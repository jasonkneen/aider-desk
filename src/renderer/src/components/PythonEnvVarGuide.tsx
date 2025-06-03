import React from 'react';
import { useTranslation } from 'react-i18next';
import Text from '@renderer/components/Text'; // Assuming Text component
import { CodeBlock } from '@renderer/components/CodeBlock'; // Assuming CodeBlock component

const PythonEnvVarGuide: React.FC = () => {
  const { t } = useTranslation();

  // It's better to manage complex instructional text within translation files if possible,
  // but for structure, I'm putting simplified versions here.
  // Keys like 'pythonEnvGuide.windows.step1', etc., would be used.

  return (
    <div className="space-y-4 text-sm">
      <Text className="mb-3">{t('pythonEnvGuide.intro', 'Setting the AIDER_DESK_PYTHON environment variable tells AiderDesk exactly which Python executable to use. This is useful if you have multiple Python versions or if it\'s not in your system\'s default PATH.')}</Text>

      {/* Windows */}
      <section className="space-y-2">
        <Text intent="h3" className="font-semibold text-base">{t('pythonEnvGuide.windows.title', 'Windows')}</Text>
        <Text>
          {t('pythonEnvGuide.windows.method1Title', 'Method 1: System Properties (Recommended for permanent setting)')}
        </Text>
        <ol className="list-decimal list-inside pl-4 space-y-1">
          <li>{t('pythonEnvGuide.windows.method1.step1', 'Search for "environment variables" in the Start Menu and select "Edit the system environment variables".')}</li>
          <li>{t('pythonEnvGuide.windows.method1.step2', 'In the System Properties window, click the "Environment Variables..." button.')}</li>
          <li>{t('pythonEnvGuide.windows.method1.step3', 'In the "User variables" (or "System variables" for all users), click "New...".')}</li>
          <li>{t('pythonEnvGuide.windows.method1.step4', 'Variable name: AIDER_DESK_PYTHON')}</li>
          <li>{t('pythonEnvGuide.windows.method1.step5', 'Variable value: Path to your Python executable (e.g., C:\\Users\\YourUser\\AppData\\Local\\Programs\\Python\\Python310\\python.exe or C:\\Python310\\python.exe)')}</li>
          <li>{t('pythonEnvGuide.windows.method1.step6', 'Click OK on all windows to save.')}</li>
        </ol>
        <Text>
          {t('pythonEnvGuide.windows.method2Title', 'Method 2: PowerShell (Temporary for current session)')}
        </Text>
        <CodeBlock code={`$env:AIDER_DESK_PYTHON = "C:\\Path\\To\\Your\\Python\\python.exe"`} language="powershell" />
      </section>

      {/* macOS */}
      <section className="space-y-2">
        <Text intent="h3" className="font-semibold text-base">{t('pythonEnvGuide.macos.title', 'macOS')}</Text>
        <Text>{t('pythonEnvGuide.macos.instruction', 'Edit your shell configuration file (e.g., ~/.zshrc for Zsh, ~/.bash_profile or ~/.bashrc for Bash). Add the following line:')}</Text>
        <CodeBlock code={`export AIDER_DESK_PYTHON="/usr/local/bin/python3.10"`} language="bash" />
        <Text>{t('pythonEnvGuide.macos.afterAdding', 'Replace with the actual path to your desired Python executable. You can find the path by typing `which python3.10` (or your specific version) in the terminal.')}</Text>
        <Text>{t('pythonEnvGuide.macos.applyChanges', 'Apply changes by running `source ~/.zshrc` (or your respective file) or by opening a new terminal window.')}</Text>
      </section>

      {/* Linux */}
      <section className="space-y-2">
        <Text intent="h3" className="font-semibold text-base">{t('pythonEnvGuide.linux.title', 'Linux')}</Text>
        <Text>{t('pythonEnvGuide.linux.instruction', 'Edit your shell configuration file (e.g., ~/.bashrc for Bash, ~/.zshrc for Zsh). Add the following line:')}</Text>
        <CodeBlock code={`export AIDER_DESK_PYTHON="/usr/bin/python3.10"`} language="bash" />
        <Text>{t('pythonEnvGuide.linux.afterAdding', 'Replace with the actual path to your desired Python executable. You can find the path by typing `which python3.10` (or your specific version) in the terminal.')}</Text>
        <Text>{t('pythonEnvGuide.linux.applyChanges', 'Apply changes by running `source ~/.bashrc` (or your respective file) or by opening a new terminal window.')}</Text>
      </section>

      <Text className="mt-4 font-semibold">{t('pythonEnvGuide.restartAiderDesk', 'Important: Restart AiderDesk after setting the environment variable for the changes to take effect.')}</Text>
    </div>
  );
};

export default PythonEnvVarGuide;
