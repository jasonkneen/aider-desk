import { join } from 'path';
import { createServer } from 'http';

import { delay } from '@common/utils';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, shell } from 'electron';
import ProgressBar from 'electron-progressbar';
import { McpManager } from 'src/main/agent/mcp-manager';

import icon from '../../resources/icon.png?asset';

import { Agent } from './agent';
import { RestApiController } from './rest-api-controller';
import { ConnectorManager } from './connector-manager';
import { setupIpcHandlers } from './ipc-handlers';
import { ProjectManager } from './project-manager';
import { performStartUp, UpdateProgressData } from './start-up';
import { Store } from './store';
import { VersionsManager } from './versions-manager';
import logger from './logger';
import { TelemetryManager } from './telemetry-manager';
import { ModelInfoManager } from './model-info-manager';

const initStore = async (): Promise<Store> => {
  const store = new Store();
  await store.init();
  return store;
};

const initWindow = async (store: Store) => {
  const lastWindowState = store.getWindowState();
  const mainWindow = new BrowserWindow({
    width: lastWindowState.width,
    height: lastWindowState.height,
    x: lastWindowState.x,
    y: lastWindowState.y,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  const saveWindowState = (): void => {
    const [width, height] = mainWindow.getSize();
    const [x, y] = mainWindow.getPosition();
    store.setWindowState({
      width,
      height,
      x,
      y,
      isMaximized: mainWindow.isMaximized(),
    });
  };

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  const telemetryManager = new TelemetryManager(store);
  await telemetryManager.init();

  const mcpManager = new McpManager();
  const activeProject = store.getOpenProjects().find((project) => project.active);

  void mcpManager.initMcpConnectors(store.getSettings().mcpServers, activeProject?.baseDir);

  const modelInfoManager = new ModelInfoManager();
  void modelInfoManager.init();

  const agent = new Agent(store, mcpManager, modelInfoManager, telemetryManager);

  // Initialize project manager
  const projectManager = new ProjectManager(mainWindow, store, agent, telemetryManager);

  // Create HTTP server
  const httpServer = createServer();

  // Create and initialize REST API controller
  const restApiController = new RestApiController(projectManager, httpServer);

  // Initialize connector manager with the server
  const connectorManager = new ConnectorManager(mainWindow, projectManager, httpServer);

  // Initialize Versions Manager (this also sets up listeners)
  const versionsManager = new VersionsManager(mainWindow, store);

  setupIpcHandlers(mainWindow, projectManager, store, mcpManager, agent, versionsManager, modelInfoManager, telemetryManager);

  const beforeQuit = async () => {
    await mcpManager.close();
    await restApiController.close();
    await connectorManager.close();
    await projectManager.close();
    versionsManager.destroy();
    await telemetryManager.destroy();
  };

  app.on('before-quit', beforeQuit);

  // Handle CTRL+C (SIGINT)
  process.on('SIGINT', async () => {
    await beforeQuit();
    process.exit(0);
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Apply saved zoom level
  const settings = store.getSettings();
  mainWindow.webContents.setZoomFactor(settings.zoomLevel ?? 1.0);

  return mainWindow;
};

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.hotovo.aider-desk');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  logger.info('Initializing fix-path...');
  (await import('fix-path')).default();

  const progressBar = new ProgressBar({
    text: 'Starting AiderDesk...',
    detail: 'Initializing...',
    closeOnComplete: false,
    indeterminate: true,
    style: {
      text: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#f1f3f5',
      },
      detail: {
        fontSize: '12px',
        color: '#adb5bd',
      },
      bar: {
        height: '16px',
        borderRadius: '4px',
        backgroundColor: '#1c2025',
      },
      value: {
        backgroundColor: '#1c2025',
        borderRadius: '4px',
      },
    },
    browserWindow: {
      width: 400,
      icon,
      backgroundColor: '#1c2025',
      webPreferences: {
        nodeIntegration: true,
      },
    },
  });

  await new Promise((resolve) => {
    progressBar.on('ready', () => {
      resolve(null);
    });
  });
  await delay(1000);

  let lastProgressData: UpdateProgressData | null = null;

  const updateProgress = (data: UpdateProgressData) => {
    lastProgressData = data; // Store the last progress update
    if (progressBar.isCompleted() || !progressBar.getOptions().browserWindow || progressBar.getOptions().browserWindow.isDestroyed()) {
      // Avoid updating a completed or destroyed progress bar
      return;
    }
    progressBar.detail = data.message;
    progressBar.text = data.step;
    if (data.isError) {
      // Potentially change style or add "(Error)" to text if desired,
      // but the main error display will be via dialog after performStartUp throws.
      // For now, just logging it here for main process visibility.
      logger.error(`Startup Error Progress: Step: ${data.step}, Message: ${data.message}, Error: ${data.errorMessage}`);
    }
  };

  try {
    await performStartUp(updateProgress);
    // Check if startup was actually successful (no error reported in last progress)
    if (lastProgressData && lastProgressData.isError) {
      // This case should ideally not be reached if performStartUp re-throws the error.
      // If it does, it means performStartUp caught an error, sent an error progress, but didn't re-throw.
      logger.warn('performStartUp completed but last progress indicated an error.');
      // Use the error information from lastProgressData for the dialog
      dialog.showErrorBox(
        `Setup Failed: ${lastProgressData.step}`,
        lastProgressData.errorMessage || lastProgressData.message || 'An unknown error occurred during setup.',
      );
      progressBar.close();
      app.quit();
      return;
    }

    updateProgress({
      step: 'Startup complete',
      message: 'Everything is ready! Have fun coding!',
    });
    progressBar.setCompleted();
    await delay(1000);
  } catch (error) { // This catches errors re-thrown by performStartUp
    progressBar.close();
    let title = 'Setup Failed';
    let content = 'An unknown error occurred during setup.';

    if (lastProgressData && lastProgressData.isError) {
      // Use the more detailed error from the last progress update
      title = `Setup Failed: ${lastProgressData.step}`;
      content = `${lastProgressData.message}\n\nDetails: ${lastProgressData.errorMessage || 'N/A'}`;
      if (lastProgressData.errorStack) {
        // Optionally, log the stack trace but don't show it in the simple error box
        logger.error("Startup error stack trace:", lastProgressData.errorStack);
      }
    } else if (error instanceof Error) {
      content = error.message;
    }

    dialog.showErrorBox(title, content);
    app.quit();
    return;
  }

  const store = await initStore();
  let mainWindowInstance: BrowserWindow | null = null; // To hold the mainWindow instance

  try {
    mainWindowInstance = await initWindow(store); // initWindow now returns the window
    // If startup was successful and we have a window, tell it.
    if (mainWindowInstance && !mainWindowInstance.isDestroyed() && (!lastProgressData || !lastProgressData.isError)) {
      mainWindowInstance.webContents.send('STARTUP_PROGRESS_UPDATE', {
        step: 'Setup Complete',
        message: 'Application setup finished successfully.',
        isError: false,
      });
    } else if (mainWindowInstance && !mainWindowInstance.isDestroyed() && lastProgressData && lastProgressData.isError) {
      // If startup failed and we have a window, tell it about the failure.
      // This is a fallback, as the dialog.showErrorBox would have already appeared.
      mainWindowInstance.webContents.send('STARTUP_PROGRESS_UPDATE', lastProgressData);
    }
  } catch (windowInitError) {
    logger.error('Failed to initialize window:', windowInitError);
    // If window initialization itself fails, there's nowhere to send IPC messages.
    // The progressBar error (if any from performStartUp) or this new error will be the main feedback.
    if (!(lastProgressData && lastProgressData.isError)) { // Avoid showing two dialogs if performStartUp already showed one
        dialog.showErrorBox('Application Error', 'Failed to initialize the application window.');
    }
    app.quit();
    return;
  } finally {
    progressBar.close(); // Close progress bar after window init attempt or if it succeeded
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Ensure mainWindowInstance is updated if a new window is created here
      initWindow(store).then(mw => mainWindowInstance = mw).catch(err => logger.error('Error re-initializing window on activate:', err));
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('exit', () => {
  app.quit();
});
