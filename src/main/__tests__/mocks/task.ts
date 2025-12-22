import { vi } from 'vitest';
import { ContextFile, TaskData } from '@common/types';

/**
 * Creates a minimal mock for Task class
 * Provides only the properties/methods needed for testing
 */
export const createMockTask = (overrides: Partial<ReturnType<typeof createMockTask>> = {}) => {
  const defaultMock = {
    getProjectDir: vi.fn((): string => '/test/project'),
    getTaskDir: vi.fn((): string => '/test/project'),
    task: { autoApprove: false } as TaskData,
    getRuleFilesAsContextFiles: vi.fn((): Promise<ContextFile[]> => Promise.resolve([])),
  };

  return { ...defaultMock, ...overrides };
};
