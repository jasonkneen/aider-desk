import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, Dispatch, SetStateAction } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import PythonCheckPage from '@/pages/PythonCheckPage';
import StartupStatusPage from '@/pages/StartupStatusPage'; // Import StartupStatusPage
import { Onboarding } from '@/pages/Onboarding';
import { Home } from '@/pages/Home';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import 'react-toastify/dist/ReactToastify.css';
import { ROUTES } from '@/utils/routes';
import '@/i18n';
import { StyledTooltip } from '@/components/common/StyledTooltip';

const ThemeManager = () => {
  const { settings } = useSettings();

  useEffect(() => {
    const className = settings?.theme === 'light' ? 'theme-light' : 'theme-dark';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(className);
  }, [settings?.theme]);

  return null;
};

interface AnimatedRoutesProps {
  pythonReady: boolean;
  setPythonReady: Dispatch<SetStateAction<boolean>>;
}

const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ pythonReady, setPythonReady }) => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { settings } = useSettings();

  useEffect(() => {
    if (settings?.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [i18n, settings]);

  if (!pythonReady) {
    return <PythonCheckPage setPythonReady={setPythonReady} />;
  }

  // Python is ready, proceed with normal app routes
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <AnimatePresence initial={true}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, position: 'absolute', width: '100%', height: '100%' }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Ensure settings are loaded before rendering routes that might depend on them */}
          {settings && (
            <Routes location={location}>
              <Route path={ROUTES.StartupStatus} element={<StartupStatusPage />} /> {/* Add StartupStatusPage route */}
              <Route path={ROUTES.Onboarding} element={<Onboarding />} />
              <Route path={ROUTES.Home} element={<Home />} />
              {/* Default route based on onboarding status */}
              <Route
                path="/"
                element={
                  settings.onboardingFinished ? (
                    <Navigate to={ROUTES.Home} replace />
                  ) : (
                    <Navigate to={ROUTES.Onboarding} replace />
                  )
                }
              />
              {/* Fallback for any other route, redirect based on onboarding status */}
              <Route
                path="*"
                element={
                  settings.onboardingFinished ? (
                    <Navigate to={ROUTES.Home} replace />
                  ) : (
                    <Navigate to={ROUTES.Onboarding} replace />
                  )
                }
              />
            </Routes>
          )}
          <StyledTooltip id="global-tooltip-sm" />
          <StyledTooltip id="global-tooltip-md" maxWidth={600} />
          <StyledTooltip id="global-tooltip-lg" maxWidth="90%" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const App = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [pythonReady, setPythonReady] = useState(false);

  useEffect(() => {
    // Initial fade-in for the whole app
    setIsVisible(true);
  }, []);

  // The main motion.div for app visibility can remain as is.
  // AnimatedRoutes will handle the switch between PythonCheckPage and the main app content.
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: isVisible ? 1 : 0 }} transition={{ duration: 0.5, ease: 'easeIn' }}>
      <Router>
        <SettingsProvider>
          <ThemeManager />
          <AnimatedRoutes pythonReady={pythonReady} setPythonReady={setPythonReady} />
          <ToastContainer />
        </SettingsProvider>
      </Router>
    </motion.div>
  );
};

export default App;
