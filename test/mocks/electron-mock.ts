// test/mocks/electron-mock.ts
import { vi } from 'vitest';

// This map will be populated by ipcMain.handle calls in the tests
// if we need to capture handlers globally via this mock.
// However, for ipc-handlers.test.ts, it captures handlers directly.
export const ipcHandlersMap: Map<string, (...args: any[]) => Promise<any>> = new Map();

export const ipcMain = {
  handle: vi.fn((channel, listener) => {
    ipcHandlersMap.set(channel, listener);
  }),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn(),
};

export const app = {
  getPath: vi.fn(name => {
    if (name === 'userData') return '/mock/userDataPath';
    if (name === 'logs') return '/mock/logsPath';
    if (name === 'appData') return '/mock/appDataPath';
    if (name === 'desktop') return '/mock/desktopPath';
    if (name === 'documents') return '/mock/documentsPath';
    if (name === 'downloads') return '/mock/downloadsPath';
    if (name === 'home') return '/mock/homePath';
    if (name === 'temp') return '/mock/tempPath';
    return `/mock/path/${name}`;
  }),
  getVersion: vi.fn(() => '1.0.0-mock'),
  isPackaged: false,
  getName: vi.fn(() => 'AppName-Mock'),
  getLocale: vi.fn(() => 'en-US'),
  quit: vi.fn(),
  relaunch: vi.fn(),
  on: vi.fn(), // Common for app lifecycle events
  isReady: vi.fn(() => true), // Some modules might check this
};

export const mockBrowserWindowInstance = {
  webContents: {
    setZoomFactor: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
    session: {
      clearStorageData: vi.fn(),
    },
    getUserAgent: vi.fn(() => 'TestUserAgent/1.0-Mock'),
    loadURL: vi.fn(), // Added this
  },
  isMaximized: vi.fn(() => false),
  getPosition: vi.fn(() => [0, 0]),
  getSize: vi.fn(() => [800, 600]),
  on: vi.fn(),
  setFullScreen: vi.fn(),
  isFullScreen: vi.fn(() => false),
  focus: vi.fn(),
  close: vi.fn(),
  loadURL: vi.fn(),
  destroy: vi.fn(),
  setMenu: vi.fn(),
  setTitle: vi.fn(),
  show: vi.fn(), // Added this
  hide: vi.fn(), // Added this
  constructor: vi.fn(), // Mock constructor property
  // Add other BrowserWindow instance methods as needed
};

export const BrowserWindow = vi.fn(() => mockBrowserWindowInstance);
BrowserWindow.getAllWindows = vi.fn(() => []); // Static method
BrowserWindow.getFocusedWindow = vi.fn(() => null); // Static method


export const dialog = {
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showMessageBox: vi.fn(),
  showErrorBox: vi.fn(),
};

export const Menu = {
  setApplicationMenu: vi.fn(),
  buildFromTemplate: vi.fn(() => ({
    popup: vi.fn(),
    items: [],
    append: vi.fn(),
    insert: vi.fn(),
  })),
};

export const MenuItem = vi.fn().mockImplementation((options) => ({ ...options, type: options.type || 'normal' }));

export const shell = {
  openExternal: vi.fn(),
  showItemInFolder: vi.fn(),
  openPath: vi.fn(),
};

export const screen = {
  getPrimaryDisplay: vi.fn(() => ({
    workAreaSize: { width: 1920, height: 1080 },
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
  })),
  getAllDisplays: vi.fn(() => []),
  getDisplayNearestPoint: vi.fn(),
  getDisplayMatching: vi.fn(),
};

export const nativeTheme = {
  shouldUseDarkColors: false,
  on: vi.fn(),
};

export const systemPreferences = {
  getUserDefault: vi.fn(),
  // Add other systemPreferences methods if needed
};

// Default export for CJS compatibility if something tries to `require('electron')`
// though `resolve.alias` should handle ESM-style imports.
export default {
  ipcMain,
  app,
  dialog,
  BrowserWindow,
  Menu,
  MenuItem,
  shell,
  screen,
  nativeTheme,
  systemPreferences,
};
