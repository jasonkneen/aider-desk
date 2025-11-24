import { SettingsData } from '@common/types';
import { useEffect, useMemo, useState } from 'react';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { LlmProviderName } from '@common/agent';

import { Settings } from '@/pages/Settings';
import { useSettings } from '@/contexts/SettingsContext';
import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useApi } from '@/contexts/ApiContext';
import { Button } from '@/components/common/Button';

type Props = {
  onClose: () => void;
  initialTab?: number;
  initialAgentProfileId?: string;
  initialAgentProvider?: LlmProviderName;
};

export const SettingsPage = ({ onClose, initialTab = 0, initialAgentProfileId, initialAgentProvider }: Props) => {
  const { t, i18n } = useTranslation();
  const api = useApi();

  const { settings: originalSettings, saveSettings, setTheme, setFont, setFontSize } = useSettings();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(originalSettings);

  useEffect(() => {
    if (originalSettings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  const hasChanges = useMemo(() => {
    return localSettings && originalSettings && !isEqual(localSettings, originalSettings);
  }, [localSettings, originalSettings]);

  const handleCancel = () => {
    if (originalSettings && localSettings?.language !== originalSettings.language) {
      void i18n.changeLanguage(originalSettings.language);
    }
    if (originalSettings && localSettings?.zoomLevel !== originalSettings.zoomLevel) {
      void api.setZoomLevel(originalSettings.zoomLevel ?? 1);
    }
    if (originalSettings && originalSettings.theme && localSettings?.theme !== originalSettings.theme) {
      setTheme(originalSettings.theme);
    }

    if (originalSettings && originalSettings.font && localSettings?.font !== originalSettings.font) {
      setFont(originalSettings.font);
    }

    if (originalSettings && originalSettings.fontSize && localSettings?.fontSize !== originalSettings.fontSize) {
      setFontSize(originalSettings.fontSize);
    }

    // Updated to use settings.mcpServers directly
    if (originalSettings && localSettings && !isEqual(localSettings.mcpServers, originalSettings.mcpServers)) {
      void api.reloadMcpServers(originalSettings.mcpServers || {});
    }
    onClose();
  };

  const handleSave = async () => {
    if (localSettings) {
      await saveSettings(localSettings);
      onClose();
    }
  };

  const handleLanguageChange = (language: string) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        language,
      });
      void i18n.changeLanguage(language);
    }
  };

  const handleZoomChange = (zoomLevel: number) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        zoomLevel,
      });
      void api.setZoomLevel(zoomLevel);
    }
  };

  return (
    <ModalOverlayLayout title={t('settings.title')}>
      <div className="flex flex-col flex-1 min-h-0">
        {localSettings && (
          <Settings
            settings={localSettings}
            updateSettings={setLocalSettings}
            onLanguageChange={handleLanguageChange}
            onZoomChange={handleZoomChange}
            onThemeChange={setTheme}
            onFontChange={setFont}
            onFontSizeChange={setFontSize}
            initialTab={initialTab}
            initialAgentProfileId={initialAgentProfileId}
            initialAgentProvider={initialAgentProvider}
          />
        )}
      </div>
      <div className="flex items-center justify-end p-3 gap-3 border-t border-border-default-dark">
        <Button variant="text" onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges}>
          {t('common.save')}
        </Button>
      </div>
    </ModalOverlayLayout>
  );
};
