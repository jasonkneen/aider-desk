import { getDefaultProviderParams, AzureProvider } from '@common/agent';

import { AzureAdvancedSettings } from './AzureAdvancedSettings';

type Props = {
  overrides: Partial<AzureProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const AzureModelOverrides = ({ overrides, onChange }: Props) => {
  // Convert overrides to AzureProvider format for AdvancedSettings
  const provider: AzureProvider = {
    ...getDefaultProviderParams('azure'),
    ...overrides,
  };

  // Convert AzureProvider back to overrides format
  const handleProviderChange = (updatedProvider: AzureProvider) => {
    const newOverrides = {
      reasoningEffort: updatedProvider.reasoningEffort,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <AzureAdvancedSettings provider={provider} onChange={handleProviderChange} />
    </div>
  );
};
