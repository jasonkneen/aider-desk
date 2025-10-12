import { useTranslation } from 'react-i18next';
import { OpenAiProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { Select, Option } from '@/components/common/Select';
import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  provider: OpenAiProvider;
  onChange: (updated: OpenAiProvider) => void;
};

export const OpenAiAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const reasoningEffort = provider.reasoningEffort || ReasoningEffort.None;
  const useWebSearch = provider.useWebSearch ?? false;

  const reasoningOptions: Option[] = [
    { value: ReasoningEffort.None, label: t('openai.reasoningEffortNone') },
    { value: ReasoningEffort.Minimal, label: t('openai.reasoningEffortMinimal') },
    { value: ReasoningEffort.Low, label: t('openai.reasoningEffortLow') },
    { value: ReasoningEffort.Medium, label: t('openai.reasoningEffortMedium') },
    { value: ReasoningEffort.High, label: t('openai.reasoningEffortHigh') },
  ];

  const handleReasoningEffortChange = (value: string) => {
    onChange({
      ...provider,
      reasoningEffort: value as ReasoningEffort,
    });
  };

  const handleUseWebSearchChange = (checked: boolean) => {
    onChange({
      ...provider,
      useWebSearch: checked,
    });
  };

  return (
    <div className="space-y-4">
      <Select label={t('openai.reasoningEffort')} value={reasoningEffort} onChange={handleReasoningEffortChange} options={reasoningOptions} />

      <div className="flex items-center space-x-2">
        <Checkbox label={<span className="text-sm">{t('openai.useWebSearch')}</span>} checked={useWebSearch} onChange={handleUseWebSearchChange} />
        <InfoIcon tooltip={t('openai.useWebSearchTooltip')} />
      </div>
    </div>
  );
};
