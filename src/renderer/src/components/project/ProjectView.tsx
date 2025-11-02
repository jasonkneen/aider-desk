import { InputHistoryData, ProjectData, ProjectStartMode, TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@reactuses/core';
import { CgSpinner } from 'react-icons/cg';

import { useSettings } from '@/contexts/SettingsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { TaskView, TaskViewRef } from '@/components/project/TaskView';
import { COLLAPSED_WIDTH, EXPANDED_WIDTH, TaskSidebar } from '@/components/project/TaskSidebar';
import { useApi } from '@/contexts/ApiContext';
import { TaskProvider } from '@/contexts/TaskContext';
import { showInfoNotification } from '@/utils/notifications';

type Props = {
  project: ProjectData;
  isActive?: boolean;
};

export const ProjectView = ({ project, isActive = false }: Props) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { projectSettings } = useProjectSettings();
  const api = useApi();

  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [starting, setStarting] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [isCollapsed, setIsCollapsed] = useLocalStorage(`task-sidebar-collapsed-${project.baseDir}`, false);
  const taskViewRef = useRef<TaskViewRef>(null);
  const activeTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) : null;

  const createNewTask = useCallback(async () => {
    if (activeTask && !activeTask.createdAt) {
      // when there is active task and is new we don't need to create new one
      return;
    }

    try {
      const newTask = await api.createNewTask(project.baseDir);
      // Task will be automatically added via the existing listener
      setActiveTaskId(newTask.id);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create new task:', error);
    }
  }, [activeTask, api, project.baseDir]);

  useEffect(() => {
    const handleStartupMode = async (tasks: TaskData[]) => {
      const mode = settings?.startupMode ?? ProjectStartMode.Empty;
      let startupTask: TaskData | null = null;

      switch (mode) {
        case ProjectStartMode.Empty: {
          startupTask = await api.createNewTask(project.baseDir);
          break;
        }
        case ProjectStartMode.Last: {
          startupTask = tasks.filter((task) => task.createdAt && task.updatedAt).sort((a, b) => b.updatedAt!.localeCompare(a.updatedAt!))[0];

          if (!startupTask) {
            startupTask = await api.createNewTask(project.baseDir);
          }
          break;
        }
      }

      if (startupTask) {
        setActiveTaskId(startupTask.id);
      }
    };

    const handleProjectStarted = () => {
      setStarting(false);
    };

    const handleTaskCreated = (taskData: TaskData) => {
      setTasks((prev) => [...prev, taskData]);
    };

    const handleTaskInitialized = (taskData: TaskData) => {
      setTasks((prev) => prev.map((task) => (task.id === taskData.id ? taskData : task)));
    };

    const handleTaskUpdated = (taskData: TaskData) => {
      setTasks((prev) => prev.map((task) => (task.id === taskData.id ? taskData : task)));
    };

    const handleTaskStarted = (taskData: TaskData) => {
      setTasks((prev) => prev.map((task) => (task.id === taskData.id ? taskData : task)));
    };

    const handleTaskCompleted = (taskData: TaskData) => {
      setTasks((prev) => prev.map((task) => (task.id === taskData.id ? taskData : task)));
    };

    const handleTaskCancelled = (taskData: TaskData) => {
      setTasks((prev) => prev.map((task) => (task.id === taskData.id ? taskData : task)));
    };

    const handleTaskDeleted = (taskData: TaskData) => {
      setTasks((prev) => prev.filter((task) => task.id !== taskData.id));
    };

    const handleInputHistoryUpdate = (data: InputHistoryData) => {
      setInputHistory(data.inputHistory);
    };

    // Set up listeners
    const removeProjectStartedListener = api.addProjectStartedListener(project.baseDir, handleProjectStarted);
    const removeTaskCreatedListener = api.addTaskCreatedListener(project.baseDir, handleTaskCreated);
    const removeTaskInitializedListener = api.addTaskInitializedListener(project.baseDir, handleTaskInitialized);
    const removeTaskUpdatedListener = api.addTaskUpdatedListener(project.baseDir, handleTaskUpdated);
    const removeTaskStartedListener = api.addTaskStartedListener(project.baseDir, handleTaskStarted);
    const removeTaskCompletedListener = api.addTaskCompletedListener(project.baseDir, handleTaskCompleted);
    const removeTaskCancelledListener = api.addTaskCancelledListener(project.baseDir, handleTaskCancelled);
    const removeTaskDeletedListener = api.addTaskDeletedListener(project.baseDir, handleTaskDeleted);

    const removeInputHistoryListener = api.addInputHistoryUpdatedListener(project.baseDir, handleInputHistoryUpdate);

    const initProject = async () => {
      try {
        // Start project
        setStarting(true);
        await api.startProject(project.baseDir);
        setStarting(false);

        // Load tasks
        setTasksLoading(true);
        const tasks = await api.getTasks(project.baseDir);
        setTasks(tasks);
        setTasksLoading(false);

        // Handle startup mode
        await handleStartupMode(tasks);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load tasks:', error);
      }
    };

    void initProject();

    return () => {
      removeProjectStartedListener();
      removeTaskCreatedListener();
      removeTaskInitializedListener();
      removeTaskUpdatedListener();
      removeTaskStartedListener();
      removeTaskCompletedListener();
      removeTaskCancelledListener();
      removeTaskDeletedListener();
      removeInputHistoryListener();
    };
  }, [api, project.baseDir, settings?.startupMode]);

  const handleTaskSelect = (taskId: string) => {
    setActiveTaskId(taskId);
  };

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleUpdateTask = useCallback(
    async (baseDir: string, taskId: string, updates: Partial<TaskData>): Promise<boolean> => {
      try {
        await api.updateTask(baseDir, taskId, updates);
        // Task will be automatically updated via the existing handleTaskUpdated listener
        return true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to update task:', error);
        return false;
      }
    },
    [api],
  );

  const handleDeleteTask = useCallback(
    async (baseDir: string, taskId: string): Promise<boolean> => {
      try {
        await api.deleteTask(baseDir, taskId);
        if (activeTaskId === taskId) {
          await createNewTask();
        }
        // Task will be automatically removed via the existing handleTaskDeleted listener
        return true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete task:', error);
        return false;
      }
    },
    [activeTaskId, api, createNewTask],
  );

  const handleExportTaskToImage = useCallback(() => {
    taskViewRef.current?.exportMessagesToImage();
  }, []);

  const handleExportTaskToMarkdown = useCallback(
    async (taskId: string) => {
      try {
        await api.exportTaskToMarkdown(project.baseDir, taskId);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to export task to markdown:', error);
      }
    },
    [api, project.baseDir],
  );

  const handleCopyTaskId = useCallback(
    (taskId: string) => {
      void navigator.clipboard.writeText(taskId);
      showInfoNotification(t('taskSidebar.taskIdCopied', { taskId }));
    },
    [t],
  );

  const renderLoading = () => {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-bg-primary to-bg-primary-light z-10">
        <CgSpinner className="animate-spin w-10 h-10" />
        <div className="mt-2 text-sm text-center text-text-primary">{t('common.startingUp')}</div>
      </div>
    );
  };

  if (!projectSettings || !settings) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-bg-primary to-bg-primary-light z-10">
        <CgSpinner className="animate-spin w-10 h-10" />
        <div className="mt-2 text-sm text-center text-text-primary">{t('common.loadingProjectSettings')}</div>
      </div>
    );
  }

  return (
    <TaskProvider baseDir={project.baseDir} tasks={tasks}>
      <div className="h-full w-full bg-gradient-to-b from-bg-primary to-bg-primary-light relative">
        {starting && renderLoading()}

        <TaskSidebar
          baseDir={project.baseDir}
          loading={tasksLoading}
          tasks={tasks}
          activeTaskId={activeTaskId}
          onTaskSelect={handleTaskSelect}
          createNewTask={createNewTask}
          className="h-full"
          isCollapsed={!!isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          updateTask={handleUpdateTask}
          deleteTask={handleDeleteTask}
          onExportToMarkdown={handleExportTaskToMarkdown}
          onExportToImage={handleExportTaskToImage}
          onCopyTaskId={handleCopyTaskId}
        />

        <div
          className={`absolute top-0 ${isCollapsed ? `left-${COLLAPSED_WIDTH}` : `left-${EXPANDED_WIDTH}`} right-0 h-full transition-left duration-300 ease-in-out`}
          style={{
            left: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
          }}
        >
          {activeTask && <TaskView key={activeTask.id} ref={taskViewRef} project={project} task={activeTask} inputHistory={inputHistory} isActive={isActive} />}
        </div>
      </div>
    </TaskProvider>
  );
};
