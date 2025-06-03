import { exec } from 'child_process';
import * as fs from 'fs';
import { IpcMainEvent } from 'electron';
import * as path from 'path';
import { promisify } from 'util';

import { delay } from '@common/utils';
import { is } from '@electron-toolkit/utils';

import logger from './logger';
import { getCurrentPythonLibVersion, getLatestPythonLibVersion, getPythonVenvBinPath } from './utils';
import {
  AIDER_DESK_DIR,
  SETUP_COMPLETE_FILENAME,
  PYTHON_VENV_DIR,
  AIDER_DESK_CONNECTOR_DIR,
  RESOURCES_DIR,
  PYTHON_COMMAND,
  AIDER_DESK_MCP_SERVER_DIR,
} from './constants';

const execAsync = promisify(exec);

const SUPPORTED_PYTHON_VERSIONS = ['3.12', '3.11', '3.10', '3.9'];

/**
 * Smartly finds the best Python executable on the system, preferring the newest supported version.
 * Respects the AIDER_DESK_PYTHON environment variable if set.
 * Returns the name of the executable/command to use.
 */
export const getOSPythonExecutable = async (): Promise<string> => {
  const envPython = process.env.AIDER_DESK_PYTHON;
  if (envPython) {
    return envPython;
  }

  for (const version of SUPPORTED_PYTHON_VERSIONS) {
    const candidates = [
      `python${version}`,
      `python${version[0]}`, // python3
    ];
    if (process.platform === 'win32') {
      candidates.push(`py -${version}`);
    }
    candidates.push('python3', 'python'); // Fallbacks

    for (const candidate of candidates) {
      try {
        const { stdout, stderr } = await execAsync(`${candidate} --version`, {
          windowsHide: true,
        });
        const output = (stdout || '') + (stderr || '');
        const match = output.match(/Python (\d+)\.(\d+)/);
        if (match) {
          const [major, minor] = [parseInt(match[1]), parseInt(match[2])];
          if (major === 3 && SUPPORTED_PYTHON_VERSIONS.includes(`3.${minor}`)) {
            return candidate;
          }
        }
      } catch {
        // Try next candidate
        logger.debug(`Failed to execute ${candidate}. It may not be installed or not in PATH.`);
      }
    }
  }

  throw new Error('No supported Python 3.9-3.12 executable found. Please install Python or set the AIDER_DESK_PYTHON environment variable.');
};

export type PythonValidationResult = {
  success: boolean;
  pythonPath?: string;
  version?: string;
  error?: string;
  message?: string; // User-friendly message
};

