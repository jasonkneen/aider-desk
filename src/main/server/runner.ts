import logger from '@/logger';
import { initManagers } from '@/managers';
import { performStartUp } from '@/start-up';
import { Store } from '@/store';
import { AIDER_DESK_DATA_DIR } from '@/constants';

const main = async (): Promise<void> => {
  // Force headless mode for node-runner
  if (!process.env.AIDER_DESK_HEADLESS) {
    process.env.AIDER_DESK_HEADLESS = 'true';
  }

  logger.info('------------ Starting AiderDesk Node Runner... ------------');

  const updateProgress = ({ step, message, info, progress }: { step: string; message: string; info?: string; progress?: number }) => {
    logger.info(`[${step}] ${message}${info ? ` (${info})` : ''}${progress !== undefined ? ` [${Math.round(progress)}%]` : ''}`);
  };

  try {
    await performStartUp(updateProgress);
    logger.info('Startup complete');

    const store = new Store();
    await store.init(AIDER_DESK_DATA_DIR);
    await initManagers(store);

    logger.info('AiderDesk Node Runner is ready!');
    logger.info('API server is running. You can now interact with AiderDesk via HTTP API or Socket.IO clients.');
  } catch (error) {
    logger.error('Failed to start AiderDesk Node Runner:', error);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});
