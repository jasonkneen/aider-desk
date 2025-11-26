import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { watch, FSWatcher } from 'chokidar';
import debounce from 'lodash/debounce';
import { DEFAULT_AGENT_PROFILES } from '@common/agent';

import type { AgentProfile } from '@common/types';

import { AIDER_DESK_AGENTS_DIR } from '@/constants';
import logger from '@/logger';

type Listener = (profiles: AgentProfile[]) => void;

interface AgentProfileContext {
  dirName: string;
  order: number;
  agentProfile: AgentProfile;
}

interface ProjectContext {
  profiles: Map<string, AgentProfileContext>;
  watchers: FSWatcher[];
  listeners: Listener[];
}

export class AgentProfileManager {
  private globalProfiles: Map<string, AgentProfileContext> = new Map();
  private projectContexts: Map<string, ProjectContext> = new Map();
  private globalWatchers: FSWatcher[] = [];
  private globalListeners: Listener[] = [];

  public async start(): Promise<void> {
    await this.initializeGlobalProfiles();
    await this.setupGlobalFileWatchers();
  }

  public addListener(listener: Listener): void {
    this.globalListeners.push(listener);
  }

  public removeListener(listener: Listener): void {
    const index = this.globalListeners.indexOf(listener);
    if (index > -1) {
      this.globalListeners.splice(index, 1);
    }
  }

  public addProjectListener(projectDir: string, listener: Listener): void {
    const context = this.projectContexts.get(projectDir);
    if (context) {
      context.listeners.push(listener);
    }
  }

  public removeProjectListener(projectDir: string, listener: Listener): void {
    const context = this.projectContexts.get(projectDir);
    if (context) {
      const index = context.listeners.indexOf(listener);
      if (index > -1) {
        context.listeners.splice(index, 1);
      }
    }
  }

  public async initializeForProject(projectDir: string): Promise<void> {
    logger.info(`Initializing agent profiles for project: ${projectDir}`);

    const context: ProjectContext = {
      profiles: new Map(),
      watchers: [],
      listeners: [],
    };

    this.projectContexts.set(projectDir, context);

    // Load project-specific profiles
    const projectAgentsDir = path.join(projectDir, AIDER_DESK_AGENTS_DIR);
    await this.loadProfilesFromDir(projectAgentsDir, projectDir, context);

    // Setup file watchers for project
    await this.setupWatcherForDirectory(projectAgentsDir, context);

    this.notifyProjectListeners(projectDir);
  }

  public removeProject(projectDir: string): void {
    logger.info(`Removing agent profiles for project: ${projectDir}`);

    const context = this.projectContexts.get(projectDir);
    if (context) {
      // Clean up watchers
      context.watchers.forEach((watcher) => watcher.close());

      // Remove context
      this.projectContexts.delete(projectDir);
    }
  }

  private notifyGlobalListeners(): void {
    const profiles = Array.from(this.globalProfiles.values()).map((ctx) => ctx.agentProfile);
    this.globalListeners.forEach((listener) => listener(profiles));
  }

  private notifyProjectListeners(projectDir: string): void {
    const context = this.projectContexts.get(projectDir);
    if (context) {
      const profiles = Array.from(context.profiles.values()).map((ctx) => ctx.agentProfile);
      context.listeners.forEach((listener) => listener(profiles));
    }
  }

  private async initializeGlobalProfiles(ensureDefaults = true): Promise<void> {
    logger.info('Initializing global agent profiles...');
    this.globalProfiles.clear();

    // Load global profiles
    const globalAgentsDir = path.join(homedir(), AIDER_DESK_AGENTS_DIR);
    await this.loadProfilesFromDir(globalAgentsDir, undefined, undefined);

    if (ensureDefaults) {
      // Ensure default profiles exist in global directory
      await this.ensureDefaultProfiles(globalAgentsDir);
    }

    this.notifyGlobalListeners();
  }

