import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';

import { AgentProfile, SettingsData, ToolApprovalState, ConflictResolutionFileContext } from '@common/types';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_BASH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  SUBAGENTS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_RUN_TASK,
  TODO_TOOL_CLEAR_ITEMS,
  TODO_TOOL_GET_ITEMS,
  TODO_TOOL_GROUP_NAME,
  TODO_TOOL_SET_ITEMS,
  TODO_TOOL_UPDATE_ITEM_COMPLETION,
  TOOL_GROUP_NAME_SEPARATOR,
  MEMORY_TOOL_DELETE,
  MEMORY_TOOL_GROUP_NAME,
  MEMORY_TOOL_LIST,
  MEMORY_TOOL_RETRIEVE,
  MEMORY_TOOL_STORE,
  SKILLS_TOOL_ACTIVATE_SKILL,
  SKILLS_TOOL_GROUP_NAME,
} from '@common/tools';

import { TemplateCompiler } from './templates/compiler/template-compiler';
import {
  SystemPromptData,
  InitProjectPromptData,
  CompactConversationPromptData,
  CommitMessagePromptData,
  ConflictResolutionSystemPromptData,
  ConflictResolutionPromptData,
  ToolPermissions,
} from './templates/types';

import logger from '@/logger';
import { Task } from '@/task';

const templateCompiler = new TemplateCompiler();

export const initializeTemplates = async (): Promise<void> => {
  await templateCompiler.compileAll();
};

