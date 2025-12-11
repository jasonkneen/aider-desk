import * as fs from 'fs';

import * as lancedb from '@lancedb/lancedb';
import { FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import { MemoryEntry, MemoryEntryType } from '@common/types';
import { v4 as uuidv4 } from 'uuid';

import { AIDER_DESK_MEMORY_FILE } from '@/constants';
import logger from '@/logger';
import { Store } from '@/store';

export class MemoryManager {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private embeddingPipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
  private isInitialized = false;
  private readonly tableName = 'memories';

  constructor(private readonly store: Store) {}

  /**
   * Initialize the database connection and the local embedding model.
   * This must be called before using other methods.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const config = this.store.getSettings().memory;

      if (!config.enabled) {
        logger.info('Memory system is disabled');
        return;
      }

      // 1. Initialize the Database
      // Ensure directory exists
      if (!fs.existsSync(AIDER_DESK_MEMORY_FILE)) {
        fs.mkdirSync(AIDER_DESK_MEMORY_FILE, { recursive: true });
      }

      this.db = await lancedb.connect(AIDER_DESK_MEMORY_FILE);

      // Check if table exists, if not, we create it lazily on the first add
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(this.tableName)) {
        this.table = await this.db.openTable(this.tableName);
      }

      // 2. Initialize Local Embedding Model (Singleton pattern for the pipeline)
      if (!this.embeddingPipelinePromise) {
        logger.info('Loading local embedding model... (this may take a moment on first run)');
        // @ts-expect-error type is too complex
        this.embeddingPipelinePromise = pipeline('feature-extraction', config.model);
        await this.embeddingPipelinePromise;
      }

      this.isInitialized = true;

      logger.info('Memory manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize memory manager:', error);
      throw error;
    }
  }

  private async waitForInit(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }
    if (this.embeddingPipelinePromise) {
      await this.embeddingPipelinePromise;
    }
    return this.isInitialized;
  }

  /**
   * Generates a vector embedding for the given text using the local model.
   */
  private async getEmbedding(text: string): Promise<number[]> {
    await this.waitForInit();

    if (!this.isInitialized) {
      throw new Error('Embedding pipeline not initialized. Call initialize() first.');
    }

    const pipeline = await this.embeddingPipelinePromise;
    if (!pipeline) {
      throw new Error('Embedding pipeline not initialized. Call initialize() first.');
    }

    // Generate embedding
    // pooling: 'mean' averages the token vectors to get a single sentence vector
    // normalize: true ensures the vector is unit length for cosine similarity
    const result = await pipeline(text, { pooling: 'mean', normalize: true });

    // Convert Float32Array to standard number array for LanceDB
    return Array.from(result.data);
  }

  /**
   * Creates and stores a new memory for a specific project.
   */
  async storeMemory(projectId: string, taskId: string, type: MemoryEntryType, content: string) {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db) {
      return;
    }

    try {
      const embedding = await this.getEmbedding(content);

      const memoryWithVector = {
        id: uuidv4(),
        type,
        content,
        taskid: taskId,
        projectid: projectId,
        timestamp: Date.now(),
        vector: embedding,
      };

      if (!this.table) {
        // Create the table if it doesn't exist yet
        this.table = await this.db.createTable(this.tableName, [memoryWithVector]);
      } else {
        // Add to existing table
        await this.table.add([memoryWithVector]);
      }

      logger.debug('Stored memory entry', {
        id: memoryWithVector.id,
        type: memoryWithVector.type,
        projectId: memoryWithVector.projectid,
        taskId: memoryWithVector.taskid,
        content: memoryWithVector.content.substring(0, 100),
      });
    } catch (error) {
      logger.error('Failed to store memory:', error);
    }
  }

  /**
   * Retrieves memories for a specific project relevant to the user's query.
   * @param projectId - The project to filter by
   * @param query - The user's search query
   * @param limit - Max number of memories to return (default 5)
   */
  async retrieveMemories(projectId: string, query: string, limit: number = 5): Promise<MemoryEntry[]> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db) {
      return [];
    }

    if (!this.table) {
      return []; // No memories exist yet
    }

    const queryVector = await this.getEmbedding(query);

    // Perform Vector Search + SQL Filtering
    const results = await this.table
      .query()
      .nearestTo(queryVector) // Vector similarity search
      .where(`projectid = '${projectId}'`) // SQL-like filtering for the project
      .limit(limit)
      .select(['id', 'content', 'type', 'timestamp', 'projectid', 'taskid'])
      .toArray();

    // Map results back to MemoryEntry interface
    // Note: LanceDB returns rows, we cast them to our interface
    return results.map((result) => ({
      id: result.id as string,
      content: result.content as string,
      type: result.type as MemoryEntryType,
      timestamp: result.timestamp as number,
      projectId: result.projectid as string,
      taskId: result.taskid as string,
    }));
  }

  async getMemory(id: string): Promise<MemoryEntry | null> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db || !this.table) {
      return null;
    }

    try {
      const results = await this.table.query().where(`id = '${id}'`).select(['id', 'content', 'type', 'timestamp', 'projectid', 'taskid']).limit(1).toArray();

      if (results.length === 0) {
        return null;
      }

      const result = results[0];
      return {
        id: result.id as string,
        content: result.content as string,
        type: result.type as MemoryEntryType,
        timestamp: result.timestamp as number,
        projectId: result.projectid as string,
        taskId: result.taskid as string,
      };
    } catch (error) {
      logger.error('Failed to get memory:', error);
      return null;
    }
  }

  async deleteMemory(id: string): Promise<boolean> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db || !this.table) {
      return false;
    }

    try {
      await this.table.delete(`id = '${id}'`);
      logger.debug(`Deleted memory entry: ${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete memory:', error);
      return false;
    }
  }

  async getAllMemories(): Promise<MemoryEntry[]> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db || !this.table) {
      return [];
    }

    const results = await this.table.query().select(['id', 'content', 'type', 'timestamp', 'projectid', 'taskid']).toArray();

    // Map results back to MemoryEntry interface
    // Note: LanceDB returns rows, we cast them to our interface
    return results.map((result) => ({
      id: result.id as string,
      content: result.content as string,
      type: result.type as MemoryEntryType,
      timestamp: result.timestamp as number,
      projectId: result.projectid as string,
      taskId: result.taskid as string,
    }));
  }

  async clearAllMemories(): Promise<boolean> {
    if (!this.isInitialized || !this.isMemoryEnabled() || !this.db) {
      return false;
    }

    try {
      await this.db.dropTable(this.tableName);
      this.table = null;
      logger.info('Cleared all memories');
      return true;
    } catch (error) {
      logger.error('Failed to clear memories:', error);
      return false;
    }
  }

  isMemoryEnabled(): boolean {
    return (this.isInitialized && this.store.getSettings().memory.enabled) || false;
  }
}
