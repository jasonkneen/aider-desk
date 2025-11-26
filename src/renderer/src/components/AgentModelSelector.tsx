import { forwardRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_PROVIDERS, getProviderModelId } from '@common/agent';
import { AgentProfile, Model } from '@common/types';

import { ModelSelector, ModelSelectorRef } from './ModelSelector';

import { useModelProviders } from '@/contexts/ModelProviderContext';
import { showErrorNotification } from '@/utils/notifications';

type Props = {
  className?: string;
  agentProfile: AgentProfile | undefined;
  onProfileChange?: (profile: AgentProfile) => void;
  preferredModelIds?: string[];
  removePreferredModel?: (modelId: string) => void;
};

export const AgentModelSelector = forwardRef<ModelSelectorRef, Props>(
  ({ className, agentProfile, onProfileChange, preferredModelIds = [], removePreferredModel = () => {} }, ref) => {
    const { t } = useTranslation();
    const { providers, models } = useModelProviders();

    const currentModel = agentProfile ? models.find((m) => m.id === agentProfile.model && m.providerId === agentProfile.provider) : undefined;
    const currentModelId = currentModel ? getProviderModelId(currentModel) : agentProfile ? `${agentProfile.provider}/${agentProfile.model}` : undefined;

    const agentModels = useMemo(() => {
      const agentModels: Model[] = [...models];

      // Add the currently selected model if it's not in the known list (custom model)
      if (currentModelId) {
        const existingModel = agentModels.find((model) => getProviderModelId(model) === currentModelId);
        if (!existingModel) {
          // Create a custom model object for the current model
          const [providerId, ...modelNameParts] = currentModelId.split('/');
          const modelId = modelNameParts.join('/');
          if (providerId && modelId) {
            const customModel: Model = {
              id: modelId,
              providerId: providerId,
            };
            agentModels.unshift(customModel); // Add to the beginning for visibility
          }
        }
      }
      return agentModels;
    }, [currentModelId, models]);

    const onModelSelected = useCallback(
      (selectedModel: Model) => {
        if (!agentProfile || !onProfileChange) {
          return;
        }

        const selectedModelId = getProviderModelId(selectedModel);
        const [providerId, ...modelNameParts] = selectedModelId.split('/');
        const modelId = modelNameParts.join('/');
        if (!providerId || !modelId) {
          showErrorNotification(
            t('modelSelector.invalidModelSelection', {
              model: selectedModelId,
            }),
          );
          return;
        }

        const provider = providers.find((provider) => provider.id === providerId);
        if (!provider) {
          showErrorNotification(
            t('modelSelector.providerNotSupported', {
              provider: providerId,
              providers: AVAILABLE_PROVIDERS.join(', '),
            }),
          );
          return;
        }

        const updatedProfile = {
          ...agentProfile,
          provider: provider.id,
          model: modelId,
        };

        onProfileChange(updatedProfile);
      },
      [providers, onProfileChange, t, agentProfile],
    );

    if (!agentProfile) {
      return <div className="text-xs text-text-muted-light">{t('modelSelector.noActiveAgentProvider')}</div>;
    }

    return (
      <div className="relative flex items-center space-x-1">
        <ModelSelector
          ref={ref}
          className={className}
          models={agentModels}
          selectedModelId={currentModelId}
          onChange={onModelSelected}
          preferredModelIds={preferredModelIds}
          removePreferredModel={removePreferredModel}
          providers={providers}
        />
      </div>
    );
  },
);

AgentModelSelector.displayName = 'AgentModelSelector';
