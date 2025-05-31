import path from 'path';

import { is } from '@electron-toolkit/utils';
import { app } from 'electron';

if (is.dev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}

export const AIDER_DESK_TITLE = 'AiderDesk';
export const AIDER_DESK_WEBSITE = 'https://github.com/hotovo/aider-desk';
export const AIDER_DESK_DIR = path.join(app.getPath('userData'), 'aider-desk');
export const RESOURCES_DIR = is.dev ? path.join(__dirname, '..', '..', 'resources') : process.resourcesPath;
export const LOGS_DIR = path.join(AIDER_DESK_DIR, 'logs');
export const SETUP_COMPLETE_FILENAME = path.join(AIDER_DESK_DIR, 'setup-complete');
export const PYTHON_VENV_DIR = path.join(AIDER_DESK_DIR, 'python-venv');
export const PYTHON_COMMAND = process.platform === 'win32' ? path.join(PYTHON_VENV_DIR, 'Scripts', 'pythonw.exe') : path.join(PYTHON_VENV_DIR, 'bin', 'python');
export const AIDER_DESK_CONNECTOR_DIR = path.join(AIDER_DESK_DIR, 'aider-connector');
export const AIDER_DESK_MCP_SERVER_DIR = path.join(AIDER_DESK_DIR, 'mcp-server');
export const SERVER_PORT = process.env.AIDER_DESK_PORT ? parseInt(process.env.AIDER_DESK_PORT) : 24337;
export const PID_FILES_DIR = path.join(AIDER_DESK_DIR, 'aider-processes');
