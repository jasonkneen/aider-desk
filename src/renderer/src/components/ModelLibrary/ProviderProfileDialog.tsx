import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import { LlmProviderName } from '@common/agent';
import { ProviderProfile } from '@common/types';

import { ProviderProfileForm, ProviderProfileFormRef } from './ProviderProfileForm';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';

type Props = {
  provider: LlmProviderName;
  profile?: ProviderProfile;
  providers: ProviderProfile[];
  onSave: (profile: ProviderProfile) => void;
  onCancel: () => void;
};

export const ProviderProfileDialog = ({ provider, profile, providers, onSave, onCancel }: Props) => {
  const { t } = useTranslation();
  const formRef = useRef<ProviderProfileFormRef>(null);

  return (
    <ConfirmDialog
      title={t('modelLibrary.editProvider')}
      onCancel={onCancel}
      onConfirm={() => formRef.current?.submit()}
      confirmButtonText={t('common.save')}
      width={700}
    >
      <ProviderProfileForm
        key={profile?.id || provider}
        ref={formRef}
        provider={provider}
        editProfile={profile}
        providers={providers}
        onSave={onSave}
        onCancel={onCancel}
        hideActions
        hideTitle
      />
    </ConfirmDialog>
  );
};
