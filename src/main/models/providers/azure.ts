import { createAzure } from '@ai-sdk/azure';
import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { AZURE_DEFAULT_API_VERSION, AzureProvider } from '@common/agent';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task/task';

const extractResourceNameFromEndpoint = (endpoint: string): string => {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname;
    // Extract resource name from hostname like "resource-name.openai.azure.com"
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[parts.length - 2] === 'openai' && parts[parts.length - 1] === 'azure') {
      return parts[0];
    }
    return '';
  } catch {
    return '';
  }
};

export const hasAzureEnvVars = (settings: SettingsData): boolean => {
  const apiKey = getEffectiveEnvironmentVariable('AZURE_API_KEY', settings)?.value;
  const endpoint = getEffectiveEnvironmentVariable('AZURE_API_BASE', settings)?.value;
  return !!(apiKey && endpoint);
};

export const getAzureAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const azureProvider = provider.provider as AzureProvider;
  const envVars: Record<string, string> = {};

  if (azureProvider.apiKey) {
    envVars.AZURE_API_KEY = azureProvider.apiKey;
  }
  if (azureProvider.resourceName) {
    envVars.AZURE_API_BASE = `https://${azureProvider.resourceName}.openai.azure.com/`;
  }
  if (azureProvider.apiVersion) {
    envVars.AZURE_API_VERSION = azureProvider.apiVersion;
  }

  return {
    modelName: `azure/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createAzureLlm = (profile: ProviderProfile, model: Model, env: Record<string, string | undefined> = {}): LanguageModelV2 => {
  const provider = profile.provider as AzureProvider;
  const apiKey = provider.apiKey || env['AZURE_API_KEY'];
  const resourceName = provider.resourceName || (env['AZURE_RESOURCE_NAME'] ? extractResourceNameFromEndpoint(env['AZURE_RESOURCE_NAME']) : '');
  const apiVersion = provider.apiVersion || env['AZURE_API_VERSION'] || AZURE_DEFAULT_API_VERSION;

  if (!apiKey) {
    throw new Error('Azure OpenAI API key is required in Providers settings or Aider environment variables (AZURE_API_KEY)');
  }
  if (!resourceName) {
    throw new Error('Azure OpenAI resource name is required in Providers settings or Aider environment variables (AZURE_API_BASE)');
  }

  const azureProvider = createAzure({
    resourceName,
    apiKey,
    apiVersion,
    headers: profile.headers,
  });
  return azureProvider(model.id);
};

type AzureMetadata = {
  openai: {
    cachedPromptTokens?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateAzureCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheReadTokens * cacheReadInputTokenCost;

  return inputCost + outputCost + cacheCost;
};

export const getAzureUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;

  // Extract cache read tokens from provider metadata
  const { openai } = (providerMetadata as AzureMetadata) || {};
  const cacheReadTokens = openai?.cachedPromptTokens ?? usage.cachedInputTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally with already deducted sentTokens
  const messageCost = calculateAzureCost(model, sentTokens, receivedTokens, cacheReadTokens);

  const usageReportData: UsageReportData = {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };

  return usageReportData;
};

// === Complete Strategy Implementation ===
export const azureProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createAzureLlm,
  getUsageReport: getAzureUsageReport,

  // Model discovery functions
  loadModels: async (_profile: ProviderProfile, _modelsInfo: Record<string, ModelInfo>, _settings: SettingsData) => ({
    models: [],
    success: true,
  }),
  hasEnvVars: hasAzureEnvVars,
  getAiderMapping: getAzureAiderMapping,
};
