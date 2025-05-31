export interface ModelCost {
  inputCost: number; // Cost per million tokens
  outputCost: number; // Cost per million tokens
  cacheCreationInputCost?: number; // Cost per million tokens, specific to Anthropic
  cacheReadInputCost?: number;     // Cost per million tokens, specific to Anthropic
}

export interface ModelInformation {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  costs: ModelCost;
  supportsTools?: boolean; // True if the model supports tools/function calling
}

export interface ModelData {
  [modelId: string]: ModelInformation;
}
