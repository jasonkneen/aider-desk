import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { GeminiProvider, isGeminiProvider, LlmProvider } from '@common/agent';
import { createGoogleGenerativeAI, google, type GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';

import type { LanguageModelUsage, ToolSet } from 'ai';
import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

export const loadGeminiModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isGeminiProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as GeminiProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.customBaseUrl || 'https://generativelanguage.googleapis.com';

  const apiKeyEnv = getEffectiveEnvironmentVariable('GEMINI_API_KEY', settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('GEMINI_API_BASE_URL', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value || 'https://generativelanguage.googleapis.com';

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const url = `${effectiveBaseUrl}/v1beta/models?key=${effectiveApiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorMsg = `Gemini models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, response.status, response.statusText);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.models
        ?.filter((model: { supportedGenerationMethods?: string[] }) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model: { name: string; inputTokenLimit?: number; outputTokenLimit?: number; supportedGenerationMethods?: string[] }) => {
          const modelId = model.name.replace('models/', '');
          const info = modelsInfo[modelId];
          return {
            ...info,
            id: modelId,
            providerId: profile.id,
            maxInputTokens: model.inputTokenLimit,
            maxOutputTokens: model.outputTokenLimit,
          };
        }) || [];

    logger.info(`Loaded ${models.length} Gemini models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Gemini models';
    logger.error('Error loading Gemini models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasGeminiEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('GEMINI_API_KEY', settings, undefined)?.value;
};

export const getGeminiAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const geminiProvider = provider.provider as GeminiProvider;
  const envVars: Record<string, string> = {};

  if (geminiProvider.apiKey) {
    envVars.GEMINI_API_KEY = geminiProvider.apiKey;
  }

  if (geminiProvider.customBaseUrl) {
    envVars.GEMINI_API_BASE = geminiProvider.customBaseUrl;
  }

  return {
    modelName: `gemini/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createGeminiLlm = (profile: ProviderProfile, model: Model, env: Record<string, string | undefined> = {}): LanguageModelV2 => {
  const provider = profile.provider as GeminiProvider;
  const apiKey = provider.apiKey || env['GEMINI_API_KEY'];

  if (!apiKey) {
    throw new Error('Gemini API key is required in Providers settings or Aider environment variables (GEMINI_API_KEY)');
  }

  const baseUrl = provider.customBaseUrl || env['GEMINI_API_BASE_URL'];

  const googleProvider = createGoogleGenerativeAI({
    apiKey,
    baseURL: baseUrl,
    headers: profile.headers,
  });
  return googleProvider(model.id);
};

type GoogleMetadata = {
  google: {
    cachedInputTokens?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateGeminiCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  let inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;
  let cacheCost = 0;

  const { google } = (providerMetadata as GoogleMetadata) || {};
  if (google) {
    const cachedPromptTokens = google.cachedInputTokens ?? 0;

    inputCost = (sentTokens - cachedPromptTokens) * modelInfo.inputCostPerToken;
    cacheCost = cachedPromptTokens * (modelInfo.cacheReadInputTokenCost ?? modelInfo.inputCostPerToken * 0.25);
  }

  return inputCost + outputCost + cacheCost;
};

export const getGeminiUsageReport = (
  project: Project,
  provider: ProviderProfile,
  modelId: string,
  messageCost: number,
  usage: LanguageModelUsage,
  providerOptions?: unknown,
): UsageReportData => {
  const usageReportData: UsageReportData = {
    model: `${provider.id}/${modelId}`,
    sentTokens: usage.inputTokens || 0,
    receivedTokens: usage.outputTokens || 0,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };

  const { google } = (providerOptions as GoogleMetadata) || {};
  if (google) {
    usageReportData.cacheReadTokens = google.cachedInputTokens;
    usageReportData.sentTokens -= usageReportData.cacheReadTokens ?? 0;
  }

  return usageReportData;
};

export const getGeminiProviderOptions = (llmProvider: LlmProvider, model: Model): SharedV2ProviderOptions | undefined => {
  if (isGeminiProvider(llmProvider)) {
    const providerOverrides = model.providerOverrides as Partial<GeminiProvider> | undefined;

    // Use model-specific overrides, falling back to provider defaults
    const includeThoughts = providerOverrides?.includeThoughts ?? llmProvider.includeThoughts;
    const thinkingBudget = providerOverrides?.thinkingBudget ?? llmProvider.thinkingBudget;

    return {
      google: {
        ...((includeThoughts || thinkingBudget) && {
          thinkingConfig: {
            includeThoughts: includeThoughts && (thinkingBudget ?? 0) > 0,
            thinkingBudget,
          },
        }),
      } satisfies GoogleGenerativeAIProviderOptions,
    };
  }

  return undefined;
};

// === Provider Tools Functions ===
export const getGeminiProviderTools = (provider: LlmProvider, model: Model): ToolSet => {
  if (!isGeminiProvider(provider)) {
    return {};
  }

  // Check for model-specific overrides
  const providerOverrides = model.providerOverrides as Partial<GeminiProvider> | undefined;
  const useSearchGrounding = providerOverrides?.useSearchGrounding ?? provider.useSearchGrounding;

  if (!useSearchGrounding) {
    return {};
  }

  return {
    google_search: google.tools.googleSearch({}),
  };
};

// === Complete Strategy Implementation ===
export const geminiProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createGeminiLlm,
  calculateCost: calculateGeminiCost,
  getUsageReport: getGeminiUsageReport,

  // Model discovery functions
  loadModels: loadGeminiModels,
  hasEnvVars: hasGeminiEnvVars,
  getAiderMapping: getGeminiAiderMapping,

  getProviderOptions: getGeminiProviderOptions,
  getProviderTools: getGeminiProviderTools,
};
