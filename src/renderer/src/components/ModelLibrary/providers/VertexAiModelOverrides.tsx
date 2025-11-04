import { getDefaultProviderParams, LlmProvider, VertexAiProvider } from '@common/agent';

import { VertexAiAdvancedSettings } from './VertexAiAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<VertexAiProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const VertexAiModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to VertexAiProvider format for AdvancedSettings
  const fullProvider: VertexAiProvider = {
    ...getDefaultProviderParams('vertex-ai'),
    ...(provider as VertexAiProvider),
    ...overrides,
  };

  // Convert VertexAiProvider back to overrides format
  const handleProviderChange = (updatedProvider: VertexAiProvider) => {
    const newOverrides = {
      thinkingBudget: updatedProvider.thinkingBudget,
      includeThoughts: updatedProvider.includeThoughts,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <VertexAiAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
    </div>
  );
};
