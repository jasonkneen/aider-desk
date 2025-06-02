import { ipcMain, BrowserWindow } from 'electron';
import { setupIpcHandlers } from './ipc-handlers';
import { ProjectManager } from './project-manager';
import { Store } from './store/store';
import { McpManager } from './agent/mcp-manager';
import { Agent } from './agent';
import { VersionsManager } from './versions-manager';
import { ModelInfoManager } from './model-info-manager';
import { TelemetryManager } from './telemetry-manager';
import { ProjectData } from '@common/types';

// Mock Electron's ipcMain.handle
// We need to capture the handler function passed to it.
let ipcHandlers: Map<string, (...args: any[]) => Promise<any>> = new Map();
jest.mock('electron', () => {
  const originalElectron = jest.requireActual('electron');
  return {
    ...originalElectron,
    ipcMain: {
      ...originalElectron.ipcMain,
      handle: jest.fn((channel, listener) => {
        ipcHandlers.set(channel, listener);
      }),
      on: jest.fn(), // Mock 'on' if it's used for other handlers, though not strictly needed for this test
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
      webContents: {
        setZoomFactor: jest.fn(),
        send: jest.fn(),
      },
      isMaximized: jest.fn(),
      getPosition: jest.fn(),
      getSize: jest.fn(),
      on: jest.fn(),
      setFullScreen: jest.fn(),
      isFullScreen: jest.fn(),
    })),
    dialog: {
      showOpenDialog: jest.fn(),
    }
  };
});

describe('IPC Handlers', () => {
  let mockProjectManager: jest.Mocked<ProjectManager>;
  let mockStore: jest.Mocked<Store>;
  let mockMcpManager: jest.Mocked<McpManager>;
  let mockAgent: jest.Mocked<Agent>;
  let mockVersionsManager: jest.Mocked<VersionsManager>;
  let mockModelInfoManager: jest.Mocked<ModelInfoManager>;
  let mockTelemetryManager: jest.Mocked<TelemetryManager>;
  let mockMainWindow: jest.Mocked<BrowserWindow>;

  beforeEach(() => {
    // Clear handlers map for each test
    ipcHandlers.clear();
    (ipcMain.handle as jest.Mock).mockClear();


    // Create instances of mocks for all dependencies
    mockMainWindow = new BrowserWindow() as jest.Mocked<BrowserWindow>;
    
    // For classes, we need to mock their methods.
    // The actual constructors might not be easily mockable without deeper jest magic,
    // so we cast to any and then to the mocked type.
    mockStore = {
      getSettings: jest.fn(),
      saveSettings: jest.fn(),
      getOpenProjects: jest.fn(),
      setOpenProjects: jest.fn(),
      updateOpenProjectsOrder: jest.fn(), // Added for completeness, though PM calls it
      getRecentProjects: jest.fn(),
      addRecentProject: jest.fn(),
      removeRecentProject: jest.fn(),
      getProjectSettings: jest.fn(),
      saveProjectSettings: jest.fn(),
      getReleaseNotes: jest.fn(),
      clearReleaseNotes: jest.fn(),
    } as any as jest.Mocked<Store>;

    mockProjectManager = {
      updateOpenProjectsOrder: jest.fn(),
      getProject: jest.fn().mockReturnValue({
        runPrompt: jest.fn(),
        answerQuestion: jest.fn(),
        dropFile: jest.fn(),
        addFile: jest.fn(),
        loadInputHistory: jest.fn(),
        getAddableFiles: jest.fn(),
        updateModels: jest.fn(),
        setArchitectModel: jest.fn(),
        runCommand: jest.fn(),
        interruptResponse: jest.fn(),
        applyEdits: jest.fn(),
        clearContext: jest.fn(),
        removeLastMessage: jest.fn(),
        redoLastUserPrompt: jest.fn(),
        addContextMessage: jest.fn(),
        saveSession: jest.fn(),
        loadSessionMessages: jest.fn(),
        loadSessionFiles: jest.fn(),
        deleteSession: jest.fn(),
        listSessions: jest.fn(),
        exportSessionToMarkdown: jest.fn(),
      }),
      startProject: jest.fn(),
      closeProject: jest.fn(),
      restartProject: jest.fn(),
      settingsChanged: jest.fn(),
    } as any as jest.Mocked<ProjectManager>;

    mockMcpManager = {
      settingsChanged: jest.fn(),
      initMcpConnectors: jest.fn(),
      getMcpServerTools: jest.fn(),
    } as any as jest.Mocked<McpManager>;

    mockAgent = {
      settingsChanged: jest.fn(),
    } as any as jest.Mocked<Agent>;

    mockVersionsManager = {
      getVersions: jest.fn(),
      downloadLatestAiderDesk: jest.fn(),
    } as any as jest.Mocked<VersionsManager>;
    
    mockModelInfoManager = {
        getAllModelsInfo: jest.fn(),
    } as any as jest.Mocked<ModelInfoManager>;

    mockTelemetryManager = {
        settingsChanged: jest.fn(),
        captureProjectOpened: jest.fn(),
        captureProjectClosed: jest.fn(),
    } as any as jest.Mocked<TelemetryManager>;


    // Call setupIpcHandlers to register all handlers
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
        throw new Error("'update-open-projects-order' handler not registered");
      }

      const mockBaseDirs = ['/path/projectA', '/path/projectB'];
      const mockUpdatedProjects: ProjectData[] = [
        { baseDir: '/path/projectB', settings: {}, active: false },
        { baseDir: '/path/projectA', settings: {}, active: true },
      ];

      mockProjectManager.updateOpenProjectsOrder.mockResolvedValue(mockUpdatedProjects);

      // The first argument to the handler is the IpcMainInvokeEvent, which we can mock as null or an empty object if not used.
      const result = await handler({}, mockBaseDirs);

      expect(mockProjectManager.updateOpenProjectsOrder).toHaveBeenCalledTimes(1);
      expect(mockProjectManager.updateOpenProjectsOrder).toHaveBeenCalledWith(mockBaseDirs);
      expect(result).toEqual(mockUpdatedProjects);
    });

    test('should throw an error if projectManager.updateOpenProjectsOrder fails', async () => {
      const handler = ipcHandlers.get('update-open-projects-order');
      if (!handler) {
        throw new Error("'update-open-projects-order' handler not registered");
      }

      const mockBaseDirs = ['/path/projectA', '/path/projectB'];
      const expectedError = new Error('Failed to update order');
      mockProjectManager.updateOpenProjectsOrder.mockRejectedValue(expectedError);

      // The first argument to the handler is the IpcMainInvokeEvent
      await expect(handler({}, mockBaseDirs)).rejects.toThrow(expectedError);

      expect(mockProjectManager.updateOpenProjectsOrder).toHaveBeenCalledTimes(1);
      expect(mockProjectManager.updateOpenProjectsOrder).toHaveBeenCalledWith(mockBaseDirs);
    });
  });
});
