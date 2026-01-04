import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  TASKS_TOOL_CREATE_TASK,
  TASKS_TOOL_DELETE_TASK,
  TASKS_TOOL_DESCRIPTIONS,
  TASKS_TOOL_GET_TASK,
  TASKS_TOOL_GET_TASK_MESSAGE,
  TASKS_TOOL_GROUP_NAME,
  TASKS_TOOL_LIST_TASKS,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';
import { AgentProfile, PromptContext, TaskData, ToolApprovalState } from '@common/types';

import { ApprovalManager } from './approval-manager';

import { Task } from '@/task';

export const createTasksToolset = (task: Task, profile: AgentProfile, promptContext?: PromptContext): ToolSet => {
  const approvalManager = new ApprovalManager(task, profile);

  const listTasksTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_LIST_TASKS],
    inputSchema: z.object({
      offset: z.number().optional().describe('The number of tasks to skip (for pagination)'),
      limit: z.number().optional().default(20).describe('The maximum number of tasks to return (default: 20)'),
      state: z.string().optional().describe('Filter tasks by state (e.g., TODO, IN_PROGRESS, DONE)'),
    }),
    execute: async ({ offset = 0, limit = 20, state }, { toolCallId }) => {
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_LIST_TASKS, { offset, limit, state }, undefined, undefined, promptContext);

      const questionKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_LIST_TASKS}`;
      const questionText = 'Approve listing tasks?';
      const questionSubject = `Offset: ${offset}, Limit: ${limit}, State: ${state || 'all'}`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Listing tasks denied by user. Reason: ${userInput}`;
      }

      try {
        let allTasks = await task.getProject().getTasks();

        // Filter by state if provided
        if (state) {
          allTasks = allTasks.filter((t) => t.state === state);
        }

        // Apply pagination
        const startIndex = Math.max(0, offset);
        const endIndex = startIndex + Math.max(0, limit);
        const paginatedTasks = allTasks.slice(startIndex, endIndex);

        return paginatedTasks.map((t) => ({
          id: t.id,
          name: t.name,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          archived: t.archived,
          state: t.state,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error listing tasks: ${errorMessage}`;
      }
    },
  });

  const getTaskTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_GET_TASK],
    inputSchema: z.object({
      taskId: z.string().describe('The ID of the task to get information for'),
    }),
    execute: async ({ taskId }, { toolCallId }) => {
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_GET_TASK, { taskId }, undefined, undefined, promptContext);

      const questionKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK}`;
      const questionText = `Approve getting information for task ${taskId}?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Getting task information denied by user. Reason: ${userInput}`;
      }

      try {
        const targetTask = task.getProject().getTask(taskId);

        if (!targetTask) {
          return `Task with ID ${taskId} not found`;
        }

        const contextMessages = await targetTask.getContextMessages();
        const contextFiles = await targetTask.getContextFiles();

        return {
          id: targetTask.task.id,
          name: targetTask.task.name,
          createdAt: targetTask.task.createdAt,
          updatedAt: targetTask.task.updatedAt,
          contextFiles: contextFiles.map((f) => ({ path: f.path, readOnly: f.readOnly })),
          contextMessagesCount: contextMessages.length,
          agentProfileId: targetTask.task.agentProfileId,
          provider: targetTask.task.provider,
          model: targetTask.task.model,
          mode: targetTask.task.currentMode,
          archived: targetTask.task.archived,
          state: targetTask.task.state,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error getting task: ${errorMessage}`;
      }
    },
  });

  const getTaskMessageTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_GET_TASK_MESSAGE],
    inputSchema: z.object({
      taskId: z.string().describe('The ID of the task'),
      messageIndex: z
        .number()
        .describe(
          'The index of the message to retrieve (0-based). Use negative numbers to count from the end: -1 for last message, -2 for second to last, etc.',
        ),
    }),
    execute: async ({ taskId, messageIndex }, { toolCallId }) => {
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_GET_TASK_MESSAGE, { taskId, messageIndex }, undefined, undefined, promptContext);

      const questionKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK_MESSAGE}`;
      const questionText = `Approve retrieving message ${messageIndex} from task ${taskId}?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Retrieving task message denied by user. Reason: ${userInput}`;
      }

      try {
        const targetTask = task.getProject().getTask(taskId);

        if (!targetTask) {
          return `Task with ID ${taskId} not found`;
        }

        const contextMessages = await targetTask.getContextMessages();

        // Handle negative indexing
        let actualIndex = messageIndex;
        if (messageIndex < 0) {
          actualIndex = contextMessages.length + messageIndex; // e.g., -1 becomes length-1
        }

        if (actualIndex < 0 || actualIndex >= contextMessages.length) {
          return `Message index ${messageIndex} out of range. Task has ${contextMessages.length} messages (0-${contextMessages.length - 1}, or -1 to -${contextMessages.length})`;
        }

        const message = contextMessages[actualIndex];

        return {
          index: actualIndex,
          originalIndex: messageIndex,
          role: message.role,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          usageReport: message.usageReport,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error getting task message: ${errorMessage}`;
      }
    },
  });

  const createTaskTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_CREATE_TASK],
    inputSchema: z.object({
      prompt: z.string().describe('The initial prompt for the new task'),
      agentProfileId: z.string().optional().describe('Optional agent profile ID to use for the task'),
      modelId: z.string().optional().describe('Optional model ID to use for the task'),
      execute: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, the task will be created and executed with the initial prompt. If false, only the task is created without executing.'),
      executeInBackground: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, the task will be created and executed in the background. Only applicable if execute is true.'),
    }),
    execute: async (args, { toolCallId }) => {
      const { prompt, agentProfileId, modelId, execute: shouldExecute, executeInBackground } = args;
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_CREATE_TASK, args, undefined, undefined, promptContext);

      const questionKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_CREATE_TASK}`;
      const questionText = 'Approve creating a new task?';
      const questionSubject = `Prompt: ${prompt}\nAgent Profile: ${agentProfileId || 'default'}\nModel: ${modelId || 'default'}\nExecute: ${shouldExecute}`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Creating task denied by user. Reason: ${userInput}`;
      }

      try {
        const newTask = await task.getProject().createNewTask();
        const updates: Partial<TaskData> = {};

        if (agentProfileId) {
          updates.agentProfileId = agentProfileId;
        }

        if (modelId) {
          // Parse modelId to extract provider and model
          const [provider, ...modelParts] = modelId.split('/');
          updates.provider = provider;
          updates.model = modelParts.join('/');
          updates.mainModel = modelId;
        }

        // createNewTask returns TaskData, not Task instance
        // We need to get the actual Task instance to call methods on it
        const taskInstance = task.getProject().getTask(newTask.id);
        if (!taskInstance) {
          throw new Error(`Failed to get task instance for newly created task ${newTask.id}`);
        }

        await taskInstance.init();
        await taskInstance.saveTask(updates);

        if (shouldExecute) {
          const run = taskInstance.runPrompt(prompt, 'agent', false);
          if (!executeInBackground) {
            await run;
          }
        } else {
          await taskInstance.savePromptOnly(prompt, false);
        }

        return {
          id: newTask.id,
          name: newTask.name,
          message: shouldExecute ? 'Task created and executed successfully' : 'Task created successfully',
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error creating task: ${errorMessage}`;
      }
    },
  });

  const deleteTaskTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_DELETE_TASK],
    inputSchema: z.object({
      taskId: z.string().describe('The ID of the task to delete'),
    }),
    execute: async ({ taskId }, { toolCallId }) => {
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_DELETE_TASK, { taskId }, undefined, undefined, promptContext);

      const questionKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_DELETE_TASK}`;
      const questionText = `Approve deleting task ${taskId}? This action cannot be undone.`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Deleting task denied by user. Reason: ${userInput}`;
      }

      try {
        // Prevent deleting the current task
        if (taskId === task.taskId) {
          return 'Cannot delete the current task';
        }

        await task.getProject().deleteTask(taskId);
        return `Task ${taskId} deleted successfully`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error deleting task: ${errorMessage}`;
      }
    },
  });

  const allTools = {
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_LIST_TASKS}`]: listTasksTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK}`]: getTaskTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK_MESSAGE}`]: getTaskMessageTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_CREATE_TASK}`]: createTaskTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_DELETE_TASK}`]: deleteTaskTool,
  };

  const filteredTools: ToolSet = {};
  for (const [toolId, tool] of Object.entries(allTools)) {
    if (profile.toolApprovals[toolId] !== ToolApprovalState.Never) {
      filteredTools[toolId] = tool;
    }
  }

  return filteredTools;
};
