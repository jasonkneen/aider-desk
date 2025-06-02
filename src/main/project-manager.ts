import { normalizeBaseDir } from '@common/utils';
import { BrowserWindow } from 'electron';
import { SettingsData } from '@common/types';
import { TelemetryManager } from 'src/main/telemetry-manager';

import { Agent } from './agent';
import logger from './logger';
import { Project } from './project';
import { Store } from './store';

export class ProjectManager {
  private projects: Project[] = [];

  constructor(
    private readonly mainWindow: BrowserWindow,
    private readonly store: Store,
    private readonly agent: Agent,
    private readonly telemetryManager: TelemetryManager,
  ) {
    this.mainWindow = mainWindow;
    this.store = store;
    this.agent = agent;
  }

  public async updateOpenProjectsOrder(baseDirs: string[]) {
    logger.info('Updating open projects order', { baseDirs });
    const updatedProjects = this.store.updateOpenProjectsOrder(baseDirs);
    // Ensure the internal 'projects' array reflects the new order if necessary.
    // This might involve re-fetching or re-sorting 'this.projects'.
    // For now, we'll assume the primary source of truth for UI order is the store.
    // If ProjectManager's 'this.projects' order needs to match, further logic is needed here.
    return updatedProjects;
  }

  private findProject(baseDir: string): Project | undefined {
    return this.projects.find((project) => normalizeBaseDir(project.baseDir) === normalizeBaseDir(baseDir));
  }

  private createProject(baseDir: string) {
    logger.info('Creating new project', { baseDir });
    const project = new Project(this.mainWindow, baseDir, this.store, this.agent, this.telemetryManager);
    this.projects.push(project);
    return project;
  }

  public getProject(baseDir: string) {
    let project = this.findProject(baseDir);

    if (!project) {
      project = this.createProject(baseDir);
    }

    return project;
  }

  public startProject(baseDir: string) {
    logger.info('Starting project', { baseDir });
    const project = this.getProject(baseDir);

    void project.start();
  }

  public async closeProject(baseDir: string) {
    const project = this.findProject(baseDir);

    if (!project) {
      logger.warn('No project found to close', { baseDir });
      return;
    }
    logger.info('Closing project', { baseDir });
    await project.close();
  }

  public async restartProject(baseDir: string): Promise<void> {
    await this.closeProject(baseDir);
    this.startProject(baseDir);
  }

  public async close(): Promise<void> {
    logger.info('Closing all projects');
    await Promise.all(this.projects.map((project) => project.close()));
    this.projects = [];
  }

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    this.projects.forEach((project) => {
      project.settingsChanged(oldSettings, newSettings);
    });
  }
}
