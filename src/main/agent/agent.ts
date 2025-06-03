import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import dotenv from 'dotenv';
import { AgentProfile, ContextFile, ContextMessage, McpTool, SettingsData, ToolApprovalState, UsageReportData } from '@common/types';
import {
  APICallError,
  addLanguageModelUsage, // Added
  APICallError,
  type CoreMessage,
  calculateLanguageModelUsage, // Added
  executeTools,
  generateText,
  InvalidToolArgumentsError,
  NoSuchToolError,
  parseToolCall,
  type StepResult,
  streamText,
  toResponseMessages,
  type Tool,
  type ToolExecutionOptions,
  type ToolSet,
} from 'ai';
import { delay, extractServerNameToolName, getActiveAgentProfile } from '@common/utils';
import { getLlmProviderConfig, LlmProviderName } from '@common/agent';
// @ts-expect-error gpt-tokenizer is not typed
import { countTokens } from 'gpt-tokenizer/model/gpt-4o';
import { jsonSchemaToZod } from '@n8n/json-schema-to-zod';
import { Client as McpSdkClient } from '@modelcontextprotocol/sdk/client/index.js';
import { ZodSchema } from 'zod';
import { nanoid } from 'nanoid'; // Added
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { TelemetryManager } from 'src/main/telemetry-manager';
import { ModelInfoManager } from 'src/main/model-info-manager';

import { parseAiderEnv } from '../utils';
import logger from '../logger';
import { Store } from '../store';
import { Project } from '../project';

import { createPowerToolset } from './tools/power';
import { getSystemPrompt } from './prompts';
import { createAiderToolset } from './tools/aider';
import { createHelpersToolset } from './tools/helpers';
import { calculateCost, createLlm, getCacheControl, getProviderOptions } from './llm-provider';
import { MCP_CLIENT_TIMEOUT, McpManager } from './mcp-manager';
import { ApprovalManager } from './tools/approval-manager';

import type { JsonSchema } from '@n8n/json-schema-to-zod';

export class Agent {
  private abortController: AbortController | null = null;
  private aiderEnv: Record<string, string> | null = null;
  private lastToolCallTime: number = 0;

  constructor(
    private readonly store: Store,
    private readonly mcpManager: McpManager,
    private readonly modelInfoManager: ModelInfoManager,
    private readonly telemetryManager: TelemetryManager,
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

  private async getWorkingFilesMessages(project: Project): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];
    const contextFiles = project.getContextFiles();

    if (contextFiles.length > 0) {
      const fileList = contextFiles
        .map((file) => {
          return `- ${file.path}`;
        })
        .join('\n');

      messages.push({
        role: 'user',
        content: `The following files are currently in the working context:\n\n${fileList}`,
      });
      messages.push({
        role: 'assistant',
        content: 'OK, I have noted the files in the context.',
      });
    }