  private async ensureDefaultProfiles(globalAgentsDir: string): Promise<void> {
    try {
      await fs.mkdir(globalAgentsDir, { recursive: true });
    } catch (err) {
      logger.error(`Failed to create global agents directory ${globalAgentsDir}: ${err}`);
      return;
    }

    // Only create default profiles if the directory is empty
    const isDirectoryEmpty = await this.isAgentsDirectoryEmpty(globalAgentsDir);
    if (!isDirectoryEmpty) {
      logger.info('Agents directory is not empty, skipping default profile creation');
      return;
    }

    for (const defaultProfile of DEFAULT_AGENT_PROFILES) {
      if (this.globalProfiles.has(defaultProfile.id)) {
        continue;
      }

      const dirName = this.deriveDirNameFromName(defaultProfile.name, new Set());
      const profileDir = path.join(globalAgentsDir, dirName);
      const configPath = path.join(profileDir, 'config.json');

      try {
        await fs.access(configPath);
      } catch {
        // Config file doesn't exist, create it
        await fs.mkdir(profileDir, { recursive: true });
        await this.saveProfileToFile(defaultProfile, configPath);
        logger.info(`Created default agent profile: ${defaultProfile.id} in directory: ${dirName}`);
      }
    }
  }

  private async setupGlobalFileWatchers(): Promise<void> {
    // Clean up existing watchers
    this.globalWatchers.forEach((watcher) => watcher.close());
    this.globalWatchers = [];

    // Watch global agents directory
    const globalAgentsDir = path.join(homedir(), AIDER_DESK_AGENTS_DIR);
    await this.setupWatcherForDirectory(globalAgentsDir, undefined);
  }

  private async setupWatcherForDirectory(agentsDir: string, context?: ProjectContext): Promise<void> {
    // Create directory if it doesn't exist
    const dirExists = await fs
      .access(agentsDir)
      .then(() => true)
      .catch(() => false);
    if (!dirExists) {
      try {
        await fs.mkdir(agentsDir, { recursive: true });
      } catch (err) {
        logger.error(`Failed to create agents directory ${agentsDir}: ${err}`);
        return;
      }
    }

    const watcher = watch(agentsDir, {
      persistent: true,
      usePolling: true,
      ignoreInitial: true,
    });

    const reloadFunction = context ? () => this.debounceReloadProjectProfiles(agentsDir, context) : () => this.debounceReloadGlobalProfiles();

    watcher
      .on('add', async () => {
        await reloadFunction();
      })
      .on('change', async () => {
        await reloadFunction();
      })
      .on('unlink', async () => {
        await reloadFunction();
      })
      .on('error', (error) => {
        logger.error(`Watcher error for ${agentsDir}: ${error}`);
      });

    if (context) {
      context.watchers.push(watcher);
    } else {
      this.globalWatchers.push(watcher);
    }
  }

  private debounceReloadGlobalProfiles = debounce(async () => {
    await this.reloadGlobalProfiles();
  }, 1000);

  private debounceReloadProjectProfiles = debounce(async (agentsDir: string, context: ProjectContext) => {
    await this.reloadProjectProfiles(agentsDir, context);
  }, 1000);

  private async reloadGlobalProfiles(): Promise<void> {
    logger.info('Reloading global agent profiles...');
    await this.initializeGlobalProfiles(false);
  }

  private async reloadProjectProfiles(agentsDir: string, context: ProjectContext): Promise<void> {
    logger.info(`Reloading project agent profiles from ${agentsDir}`);

    // Find projectDir from context
    const projectDir = Array.from(this.projectContexts.entries()).find(([_, ctx]) => ctx === context)?.[0];

    if (projectDir) {
      context.profiles.clear();
      await this.loadProfilesFromDir(agentsDir, projectDir, context);
      this.notifyProjectListeners(projectDir);
    }
  }

  private deriveDirNameFromName(name: string, existingDirNames: Set<string>): string {
    const baseDirName = name.toLowerCase().replace(/\s+/g, '-');
    let dirName = baseDirName;
    let suffix = 1;

    while (existingDirNames.has(dirName)) {
      suffix++;
      dirName = `${baseDirName}-${suffix}`;
    }

    return dirName;
  }

  private async getExistingDirNames(agentsDir: string): Promise<Set<string>> {
    const dirNames = new Set<string>();

    try {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirNames.add(entry.name);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return dirNames;
  }

  private async isAgentsDirectoryEmpty(agentsDir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });

