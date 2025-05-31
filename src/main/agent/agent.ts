import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import dotenv from 'dotenv';
import { AgentProfile, ContextFile, ContextMessage, McpTool, QuestionData, SettingsData, ToolApprovalState, UsageReportData } from '@common/types';
import {
  APICallError,
  type CoreMessage,
  generateText,
  InvalidToolArgumentsError,
  NoSuchToolError,
  type StepResult,
  streamText,
  type Tool,
  type ToolExecutionOptions,
  type ToolSet,
} from 'ai';
import { delay, extractServerNameToolName, getActiveAgentProfile } from '@common/utils';
import { getCacheControl, getLlmProviderConfig, LlmProviderName, calculateCost } from '@common/agent';
// @ts-expect-error gpt-tokenizer is not typed
import { countTokens } from 'gpt-tokenizer/model/gpt-4o';
import { jsonSchemaToZod } from '@n8n/json-schema-to-zod';
import { Client as McpSdkClient } from '@modelcontextprotocol/sdk/client/index.js';
import { ZodSchema } from 'zod';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { parseAiderEnv } from '../utils';
import logger from '../logger';
import { Store } from '../store';
import { Project } from '../project';
import { getStoredModelData } from '../model-data-loader';

import { createPowerToolset } from './tools/power';
import { getSystemPrompt } from './prompts';
import { createAiderToolset } from './tools/aider';
import { createHelpersToolset } from './tools/helpers';
import { createLlm } from './llm-provider';
import { MCP_CLIENT_TIMEOUT, McpManager } from './mcp-manager';

import type { JsonSchema } from '@n8n/json-schema-to-zod';

export class Agent {
  private abortController: AbortController | null = null;
  private aiderEnv: Record<string, string> | null = null;
  private lastToolCallTime: number = 0;

  constructor(
    private readonly store: Store,
    private readonly mcpManager: McpManager,
  ) {}

