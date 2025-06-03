import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UpdateProgressData } from '@common/types'; // Assuming UpdateProgressData is in @common/types
import { ROUTES } from '@renderer/utils/routes';
import Button from '@renderer/components/Button';
import Spinner from '@renderer/components/Spinner';
import Section from '@renderer/components/Section';
import Text from '@renderer/components/Text';
import { useSettings } from '@renderer/context/SettingsContext'; // To check onboardingFinished

const StartupStatusPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings(); // Get settings to decide next route

  const [currentStep, setCurrentStep] = useState<string>(t('startupStatusPage.initializing'));
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [errorOccurred, setErrorOccurred] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStack, setErrorStack] = useState<string | null>(null);
  const [setupComplete, setSetupComplete] = useState<boolean>(false);

  useEffect(() => {
    const handleStartupProgress = (_event: Electron.IpcRendererEvent, data: UpdateProgressData) => {
      setCurrentStep(data.step);
      setCurrentMessage(data.message);

      if (data.isError) {
        setErrorOccurred(true);
        setErrorMessage(data.errorMessage || t('startupStatusPage.unknownError'));
        setErrorStack(data.errorStack || null);
        setSetupComplete(false); // Ensure setup is not marked as complete if an error occurs
      } else if (data.step === 'Setup Complete' || data.message.includes('Application setup finished successfully')) {
        // Specific condition to mark setup as complete from main process message
        setSetupComplete(true);
        setErrorOccurred(false); // Ensure no error state if setup completes successfully
      }
    };

    const removeListener = window.electron.ipcRenderer.on('STARTUP_PROGRESS_UPDATE', handleStartupProgress);

    // Timeout to handle cases where startup is very fast and no messages are received,
    // or if the main process fails to send a completion message.
    const timer = setTimeout(() => {
      if (!errorOccurred && !setupComplete) {
        // If no error and setup not explicitly marked complete, assume it's done (e.g., already set up).
        // This is a fallback. Ideally, main process *always* sends a completion signal.
        setSetupComplete(true);
      }
    }, 5000); // 5 seconds timeout

    return () => {
      removeListener();
      clearTimeout(timer);
    };
  }, [t, errorOccurred, setupComplete]);

  useEffect(() => {
    if (setupComplete && !errorOccurred) {
      if (settings?.onboardingFinished) {
        navigate(ROUTES.Home, { replace: true });
      } else {
        navigate(ROUTES.Onboarding, { replace: true });
      }
    }
  }, [setupComplete, errorOccurred, settings, navigate]);

  const handleQuit = () => {
    window.electron.ipcRenderer.send('quit-app'); // Assuming a 'quit-app' IPC handler exists in main
  };

  if (errorOccurred) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 bg-neutral-900 text-white">
        <Section className="w-full max-w-lg p-6 bg-red-800 rounded-lg shadow-xl">
          <Text intent="h2" className="mb-4 text-center text-red-100">
            {t('startupStatusPage.errorTitle')}
          </Text>
          <Text className="mb-2 text-red-200">
            <strong>{t('startupStatusPage.errorStepLabel')}:</strong> {currentStep}
          </Text>
          <Text className="mb-2 text-red-200">
            <strong>{t('startupStatusPage.errorMessageLabel')}:</strong> {currentMessage}
          </Text>
          {errorMessage && (
            <Text className="mb-4 text-red-200 whitespace-pre-wrap">
              <strong>{t('startupStatusPage.errorDetailsLabel')}:</strong> {errorMessage}
            </Text>
          )}
          {errorStack && (
            <details className="mb-4 text-xs text-red-300">
              <summary className="cursor-pointer">{t('startupStatusPage.errorStackLabel')}</summary>
              <pre className="mt-2 p-2 bg-red-900 rounded overflow-auto">{errorStack}</pre>
            </details>
          )}
          <div className="flex justify-center space-x-4 mt-6">
            {/* <Button onClick={() => window.location.reload()} intent="secondary">
              {t('startupStatusPage.retryButton')}
            </Button> */}
            <Button onClick={handleQuit} intent="danger">
              {t('startupStatusPage.quitButton')}
            </Button>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-neutral-900 text-white">
      <Spinner size="large" />
      <Text intent="h2" className="mt-6 mb-2">
        {currentStep}
      </Text>
      <Text className="text-neutral-300">{currentMessage}</Text>
    </div>
  );
};

export default StartupStatusPage;