const calculateToolPermissions = (settings: SettingsData, agentProfile: AgentProfile, autoApprove: boolean): ToolPermissions => {
  const { usePowerTools = false, useMemoryTools = false, useSkillsTools = false } = agentProfile;
  const memoryEnabled = settings.memory.enabled && useMemoryTools;

  const isAllowed = (tool: string) => agentProfile.toolApprovals[`${tool}`] !== ToolApprovalState.Never;

  return {
    aiderTools: agentProfile.useAiderTools,
    powerTools: {
      semanticSearch: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_SEMANTIC_SEARCH}`),
      fileRead: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`),
      fileWrite: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`),
      fileEdit: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`),
      glob: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GLOB}`),
      grep: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`),
      bash: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`),
      anyEnabled: false, // Will be set below
    },
    todoTools: agentProfile.useTodoTools,
    subagents: agentProfile.useSubagents ?? false,
    memory: {
      enabled: memoryEnabled,
      retrieveAllowed: memoryEnabled && isAllowed(`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_RETRIEVE}`),
      storeAllowed: memoryEnabled && isAllowed(`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_STORE}`),
      listAllowed: memoryEnabled && isAllowed(`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_LIST}`),
      deleteAllowed: memoryEnabled && isAllowed(`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_DELETE}`),
    },
    skills: {
      allowed: useSkillsTools && isAllowed(`${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`),
    },
    autoApprove,
  };
};

export const getSystemPrompt = async (
  settings: SettingsData,
  task: Task,
  agentProfile: AgentProfile,
  autoApprove = task.task.autoApprove ?? false,
  additionalInstructions?: string,
) => {
  const toolPermissions = calculateToolPermissions(settings, agentProfile, autoApprove);
  toolPermissions.powerTools.anyEnabled = Object.values(toolPermissions.powerTools).some((v) => v);

  const rulesFiles = await getRulesContent(task, agentProfile);
  const customInstructions = [agentProfile.customInstructions, additionalInstructions].filter(Boolean).join('\n\n').trim();

  const osName = (await import('os-name')).default();
  const currentDate = new Date().toDateString();

  const data: SystemPromptData = {
    projectDir: task.getProjectDir(),
    taskDir: task.getTaskDir(),
    agentProfile,
    additionalInstructions,
    osName,
    currentDate,
    rulesFiles,
    customInstructions,
    toolPermissions,
    workflow: '', // Placeholder
    projectGitRootDirectory: task.getTaskDir() !== task.getProjectDir() ? task.getProjectDir() : undefined,
    toolConstants: {
      SUBAGENTS_TOOL_GROUP_NAME,
      SUBAGENTS_TOOL_RUN_TASK,
      TOOL_GROUP_NAME_SEPARATOR,
      TODO_TOOL_GROUP_NAME,
      TODO_TOOL_GET_ITEMS,
      TODO_TOOL_CLEAR_ITEMS,
      TODO_TOOL_SET_ITEMS,
      TODO_TOOL_UPDATE_ITEM_COMPLETION,
      MEMORY_TOOL_GROUP_NAME,
      MEMORY_TOOL_RETRIEVE,
      MEMORY_TOOL_LIST,
      MEMORY_TOOL_DELETE,
      AIDER_TOOL_GROUP_NAME,
      AIDER_TOOL_RUN_PROMPT,
      AIDER_TOOL_ADD_CONTEXT_FILES,
      AIDER_TOOL_GET_CONTEXT_FILES,
      AIDER_TOOL_DROP_CONTEXT_FILES,
      POWER_TOOL_GROUP_NAME,
      POWER_TOOL_SEMANTIC_SEARCH,
      POWER_TOOL_FILE_READ,
      POWER_TOOL_FILE_WRITE,
      POWER_TOOL_FILE_EDIT,
      POWER_TOOL_GLOB,
      POWER_TOOL_GREP,
      POWER_TOOL_BASH,
    },
  };

  data.workflow = templateCompiler.render('workflow', data);

  return templateCompiler.render('system-prompt', data);
};

const getRulesContent = async (task: Task, agentProfile?: AgentProfile) => {
  const ruleFiles = await task.getRuleFilesAsContextFiles(agentProfile);
  const agentsFilePath = path.join(task.getProjectDir(), 'AGENTS.md');

  const ruleFilesContent = await Promise.all(
    ruleFiles.map(async (file) => {
      try {
        let absolutePath: string;
        if (file.path.startsWith('~/')) {
          const homeDir = (await import('os')).homedir();
          absolutePath = path.join(homeDir, file.path.slice(2));
        } else if (path.isAbsolute(file.path)) {
          absolutePath = file.path;
        } else {
          absolutePath = path.join(task.getProjectDir(), file.path);
        }

        const content = await fsPromises.readFile(absolutePath, 'utf8');
        const fileName = path.basename(file.path);
        return `      <File name="${fileName}"><![CDATA[\n${content}\n]]></File>`;
      } catch (err) {
        logger.warn(`Failed to read rule file ${file.path}: ${err}`);
        return null;
      }
    }),
  );

  const agentsFileContent = fs.existsSync(agentsFilePath)
    ? `      <File name="AGENTS.md"><![CDATA[\n${fs.readFileSync(agentsFilePath, 'utf8')}\n]]></File>`
    : '';

  return [agentsFileContent, ...ruleFilesContent].filter(Boolean).join('\n');
};

export const getInitProjectPrompt = () => {
  const data: InitProjectPromptData = {};
  return templateCompiler.render('init-project', data);
};

export const getCompactConversationPrompt = (customInstructions?: string) => {
  const data: CompactConversationPromptData = { customInstructions };
  return templateCompiler.render('compact-conversation', data);
};

export const getGenerateCommitMessagePrompt = () => {
  const data: CommitMessagePromptData = {};
  return templateCompiler.render('commit-message', data);
};

export const getConflictResolutionSystemPrompt = () => {
  const data: ConflictResolutionSystemPromptData = {
    POWER_TOOL_GROUP_NAME,
    TOOL_GROUP_NAME_SEPARATOR,
    POWER_TOOL_FILE_EDIT,
  };
  return templateCompiler.render('conflict-resolution-system', data);
};

export const getConflictResolutionPrompt = (
  filePath: string,
  ctx: ConflictResolutionFileContext & {
    basePath?: string;
    oursPath?: string;
    theirsPath?: string;
  },
) => {
  const data: ConflictResolutionPromptData = {
    filePath,
    basePath: ctx.basePath,
    oursPath: ctx.oursPath,
    theirsPath: ctx.theirsPath,
  };
  return templateCompiler.render('conflict-resolution', data);
};
