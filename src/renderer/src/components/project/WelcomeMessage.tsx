import { useTranslation } from 'react-i18next';
import { FiCode, FiFile, FiLayers, FiZap, FiTerminal } from 'react-icons/fi';

// @ts-expect-error TypeScript is not aware of asset import
import icon from '../../../../../resources/icon.png?asset';

export const WelcomeMessage = () => {
  const { t } = useTranslation();

  const features = [
    { icon: FiCode, key: 'aiCoding' },
    { icon: FiFile, key: 'contextManagement' },
    { icon: FiLayers, key: 'multiModel' },
    { icon: FiZap, key: 'modes' },
    { icon: FiTerminal, key: 'commands' },
  ];

  const tips = ['addFiles', 'askQuestion', 'useCommands', 'switchMode'];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted-light overflow-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary">
      <div className="text-center max-w-2xl h-full pt-20">
        <img src={icon} alt="AiderDesk" className="h-20 w-20 mx-auto mb-2 opacity-90" />

        <h1 className="text-xl font-semibold text-text-primary mb-2">{t('welcomeMessage.title')}</h1>
        <p className="text-sm text-text-secondary mb-10">{t('welcomeMessage.subtitle')}</p>

        <div className="mb-6">
          <h2 className="text-base font-medium text-text-primary mb-3">{t('welcomeMessage.features.title')}</h2>
          <div className="space-y-2">
            {features.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center justify-center gap-3 text-text-secondary text-xs">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t(`welcomeMessage.features.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border-default-dark pt-5">
          <h2 className="text-sm font-medium text-text-primary mb-3">{t('welcomeMessage.tips.title')}</h2>
          <div className="space-y-2 text-xs text-text-muted-light">
            {tips.map((tip) => (
              <div key={tip} className="flex items-start justify-center gap-2">
                <span className="text-accent-primary mt-0.5">•</span>
                <span>{t(`welcomeMessage.tips.${tip}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