// Renamed from checkPythonVersion to avoid conflict with the startup check
const getPythonVersionValidationResult = async (pythonExecutable: string): Promise<PythonValidationResult> => {
  try {
    const command = `${pythonExecutable} --version`;
    const { stdout, stderr } = await execAsync(command, {
      windowsHide: true,
    });

    const output = (stdout || '') + (stderr || '');
    const versionMatch = output.match(/Python (\d+)\.(\d+)\.\d+/);

    if (!versionMatch) {
      return {
        success: false,
        pythonPath: pythonExecutable,
        error: `Could not determine Python version (output: '${output}').`,
        message: `Could not determine Python version from ${pythonExecutable}. You can specify a specific Python executable by setting the AIDER_DESK_PYTHON environment variable.`,
      };
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    const version = `${major}.${minor}`;

    if (major !== 3 || minor < 9 || minor > 12) {
      return {
        success: false,
        pythonPath: pythonExecutable,
        version,
        error: `Python version ${version} is not supported. Please install Python 3.9-3.12.`,
        message: `Python version ${version} found at ${pythonExecutable} is not supported. Please install Python 3.9-3.12. You can specify a specific Python executable by setting the AIDER_DESK_PYTHON environment variable.`,
      };
    }

    return {
      success: true,
      pythonPath: pythonExecutable,
      version,
      message: `Python version ${version} found at ${pythonExecutable} is compatible.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      pythonPath: pythonExecutable,
      error: `Error checking Python version: ${errorMessage}`,
      message: `Error checking Python version for ${pythonExecutable}. Please ensure Python 3.9-3.12 is installed and accessible. You can specify a specific Python executable by setting the AIDER_DESK_PYTHON environment variable. Original error: ${errorMessage}`,
    };
  }
};

export const validatePythonEnvironment = async (): Promise<PythonValidationResult> => {
  let pythonExecutable: string;
  try {
    pythonExecutable = await getOSPythonExecutable();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      message: `Python executable not found. ${errorMessage}`,
    };
  }

  return getPythonVersionValidationResult(pythonExecutable);
};

// This version is for startup and will throw an error on failure
const checkPythonVersionForStartup = async (): Promise<void> => {
  const pythonExecutable = await getOSPythonExecutable();
  const result = await getPythonVersionValidationResult(pythonExecutable);
  if (!result.success) {
    throw new Error(result.message || result.error || 'Python validation failed during startup');
  }
};

const createVirtualEnv = async (): Promise<void> => {
  const command = await getOSPythonExecutable();
  await execAsync(`${command} -m venv "${PYTHON_VENV_DIR}"`, {
    windowsHide: true,
  });
};

const setupAiderConnector = async (cleanInstall: boolean, updateProgress?: UpdateProgressFunction): Promise<void> => {
  if (!fs.existsSync(AIDER_DESK_CONNECTOR_DIR)) {
    fs.mkdirSync(AIDER_DESK_CONNECTOR_DIR, { recursive: true });
  }

  // Copy connector.py from resources
  const sourceConnectorPath = path.join(RESOURCES_DIR, 'connector/connector.py');
  const destConnectorPath = path.join(AIDER_DESK_CONNECTOR_DIR, 'connector.py');
  fs.copyFileSync(sourceConnectorPath, destConnectorPath);

  // Ensure updateProgress is passed down
  await installAiderConnectorRequirements(cleanInstall, updateProgress);
};

const installAiderConnectorRequirements = async (cleanInstall: boolean, updateProgress?: UpdateProgressFunction): Promise<void> => {
  const pythonBinPath = getPythonVenvBinPath();
  const packages = ['pip', 'aider-chat', 'python-socketio==5.12.1', 'websocket-client==1.8.0', 'nest-asyncio==1.6.0', 'boto3==1.38.25'];

  logger.info('Starting Aider connector requirements installation', { packages });

  for (let currentPackage = 0; currentPackage < packages.length; currentPackage++) {
    const pkg = packages[currentPackage];
    if (updateProgress) {
      updateProgress({
        step: 'Installing Requirements',
        message: `Installing package: ${pkg.split('==')[0]} (${currentPackage + 1}/${packages.length})`,
      });
    }
    try {
      const installCommand = `"${PYTHON_COMMAND}" -m pip install --upgrade --no-cache-dir ${pkg}`;

      if (!cleanInstall && updateProgress) { // Ensure updateProgress exists
        const packageName = pkg.split('==')[0];
        const currentVersion = await getCurrentPythonLibVersion(packageName);

        if (currentVersion) {
          if (pkg.includes('==')) {
            // Version-pinned package - check if matches required version
            const requiredVersion = pkg.split('==')[1];
            if (currentVersion === requiredVersion) {
              logger.info(`Package ${pkg} is already at required version ${requiredVersion}, skipping`);
              continue;
            }
          } else {
            // For non-version-pinned packages, check if newer version is available
            const latestVersion = await getLatestPythonLibVersion(packageName);
            if (latestVersion && currentVersion === latestVersion) {
              logger.info(`Package ${pkg} is already at latest version ${currentVersion}, skipping`);
              continue;
            }
          }
        }
        // If currentVersion is null, the package is not installed, so proceed with installation.
      }

      logger.info(`Installing package: ${pkg}`);
      const { stdout, stderr } = await execAsync(installCommand, {
        windowsHide: true,
        env: {
          ...process.env,
          VIRTUAL_ENV: PYTHON_VENV_DIR,
          PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
        },
      });

      if (stdout.trim()) {
        logger.debug(`Package ${pkg} installation output`, { stdout: stdout.trim() });
      }
      if (stderr.trim()) {
        logger.warn(`Package ${pkg} installation warnings`, { stderr: stderr.trim() });
      }
    } catch (error) {
      const errorMsg = `Failed to install Aider connector requirements. Package: ${pkg}. Error: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`Failed to install package: ${pkg}`, { // Keep original logger error format
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (updateProgress) {
        updateProgress(
          createErrorProgressData(
            'Installing Requirements', // Step name
            `Failed to install package: ${pkg}`, // User-friendly message
            error, // The original error
          ),
        );
      }
      throw new Error(errorMsg); // Re-throw the error after sending progress
    }
  }

  if (updateProgress) {
    updateProgress({
      step: 'Installing Requirements',
      message: 'Completed installing all packages',
    });
  }
  logger.info('Completed Aider connector requirements installation');
};

const setupMcpServer = async () => {
  if (is.dev) {
    logger.info('Skipping AiderDesk MCP server setup in dev mode');
    return;
  }

  if (!fs.existsSync(AIDER_DESK_MCP_SERVER_DIR)) {
    fs.mkdirSync(AIDER_DESK_MCP_SERVER_DIR, { recursive: true });
  }

  // Copy all files from the MCP server directory
  const sourceMcpServerDir = path.join(RESOURCES_DIR, 'mcp-server');

  if (fs.existsSync(sourceMcpServerDir)) {
    const files = fs.readdirSync(sourceMcpServerDir);

    for (const file of files) {
      const sourceFilePath = path.join(sourceMcpServerDir, file);
      const destFilePath = path.join(AIDER_DESK_MCP_SERVER_DIR, file);

      // Skip directories for now, only copy files
      if (fs.statSync(sourceFilePath).isFile()) {
        fs.copyFileSync(sourceFilePath, destFilePath);
      }
    }
  } else {
    logger.error(`MCP server directory not found: ${sourceMcpServerDir}`);
  }
};

const performUpdateCheck = async (updateProgress: UpdateProgressFunction): Promise<void> => {
  updateProgress({
    step: 'Update Check',
    message: 'Updating Aider connector...',
  });

  await setupAiderConnector(false, updateProgress);

  updateProgress({
    step: 'Update Check',
    message: 'Updating MCP server...',
  });

  await setupMcpServer();
};

export type UpdateProgressData = {
  step: string; // Current phase, e.g., "Creating Virtual Environment"
  message: string; // Specific progress message
  isError?: boolean; // True if this update represents a fatal error
  errorMessage?: string; // Detailed error message if isError is true
  errorStack?: string; // Optional: stack trace for debugging
};

export type UpdateProgressFunction = (data: UpdateProgressData) => void;

// Helper to create a standardized error object for updateProgress
const createErrorProgressData = (
  step: string,
  userMessage: string,
  error: unknown,
): UpdateProgressData => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  return {
    step,
    message: userMessage,
    isError: true,
    errorMessage: errorObj.message,
    errorStack: errorObj.stack,
  };
};

export const performStartUp = async (updateProgress: UpdateProgressFunction): Promise<boolean> => {
  logger.info('Starting AiderDesk setup process');

  if (fs.existsSync(SETUP_COMPLETE_FILENAME)) {
    logger.info('Setup previously completed, performing update check');
    await performUpdateCheck(updateProgress);
    return true;
  }

  updateProgress({
    step: 'AiderDesk Setup',
    message: 'Performing initial setup...',
  });

  await delay(2000);

  if (!fs.existsSync(AIDER_DESK_DIR)) {
    logger.info(`Creating AiderDesk directory: ${AIDER_DESK_DIR}`);
    fs.mkdirSync(AIDER_DESK_DIR, { recursive: true });
  }

  try {
    updateProgress({ step: 'Checking Python Installation', message: 'Verifying Python installation...' });
    logger.info('Checking Python version compatibility');
    try {
      await checkPythonVersionForStartup();
    } catch (err) {
      updateProgress(createErrorProgressData('Checking Python Installation', 'Python version check failed.', err));
      throw err; // Re-throw to be caught by the main catch block
    }

    updateProgress({ step: 'Creating Virtual Environment', message: 'Setting up Python virtual environment...' });
    logger.info(`Creating Python virtual environment in: ${PYTHON_VENV_DIR}`);
    try {
      await createVirtualEnv();
    } catch (err) {
      updateProgress(createErrorProgressData('Creating Virtual Environment', 'Failed to create Python virtual environment.', err));
      throw err;
    }

    updateProgress({ step: 'Setting Up Connector', message: 'Installing Aider connector (this may take a while)...' });
    logger.info('Setting up Aider connector');
    try {
      // Pass updateProgress down so installAiderConnectorRequirements can use it
      await setupAiderConnector(true, updateProgress);
    } catch (err) {
      // If error is from installAiderConnectorRequirements, it should have already sent a progress update.
      // This will catch errors from setupAiderConnector itself or if installAiderConnectorRequirements somehow didn't send one.
      if (!(err instanceof Error && err.message.includes('Failed to install Aider connector requirements'))) {
         updateProgress(createErrorProgressData('Setting Up Connector', 'Failed to set up Aider connector.', err));
      }
      throw err;
    }

    updateProgress({ step: 'Setting Up MCP Server', message: 'Installing MCP server...' });
    logger.info('Setting up MCP server');
    try {
      await setupMcpServer();
    } catch (err) {
      updateProgress(createErrorProgressData('Setting Up MCP Server', 'Failed to set up MCP server.', err));
      throw err;
    }

    updateProgress({ step: 'Finishing Setup', message: 'Completing installation...' });
    logger.info(`Creating setup complete file: ${SETUP_COMPLETE_FILENAME}`);
    fs.writeFileSync(SETUP_COMPLETE_FILENAME, new Date().toISOString());

    logger.info('AiderDesk setup completed successfully');
    return true;
  } catch (error) { // This is the main catch block for performStartUp
    // The error should have already been sent with details by the specific step's catch block.
    // This main catch block is now primarily for logging the overall failure and cleanup.
    const finalErrorMessage = error instanceof Error ? error.message : String(error);
    logger.error('AiderDesk setup failed', { error: finalErrorMessage, stack: error instanceof Error ? error.stack : undefined });

    // Clean up if setup fails
    if (fs.existsSync(PYTHON_VENV_DIR)) {
      logger.info(`Removing virtual environment directory: ${PYTHON_VENV_DIR}`);
      fs.rmSync(PYTHON_VENV_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(SETUP_COMPLETE_FILENAME)) {
      logger.info(`Removing setup complete file: ${SETUP_COMPLETE_FILENAME}`);
      fs.unlinkSync(SETUP_COMPLETE_FILENAME);
    }
    throw error;
  }
};
