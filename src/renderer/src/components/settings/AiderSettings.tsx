import { useState, useEffect } from 'react';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import { Trans, useTranslation } from 'react-i18next';
import { SettingsData } from '@common/types';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Section } from '@/components/common/Section';
import { TextArea } from '@/components/common/TextArea';
import { Checkbox } from '@/components/common/Checkbox';
import { CodeInline } from '@/components/message';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  initialShowEnvVars?: boolean;
};

// Helper functions for environment variables
const parseEnvVars = (envString: string): Record<string, string> => {
  const vars: Record<string, string> = {};
  if (!envString) return vars;
  envString.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && key.trim()) {
      vars[key.trim()] = valueParts.join('=').trim();
    }
  });
  return vars;
};

const serializeEnvVars = (vars: Record<string, string>): string => {
  return Object.entries(vars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
};

export const AiderSettings = ({ settings, setSettings, initialShowEnvVars = false }: Props) => {
  const { t } = useTranslation();
  const [showEnvVarsTextarea, setShowEnvVarsTextarea] = useState(false); // For the textarea blur
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [isAdvEnvVarsExpanded, setIsAdvEnvVarsExpanded] = useState(!initialShowEnvVars);
  const [isAiderOptionsExpanded, setIsAiderOptionsExpanded] = useState(!initialShowEnvVars);

  useEffect(() => {
    const envs = parseEnvVars(settings.aider.environmentVariables);
    setOpenaiApiKey(envs.OPENAI_API_KEY || '');
    //决定textarea的blur状态，如果initialShowEnvVars为true，则blur，否则看用户是否点击了show secrets
    setShowEnvVarsTextarea(initialShowEnvVars ? false : true);
  }, [settings.aider.environmentVariables, initialShowEnvVars]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newApiKey = e.target.value;
    setOpenaiApiKey(newApiKey);
    const currentEnvVars = parseEnvVars(settings.aider.environmentVariables);
    currentEnvVars.OPENAI_API_KEY = newApiKey;
    // Remove OPENAI_API_KEY if it's empty to keep the env string clean
    if (!newApiKey.trim()) {
      delete currentEnvVars.OPENAI_API_KEY;
    }
    setSettings({
      ...settings,
      aider: {
        ...settings.aider,
        environmentVariables: serializeEnvVars(currentEnvVars),
      },
    });
  };

  const handleEnvVarsTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newEnvString = e.target.value;
    const envs = parseEnvVars(newEnvString);
    setOpenaiApiKey(envs.OPENAI_API_KEY || '');
    setSettings({
      ...settings,
      aider: {
        ...settings.aider,
        environmentVariables: newEnvString,
      },
    });
  };

  // This controls the blur overlay on the advanced env vars textarea
  const toggleShowEnvVarsTextarea = () => setShowEnvVarsTextarea(!showEnvVarsTextarea);

  return (
    <div className="space-y-6">
      {/* OpenAI API Key Input - Always visible and prominent */}
      <Section title={t('settings.aider.openAIApiKeyTitle')}>
        <div className="px-4 py-6 pb-3 space-y-1.5">
          <Input
            type="password" // Use password type to obscure the key
            value={openaiApiKey}
            onChange={handleApiKeyChange}
            placeholder={t('settings.aider.openAIApiKeyPlaceholder', { exampleKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' })}
            spellCheck={false}
          />
          <p className="text-xs text-neutral-200 px-1">
            <Trans
              i18nKey="settings.aider.openAIApiKeyDescription"
              components={{
                link: (
                  <a
                    href="https://platform.openai.com/account/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  />
                ),
              }}
            />
          </p>
        </div>
      </Section>

      {/* Collapsible Aider Options */}
      <Section
        title={t(initialShowEnvVars ? 'settings.aider.aiderOptionsAdvancedTitle' : 'settings.aider.options')}
        collapsible={initialShowEnvVars}
        isExpanded={isAiderOptionsExpanded}
        onToggle={initialShowEnvVars ? () => setIsAiderOptionsExpanded(!isAiderOptionsExpanded) : undefined}
      >
        {isAiderOptionsExpanded && (
          <div className="px-4 py-6 pb-3 space-y-1.5">
            <Input
              type="text"
              value={settings.aider.options}
              spellCheck={false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aider: {
                    ...settings.aider,
                    options: e.target.value,
                  },
                })
              }
              placeholder={t('settings.aider.optionsPlaceholder')}
            />
            <p className="text-xs text-neutral-200 px-1">
              {t('settings.aider.optionsDocumentation')}{' '}
              <a
                href="https://aider.chat/docs/config/options.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                https://aider.chat/docs/config/options.html
              </a>
            </p>
          </div>
        )}
      </Section>

      {/* Collapsible Advanced Environment Variables */}
      <Section
        title={t(initialShowEnvVars ? 'settings.aider.environmentVariablesAdvancedTitle' : 'settings.aider.environmentVariables')}
        collapsible={initialShowEnvVars}
        isExpanded={isAdvEnvVarsExpanded}
        onToggle={initialShowEnvVars ? () => setIsAdvEnvVarsExpanded(!isAdvEnvVarsExpanded) : undefined}
      >
        {isAdvEnvVarsExpanded && (
          <div className="px-4 py-6 pb-3">
            <div className="relative">
              <TextArea
                value={settings.aider.environmentVariables}
                onChange={handleEnvVarsTextareaChange}
                spellCheck={false}
                className="min-h-[200px]" // Reduced height as it's advanced
                placeholder={t('settings.aider.envVarsPlaceholder')}
              />
              {!showEnvVarsTextarea && ( // This state controls the blur
                <div className="absolute inset-[3px] bottom-[9px] bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center rounded-sm">
                  <Button variant="text" color="secondary" onClick={toggleShowEnvVarsTextarea} className="flex items-center" size="sm">
                    <HiEye className="mr-2" /> {t('settings.common.showSecrets')}
                  </Button>
                </div>
              )}
               {showEnvVarsTextarea && initialShowEnvVars && ( // Show "Hide Secrets" only if initially blurred and now shown
                 <Button variant="text" color="secondary" onClick={toggleShowEnvVarsTextarea} className="flex items-center absolute top-2 right-2" size="sm">
                    <HiEyeOff className="mr-2" /> {t('settings.common.hideSecrets')}
                  </Button>
               )}
            </div>
            <p className="text-xs text-neutral-200 px-1 mt-1">
              {t('settings.aider.envVarsDocumentation')}{' '}
              <a
                href="https://aider.chat/docs/config/dotenv.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                https://aider.chat/docs/config/dotenv.html
              </a>
            </p>
            <p className="text-xs text-orange-300 px-1 mt-2">
              {t('settings.aider.openAIApiKeyWarning')}
            </p>
          </div>
        )}
      </Section>

      {/* Original Context Section - unchanged for this task */}
      <Section title={t('settings.aider.context')}>
        <div className="px-4 py-6 pb-3 space-y-1.5">
          <Checkbox
            label={
              <Trans
                i18nKey="settings.aider.addRuleFiles"
                components={{
                  file: <CodeInline />,
                }}
              />
            }
            checked={settings.aider.addRuleFiles}
            onChange={(checked) =>
              setSettings({
                ...settings,
                aider: {
                  ...settings.aider,
                  addRuleFiles: checked,
                },
              })
            }
          />
        </div>
      </Section>
    </div>
  );
};
