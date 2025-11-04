import { getDefaultProviderParams, LlmProvider, OpenAiProvider } from '@common/agent';

import { OpenAiAdvancedSettings } from './OpenAiAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<OpenAiProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const OpenAiModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to OpenAiProvider format for AdvancedSettings
  const fullProvider: OpenAiProvider = {
    ...getDefaultProviderParams('openai'),
    ...(provider as OpenAiProvider),
    ...overrides,
  };

  // Convert OpenAiProvider back to overrides format
  const handleProviderChange = (updatedProvider: OpenAiProvider) => {
    const newOverrides = {
      reasoningEffort: updatedProvider.reasoningEffort,
      useWebSearch: updatedProvider.useWebSearch,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <OpenAiAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
    </div>
  );
};