    return messages;
  }

  private async getAvailableTools(project: Project, profile: AgentProfile): Promise<ToolSet> {
    const mcpConnectors = await this.mcpManager.getConnectors();
    const approvalManager = new ApprovalManager(project, profile);

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

        acc[toolId] = this.convertMpcToolToAiSdkTool(profile.provider, mcpConnector.serverName, project, profile, mcpConnector.client, tool, approvalManager);
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
    approvalManager: ApprovalManager,
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
      project.addToolMessage(toolCallId, serverName, toolDef.name, args);

      // --- Tool Approval Logic ---
      const questionKey = toolId;
      const questionText = `Approve tool ${toolDef.name} from ${serverName} MCP server?`;
      const questionSubject = args ? JSON.stringify(args) : undefined;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, questionSubject);

      if (!isApproved) {
        logger.warn(`Tool execution denied by user: ${toolId}`);
        return `Tool execution denied by user.${userInput ? ` User input: ${userInput}` : ''}`;
      }
      logger.debug(`Tool execution approved: ${toolId}`);
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
      throw new Error('No active Agent profile found');
    }

    this.telemetryManager.captureAgentRun(profile);

    // Create new abort controller for this run
    this.abortController = new AbortController();

    const llmProvider = getLlmProviderConfig(profile.provider, settings);
    const cacheControl = getCacheControl(profile);
    const providerOptions = getProviderOptions(llmProvider);

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

    // --- Start of new variable initializations ---
    let stepCount = 0;
    const initialResponseMessages = [...messages]; // messages is from prepareMessages + user prompt
    let currentModelResponse: CoreMessage | undefined = undefined;
    let currentToolCalls: unknown[] = []; // Define more specific types later if possible
    let currentToolResults: unknown[] = []; // Define more specific types later if possible
    let accumulatedText = "";
    let usage = { completionTokens: 0, promptTokens: 0, totalTokens: 0 };
    let stepType = "initial"; // Or choose a more appropriate starting step type name
    const allResponseMessages = [...initialResponseMessages]; // This will accumulate all messages through steps
    const steps: StepResult<typeof toolSet>[] = []; // To store step results, similar to Vercel SDK
    let currentResponseId: string | null = null; // As per request, ensure usable in loop
    // --- End of new variable initializations ---

    while (stepType !== "done") {
      // Define mode for the model call for the current step
      const mode = {
        type: 'regular' as const,
        tools: toolSet && Object.keys(toolSet).length > 0 ? Object.values(toolSet) : undefined,
        toolChoice: toolSet && Object.keys(toolSet).length > 0 ? 'auto' as const : undefined,
      };

      // Ensure model and systemPrompt are available in this scope
      // model and systemPrompt are defined in the try block enclosing this while loop
      const model = createLlm(llmProvider, profile.model, await this.getLlmEnv(project)); // This might need to be outside the loop if it's expensive/stateful
      const systemPrompt = await getSystemPrompt(project.baseDir, profile); // Similarly, this could be outside

      // Make the call to model.doStream
      const streamResult = await model.doStream({
        system: systemPrompt,
        prompt: [...allResponseMessages], // Use a copy
        mode: mode,
        maxTokens: profile.maxTokens,
        temperature: 0, // Keep deterministic for agent behavior
        providerMetadata: providerOptions, // Contains cacheControl
        abortSignal: this.abortController.signal,
        // Note: Other settings like inputFormat, responseFormat might be needed depending on the model implementation
      });

      // Initialize variables to accumulate results from the stream for the current step
      let streamedText = "";
      let streamedToolCalls: CoreMessage.ToolCall[] = []; // More specific type
      let streamedFinishReason: string | null = null; // type should be FinishReason
      let streamedUsage: { promptTokens: number; completionTokens: number } = { promptTokens: 0, completionTokens: 0 };
      let streamedWarnings: CoreMessage.Warning[] | undefined = undefined; // More specific type
      let streamedRawResponse: { id?: string; timestamp?: Date; modelId?: string } | undefined = undefined; // Adjust as per actual rawResponse structure
      let streamedProviderMetadata: Record<string, any> | undefined = undefined;

      // Iterate over streamResult.stream
      for await (const part of streamResult.stream) {
        if (this.abortController.signal.aborted) {
          logger.info('Streaming aborted by user during model call.');
          streamedFinishReason = 'abort';
          break;
        }

        switch (part.type) {
          case 'text-delta':
            streamedText += part.textDelta;
            currentResponseId = project.processResponseMessage({
              action: 'response',
              content: part.textDelta,
              finished: false,
              // id: currentResponseId, // processResponseMessage can manage this
            });
            break;
          case 'tool-call':
            streamedToolCalls.push(part.toolCall);
            break;
          case 'finish':
            streamedFinishReason = part.finishReason as string; // Cast to string
            streamedUsage = part.usage;
            streamedWarnings = part.warnings;
            streamedRawResponse = part.rawResponse as { id?: string; timestamp?: Date; modelId?: string }; // Cast as needed
            streamedProviderMetadata = part.providerMetadata;
            break;
          case 'error':
            logger.error('Error during model stream:', part.error);
            const error = part.error;
            if (typeof error === 'string') {
              project.addLogMessage('error', error);
            } else if (APICallError.isInstance(error) || ('message' in error && 'responseBody' in error)) {
              // @ts-expect-error error has responseBody if it's an APICallError like structure
              project.addLogMessage('error', `${error.message}: ${error.responseBody}`);
            } else if (error instanceof Error) {
              project.addLogMessage('error', error.message);
            } else {
              project.addLogMessage('error', JSON.stringify(error));
            }
            streamedFinishReason = 'error';
            // Potentially set stepType to 'done' or handle error to allow retry/repair
            stepType = "done"; // Exit loop on stream error for now
            break;
        }
      }

      // Construct currentModelResponse from accumulated streamed data
      currentModelResponse = {
        text: streamedText,
        toolCalls: streamedToolCalls, // These are of type CoreMessage.ToolCall
        finishReason: streamedFinishReason,
        usage: streamedUsage,
        warnings: streamedWarnings,
        rawResponse: streamedRawResponse,
        providerMetadata: streamedProviderMetadata,
        // Emulate the structure that processStep might expect from onStepFinish's stepResult.response
        response: {
          id: streamedRawResponse?.id || `response-${Date.now()}`, // Example ID
          timestamp: streamedRawResponse?.timestamp || new Date(),
          modelId: streamedRawResponse?.modelId || profile.model,
          messages: [...allResponseMessages], // This will be updated later with assistant's response
        }
      };

      // Aggregate usage from the current step
      if (currentModelResponse.usage) {
        const currentStepUsage = calculateLanguageModelUsage(currentModelResponse.usage);
        usage = addLanguageModelUsage(usage, currentStepUsage);
      }

      // TODO: Process currentModelResponse (e.g., call tools, update allResponseMessages, decide next stepType)
      // For now, this is where the old onStepFinish logic would partially go.
      // We'll need to adapt processStep or replicate its relevant parts here.

      // --- Start: Process text and parse tool calls from currentModelResponse ---
      const currentStepText = currentModelResponse.text || "";
      accumulatedText += currentStepText; // Simple accumulation for now

      let currentStepToolCalls: { toolCallId: string, toolName: string, args: any }[] = []; // Type for parsed tool calls
      const parsedToolCallsThisStep = [];
      if (currentModelResponse.toolCalls && currentModelResponse.toolCalls.length > 0) {
        for (const tc of currentModelResponse.toolCalls) { // tc is a LanguageModelToolCall from the model stream
          let repairedTcToParse = null; // Holds the result of repairToolCall if needed

          // Ensure args is a string for the initial parse attempt
          let argsForInitialParse: string;
          if (typeof tc.args === 'string') {
            argsForInitialParse = tc.args;
          } else {
            argsForInitialParse = JSON.stringify(tc.args);
          }
          const initialToolCallToParse = {
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: argsForInitialParse,
          };

          try {
            // First attempt to parse the original tool call
            const parsedTc = await parseToolCall({
              toolCall: initialToolCallToParse, // Use the version with stringified args
              tools: toolSet,
            });
            parsedToolCallsThisStep.push(parsedTc);
          } catch (error) {
            // Initial parsing failed, attempt to repair
            logger.warn(`Initial parsing failed for tool call ${tc.toolCallId} (${tc.toolName}), attempting repair. Error:`, error);

            const repairedCallData = await repairToolCall({
              toolCall: tc, // Pass original tc (with potentially non-string args) to repairToolCall
              tools: toolSet,
              error: error, // Pass the original error
              messages: [...allResponseMessages], // Context for repair
              system: systemPrompt,
              // model: model, // repairToolCall has access to model via closure from the outer scope
            });

            if (repairedCallData && repairedCallData.toolCallId) {
              let argsForRepairedParse: string;
              if (typeof repairedCallData.args === 'string') {
                argsForRepairedParse = repairedCallData.args;
              } else {
                argsForRepairedParse = JSON.stringify(repairedCallData.args);
              }

              repairedTcToParse = {
                toolCallId: repairedCallData.toolCallId,
                toolName: repairedCallData.toolName,
                args: argsForRepairedParse,
              };

              logger.info(`Tool call ${tc.toolCallId} repaired. Attempting to parse repaired call:`, repairedTcToParse);
              try {
                const parsedRepairedTc = await parseToolCall({
                  toolCall: repairedTcToParse,
                  tools: toolSet,
                });
                parsedToolCallsThisStep.push(parsedRepairedTc);
              } catch (repairedParsingError) {
                logger.error(`Failed to parse *repaired* tool call ${repairedTcToParse.toolCallId}. Original error: ${error?.message}. Repair error: ${repairedParsingError?.message}`);
                project.addLogMessage('error', `Failed to parse repaired tool call ${repairedTcToParse.toolCallId}: ${repairedParsingError.message}`);
                stepType = 'done';
                streamedFinishReason = 'error';
                break;
              }
            } else {
              logger.error(`Tool call ${tc.toolCallId} could not be repaired. Original error: ${error?.message}.`);
              project.addLogMessage('error', `Unrepairable tool call ${tc.toolCallId}: ${error.message}`);
              stepType = 'done';
              streamedFinishReason = 'error';
              break;
            }
          }
        }
      }
      // Only assign if we haven't aborted the step by setting stepType = 'done'
      if (stepType !== 'done') {
        currentStepToolCalls = parsedToolCallsThisStep;
      } else {
        currentStepToolCalls = []; // Clear any partially parsed calls if step was aborted
      }
      logger.debug('Parsed step tool calls (after repair attempt):', currentStepToolCalls);
      // --- End: Process text and parse tool calls ---

      // --- Start: Execute parsed tool calls ---
      let currentStepToolResults: { toolCallId: string, toolName: string, args: any, result: any, isError?: boolean }[] = [];
      if (currentStepToolCalls && currentStepToolCalls.length > 0 && toolSet) {
        try {
          currentStepToolResults = await executeTools({
            toolCalls: currentStepToolCalls, // These are already parsed and args are objects
            tools: toolSet,
            messages: [...allResponseMessages], // Pass current messages for context
            abortSignal: this.abortController.signal,
            // Optional: Pass tracer or telemetry if available and needed by your executeTools version or tool implementations
          });
          logger.debug('Tool execution results:', currentStepToolResults);
        } catch (error) {
          logger.error('Critical error during executeTools call:', error);
          // This catch is for fundamental errors in executeTools setup or unexpected issues,
          // as individual tool errors are typically returned within the results array.
          project.addLogMessage('error', `Critical error during tool execution: ${error instanceof Error ? error.message : String(error)}`);
          stepType = 'done'; // Halt on critical executeTools error
        }
      }
      // --- End: Execute parsed tool calls ---

      // --- Start: Update messages, determine next step, and call processStep ---

      // Update allResponseMessages with the latest assistant message and tool results
      const newMessages = toResponseMessages({
        text: currentStepText, // Text from the current model response
        toolCalls: currentModelResponse.toolCalls || [], // Raw tool calls from the model
        toolResults: currentStepToolResults, // Results from executeTools
        messageId: () => nanoid(), // Generate unique IDs for new messages
      });
      allResponseMessages.push(...newMessages);

      stepCount++; // Increment step count after a step has been processed

      let nextStepLogic = "default_done";

      if (currentModelResponse.finishReason === 'abort') {
        logger.info('Run aborted by user.');
        nextStepLogic = "done_aborted";
      } else if (stepCount >= profile.maxIterations) {
        logger.info(`Max iterations (${profile.maxIterations}) reached.`);
        nextStepLogic = "done_max_iterations";
      } else if (currentModelResponse.finishReason === 'tool-calls') {
        if (currentStepToolCalls && currentStepToolCalls.length > 0) {
          nextStepLogic = "needs_model_call_for_tool_results";
        } else {
          logger.warn("Model finishReason was 'tool-calls' but no tool calls were parsed/provided.");
          nextStepLogic = "done_unexpected_state_tool_calls_no_calls";
        }
      } else if (currentModelResponse.finishReason === 'length') {
        logger.info("Model finishReason was 'length', indicating continuation may be needed.");
        nextStepLogic = "needs_model_call_for_continuation";
      } else if (currentModelResponse.finishReason === 'stop') {
        // If finishReason is 'stop', but we did have tool calls that were just executed,
        // we should loop back to the model with the tool results.
        if (currentStepToolCalls && currentStepToolCalls.length > 0) {
          nextStepLogic = "needs_model_call_for_tool_results";
        } else {
          nextStepLogic = "done_model_stopped";
        }
      } else if (currentModelResponse.finishReason === 'error') {
        logger.info("Model stream ended with error. Step type set to done by stream error handling or here.");
        nextStepLogic = "done_model_error";
      } else if (currentStepToolCalls && currentStepToolCalls.length > 0) {
        // This case handles scenarios where tools were called (e.g. model output text and tool_calls)
        // but the finishReason might not have been 'tool-calls' explicitly (e.g. some models might output
        // tool calls and then 'stop'). We've executed tools, so we need to feed results back.
        nextStepLogic = "needs_model_call_for_tool_results";
      } else {
        logger.warn(`Unhandled finish reason: '${currentModelResponse.finishReason}' or no tool calls to process. Assuming current step is final.`);
        nextStepLogic = "done_unhandled_reason";
      }

      if (nextStepLogic.startsWith("done")) {
        stepType = "done";
      } else {
        stepType = "processing"; // Continue the loop
      }

      // Construct StepResult for this.processStep
      // Ensure currentModelResponse and its fields are defined before accessing
      const usageForStep = currentModelResponse.usage || { promptTokens: 0, completionTokens: 0 };
      const responseForStep = currentModelResponse.response || {
        id: nanoid(),
        timestamp: new Date(),
        modelId: profile.model,
        messages: [], // This should be the messages up to the point of this response
      };

      const stepResultForCallback: StepResult<typeof toolSet> = {
        text: currentStepText, // Text from the model for this step
        toolCalls: currentModelResponse.toolCalls || [], // Raw tool calls from model for this step
        toolResults: currentStepToolResults, // Results of execution for this step
        finishReason: currentModelResponse.finishReason || 'unknown', // Ensure finishReason is not null/undefined
        usage: usageForStep,
        providerMetadata: currentModelResponse.providerMetadata,
        warnings: currentModelResponse.warnings,
        response: { // This 'response' object for processStep might need specific fields
          id: responseForStep.id,
          timestamp: responseForStep.timestamp,
          modelId: responseForStep.modelId,
          messages: [...allResponseMessages], // Pass the fully updated message history
        },
        // Optional fields like reasoning, files, sources, logprobs can be added if available
      };

      this.processStep(currentResponseId, stepResultForCallback, project, profile);
      currentResponseId = null; // Reset for the next potential message stream

      steps.push(stepResultForCallback); // Store step result

      // --- End: Update messages, determine next step, and call processStep ---
    }

    // --- Start: onFinish logic (after while loop) ---
    const finalFinishReason = currentModelResponse?.finishReason || (streamedFinishReason === 'abort' ? 'abort' : (stepCount >= profile.maxIterations ? 'max_iterations' : 'unknown'));
    // Note: streamedFinishReason would hold 'error' if stream errored.
    // currentModelResponse.finishReason would be from the last successful model interaction.

    logger.info(`Agent run finished. Reason: ${finalFinishReason}, Steps: ${stepCount}`);
    logger.info('Total usage for the run:', usage);
    // --- End: onFinish logic ---

    try {
      // const model = createLlm(llmProvider, profile.model, await this.getLlmEnv(project)); // Moved into loop
      // const systemPrompt = await getSystemPrompt(project.baseDir, profile); // Moved into loop

      // repairToolCall function that attempts to repair tool calls
      // This repairToolCall was part of the old streamText. We might need a similar mechanism for doStream if it doesn't handle it.
      // For now, this is not directly used by doStream in the loop above.
      const repairToolCall = async ({ toolCall, tools, error, messages, system }) => {
        logger.warn('Error during tool call (Note: repairToolCall might need reintegration/rethinking with doStream):', { error, toolCall });

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

      let currentResponseId_original_declaration_location: null | string = null; // Original line, kept for reference, but new currentResponseId is used

      // const result = streamText({ ... }); // Original streamText call is commented out

      // await result.consumeStream(); // Original consumeStream call is commented out
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

    // Determine messages to return (specific to this run)
    // `messages` here refers to the variable holding `await this.prepareMessages(project, profile);`
    // `agentMessages` is the initial user prompt for this run.
    // `initialResponseMessages` = `messages` (prepared history) + `agentMessages` (current prompt)
    // `allResponseMessages` = `initialResponseMessages` + everything generated by the loop.
    // We want to return messages starting from the current user prompt.
    // The `messages` variable (passed into `initialResponseMessages`) included the history *and* the current user prompt.
    // So, `initialResponseMessages` is the full list of messages at the start of the loop.
    // The messages strictly generated *by the agent interaction loop* are `allResponseMessages.slice(initialResponseMessages.length)`.
    // However, the function is expected to return messages including the user's prompt that triggered this run.

    // `messages` was:
    //    const messagesFromHistory = await this.prepareMessages(project, profile);
    //    const currentUserPromptMessage = agentMessages[0]; // agentMessages was [{ role: 'user', content: prompt, ... }]
    //    messages = [...messagesFromHistory, currentUserPromptMessage]; // This was the input to initialResponseMessages
    // So, `initialResponseMessages.length - 1` is the count of historical messages.
    const historyMessagesCount = initialResponseMessages.length - 1;
    const runSpecificMessages = allResponseMessages.slice(historyMessagesCount);
    return runSpecificMessages;
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
      const contextFilesMessages = await this.getContextFilesMessages(project, profile);
      messages.push(...contextFilesMessages);
    } else {
      const workingFilesMessages = await this.getWorkingFilesMessages(project);
      messages.push(...workingFilesMessages);
    }

    return messages;
  }

  async estimateTokens(project: Project, profile: AgentProfile): Promise<number> {
    try {
      const toolSet = await this.getAvailableTools(project, profile);
      const systemPrompt = await getSystemPrompt(project.baseDir, profile);
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

    const messageCost = calculateCost(this.modelInfoManager, profile, usage.promptTokens, usage.completionTokens, providerMetadata);
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