  private invalidateAiderEnv() {
    this.aiderEnv = null;
  }

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    const aiderEnvChanged = oldSettings.aider?.environmentVariables !== newSettings.aider?.environmentVariables;
    const aiderOptionsChanged = oldSettings.aider?.options !== newSettings.aider?.options;
    if (aiderEnvChanged || aiderOptionsChanged) {
      logger.info('Aider environment or options changed, invalidating cached environment.');
      this.invalidateAiderEnv();
    }
  }

  private async getFileContentForPrompt(files: ContextFile[], project: Project): Promise<string> {
    // Common binary file extensions to exclude
    const BINARY_EXTENSIONS = new Set([
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.bmp',
      '.tiff',
      '.ico', // Images
      '.mp3',
      '.wav',
      '.ogg',
      '.flac', // Audio
      '.mp4',
      '.mov',
      '.avi',
      '.mkv', // Video
      '.zip',
      '.tar',
      '.gz',
      '.7z', // Archives
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx', // Documents
      '.exe',
      '.dll',
      '.so', // Binaries
    ]);

    const fileSections = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.resolve(project.baseDir, file.path);
          const ext = path.extname(filePath).toLowerCase();

          // Skip known binary extensions
          if (BINARY_EXTENSIONS.has(ext)) {
            logger.debug(`Skipping binary file: ${file.path}`);
            return null;
          }

          // Read file as text
          const content = await fs.readFile(filePath, 'utf8');
          return {
            path: file.path,
            content,
            readOnly: file.readOnly,
          };
        } catch (error) {
          logger.error('Error reading context file:', {
            path: file.path,
            error,
          });
          return null;
        }
      }),
    );

    return fileSections
      .filter(Boolean)
      .map((file) => {
        const filePath = path.isAbsolute(file!.path) ? path.relative(project.baseDir, file!.path) : file!.path;
        return `File: ${filePath}\n\`\`\`\n${file!.content}\n\`\`\`\n\n`;
      })
      .join('\n\n'); // Join sections into a single string
  }

  private async getContextFilesMessages(project: Project, profile: AgentProfile): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];

    if (profile.includeContextFiles) {
      const contextFiles = project.getContextFiles();
      if (contextFiles.length > 0) {
        // Separate readonly and editable files
        const [readOnlyFiles, editableFiles] = contextFiles.reduce(
          ([readOnly, editable], file) => (file.readOnly ? [[...readOnly, file], editable] : [readOnly, [...editable, file]]),
          [[], []] as [ContextFile[], ContextFile[]],
        );

        // Process readonly files first
        if (readOnlyFiles.length > 0) {
          const fileContent = await this.getFileContentForPrompt(readOnlyFiles, project);
          if (fileContent) {
            messages.push({
              role: 'user',
              content:
                'The following files are included in the Aider context for reference purposes only. These files are READ-ONLY, and their content is provided below. Do not attempt to edit these files:\n\n' +
                fileContent,
            });
            messages.push({
              role: 'assistant',
              content: 'OK, I will use these files as references and will not try to edit them.',
            });
          }
        }

        // Process editable files
        if (editableFiles.length > 0) {
          const fileContent = await this.getFileContentForPrompt(editableFiles, project);
          if (fileContent) {
            messages.push({
              role: 'user',
              content:
                'The following files are currently in the Aider context and are available for editing. Their content, as provided below, is up-to-date:\n\n' +
                fileContent,
            });
            messages.push({
              role: 'assistant',
              content:
                "OK, I understand. These are files already added in the Aider context, so I don't have to re-add them. Their content is up-to-date, so I don't have to read them again, unless I have changed them meanwhile.",
            });
          }
        }
      }
    }

    return messages;
  }

  private async getAvailableTools(project: Project, profile: AgentProfile): Promise<ToolSet> {
    const mcpConnectors = await this.mcpManager.getConnectors();

    // Build the toolSet directly from enabled clients and tools
    const toolSet: ToolSet = mcpConnectors.reduce((acc, mcpConnector) => {
      // Skip if serverName is not in the profile's enabledServers
      if (!profile.enabledServers.includes(mcpConnector.serverName)) {
        return acc;
      }

      // Process tools for this enabled server
      mcpConnector.tools.forEach((tool) => {
        const toolId = `${mcpConnector.serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`;

        // Check approval state first from the profile
        const approvalState = profile.toolApprovals[toolId];

        // Skip tools marked as 'Never' approved
        if (approvalState === ToolApprovalState.Never) {
          logger.debug(`Skipping tool due to 'Never' approval state: ${toolId}`);
          return; // Do not add the tool if it's never approved
        }

        acc[toolId] = this.convertMpcToolToAiSdkTool(profile.provider, mcpConnector.serverName, project, profile, mcpConnector.client, tool);
      });

      return acc;
    }, {} as ToolSet);

    if (profile.useAiderTools) {
      const aiderTools = createAiderToolset(project, profile);
      Object.assign(toolSet, aiderTools);
    }

    if (profile.usePowerTools) {
      const powerTools = createPowerToolset(project, profile);
      Object.assign(toolSet, powerTools);
    }

    // Add helper tools
    const helperTools = createHelpersToolset();
    Object.assign(toolSet, helperTools);

    return toolSet;
  }

  private convertMpcToolToAiSdkTool(
    providerName: LlmProviderName,
    serverName: string,
    project: Project,
    profile: AgentProfile,
    mcpClient: McpSdkClient,
    toolDef: McpTool,
  ): Tool {
    const toolId = `${serverName}${TOOL_GROUP_NAME_SEPARATOR}${toolDef.name}`;
    let zodSchema: ZodSchema;
    try {
      zodSchema = jsonSchemaToZod(this.fixInputSchema(providerName, toolDef.inputSchema));
    } catch (e) {
      logger.error(`Failed to convert JSON schema to Zod for tool ${toolDef.name}:`, e);
      // Fallback to a generic object schema if conversion fails
      zodSchema = jsonSchemaToZod({ type: 'object', properties: {} });
    }

    const execute = async (args: { [x: string]: unknown } | undefined, { toolCallId }: ToolExecutionOptions) => {
      // --- Tool Approval Logic ---
      const currentApprovalState = profile.toolApprovals[toolId] || ToolApprovalState.Always; // Default to Always

      if (currentApprovalState === ToolApprovalState.Never) {
        logger.warn(`Tool execution denied (Never): ${toolId}`);
        return `Tool execution denied by user configuration (${toolId}).`;
      }

      project.addToolMessage(toolCallId, serverName, toolDef.name, args);

      if (currentApprovalState === ToolApprovalState.Ask) {
        const questionData: QuestionData = {
          baseDir: project.baseDir,
          text: `Approve tool ${toolDef.name} from ${serverName} MCP server?`,
          subject: `${JSON.stringify(args)}`,
          defaultAnswer: 'y',
          key: toolId, // Use toolId as the key for storing the answer
        };

        // Ask the question and wait for the answer
        const [yesNoAnswer, userInput] = await project.askQuestion(questionData);

        const isApproved = yesNoAnswer === 'y';

        if (!isApproved) {
          logger.warn(`Tool execution denied by user: ${toolId}`);
          return `Tool execution denied by user.${userInput ? ` User input: ${userInput}` : ''}`;
        }
        logger.debug(`Tool execution approved by user: ${toolId}`);
      } else {
        // If Always approved
        logger.debug(`Tool execution automatically approved (Always): ${toolId}`);
      }
      // --- End Tool Approval Logic ---

      // Enforce minimum time between tool calls
      const timeSinceLastCall = Date.now() - this.lastToolCallTime;
      const currentMinTime = profile.minTimeBetweenToolCalls;
      const remainingDelay = currentMinTime - timeSinceLastCall;

      if (remainingDelay > 0) {
        logger.debug(`Delaying tool call by ${remainingDelay}ms to respect minTimeBetweenToolCalls (${currentMinTime}ms)`);
        await delay(remainingDelay);
      }

      try {
        const response = await mcpClient.callTool(
          {
            name: toolDef.name,
            arguments: args,
          },
          undefined,
          {
            timeout: MCP_CLIENT_TIMEOUT,
          },
        );

        logger.debug(`Tool ${toolDef.name} returned response`, { response });

        // Update last tool call time
        this.lastToolCallTime = Date.now();
        return response;
      } catch (error) {
        logger.error(`Error calling tool ${serverName}${TOOL_GROUP_NAME_SEPARATOR}${toolDef.name}:`, error);
        // Update last tool call time even if there's an error
        this.lastToolCallTime = Date.now();
        // Return an error message string to the agent
        return `Error executing tool ${toolDef.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

    logger.debug(`Converting MCP tool to AI SDK tool: ${toolDef.name}`, toolDef);

    return {
      description: toolDef.description ?? '',
      parameters: zodSchema,
      execute,
    };
  }

  /**
   * Fixes the input schema for various providers.
   */
  private fixInputSchema(provider: LlmProviderName, inputSchema: JsonSchema): JsonSchema {
    if (provider === 'gemini') {
      // Deep clone to avoid modifying the original schema
      const fixedSchema = JSON.parse(JSON.stringify(inputSchema));

      if (fixedSchema.properties) {
        for (const key of Object.keys(fixedSchema.properties)) {
          const property = fixedSchema.properties[key];

          if (property.anyOf) {
            property.any_of = property.anyOf;
            delete property.anyOf;
          }
          if (property.oneOf) {
            property.one_of = property.oneOf;
            delete property.oneOf;
          }
          if (property.allOf) {
            property.all_of = property.allOf;
            delete property.allOf;
          }

          // gemini does not like "default" in the schema
          if (property.default !== undefined) {
            delete property.default;
          }

          if (property.type === 'string' && property.format && !['enum', 'date-time'].includes(property.format)) {
            logger.debug(`Removing unsupported format '${property.format}' for property '${key}' in Gemini schema`);
            delete property.format;
          }

          if (!property.type || property.type === 'null') {
            property.type = 'string';
          }
        }
        if (Object.keys(fixedSchema.properties).length === 0) {
          // gemini requires at least one property in the schema
          fixedSchema.properties = {
            placeholder: {
              type: 'string',
              description: 'Placeholder property to satisfy Gemini schema requirements',
            },
          };
        }
      }

      return fixedSchema;
    }

    return inputSchema;
  }

  async runAgent(project: Project, prompt: string): Promise<ContextMessage[]> {
    const settings = this.store.getSettings();
    const profile = getActiveAgentProfile(settings, this.store.getProjectSettings(project.baseDir));
    logger.debug('AgentProfile:', profile);

    if (!profile) {
      throw new Error('No active MCP provider found');
    }

    // Create new abort controller for this run
    this.abortController = new AbortController();

    const cacheControl = getCacheControl(profile);

    // Track new messages created during this run
    const agentMessages: CoreMessage[] = [
      {
        role: 'user',
        content: prompt,
        providerOptions: {
          ...cacheControl,
        },
      },
    ];
    const messages = await this.prepareMessages(project, profile);

    // add user message
    messages.push(...agentMessages);

    try {
      // reinitialize MCP clients for the current project and wait for them to be ready
      await this.mcpManager.initMcpConnectors(settings.mcpServers, project.baseDir);
    } catch (error) {
      logger.error('Error reinitializing MCP clients:', error);
      project.addLogMessage('error', `Error reinitializing MCP clients: ${error}`);
    }

    const toolSet = await this.getAvailableTools(project, profile);

    logger.info(`Running prompt with ${Object.keys(toolSet).length} tools.`);
    logger.debug('Tools:', {
      tools: Object.keys(toolSet),
    });

    try {
      const llmProvider = getLlmProviderConfig(profile.provider, settings);
      const model = createLlm(llmProvider, profile.model, await this.getLlmEnv(project));
      const systemPrompt = await getSystemPrompt(
        project.baseDir,
        profile.useAiderTools,
        profile.usePowerTools,
        profile.includeContextFiles,
        profile.customInstructions,
      );

      // repairToolCall function that attempts to repair tool calls
      const repairToolCall = async ({ toolCall, tools, error, messages, system }) => {
        logger.warn('Error during tool call:', { error, toolCall });

        if (NoSuchToolError.isInstance(error)) {
          // If the tool doesn't exist, return a call to the helper tool
          // to inform the LLM about the missing tool.
          logger.warn(`Attempted to call non-existent tool: ${error.toolName}`);

          const matchingTool = error.availableTools?.find((availableTool) => availableTool.endsWith(`${TOOL_GROUP_NAME_SEPARATOR}${error.toolName}`));
          if (matchingTool) {
            logger.info(`Found matching tool for ${error.toolName}: ${matchingTool}. Retrying with full name.`);
            return {
              toolCallType: 'function' as const,
              toolCallId: toolCall.toolCallId,
              toolName: matchingTool,
              args: toolCall.args,
            };
          } else {
            return {
              toolCallType: 'function' as const,
              toolCallId: toolCall.toolCallId,
              toolName: `helpers${TOOL_GROUP_NAME_SEPARATOR}no_such_tool`,
              args: JSON.stringify({
                toolName: error.toolName,
                availableTools: error.availableTools,
              }),
            };
          }
        } else if (InvalidToolArgumentsError.isInstance(error)) {
          // If the arguments are invalid, return a call to the helper tool
          // to inform the LLM about the argument error.
          logger.warn(`Invalid arguments for tool: ${error.toolName}`, {
            args: error.toolArgs,
            error: error.message,
          });
          return {
            toolCallType: 'function' as const,
            toolCallId: toolCall.toolCallId,
            toolName: `helpers${TOOL_GROUP_NAME_SEPARATOR}invalid_tool_arguments`,
            args: JSON.stringify({
              toolName: error.toolName,
              toolArgs: JSON.stringify(error.toolArgs), // Pass the problematic args
              error: error.message, // Pass the validation error message
            }),
          };
        }

        // Attempt generic repair for other types of errors
        try {
          logger.info(`Attempting generic repair for tool call error: ${toolCall.toolName}`);
          const result = await generateText({
            model,
            system,
            messages: [
              ...messages,
              {
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: JSON.stringify(toolCall.args),
                  },
                ],
              },
              {
                role: 'tool' as const,
                content: [
                  {
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    result: error.message,
                  },
                ],
              },
            ],
            tools,
          });

          logger.info('Repair tool call result:', result);
          const newToolCall = result.toolCalls.find((newToolCall) => newToolCall.toolName === toolCall.toolName);
          return newToolCall != null
            ? {
                toolCallType: 'function' as const,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                // Ensure args are stringified for the AI SDK tool call format
                args: typeof newToolCall.args === 'string' ? newToolCall.args : JSON.stringify(newToolCall.args),
              }
            : null; // Return null if the LLM couldn't repair the call
        } catch (repairError) {
          logger.error('Error during tool call repair:', repairError);
          return null;
        }
      };

      let currentResponseId: null | string = null;

      const result = streamText({
        model,
        system: systemPrompt,
        messages,
        tools: toolSet,
        abortSignal: this.abortController.signal,
        maxSteps: profile.maxIterations,
        maxTokens: profile.maxTokens,
        temperature: 0, // Keep deterministic for agent behavior
        onError: ({ error }) => {
          logger.error('Error during prompt:', { error });
          if (typeof error === 'string') {
            project.addLogMessage('error', error);
            // @ts-expect-error checking keys in error
          } else if (APICallError.isInstance(error) || ('message' in error && 'responseBody' in error)) {
            project.addLogMessage('error', `${error.message}: ${error.responseBody}`);
          } else if (error instanceof Error) {
            project.addLogMessage('error', error.message);
          } else {
            project.addLogMessage('error', JSON.stringify(error));
          }
        },
        onChunk: ({ chunk }) => {
          if (chunk.type === 'text-delta') {
            currentResponseId = project.processResponseMessage({
              action: 'response',
              content: chunk.textDelta,
              finished: false,
            });
          }
        },
        onStepFinish: (stepResult) => {
          const { response, finishReason } = stepResult;

          if (finishReason === 'error') {
            logger.error('Error during prompt:', { stepResult });
            return;
          }

          // Replace agentMessages with the latest full history from the response keeping the user message
          agentMessages.length = 1;
          agentMessages.push(...response.messages);

          if (this.abortController?.signal.aborted) {
            logger.info('Prompt aborted by user');
            return;
          }

          this.processStep<typeof toolSet>(currentResponseId, stepResult, project, profile);

          currentResponseId = null;
        },
        onFinish: ({ finishReason }) => {
          logger.info(`Prompt finished. Reason: ${finishReason}`);
        },
        experimental_repairToolCall: repairToolCall,
      });

      // Consume the stream to ensure it runs to completion
      await result.consumeStream();
    } catch (error) {
      if (this.abortController?.signal.aborted) {
        logger.info('Prompt aborted by user');
        return agentMessages;
      }

      logger.error('Error running prompt:', error);
      if (error instanceof Error && (error.message.includes('API key') || error.message.includes('credentials'))) {
        project.addLogMessage('error', `Error running MCP servers. ${error.message}. Configure credentials in the Settings -> Agent -> Providers.`);
      } else {
        project.addLogMessage('error', `Error running MCP servers: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      // Clean up abort controller
      this.abortController = null;

      // Always send a final "finished" message, regardless of whether there was text or tools
      project.processResponseMessage({
        action: 'response',
        content: '',
        finished: true,
      });
    }

    return agentMessages;
  }

  private async getLlmEnv(project: Project) {
    const env = {
      ...process.env,
    };

    const homeEnvPath = path.join(homedir(), '.env');
    const projectEnvPath = path.join(project.baseDir, '.env');

    try {
      await fs.access(homeEnvPath);
      const homeEnvContent = await fs.readFile(homeEnvPath, 'utf8');
      Object.assign(env, dotenv.parse(homeEnvContent));
    } catch {
      // File does not exist or other read error, ignore
    }

    try {
      await fs.access(projectEnvPath);
      const projectEnvContent = await fs.readFile(projectEnvPath, 'utf8');
      Object.assign(env, dotenv.parse(projectEnvContent));
    } catch {
      // File does not exist or other read error, ignore
    }

    Object.assign(env, this.getAiderEnv());

    return env;
  }

  private getAiderEnv(): Record<string, string> {
    if (!this.aiderEnv) {
      this.aiderEnv = parseAiderEnv(this.store.getSettings());
    }

    return this.aiderEnv;
  }

  private async prepareMessages(project: Project, profile: AgentProfile): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];

    // Add repo map if enabled
    if (profile.includeRepoMap) {
      const repoMap = project.getRepoMap();
      if (repoMap) {
        messages.push({
          role: 'user',
          content: repoMap,
        });
        messages.push({
          role: 'assistant',
          content: 'Ok, I will use the repository map as a reference.',
        });
      }
    }

    // Add message history
    messages.push(...project.getContextMessages());

    if (profile.includeContextFiles) {
      // Get and store new context files messages
      const contextFilesMessages = await this.getContextFilesMessages(project, profile);
      messages.push(...contextFilesMessages);
    }

    return messages;
  }

  async estimateTokens(project: Project, profile: AgentProfile): Promise<number> {
    try {
      const toolSet = await this.getAvailableTools(project, profile);
      const systemPrompt = await getSystemPrompt(
        project.baseDir,
        profile.useAiderTools,
        profile.usePowerTools,
        profile.includeContextFiles,
        profile.customInstructions,
      );
      const messages = await this.prepareMessages(project, profile);

      // Format tools for the prompt
      const toolDefinitions = Object.entries(toolSet).map(([name, tool]) => ({
        name,
        description: tool.description,
        parameters: tool.parameters ? tool.parameters.describe() : '', // Get Zod schema description
      }));
      const toolDefinitionsString = `Available tools: ${JSON.stringify(toolDefinitions, null, 2)}`;

      // Add tool definitions and system prompt to the beginning
      messages.unshift({ role: 'system', content: toolDefinitionsString });
      messages.unshift({ role: 'system', content: systemPrompt });

      const chatMessages = messages.map((msg) => ({
        role: msg.role === 'tool' ? 'user' : msg.role, // Map 'tool' role to user message as gpt-tokenizer does not support tool messages
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content), // Handle potential non-string content if necessary
      }));

      return countTokens(chatMessages);
    } catch (error) {
      logger.error(`Error counting tokens: ${error}`);
      return 0;
    }
  }

  public interrupt() {
    logger.info('Interrupting MCP agent run');
    this.abortController?.abort();
  }

  private processStep<TOOLS extends ToolSet>(
    currentResponseId: string | null,
    { reasoning, text, toolCalls, toolResults, finishReason, usage, providerMetadata }: StepResult<TOOLS>,
    project: Project,
    profile: AgentProfile,
  ): void {
    logger.info(`Step finished. Reason: ${finishReason}`, {
      reasoning: reasoning?.substring(0, 100), // Log truncated reasoning
      text: text?.substring(0, 100), // Log truncated text
      toolCalls: toolCalls?.map((tc) => tc.toolName),
      toolResults: toolResults?.map((tr) => tr.toolName),
      usage,
      providerMetadata,
    });

    const modelData = getStoredModelData(); // Get the loaded model data
    const messageCost = calculateCost(profile, modelData, usage.promptTokens, usage.completionTokens, providerMetadata);
    const usageReport: UsageReportData = {
      sentTokens: usage.promptTokens,
      receivedTokens: usage.completionTokens,
      messageCost: messageCost,
      agentTotalCost: project.agentTotalCost + messageCost,
    };

    // Process text/reasoning content
    if (reasoning || text) {
      project.processResponseMessage({
        id: currentResponseId,
        action: 'response',
        content:
          reasoning && text
            ? `---
► **THINKING**
${reasoning.trim()}
---
► **ANSWER**
${text.trim()}`
            : reasoning || text,
        finished: true,
        usageReport,
      });
      project.addLogMessage('loading');
    }

    if (toolResults) {
      // Process successful tool results *after* sending text/reasoning and handling errors
      for (const toolResult of toolResults) {
        const [serverName, toolName] = extractServerNameToolName(toolResult.toolName);
        // Update the existing tool message with the result
        project.addToolMessage(toolResult.toolCallId, serverName, toolName, toolResult.args, JSON.stringify(toolResult.result), usageReport);
      }
    }
  }
}
