import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectData, TaskData, ModelsData } from '@common/types';

import { TaskView } from '../TaskView';

import { useApi } from '@/contexts/ApiContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { TaskState, useTask } from '@/contexts/TaskContext';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useResponsive } from '@/hooks/useResponsive';
import { createMockApi } from '@/__tests__/mocks/api';
import { createMockTaskContext, createMockModelProviderContext, createMockAgentsContext, createMockResponsive } from '@/__tests__/mocks/contexts';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock contexts
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: vi.fn(),
}));

vi.mock('@/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: vi.fn(),
}));

vi.mock('@/contexts/TaskContext', () => ({
  useTask: vi.fn(),
}));

vi.mock('@/contexts/ModelProviderContext', () => ({
  useModelProviders: vi.fn(),
}));

vi.mock('@/contexts/AgentsContext', () => ({
  useAgents: vi.fn(),
}));

vi.mock('@/hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));

// Mock hooks
vi.mock('../useSidebarWidth', () => ({
  useSidebarWidth: () => ({ width: 300, setWidth: vi.fn() }),
}));

// Mock child components
vi.mock('../TaskBar', () => ({
  TaskBar: vi.fn(({ onModelsChange, updateTask }: { onModelsChange: (models: Partial<ModelsData>) => void; updateTask: (task: Partial<TaskData>) => void }) => (
    <div data-testid="task-bar">
      <button onClick={() => onModelsChange({ mainModel: 'new-model' })}>Change Model</button>
      <button onClick={() => updateTask({ currentMode: 'architect' })}>Change Mode</button>
    </div>
  )),
}));

vi.mock('../../message/Messages', () => ({
  Messages: ({ messages }: { messages: { id: string; content: string }[] }) => (
    <div data-testid="messages">
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
    </div>
  ),
}));

vi.mock('../../message/VirtualizedMessages', () => ({
  VirtualizedMessages: ({ messages }: { messages: { id: string; content: string }[] }) => (
    <div data-testid="virtualized-messages">
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
    </div>
  ),
}));

vi.mock('../../PromptField', () => ({
  PromptField: ({ runPrompt, addFiles }: { runPrompt: (prompt: string) => void; addFiles: (files: string[], readOnly: boolean) => void }) => (
    <div data-testid="prompt-field">
      <button onClick={() => runPrompt('hello')}>Run Prompt</button>
      <button onClick={() => addFiles(['file1.ts'], false)}>Add File</button>
    </div>
  ),
}));

vi.mock('../FilesContextInfoContent', () => ({
  FilesContextInfoContent: () => <div data-testid="files-sidebar" />,
}));

vi.mock('../../terminal/TerminalView', () => ({
  TerminalView: () => <div data-testid="terminal-view" />,
}));

describe('TaskView', () => {
  const mockProject = { baseDir: '/mock/project' } as ProjectData;
  const mockTask = { id: 'task-1', currentMode: 'code' } as TaskData;
  const mockUpdateTask = vi.fn();

  const mockApi = createMockApi({
    addFile: vi.fn(),
    runPrompt: vi.fn(),
    isTerminalSupported: vi.fn(() => true),
  });

  const mockTaskState = {
    loading: false,
    loaded: true,
    processing: false,
    messages: [{ id: '1', content: 'hello', type: 'user' }],
    tokensInfo: null,
    question: null,
    todoItems: [],
    allFiles: [],
    autocompletionWords: [],
    aiderTotalCost: 0,
    contextFiles: [],
    aiderModelsData: { baseDir: '/mock/project', taskId: 'task-1', mainModel: 'gpt-4' },
  } as TaskState;

  const mockTaskContext = createMockTaskContext({
    getTaskState: vi.fn(() => mockTaskState),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue(mockApi);
    vi.mocked(useSettings).mockReturnValue({ settings: { virtualizedRendering: false, renderMarkdown: true } } as ReturnType<typeof useSettings>);
    vi.mocked(useProjectSettings).mockReturnValue({ projectSettings: { agentProfileId: 'default' } } as ReturnType<typeof useProjectSettings>);
    vi.mocked(useTask).mockReturnValue(mockTaskContext as ReturnType<typeof useTask>);
    vi.mocked(useModelProviders).mockReturnValue(createMockModelProviderContext());
    vi.mocked(useAgents).mockReturnValue(createMockAgentsContext());
    vi.mocked(useResponsive).mockReturnValue(createMockResponsive());
  });

  it('renders loading state when task state is missing', () => {
    vi.mocked(useTask).mockReturnValue(
      createMockTaskContext({
        getTaskState: vi.fn(() => null),
      }),
    );
    render(<TaskView project={mockProject} task={mockTask} updateTask={mockUpdateTask} inputHistory={[]} />);
    expect(screen.getByText('common.loadingTask')).toBeInTheDocument();
  });

  it('renders core components when loaded', () => {
    render(<TaskView project={mockProject} task={mockTask} updateTask={mockUpdateTask} inputHistory={[]} />);

    expect(screen.getByTestId('task-bar')).toBeInTheDocument();
    expect(screen.getByTestId('messages')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-field')).toBeInTheDocument();
    expect(screen.getByTestId('files-sidebar')).toBeInTheDocument();
  });

  it('uses VirtualizedMessages when setting is enabled', () => {
    vi.mocked(useSettings).mockReturnValue({ settings: { virtualizedRendering: true } } as ReturnType<typeof useSettings>);
    render(<TaskView project={mockProject} task={mockTask} updateTask={mockUpdateTask} inputHistory={[]} />);

    expect(screen.getByTestId('virtualized-messages')).toBeInTheDocument();
    expect(screen.queryByTestId('messages')).not.toBeInTheDocument();
  });

  it('calls updateTask when mode is changed in TaskBar', () => {
    render(<TaskView project={mockProject} task={mockTask} updateTask={mockUpdateTask} inputHistory={[]} />);

    fireEvent.click(screen.getByText('Change Mode'));
    expect(mockUpdateTask).toHaveBeenCalledWith({ currentMode: 'architect' });
  });

  it('calls setAiderModelsData when model is changed in TaskBar', () => {
    render(<TaskView project={mockProject} task={mockTask} updateTask={mockUpdateTask} inputHistory={[]} />);

    fireEvent.click(screen.getByText('Change Model'));
    expect(mockTaskContext.setAiderModelsData).toHaveBeenCalledWith(mockTask.id, { mainModel: 'new-model' });
  });

  it('calls api.runPrompt when prompt is submitted', () => {
    render(<TaskView project={mockProject} task={mockTask} updateTask={mockUpdateTask} inputHistory={[]} />);

    fireEvent.click(screen.getByText('Run Prompt'));
    expect(mockApi.runPrompt).toHaveBeenCalledWith(mockProject.baseDir, mockTask.id, 'hello', 'code');
  });

  it('calls api.addFile when files are added', () => {
    render(<TaskView project={mockProject} task={mockTask} updateTask={mockUpdateTask} inputHistory={[]} />);

    fireEvent.click(screen.getByText('Add File'));
    expect(mockApi.addFile).toHaveBeenCalledWith(mockProject.baseDir, mockTask.id, 'file1.ts', false);
  });
});
