// @vitest-environment node
import { vi } from 'vitest';

// The 'electron' module is *intended* to be globally mocked via vitest.config.ts alias.
// However, if dependencies like @electron-toolkit/utils also import electron,
// we might need to mock them too if the alias isn't fully effective for them.
vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: false, // Or true, depending on what constants.ts needs for the test
    macOS: process.platform === 'darwin',
    linux: process.platform === 'linux',
    windows: process.platform === 'win32',
    // Add other properties of 'is' if used and relevant
  },
}));

// Mock logger to prevent file system errors during tests, as it's imported by ipc-handlers.ts
vi.mock('./logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    // Add any other logger methods used by the code under test
  },
  stream: { // If the logger exports a stream object that's used
    write: vi.fn(),
  }
}));


// We can directly import from 'electron' and it will use test/mocks/electron-mock.ts.
import { ipcMain, BrowserWindow as MockedBrowserWindow } from 'electron'; 

import { setupIpcHandlers } from './ipc-handlers';
import { ProjectManager } from './project-manager';
import { Store } from './store/store';
import { McpManager } from './agent/mcp-manager';
import { Agent } from './agent';
import { VersionsManager } from './versions-manager';
import { ModelInfoManager } from './model-info-manager';
import { TelemetryManager } from './telemetry-manager';
import { ProjectData } from '@common/types';

// This map will capture handlers registered via the mocked ipcMain.handle
let ipcHandlers: Map<string, (...args: any[]) => Promise<any>> = new Map();

describe('IPC Handlers', () => {
  let mockProjectManager: vi.Mocked<ProjectManager>;
  let mockStore: vi.Mocked<Store>;
  let mockMcpManager: vi.Mocked<McpManager>;
  let mockAgent: vi.Mocked<Agent>;
  let mockVersionsManager: vi.Mocked<VersionsManager>;
  let mockModelInfoManager: vi.Mocked<ModelInfoManager>;
  let mockTelemetryManager: vi.Mocked<TelemetryManager>;
  let mockMainWindow: vi.Mocked<import('electron').BrowserWindow>;


  beforeEach(async () => { 
    ipcHandlers.clear(); 
    vi.resetAllMocks(); // Resets all mocks, including those from electron-mock.ts
    
    const electronMock = await import('electron'); // Gets our aliased mock
    vi.mocked(electronMock.ipcMain.handle).mockImplementation((channel, listener) => {
      ipcHandlers.set(channel, listener);
      return Promise.resolve() as any; 
    });

    mockMainWindow = new MockedBrowserWindow({}) as vi.Mocked<import('electron').BrowserWindow>;
    
    mockStore = {
      getSettings: vi.fn(),
      saveSettings: vi.fn(),
      getOpenProjects: vi.fn(),
      setOpenProjects: vi.fn(),
      updateOpenProjectsOrder: vi.fn(),
      getRecentProjects: vi.fn(),
      addRecentProject: vi.fn(),
      removeRecentProject: vi.fn(),
      getProjectSettings: vi.fn(),
      saveProjectSettings: vi.fn(),
      getReleaseNotes: vi.fn(),
      clearReleaseNotes: vi.fn(),
    } as vi.Mocked<Store>;

    mockProjectManager = {
      updateOpenProjectsOrder: vi.fn(),
      getProject: vi.fn().mockReturnValue({
        runPrompt: vi.fn(),
        answerQuestion: vi.fn(),
        dropFile: vi.fn(),
        addFile: vi.fn(),
        loadInputHistory: vi.fn(),
        getAddableFiles: vi.fn(),
        updateModels: vi.fn(),
        setArchitectModel: vi.fn(),
        runCommand: vi.fn(),
        interruptResponse: vi.fn(),
        applyEdits: vi.fn(),
        clearContext: vi.fn(),
        removeLastMessage: vi.fn(),
        redoLastUserPrompt: vi.fn(),
        addContextMessage: vi.fn(),
        saveSession: vi.fn(),
        loadSessionMessages: vi.fn(),
        loadSessionFiles: vi.fn(),
        deleteSession: vi.fn(),
        listSessions: vi.fn(),
        exportSessionToMarkdown: vi.fn(),
      }),
      startProject: vi.fn(),
      closeProject: vi.fn(),
      restartProject: vi.fn(),
      settingsChanged: vi.fn(),
    } as vi.Mocked<ProjectManager>;

    mockMcpManager = {
      settingsChanged: vi.fn(),
      initMcpConnectors: vi.fn(),
      getMcpServerTools: vi.fn(),
    } as vi.Mocked<McpManager>;

    mockAgent = {
      settingsChanged: vi.fn(),
    } as vi.Mocked<Agent>;

    mockVersionsManager = {
      getVersions: vi.fn(),
      downloadLatestAiderDesk: vi.fn(),
    } as vi.Mocked<VersionsManager>;
    
    mockModelInfoManager = {
        getAllModelsInfo: vi.fn(),
    } as vi.Mocked<ModelInfoManager>;

    mockTelemetryManager = {
        settingsChanged: vi.fn(),
        captureProjectOpened: vi.fn(),
        captureProjectClosed: vi.fn(),
    } as vi.Mocked<TelemetryManager>;

    setupIpcHandlers(
      mockMainWindow,
      mockProjectManager,
      mockStore,
      mockMcpManager,
      mockAgent,
      mockVersionsManager,
      mockModelInfoManager,
      mockTelemetryManager
    );
  });

  describe("'update-open-projects-order' handler", () => {
    test('should call projectManager.updateOpenProjectsOrder and return its result', async () => {
      const handler = ipcHandlers.get('update-open-projects-order');
      if (!handler) {
        throw new Error("'update-open-projects-order' handler not registered by mock");
      }

      const mockBaseDirs = ['/path/projectA', '/path/projectB'];
      const mockUpdatedProjects: ProjectData[] = [
        { baseDir: '/path/projectB', settings: {}, active: false },
        { baseDir: '/path/projectA', settings: {}, active: true },
      ];

      mockProjectManager.updateOpenProjectsOrder.mockResolvedValue(mockUpdatedProjects);

      const result = await handler({}, mockBaseDirs); 

      expect(mockProjectManager.updateOpenProjectsOrder).toHaveBeenCalledTimes(1);
      expect(mockProjectManager.updateOpenProjectsOrder).toHaveBeenCalledWith(mockBaseDirs);
      expect(result).toEqual(mockUpdatedProjects);
    });

    test('should throw an error if projectManager.updateOpenProjectsOrder fails', async () => {
      const handler = ipcHandlers.get('update-open-projects-order');
      if (!handler) {
        throw new Error("'update-open-projects-order' handler not registered by mock");
      }

      const mockBaseDirs = ['/path/projectA', '/path/projectB'];
      const expectedError = new Error('Failed to update order');
      mockProjectManager.updateOpenProjectsOrder.mockRejectedValue(expectedError);

      await expect(handler({}, mockBaseDirs)).rejects.toThrow(expectedError);

      expect(mockProjectManager.updateOpenProjectsOrder).toHaveBeenCalledTimes(1);
      expect(mockProjectManager.updateOpenProjectsOrder).toHaveBeenCalledWith(mockBaseDirs);
    });
  });
});
