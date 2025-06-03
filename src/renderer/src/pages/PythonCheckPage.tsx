import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PythonValidationResult } from '@common/types';
import { checkPython } from '@renderer/utils/ipc';
import { ROUTES } from '@renderer/utils/routes';
import Button from '@renderer/components/Button';
import Spinner from '@renderer/components/Spinner';
import Section from '@renderer/components/Section';
import Text from '@renderer/components/Text';
import Modal from '@renderer/components/common/Modal'; // Import Modal
import PythonEnvVarGuide from '@renderer/components/PythonEnvVarGuide'; // Import Guide

interface PythonCheckPageProps {
  setPythonReady: (isReady: boolean) => void;
}

const PythonCheckPage: React.FC<PythonCheckPageProps> = ({ setPythonReady }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [validationResult, setValidationResult] = useState<PythonValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEnvGuideModalOpen, setIsEnvGuideModalOpen] = useState(false); // State for modal

  const performPythonCheck = async () => {
    setIsLoading(true);
    setError(null);
    setValidationResult(null);
    try {
      const result = await checkPython();
      setValidationResult(result);
      if (result.success) {
        setPythonReady(true); // Still set pythonReady for App.tsx to switch views
        navigate(ROUTES.StartupStatus); // Navigate to StartupStatusPage
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pythonCheckPage.unknownError'));
      // Ensure pythonReady is false if check fails catastrophically
      setPythonReady(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    performPythonCheck();
  }, []);

  const handleRecheck = () => {
    performPythonCheck();
  };

  const handleContinue = () => {
    // User chooses to continue despite a failed check.
    // Set pythonReady to true to allow App.tsx to proceed with routing.
    // A warning might be shown, or this state could be tracked elsewhere if needed.
    setPythonReady(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner size="large" />
        <Text className="mt-4 text-lg">{t('pythonCheckPage.checking')}</Text>
      </div>
    );
  }

  if (validationResult && !validationResult.success) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8">
        <Section className="w-full max-w-md p-6 bg-red-100 rounded-lg shadow-md">
          <Text intent="h2" className="mb-4 text-center text-red-700">
            {t('pythonCheckPage.failedTitle')}
          </Text>
          <Text className="mb-2 text-red-600">
            {validationResult.message || t('pythonCheckPage.genericFailure')}
          </Text>
          <Text className="mb-2 text-sm text-gray-700">
            {t('pythonCheckPage.versionRequirement', { versions: '3.9-3.12' })}
          </Text>
          <div className="mb-2 text-sm text-gray-700">
            {t('pythonCheckPage.aiderDeskPythonEnvVarInfo')}{' '}
            <button
              onClick={() => setIsEnvGuideModalOpen(true)}
              className="text-blue-500 hover:text-blue-400 underline focus:outline-none"
            >
              {t('pythonCheckPage.aiderDeskPythonEnvVarLink')}
            </button>
          </div>
          <div className="mb-4">
            <a
              href="https://www.python.org/downloads/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {t('pythonCheckPage.downloadPythonLink')}
            </a>
          </div>
          <div className="flex flex-col space-y-2">
            <Button onClick={handleRecheck} intent="primary">
              {t('pythonCheckPage.recheckButton')}
            </Button>
            <Button onClick={handleContinue} intent="secondary">
              {t('pythonCheckPage.continueButton')}
            </Button>
          </div>
        </Section>
        {error && (
          <Text className="mt-4 text-sm text-red-500">
            {t('pythonCheckPage.additionalErrorDetails', { error })}
          </Text>
        )}
        <Modal
          isOpen={isEnvGuideModalOpen}
          onClose={() => setIsEnvGuideModalOpen(false)}
          title={t('pythonCheckPage.envGuideModalTitle')}
          size="lg"
        >
          <PythonEnvVarGuide />
        </Modal>
      </div>
    );
  }

  // If validationResult.success is true, we now navigate away, so this part might only flash briefly or not at all.
  // Consider removing or simplifying if navigation to StartupStatus is immediate.
  // For now, keeping it as is, as App.tsx will quickly switch based on pythonReady.
  if (validationResult && validationResult.success) {
     return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner size="large" />
        <Text className="mt-4 text-lg">{t('pythonCheckPage.successNavigating')}</Text>
      </div>
    );
  }

  // Fallback for any other unhandled state, though ideally covered by above.
  // This also handles the case where 'error' state is set from the catch block.
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8">
        <Section className="w-full max-w-md p-6 bg-red-100 rounded-lg shadow-md">
          <Text intent="h2" className="mb-4 text-center text-red-700">
            {t('pythonCheckPage.errorTitle')}
          </Text>
          <Text className="mb-4 text-red-600">{error}</Text>
          <div className="flex flex-col space-y-2">
            <Button onClick={handleRecheck} intent="primary">
              {t('pythonCheckPage.recheckButton')}
            </Button>
             <Button onClick={handleContinue} intent="secondary">
              {t('pythonCheckPage.continueButton')}
            </Button>
          </div>
        </Section>
      </div>
    );
  }

  return null; // Should ideally not be reached if logic is sound
};

export default PythonCheckPage;
