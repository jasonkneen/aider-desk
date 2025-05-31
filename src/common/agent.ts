import { ModelData, ModelInformation } from '@common/model-data';
import { AgentProfile, ReasoningEffort, SettingsData, ToolApprovalState } from '@common/types';
import {
  AIDER_TOOL_ADD_CONTEXT_FILE,
  AIDER_TOOL_DROP_CONTEXT_FILE,
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
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

import type { JSONValue } from 'ai';

export type LlmProviderName = 'openai' | 'anthropic' | 'gemini' | 'bedrock' | 'deepseek' | 'openai-compatible' | 'ollama' | 'openrouter' | 'requesty';

export interface LlmProviderBase {
  name: LlmProviderName;
}

export interface OllamaProvider extends LlmProviderBase {
  name: 'ollama';
  baseUrl: string;
}

export const AVAILABLE_PROVIDERS: LlmProviderName[] = [
  'anthropic',
  'bedrock',
  'deepseek',
  'gemini',
  'ollama',
  'openai',
  'openai-compatible',
  'openrouter',
  'requesty',
];

export interface OpenAiProvider extends LlmProviderBase {
  name: 'openai';
  apiKey: string;
}
export const isOpenAiProvider = (provider: LlmProviderBase): provider is OpenAiProvider => provider.name === 'openai';

export interface AnthropicProvider extends LlmProviderBase {
  name: 'anthropic';
  apiKey: string;
}
export const isAnthropicProvider = (provider: LlmProviderBase): provider is AnthropicProvider => provider.name === 'anthropic';

export interface GeminiProvider extends LlmProviderBase {
  name: 'gemini';
  apiKey: string;
}
export const isGeminiProvider = (provider: LlmProviderBase): provider is GeminiProvider => provider.name === 'gemini';

export interface DeepseekProvider extends LlmProviderBase {
  name: 'deepseek';
  apiKey: string;
}
export const isDeepseekProvider = (provider: LlmProviderBase): provider is DeepseekProvider => provider.name === 'deepseek';

export interface BedrockProvider extends LlmProviderBase {
  name: 'bedrock';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}
export const isBedrockProvider = (provider: LlmProviderBase): provider is BedrockProvider => provider.name === 'bedrock';

export interface OpenAiCompatibleProvider extends LlmProviderBase {
  name: 'openai-compatible';
  apiKey: string;
  baseUrl?: string;
  models: string[];
}
export const isOpenAiCompatibleProvider = (provider: LlmProviderBase): provider is OpenAiCompatibleProvider => provider.name === 'openai-compatible';

export const isOllamaProvider = (provider: LlmProviderBase): provider is OllamaProvider => provider.name === 'ollama';

export interface OpenRouterProvider extends LlmProviderBase {
  name: 'openrouter';
  apiKey: string;
  models: string[];
}
export const isOpenRouterProvider = (provider: LlmProviderBase): provider is OpenRouterProvider => provider.name === 'openrouter';

export interface RequestyProvider extends LlmProviderBase {
  name: 'requesty';
  apiKey: string;
  models: string[];
  useAutoCache: boolean;
  reasoningEffort: ReasoningEffort;
}
export const isRequestyProvider = (provider: LlmProviderBase): provider is RequestyProvider => provider.name === 'requesty';

export type LlmProvider =
  | OpenAiProvider
  | AnthropicProvider
  | GeminiProvider
  | BedrockProvider
  | DeepseekProvider
  | OpenAiCompatibleProvider
  | OllamaProvider
  | OpenRouterProvider
const DEFAULT_AGENT_PROFILE_ID = 'default';

// Define a logger for common code, can be replaced by a more robust solution if needed
const logger = {
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
};

export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  id: DEFAULT_AGENT_PROFILE_ID,
  name: 'Default',
  provider: 'anthropic',
  model: 'claude-3-haiku-20240307', // Using a known Haiku model as a sensible default.
  maxIterations: 20,
  maxTokens: 2000,
  minTimeBetweenToolCalls: 0,
  toolApprovals: {
    // aider tools
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_GET_CONTEXT_FILES}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_ADD_CONTEXT_FILE}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_DROP_CONTEXT_FILE}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`]: ToolApprovalState.Ask,
    // power tools
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Ask,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Ask,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GLOB}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_SEMANTIC_SEARCH}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Ask,
  },
  includeContextFiles: true,
  includeRepoMap: true,
  usePowerTools: false,
  useAiderTools: true,
  customInstructions: '',
  enabledServers: [],
};

export const getLlmProviderConfig = (providerName: LlmProviderName, settings: SettingsData | null): LlmProvider => {
  let provider = settings?.llmProviders[providerName] || null;

  if (!provider) {
    const baseConfig: LlmProviderBase = {
      name: providerName,
    };

    switch (providerName) {
      case 'openai':
        provider = { ...baseConfig, apiKey: '' } as OpenAiProvider;
        break;
      case 'anthropic':
        provider = { ...baseConfig, apiKey: '' } as AnthropicProvider;
        break;
      case 'gemini':
        provider = { ...baseConfig, apiKey: '' } as GeminiProvider;
        break;
      case 'deepseek':
        provider = { ...baseConfig, apiKey: '' } as DeepseekProvider;
        break;
      case 'bedrock':
        provider = {
          ...baseConfig,
          accessKeyId: '',
          secretAccessKey: '',
          region: 'us-east-1', // Default region
        } as BedrockProvider;
        break;
      case 'openai-compatible':
        provider = {
          ...baseConfig,
          apiKey: '',
          baseUrl: '',
          models: [],
        } as OpenAiCompatibleProvider;
        break;
      case 'ollama':
        provider = {
          ...baseConfig,
          baseUrl: 'http://localhost:11434/api',
        } as OllamaProvider;
        break;
      case 'openrouter':
        provider = {
          ...baseConfig,
          apiKey: '',
          models: [],
        } as OpenRouterProvider;
        break;
      case 'requesty':
        provider = {
          ...baseConfig,
          apiKey: '',
          models: [],
          useAutoCache: true,
          reasoningEffort: ReasoningEffort.None,
        } as RequestyProvider;
        break;
      default:
        // For any other provider, create a base structure. This might need more specific handling if new providers are added.
        provider = {
          ...baseConfig,
        } as LlmProvider;
    }

    return provider;
  } else {
    return {
      ...provider,
    };
  }
};

export const getCacheControl = (profile: AgentProfile): Record<string, Record<string, JSONValue>> => {
  if (profile.provider === 'anthropic') {
    return {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    };
  } else if (profile.provider === 'openrouter' || profile.provider === 'requesty') {
    if (profile.model.startsWith('anthropic/')) {
      return {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      };
    }
  }

  return {};
};

type AnthropicMetadata = {
  anthropic: {
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
};

export const calculateCost = (
  profile: AgentProfile,
  modelData: ModelData | null, // Added new parameter
  sentTokens: number,
  receivedTokens: number,
  providerMetadata?: AnthropicMetadata | unknown,
) => {
  if (!modelData) {
    logger.warn('Model data not available for cost calculation.');
    return 0;
  }

  // Get the model name directly from the profile.
  // The keys in modelData are expected to be without provider prefixes.
  // profile.model might or might not have a prefix.
  const modelId = profile.model;

  let modelInfo = modelData[modelId];

  if (!modelInfo) {
    // Try to find the model by stripping provider prefix if modelId contains one
    const parts = modelId.split('/');
    const potentialBaseModelId = parts.length > 1 ? parts.slice(1).join('/') : modelId;
    const fallbackModelInfo = modelData[potentialBaseModelId];

    if (!fallbackModelInfo) {
        logger.warn(`Cost data for model ${modelId} (and fallback ${potentialBaseModelId}) not found in model-data.json.`);
        return 0;
    }
    logger.debug(`Using fallback model key ${potentialBaseModelId} for ${modelId}`);
    modelInfo = fallbackModelInfo;
  }

  const modelCost = modelInfo.costs;
  if (!modelCost) {
    logger.warn(`Cost details for model ${modelId} not found.`);
    return 0;
  }

  const inputCost = (sentTokens * modelCost.inputCost) / 1_000_000;
  const outputCost = (receivedTokens * modelCost.outputCost) / 1_000_000;

  let specializedCacheCost = 0;
  if (profile.provider === 'anthropic' && providerMetadata && modelInfo.costs) { // Ensure modelInfo.costs exists
      const anthropicMeta = providerMetadata as AnthropicMetadata; // Type assertion
      const cacheCreationTokens = anthropicMeta.anthropic?.cacheCreationInputTokens ?? 0;
      const cacheReadTokens = anthropicMeta.anthropic?.cacheReadInputTokens ?? 0;

      if (modelInfo.costs.cacheCreationInputCost !== undefined) {
          const cacheCreationCost = (cacheCreationTokens * modelInfo.costs.cacheCreationInputCost) / 1_000_000;
          specializedCacheCost += cacheCreationCost;
      }
      if (modelInfo.costs.cacheReadInputCost !== undefined) {
          const cacheReadCost = (cacheReadTokens * modelInfo.costs.cacheReadInputCost) / 1_000_000;
          specializedCacheCost += cacheReadCost;
      }
      if (cacheCreationTokens > 0 || cacheReadTokens > 0) {
           logger.debug('Calculating Anthropic cache cost', { specializedCacheCost });
      }
  }

  return inputCost + outputCost + specializedCacheCost;
};
