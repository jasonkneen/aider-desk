import fs from 'fs/promises';
import path from 'path';

import { CustomCommand, InputHistoryData, ProjectStartMode, SettingsData, TaskData } from '@common/types';
import { fileExists } from '@common/utils';

import { getAllFiles } from '@/utils/file-system';
import { McpManager } from '@/agent';
import { Connector } from '@/connector';
import { DataManager } from '@/data-manager';
import logger from '@/logger';
import { Store } from '@/store';
import { ModelManager } from '@/models';
import { CustomCommandManager } from '@/custom-commands';
import { TelemetryManager } from '@/telemetry';
import { EventManager } from '@/events';
import { Task } from '@/task';
import { migrateSessionsToTasks } from '@/project/migrations';

export class Project {
  private readonly customCommandManager: CustomCommandManager;
  private readonly tasks = new Map<string, Task>();

  private initialized = false;
  private connectors: Connector[] = [];
  private inputHistoryFile = '.aider.input.history';

  constructor(
    public readonly baseDir: string,
    private readonly store: Store,
    private readonly mcpManager: McpManager,
    private readonly telemetryManager: TelemetryManager,
    private readonly dataManager: DataManager,
    private readonly eventManager: EventManager,
    private readonly modelManager: ModelManager,
  ) {
    this.customCommandManager = new CustomCommandManager(this);
  }

  public async start(startupMode?: ProjectStartMode) {
    // Migrate sessions to tasks before starting
    await migrateSessionsToTasks(this);

    const settings = this.store.getSettings();
    const mode = startupMode ?? settings.startupMode;

    if (!this.initialized) {
      await this.loadTasks();
      this.initialized = true;
    }

    await this.customCommandManager.start();

    await this.initAutosavedTask(mode);
    await this.sendInputHistoryUpdatedEvent();

    this.eventManager.sendProjectStarted(this.baseDir);
  }

  // TODO: temporary solution for backward compatibility
  private async initAutosavedTask(mode?: ProjectStartMode) {
    if (!this.tasks.has('autosaved')) {
      await this.createTask('autosaved');
    }

    const task = this.tasks.get('autosaved')!;
    await task.init();

    try {
      // Handle different startup modes
      switch (mode) {
        case ProjectStartMode.Empty:
          // Don't load any session, start fresh
          logger.info('Starting with empty session');
          break;

        case ProjectStartMode.Last:
          // Load the autosaved session
          logger.info('Loading autosaved session');
          await task.loadContext();
          break;
      }
    } catch (error) {
      logger.error('Error loading session:', { error });
    }
  }

  private async createTask(taskId: string) {
    const task = new Task(
      this,
      taskId,
      this.store,
      this.mcpManager,
      this.customCommandManager,
      this.telemetryManager,
      this.dataManager,
      this.eventManager,
      this.modelManager,
    );
    this.tasks.set(taskId, task);
    this.eventManager.sendTaskCreated(task.task);
  }

  public async saveTask(name: string, id?: string): Promise<TaskData> {
    const savedTaskData = await this.getAutosavedTask().saveAs(name, id);

    // If a new task was created (id was not autosaved), add it to the project's task map
    if (savedTaskData.id !== 'autosaved' && !this.tasks.has(savedTaskData.id)) {
      await this.createTask(savedTaskData.id);
    }

    return savedTaskData;
  }

