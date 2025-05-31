import * as fs from 'fs';
import * as path from 'path';
import { ModelData, ModelInformation, ModelCost } from '@common/model-data'; // Adjust path as necessary
import logger from './logger'; // Assuming logger is available and configured
import { AIDER_DESK_DIR } from './constants'; // Assuming AIDER_DESK_DIR is exported

const MODEL_DATA_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const MODEL_DATA_FILENAME = 'model-data.json';

interface LiteLLMModelInfo {
  max_tokens?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  litellm_provider?: string;
  mode?: string;
  supports_function_calling?: boolean;
  cache_creation_input_token_cost?: number; // Added for Anthropic cache cost
  cache_read_input_token_cost?: number;     // Added for Anthropic cache cost
  // Add any other fields you might need from the source JSON
}

interface LiteLLMData {
  [key: string]: LiteLLMModelInfo;
}

async function fetchModelDataFromSource(): Promise<LiteLLMData | null> {
  try {
    const response = await fetch(MODEL_DATA_URL);
    if (!response.ok) {
      logger.error(`Failed to fetch model data: ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return data as LiteLLMData;
  } catch (error) {
    logger.error('Error fetching or parsing model data:', { error });
    return null;
  }
}

function transformModelData(liteLLMData: LiteLLMData): ModelData {
  const modelData: ModelData = {};

  for (const key in liteLLMData) {
    // Skip the 'sample_spec' entry or any other non-model entries
    if (key === 'sample_spec') {
      continue;
    }

    const rawModel = liteLLMData[key];

    // Only process models that are for 'chat', 'completion', or not specified (to be inclusive)
    // This helps filter out embedding, image_generation models etc. if they are not needed for cost calculation.
    if (rawModel.mode && !['chat', 'completion'].includes(rawModel.mode)) {
        // logger.debug(`Skipping model ${key} due to mode: ${rawModel.mode}`);
        continue;
    }

    // Determine model ID - remove provider prefix if present
    let modelId = key;
    if (rawModel.litellm_provider && key.startsWith(rawModel.litellm_provider + '/')) {
      modelId = key.substring(rawModel.litellm_provider.length + 1);
    }

    // Skip if essential cost data is missing
    if (rawModel.input_cost_per_token === undefined || rawModel.output_cost_per_token === undefined) {
        // logger.debug(`Skipping model ${modelId} due to missing cost data.`);
        continue;
    }

    const costs: ModelCost = {
      inputCost: (rawModel.input_cost_per_token ?? 0) * 1_000_000,
      outputCost: (rawModel.output_cost_per_token ?? 0) * 1_000_000,
    };

    if (rawModel.cache_creation_input_token_cost !== undefined) {
      costs.cacheCreationInputCost = rawModel.cache_creation_input_token_cost * 1_000_000;
    }
    if (rawModel.cache_read_input_token_cost !== undefined) {
      costs.cacheReadInputCost = rawModel.cache_read_input_token_cost * 1_000_000;
    }

    const modelInfo: ModelInformation = {
      maxInputTokens: rawModel.max_input_tokens,
      maxOutputTokens: rawModel.max_output_tokens ?? rawModel.max_tokens, // Fallback to max_tokens
      costs,
      supportsTools: rawModel.supports_function_calling ?? false,
    };

    // logger.debug(`Processed model ${key} as ${modelId}`);
    modelData[modelId] = modelInfo;
  }
  return modelData;
}

function saveModelDataToFile(modelData: ModelData): void {
  try {
    if (!fs.existsSync(AIDER_DESK_DIR)) {
      fs.mkdirSync(AIDER_DESK_DIR, { recursive: true });
    }
    const filePath = path.join(AIDER_DESK_DIR, MODEL_DATA_FILENAME);
    fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2));
    logger.info(`Model data saved to ${filePath}`);
  } catch (error) {
    logger.error('Error saving model data to file:', { error });
  }
}

export async function loadAndProcessModelData(): Promise<void> {
  logger.info('Starting model data load and process...');
  const liteLLMData = await fetchModelDataFromSource();
  if (liteLLMData) {
    const modelData = transformModelData(liteLLMData);
    saveModelDataToFile(modelData);
    logger.info('Model data processing complete.');
  } else {
    logger.warn('Model data processing failed as source data could not be fetched.');
  }
}

// Function to read the stored model data
// This might be called by other parts of the application, e.g., the cost calculation logic
export function getStoredModelData(): ModelData | null {
  const filePath = path.join(AIDER_DESK_DIR, MODEL_DATA_FILENAME);
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent) as ModelData;
    }
    logger.warn(`${MODEL_DATA_FILENAME} not found in ${AIDER_DESK_DIR}.`);
    return null;
  } catch (error) {
    logger.error(`Error reading ${MODEL_DATA_FILENAME}:`, { error });
    return null;
  }
}
