import { SettingsData } from '@common/types';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '../common/Checkbox';
import { Section } from '../common/Section';
import { InfoIcon } from '../common/InfoIcon';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const TaskSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();

  const handleSmartTaskStateChange = (checked: boolean) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        smartTaskState: checked,
      },
    });
  };

  const handleAutoGenerateTaskNameChange = (checked: boolean) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        autoGenerateTaskName: checked,
      },
    });
  };

  const handleShowTaskStateActionsChange = (checked: boolean) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        showTaskStateActions: checked,
      },
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Section title={t('settings.tasks.title')} className="px-4 py-5">
        <div className="space-y-3">
          <div className="flex items-start gap-1">
            <Checkbox
              id="smart-task-state"
              checked={settings.taskSettings.smartTaskState}
              onChange={handleSmartTaskStateChange}
              label={t('settings.tasks.smartTaskState')}
            />
            <InfoIcon tooltip={t('settings.tasks.smartTaskStateTooltip')} />
          </div>

          <div className="flex items-start gap-1">
            <Checkbox
              id="auto-generate-task-name"
              checked={settings.taskSettings?.autoGenerateTaskName ?? true}
              onChange={handleAutoGenerateTaskNameChange}
              label={t('settings.tasks.autoGenerateTaskName')}
            />
            <InfoIcon tooltip={t('settings.tasks.autoGenerateTaskNameTooltip')} />
          </div>

          <div className="flex items-start gap-1">
            <Checkbox
              id="show-task-state-actions"
              checked={settings.taskSettings?.showTaskStateActions ?? true}
              onChange={handleShowTaskStateActionsChange}
              label={t('settings.tasks.showTaskStateActions')}
            />
            <InfoIcon tooltip={t('settings.tasks.showTaskStateActionsTooltip')} />
          </div>
        </div>
      </Section>
    </div>
  );
};
