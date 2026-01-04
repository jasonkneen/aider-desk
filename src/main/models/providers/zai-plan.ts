import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isZaiPlanProvider, ZaiPlanProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { calculateCost, getDefaultUsageReport } from './default';

import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task';

const loadZaiPlanModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isZaiPlanProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as ZaiPlanProvider;
  const apiKey = provider.apiKey || '';

  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    // ZAI uses specific endpoint for model discovery
    const response = await fetch('https://api.z.ai/api/paas/v4/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      const errorMsg = `ZAI models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((model: { id: string }) => {
        return {
          id: model.id,
          providerId: profile.id,
          temperature: 0.7, // Default temperature for ZAI models
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} ZAI models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading ZAI models';
    logger.warn('Failed to fetch ZAI models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasZaiPlanEnvVars = (): boolean => false;

const getZaiPlanAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const zaiProvider = provider.provider as ZaiPlanProvider;
  const envVars: Record<string, string> = {};

  if (zaiProvider.apiKey) {
    envVars.OPENAI_API_KEY = zaiProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('ZAI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }

  // Set the base URL for ZAI Plan
  envVars.OPENAI_API_BASE = 'https://api.z.ai/api/coding/paas/v4';

  // Use zai-plan prefix for ZAI providers
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
const createZaiPlanLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as ZaiPlanProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ZAI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded ZAI_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (ZAI_API_KEY).`);
  }

  // Use createOpenAICompatible to get a provider instance, then get the model
  // ZAI uses specific base URL for chat completions
  const compatibleProvider = createOpenAICompatible({
    name: provider.name,
    apiKey,
    baseURL: 'https://api.z.ai/api/coding/paas/v4',
    headers: profile.headers,
  });
  return compatibleProvider(model.id);
};

export const getZaiPlanUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cachedInputTokens || 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  const messageCost = calculateCost(model, sentTokens, receivedTokens, cacheReadTokens);

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

const getZaiPlanModelInfo = (_provider: ProviderProfile, modelId: string, allModelInfos: Record<string, ModelInfo>): ModelInfo | undefined => {
  const fullModelId = `zai-coding-plan/${modelId}`;
  return allModelInfos[fullModelId];
};

// === Complete Strategy Implementation ===
export const zaiPlanProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createZaiPlanLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadZaiPlanModels,
  hasEnvVars: hasZaiPlanEnvVars,
  getAiderMapping: getZaiPlanAiderMapping,
  getModelInfo: getZaiPlanModelInfo,
};
