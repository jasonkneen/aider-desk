import { MemoryConfig, MemoryEmbeddingProvider } from '@common/types';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '../common/Checkbox';
import { Select } from '../common/Select';
import { Section } from '../common/Section';

type Props = {
  settings: MemoryConfig;
  setSettings: (settings: MemoryConfig) => void;
};

const EMBEDDING_PROVIDERS = [{ value: 'sentence-transformers', label: 'Local' }];

const LOCAL_MODELS = [
  { value: 'Xenova/all-MiniLM-L6-v2', label: 'MiniLM-L6 (Fast, 100MB)', description: 'Fast and lightweight model' },
  { value: 'BAAI/bge-small-en-v1.5', label: 'BGE-Small (Good, 400MB)', description: 'Good balance of speed and quality' },
  { value: 'BAAI/bge-base-en-v1.5', label: 'BGE-Base (Better, 1.2GB)', description: 'Better quality for complex tasks' },
  { value: 'BAAI/bge-large-en-v1.5', label: 'BGE-Large (Best, 1.3GB)', description: 'Highest quality, slower' },
];

export const MemorySettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();

  const handleEnabledChange = (enabled: boolean) => {
    setSettings({
      ...settings,
      enabled,
    });
  };

  const handleModelChange = (model: string) => {
    setSettings({
      ...settings,
      model,
    });
  };

  const handleProviderChange = (provider: string) => {
    setSettings({
      ...settings,
      provider: provider as MemoryEmbeddingProvider,
    });
  };

  return (
    <div className="space-y-6">
      <Section id="memory-general" title={t('settings.memory.title')}>
        <div className="px-4 py-5 space-y-4">
          <div className="text-xs py-2">{t('settings.memory.description')}</div>

          {/* Enable Memory */}
          <Checkbox label={t('settings.memory.enabled.label')} checked={settings.enabled} onChange={handleEnabledChange} size="md" />

          {settings.enabled && (
            <div className="grid grid-cols-2 gap-x-6">
              {/* Provider Selection */}
              <div>
                <Select
                  label={t('settings.memory.provider.label')}
                  value={settings.provider}
                  onChange={handleProviderChange}
                  options={EMBEDDING_PROVIDERS.map((provider) => ({
                    value: provider.value,
                    label: provider.label,
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-text-secondary mt-1">{t('settings.memory.provider.description')}</p>
              </div>

              {/* Model Selection */}
              <div>
                <Select
                  label={t('settings.memory.model.label')}
                  value={settings.model}
                  onChange={handleModelChange}
                  options={LOCAL_MODELS.map((model) => ({
                    value: model.value,
                    label: model.label,
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-text-secondary mt-1">{LOCAL_MODELS.find((m) => m.value === settings.model)?.description}</p>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
};
