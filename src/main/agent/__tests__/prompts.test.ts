import path from 'path';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentProfile, SettingsData } from '@common/types';

import { Task } from '@/task';
import { getSystemPrompt, initializeTemplates } from '@/agent';
import { createMockAgentProfile, createMockSettings, createMockTask } from '@/__tests__/mocks';

// Mock dependencies
vi.mock('@/logger');
vi.mock('os-name', () => ({
  default: () => 'Test OS',
}));

// We need to partially unmock path and fs to allow template loading
vi.unmock('path');
vi.unmock('fs');
vi.unmock('fs/promises');

// Mock constants to point to the actual resources directory in the project root
vi.mock('@/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants')>();
  return {
    ...actual,
    RESOURCES_DIR: path.resolve(__dirname, '../../../../resources'),
  };
});

describe('Prompts with Handlebars', () => {
  let mockTask: ReturnType<typeof createMockTask>;
  let mockSettings: SettingsData;
  let mockProfile: AgentProfile;

  beforeEach(async () => {
    await initializeTemplates();

    mockTask = createMockTask();
    mockSettings = createMockSettings();
    mockProfile = createMockAgentProfile();
  });

  it('should render system prompt with all features enabled', async () => {
    const prompt = await getSystemPrompt(mockSettings, mockTask as Task, mockProfile);

    expect(prompt).toContain('<AiderDeskSystemPrompt version="1.0">');
    expect(prompt).toContain('<Objective>You are AiderDesk');
    expect(prompt).toContain('<Workflow>');
    expect(prompt).toContain('<Step number="2" title="Skills">');
    expect(prompt).toContain('<Step number="3" title="Retrieve Memory">');
    expect(prompt).toContain('<MemoryTools group="memory">');
    expect(prompt).toContain('<SubagentsProtocol enabled="true">');
    expect(prompt).toContain('<TodoManagement enabled="true" group="todo">');

    // Check workflow step numbering
    expect(prompt).toContain('<Step number="1" title="Analyze User Request">');
    expect(prompt).toContain('<Step number="2" title="Skills">');
    expect(prompt).toContain('<Step number="3" title="Retrieve Memory">');
    expect(prompt).toContain('<Step number="4" title="Gather Initial Context">');
  });

  it('should exclude memory features and renumber workflow steps', async () => {
    mockProfile.useMemoryTools = false;
    mockProfile.useSkillsTools = false;
    const prompt = await getSystemPrompt(mockSettings, mockTask as unknown as Task, mockProfile);

    expect(prompt).not.toContain('<Step number="2" title="Skills">');
    expect(prompt).not.toContain('<Step number="3" title="Retrieve Memory">');

    // "Gather Initial Context" should now be step 2
    expect(prompt).toContain('<Step number="2" title="Gather Initial Context">');
    expect(prompt).not.toContain('<MemoryTools group="memory">');
  });

  it('should respect autoApprove setting in workflow steps', async () => {
    mockTask.task.autoApprove = true;
    const prompt = await getSystemPrompt(mockSettings, mockTask as unknown as Task, mockProfile, true);

    expect(prompt).toContain('autoApprove="true"');
    expect(prompt).toContain('IMPORTANT: User confirmation is not required as auto-approve is enabled');
  });
});