  private async loadTasks() {
    const tasksDir = path.join(this.baseDir, '.aider-desk', 'tasks');

    try {
      if (!(await fileExists(tasksDir))) {
        logger.debug('Tasks directory does not exist, skipping loadTasks', {
          baseDir: this.baseDir,
          tasksDir,
        });
        return;
      }

      const taskFolders = await fs.readdir(tasksDir, { withFileTypes: true });
      const taskDirs = taskFolders.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);

      logger.info(`Loading ${taskDirs.length} tasks from directory`, {
        baseDir: this.baseDir,
        tasksDir,
        taskIds: taskDirs,
      });

      for (const taskId of taskDirs) {
        await this.createTask(taskId);
      }

      logger.info('Successfully loaded tasks', {
        baseDir: this.baseDir,
        loadedTasks: taskDirs.length,
      });
    } catch (error) {
      logger.error('Failed to load tasks', {
        baseDir: this.baseDir,
        tasksDir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public getTask(taskId: string = 'autosaved') {
    return this.tasks.get(taskId) || null;
  }

  public getAutosavedTask() {
    return this.getTask('autosaved')!;
  }

  public addConnector(connector: Connector) {
    logger.info('Adding connector for base directory:', {
      baseDir: this.baseDir,
      source: connector.source,
    });

    this.connectors.push(connector);

    if (connector.taskId) {
      this.tasks.get(connector.taskId)?.addConnector(connector);
    }

    // Set input history file if provided by the connector
    if (connector.inputHistoryFile) {
      this.inputHistoryFile = connector.inputHistoryFile;
      void this.sendInputHistoryUpdatedEvent();
    }
  }

  public removeConnector(connector: Connector) {
    this.connectors = this.connectors.filter((c) => c !== connector);
  }

  public async loadInputHistory(): Promise<string[]> {
    try {
      const historyPath = path.isAbsolute(this.inputHistoryFile) ? this.inputHistoryFile : path.join(this.baseDir, this.inputHistoryFile);

      if (!(await fileExists(historyPath))) {
        return [];
      }

      const content = await fs.readFile(historyPath, 'utf8');

      if (!content) {
        return [];
      }

      const history: string[] = [];
      const lines = content.split('\n');
      let currentInput = '';

      for (const line of lines) {
        if (line.startsWith('# ')) {
          if (currentInput) {
            history.push(currentInput.trim());
            currentInput = '';
          }
        } else if (line.startsWith('+')) {
          currentInput += line.substring(1) + '\n';
        }
      }

      if (currentInput) {
        history.push(currentInput.trim());
      }

      return history.reverse();
    } catch (error) {
      logger.error('Failed to load input history:', { error });
      return [];
    }
  }

  public async addToInputHistory(message: string) {
    try {
      const history = await this.loadInputHistory();
      if (history.length > 0 && history[0] === message) {
        return;
      }

      const historyPath = path.isAbsolute(this.inputHistoryFile) ? this.inputHistoryFile : path.join(this.baseDir, this.inputHistoryFile);

      const timestamp = new Date().toISOString();
      const formattedMessage = `\n# ${timestamp}\n+${message.replace(/\n/g, '\n+')}\n`;

      await fs.appendFile(historyPath, formattedMessage);

      await this.sendInputHistoryUpdatedEvent();
    } catch (error) {
      logger.error('Failed to add to input history:', { error });
    }
  }

  private async sendInputHistoryUpdatedEvent() {
    const history = await this.loadInputHistory();
    const inputHistoryData: InputHistoryData = {
      baseDir: this.baseDir,
      messages: history,
    };
    this.eventManager.sendInputHistoryUpdated(inputHistoryData);
  }

  public async updateAutocompletionData(words: string[], models: string[]) {
    this.eventManager.sendUpdateAutocompletion(this.baseDir, words, await getAllFiles(this.baseDir), models);
  }

  public async getAddableFiles(searchRegex?: string): Promise<string[]> {
    let files = await getAllFiles(this.baseDir);

    if (searchRegex) {
      try {
        const regex = new RegExp(searchRegex, 'i');
        files = files.filter((file) => regex.test(file));
      } catch (error) {
        logger.error('Invalid regex for getAddableFiles', {
          searchRegex,
          error,
        });
      }
    }

    return files;
  }

  public getCustomCommands() {
    return this.customCommandManager.getAllCommands();
  }

  public sendCustomCommandsUpdated(commands: CustomCommand[]) {
    this.eventManager.sendCustomCommandsUpdated(this.baseDir, commands);
  }

  public async loadTask(taskId: string): Promise<void> {
    const sourceContextPath = path.join(this.baseDir, '.aider-desk', 'tasks', taskId, 'context.json');
    const targetContextPath = path.join(this.baseDir, '.aider-desk', 'tasks', 'autosaved', 'context.json');

    try {
      // Ensure the target directory exists
      await fs.mkdir(path.dirname(targetContextPath), { recursive: true });

      // Copy the context.json file
      await fs.copyFile(sourceContextPath, targetContextPath);

      // Load the context in the autosaved task
      await this.getAutosavedTask().loadContext();
    } catch (error) {
      logger.error('Failed to load task:', {
        baseDir: this.baseDir,
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async deleteTask(taskId: string): Promise<void> {
    const taskDir = path.join(this.baseDir, '.aider-desk', 'tasks', taskId);

    try {
      // Close the task if it's loaded
      const task = this.tasks.get(taskId);
      if (task) {
        await task.close(taskId === 'autosaved');
        this.tasks.delete(taskId);
      }

      // Delete the task directory
      await fs.rm(taskDir, { recursive: true, force: true });

      logger.info('Successfully deleted task', {
        baseDir: this.baseDir,
        taskId,
      });
    } catch (error) {
      logger.error('Failed to delete task:', {
        baseDir: this.baseDir,
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getTasks(): TaskData[] {
    return Array.from(this.tasks.values())
      .map((task) => task.task)
      .filter((task) => task.id !== 'autosaved');
  }

  // TODO: should be on task level
  async close() {
    this.customCommandManager.dispose();
    await this.getAutosavedTask().close();
  }

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    this.tasks.forEach((task) => {
      task.settingsChanged(oldSettings, newSettings);
    });
  }
}