      // Check if there are any directories (profiles)
      for (const entry of entries) {
        if (entry.isDirectory()) {
          return false; // Found at least one profile directory
        }
      }

      return true; // No profile directories found
    } catch {
      // Directory doesn't exist or can't be read, treat as empty
      return true;
    }
  }

  private async loadProfilesFromDir(agentsDir: string, projectDir?: string, context?: ProjectContext): Promise<void> {
    const dirExists = await fs
      .access(agentsDir)
      .then(() => true)
      .catch(() => false);
    if (!dirExists) {
      logger.info(`Agents directory does not exist, skipping: ${agentsDir}`);
      return;
    }

    logger.info(`Loading agent profiles from ${agentsDir}`);

    // Load order first
    const order = await this.loadOrderFile(agentsDir);
    const profilesMap = new Map<string, AgentProfileContext>();

    try {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const configPath = path.join(agentsDir, entry.name, 'config.json');
          const profile = await this.loadProfileFile(configPath, projectDir);

          if (profile) {
            const profileContext: AgentProfileContext = {
              dirName: entry.name,
              order: 0, // Will be set by order file
              agentProfile: profile,
            };
            profilesMap.set(profile.id, profileContext);
          }
        }
      }

      // Apply order to profiles
      const orderedProfiles = this.applyOrderToProfiles(profilesMap, order);

      // If no order file exists, create one based on current order
      if (order.size === 0 && profilesMap.size > 0) {
        await this.createDefaultOrderFromProfiles(orderedProfiles, agentsDir);
      }

      // Store profiles in the appropriate location
      if (context) {
        context.profiles = orderedProfiles;
      } else {
        this.globalProfiles = orderedProfiles;
      }
    } catch (err) {
      logger.error(`Failed to read agents directory ${agentsDir}: ${err}`);
    }
  }

  private async loadProfileFile(filePath: string, projectDir?: string): Promise<AgentProfile | null> {
    try {
      logger.debug(`Loading agent profile from ${filePath}`);

      const content = await fs.readFile(filePath, 'utf-8');
      const profile: AgentProfile = JSON.parse(content);

      if (!profile.id) {
        logger.warn(`Agent profile file ${filePath} has no ID`);
        return null;
      }

      const profileWithDir = {
        ...profile,
        projectDir,
      };

      logger.debug(`Loaded agent profile: ${profile.name}`);
      return profileWithDir;
    } catch (err) {
      logger.error(`Failed to parse agent profile file ${filePath}: ${err}`);
      return null;
    }
  }

  private async saveProfileToFile(profile: AgentProfile, filePath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`Failed to save agent profile to ${filePath}: ${err}`);
      throw err;
    }
  }

  private async loadOrderFile(agentsDir: string): Promise<Map<string, number>> {
    const orderPath = path.join(agentsDir, 'order.json');
    const order = new Map<string, number>();

    try {
      await fs.access(orderPath);
      const content = await fs.readFile(orderPath, 'utf-8');
      const orderData = JSON.parse(content);

      for (const [profileId, orderIndex] of Object.entries(orderData)) {
        if (typeof orderIndex === 'number') {
          order.set(profileId, orderIndex);
        }
      }

      logger.info(`Loaded order for ${order.size} profiles from ${orderPath}`);
    } catch {
      logger.info(`No order file found at ${orderPath}, will create default order`);
    }

    return order;
  }

  private async saveOrderFile(agentsDir: string, order: Map<string, number>): Promise<void> {
    const orderPath = path.join(agentsDir, 'order.json');
    const orderData: Record<string, number> = {};

    for (const [profileId, orderIndex] of Array.from(order.entries())) {
      orderData[profileId] = orderIndex;
    }

    try {
      await fs.mkdir(path.dirname(orderPath), { recursive: true });
      await fs.writeFile(orderPath, JSON.stringify(orderData, null, 2), 'utf-8');
      logger.info(`Saved order for ${order.size} profiles to ${orderPath}`);
    } catch (err) {
      logger.error(`Failed to save order file to ${orderPath}: ${err}`);
      throw err;
    }
  }

  private applyOrderToProfiles(profilesMap: Map<string, AgentProfileContext>, order: Map<string, number>): Map<string, AgentProfileContext> {
    const sortedEntries = Array.from(profilesMap.entries()).sort(([, a], [, b]) => {
      const orderA = order.get(a.agentProfile.id);
      const orderB = order.get(b.agentProfile.id);

      // If both have order, use it
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }

      // If only one has order, the one with order comes first
      if (orderA !== undefined) {
        return -1;
      }
      if (orderB !== undefined) {
        return 1;
      }

      // If neither has order, maintain original order (by name as fallback)
      return a.agentProfile.name.localeCompare(b.agentProfile.name);
    });

    return new Map(sortedEntries);
  }

  private async createDefaultOrderFromProfiles(profilesMap: Map<string, AgentProfileContext>, agentsDir: string): Promise<void> {
    const order = new Map<string, number>();
    let index = 0;
    for (const [profileId, context] of profilesMap.entries()) {
      order.set(profileId, index);
      context.order = index;
      index++;
    }
    await this.saveOrderFile(agentsDir, order);
  }

  public async createProfile(profile: AgentProfile, projectDir?: string): Promise<void> {
    if (!profile.id) {
      throw new Error('Agent profile must have an id');
    }

    const agentsDir = projectDir ? path.join(projectDir, AIDER_DESK_AGENTS_DIR) : path.join(homedir(), AIDER_DESK_AGENTS_DIR);

    // Get existing directory names for collision handling
    const existingDirNames = await this.getExistingDirNames(agentsDir);

    // Derive unique directory name
    const dirName = this.deriveDirNameFromName(profile.name, existingDirNames);

    // Create directory and save config.json
    const profileDir = path.join(agentsDir, dirName);
    const configPath = path.join(profileDir, 'config.json');

    await fs.mkdir(profileDir, { recursive: true });
    await this.saveProfileToFile(profile, configPath);

    // Reload profiles to update the cache
    if (projectDir) {
      const context = this.projectContexts.get(projectDir);
      if (context) {
        await this.reloadProjectProfiles(agentsDir, context);
      }
    } else {
      await this.reloadGlobalProfiles();
    }
  }

  public async updateProfile(profile: AgentProfile): Promise<void> {
    if (!profile.id) {
      throw new Error('Agent profile must have an id');
    }

    // Check global profiles first
    let existingContext = this.globalProfiles.get(profile.id);

    let projectContext: ProjectContext | undefined;

    // If not found globally, check project contexts
    if (!existingContext) {
      for (const [_pDir, ctx] of Array.from(this.projectContexts.entries())) {
        const foundContext = ctx.profiles.get(profile.id);
        if (foundContext) {
          existingContext = foundContext;
          projectContext = ctx;
          break;
        }
      }
    }

    if (!existingContext) {
      throw new Error(`Agent profile with id ${profile.id} not found`);
    }

    const agentsDir = existingContext.agentProfile.projectDir
      ? path.join(existingContext.agentProfile.projectDir, AIDER_DESK_AGENTS_DIR)
      : path.join(homedir(), AIDER_DESK_AGENTS_DIR);

    const configPath = path.join(agentsDir, existingContext.dirName, 'config.json');
    await this.saveProfileToFile(profile, configPath);

    // Reload profiles to update the cache
    if (projectContext) {
      await this.reloadProjectProfiles(agentsDir, projectContext);
    } else {
      await this.reloadGlobalProfiles();
    }
  }

  public async deleteProfile(profileId: string): Promise<void> {
    // Check global profiles first
    let existingContext = this.globalProfiles.get(profileId);

    let projectContext: ProjectContext | undefined;

    // If not found globally, check project contexts
    if (!existingContext) {
      for (const [_pDir, ctx] of Array.from(this.projectContexts.entries())) {
        const foundContext = ctx.profiles.get(profileId);
        if (foundContext) {
          existingContext = foundContext;
          projectContext = ctx;
          break;
        }
      }
    }

    if (!existingContext) {
      throw new Error(`Agent profile with id ${profileId} not found`);
    }

    const agentsDir = existingContext.agentProfile.projectDir
      ? path.join(existingContext.agentProfile.projectDir, AIDER_DESK_AGENTS_DIR)
      : path.join(homedir(), AIDER_DESK_AGENTS_DIR);

    const profileDir = path.join(agentsDir, existingContext.dirName);

    try {
      await fs.rm(profileDir, { recursive: true, force: true });
    } catch (err) {
      logger.error(`Failed to delete agent profile directory ${profileDir}: ${err}`);
      throw err;
    }

    // Reload profiles to update the cache
    if (projectContext) {
      await this.reloadProjectProfiles(agentsDir, projectContext);
    } else {
      await this.reloadGlobalProfiles();
    }
  }

  public getProfile(profileId: string, projectDir?: string): AgentProfile | undefined {
    logger.info(`Getting agent profile ${profileId} for project ${projectDir}`, {
      projectProfiles: Array.from(this.projectContexts.values()).map((ctx) => Array.from(ctx.profiles.keys())),
      globalProfiles: Array.from(this.globalProfiles.keys()),
    });
    if (projectDir) {
      const context = this.projectContexts.get(projectDir);
      if (context) {
        const profileContext = context.profiles.get(profileId);
        if (profileContext) {
          return profileContext.agentProfile;
        }
      }
    }

    // Check global profiles
    const globalContext = this.globalProfiles.get(profileId);
    return globalContext?.agentProfile;
  }

  private getOrderedProfiles(profileContexts: AgentProfileContext[]): AgentProfile[] {
    return profileContexts.sort((a, b) => a.order - b.order).map((ctx) => ctx.agentProfile);
  }

  public getAllProfiles(): AgentProfile[] {
    const allProfiles = this.getOrderedProfiles(Array.from(this.globalProfiles.values()));

    for (const context of Array.from(this.projectContexts.values())) {
      allProfiles.push(...this.getOrderedProfiles(Array.from(context.profiles.values())));
    }

    return allProfiles;
  }

  public getProjectProfiles(projectDir: string, includeGlobal = true): AgentProfile[] {
    const profiles: AgentProfile[] = [];

    const context = this.projectContexts.get(projectDir);
    if (context) {
      profiles.push(...this.getOrderedProfiles(Array.from(context.profiles.values())));
    }
    if (includeGlobal) {
      profiles.push(...this.getOrderedProfiles(Array.from(this.globalProfiles.values())));
    }

    return profiles;
  }

  public async updateAgentProfilesOrder(agentProfiles: AgentProfile[], baseDir?: string): Promise<void> {
    const agentsDir = baseDir ? path.join(baseDir, AIDER_DESK_AGENTS_DIR) : path.join(homedir(), AIDER_DESK_AGENTS_DIR);

    // Create order map from the provided profiles array
    const order = new Map<string, number>();
    agentProfiles.forEach((profile, index) => {
      order.set(profile.id, index);
    });

    // Save the order file
    await this.saveOrderFile(agentsDir, order);

    // Update the in-memory profiles to match the new order
    if (baseDir) {
      const context = this.projectContexts.get(baseDir);
      if (context) {
        // Update order in existing contexts
        for (const [profileId, profileContext] of context.profiles.entries()) {
          const newOrder = order.get(profileId);
          if (newOrder !== undefined) {
            profileContext.order = newOrder;
          }
        }
        this.notifyProjectListeners(baseDir);
      }
    } else {
      // Update order in global contexts
      for (const [profileId, profileContext] of this.globalProfiles.entries()) {
        const newOrder = order.get(profileId);
        if (newOrder !== undefined) {
          profileContext.order = newOrder;
        }
      }
      this.notifyGlobalListeners();
    }
  }

  dispose(): void {
    // Clean up global watchers and listeners
    this.globalWatchers.forEach((watcher) => watcher.close());
    this.globalWatchers = [];
    this.globalListeners = [];

    // Clean up all project contexts
    for (const context of Array.from(this.projectContexts.values())) {
      context.watchers.forEach((watcher) => watcher.close());
    }
    this.projectContexts.clear();
  }
}
