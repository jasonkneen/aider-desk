import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isZaiPlanProvider, ZaiPlanProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { Project } from '@/project/project';
import { getEffectiveEnvironmentVariable } from '@/utils';

const loadZaiPlanModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>, settings: SettingsData): Promise<LoadModelsResponse> => {
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
        const info = modelsInfo[model.id];
        return {
          id: model.id,
          providerId: profile.id,
          ...info,
        };
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

const getZaiPlanAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const zaiProvider = provider.provider as ZaiPlanProvider;
  const envVars: Record<string, string> = {};

  if (zaiProvider.apiKey) {
    envVars.OPENAI_API_KEY = zaiProvider.apiKey;
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
const createZaiPlanLlm = (profile: ProviderProfile, model: Model, env: Record<string, string | undefined> = {}): LanguageModelV2 => {
  const provider = profile.provider as ZaiPlanProvider;
  const apiKey = provider.apiKey || env['ZAI_API_KEY'];
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

// === Cost and Usage Functions ===
const calculateZaiPlanCost = (model: Model, sentTokens: number, receivedTokens: number, _providerMetadata?: unknown): number => {
  // Use model overrides if available, otherwise use base model info
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;

  return inputCost + outputCost;
};

const getZaiPlanUsageReport = (
  project: Project,
  provider: ProviderProfile,
  modelId: string,
  messageCost: number,
  usage: LanguageModelUsage,
  _providerMetadata?: unknown,
): UsageReportData => {
  return {
    model: `${provider.id}/${modelId}`,
    sentTokens: usage.inputTokens || 0,
    receivedTokens: usage.outputTokens || 0,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };
};

// === Complete Strategy Implementation ===
export const zaiPlanProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createZaiPlanLlm,
  calculateCost: calculateZaiPlanCost,
  getUsageReport: getZaiPlanUsageReport,

  // Model discovery functions
  loadModels: loadZaiPlanModels,
  hasEnvVars: hasZaiPlanEnvVars,
  getAiderMapping: getZaiPlanAiderMapping,
};
