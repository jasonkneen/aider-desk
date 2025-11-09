import { getDefaultProviderParams, LlmProvider, GpustackProvider } from '@common/agent';

import { DisableStreaming } from '../DisableStreaming';

import { GpustackAdvancedSettings } from './GpustackAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<GpustackProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const GpustackModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to GpustackProvider format for AdvancedSettings
  const fullProvider: GpustackProvider = {
    ...getDefaultProviderParams('gpustack'),
    ...(provider as GpustackProvider),
    ...overrides,
  };

  // Convert GpustackProvider back to overrides format
  const handleProviderChange = (updatedProvider: GpustackProvider) => {
    const newOverrides = {
      reasoningEffort: updatedProvider.reasoningEffort,
      disableStreaming: updatedProvider.disableStreaming,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  // Handle disable streaming change separately
  const handleDisableStreamingChange = (disableStreaming: boolean) => {
    const updatedProvider = { ...fullProvider, disableStreaming };
    handleProviderChange(updatedProvider);
  };

  return (
    <div className="space-y-4">
      <GpustackAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
