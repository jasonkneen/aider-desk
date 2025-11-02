import { TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { KeyboardEvent, MouseEvent, useState, memo, useRef } from 'react';
import { HiOutlinePencil, HiOutlineTrash, HiPlus } from 'react-icons/hi';
import { RiMenuUnfold4Line } from 'react-icons/ri';
import { FaEllipsisVertical } from 'react-icons/fa6';
import { IoLogoMarkdown } from 'react-icons/io';
import { CgSpinner } from 'react-icons/cg';
import { MdImage } from 'react-icons/md';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { BiCopy, BiDuplicate } from 'react-icons/bi';

import { useTask } from '@/contexts/TaskContext';
import { Input } from '@/components/common/Input';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { Button } from '@/components/common/Button';
import { useClickOutside } from '@/hooks/useClickOutside';

export const COLLAPSED_WIDTH = 44;
export const EXPANDED_WIDTH = 256;

type TaskMenuButtonProps = {
  onEdit: (e: MouseEvent) => void;
  onDelete: (e: MouseEvent) => void;
  onExportToMarkdown?: (e: MouseEvent) => void;
  onExportToImage?: (e: MouseEvent) => void;
  onCopyTaskId?: () => void;
  onDuplicateTask?: (e: MouseEvent) => void;
};

const TaskMenuButton = ({ onEdit, onDelete, onExportToMarkdown, onExportToImage, onCopyTaskId, onDuplicateTask }: TaskMenuButtonProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useClickOutside([menuRef, buttonRef], () => {
    setIsMenuOpen(false);
  });

  const handleMenuClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleEditClick = (e: MouseEvent) => {
    onEdit(e);
    setIsMenuOpen(false);
  };

  const handleDeleteClick = (e: MouseEvent) => {
    onDelete(e);
    setIsMenuOpen(false);
  };

  const handleExportToMarkdownClick = (e: MouseEvent) => {
    onExportToMarkdown?.(e);
    setIsMenuOpen(false);
  };

  const handleExportToImageClick = (e: MouseEvent) => {
    onExportToImage?.(e);
    setIsMenuOpen(false);
  };

  const handleCopyTaskIdClick = () => {
    onCopyTaskId?.();
    setIsMenuOpen(false);
  };

  const handleDuplicateTaskClick = (e: MouseEvent) => {
    onDuplicateTask?.(e);
    setIsMenuOpen(false);
  };

  return (
    <div className={clsx('relative flex items-center pl-2', isMenuOpen ? 'flex' : 'display-none w-0 group-hover:w-auto group-hover:display-flex')}>
      <div ref={buttonRef}>
        <button
          className={clsx(
            'transition-opacity p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-text-primary',
            !isMenuOpen && 'opacity-0 group-hover:opacity-100',
          )}
          onClick={handleMenuClick}
        >
          <FaEllipsisVertical className="w-4 h-4" />
        </button>
      </div>
      {isMenuOpen && (
        <div ref={menuRef} className="absolute right-0 top-full mt-1 w-[170px] bg-bg-secondary-light border border-border-default-dark rounded shadow-lg z-10">
          <ul className="display-none group-hover:display-block">
            <li
              className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
              onClick={handleEditClick}
            >
              <HiOutlinePencil className="w-4 h-4" />
              <span className="whitespace-nowrap">{t('taskSidebar.rename')}</span>
            </li>
            {onExportToMarkdown && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleExportToMarkdownClick}
              >
                <IoLogoMarkdown className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.exportAsMarkdown')}</span>
              </li>
            )}
            {onExportToImage && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleExportToImageClick}
              >
                <MdImage className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.exportAsImage')}</span>
              </li>
            )}
            {onCopyTaskId && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleCopyTaskIdClick}
              >
                <BiCopy className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.copyTaskId')}</span>
              </li>
            )}
            {onDuplicateTask && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleDuplicateTaskClick}
              >
                <BiDuplicate className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.duplicateTask')}</span>
              </li>
            )}
            <li
              className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
              onClick={handleDeleteClick}
            >
              <HiOutlineTrash className="w-4 h-4 text-error" />
              <span className="whitespace-nowrap">{t('taskSidebar.deleteTask')}</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

type Props = {
  baseDir: string;
  loading: boolean;
  tasks: TaskData[];
  activeTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  createNewTask?: () => void;
  className?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  updateTask?: (baseDir: string, taskId: string, updates: Partial<TaskData>) => Promise<boolean>;
  deleteTask?: (baseDir: string, taskId: string) => Promise<boolean>;
  onExportToMarkdown?: (taskId: string) => void;
  onExportToImage?: (taskId: string) => void;
  onCopyTaskId?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
};

const TaskSidebarComponent = ({
  baseDir,
  loading,
  tasks,
  activeTaskId,
  onTaskSelect,
  createNewTask,
  className,
  isCollapsed,
  onToggleCollapse,
  updateTask,
  deleteTask,
  onExportToMarkdown,
  onExportToImage,
  onCopyTaskId,
  onDuplicateTask,
}: Props) => {
  const { t } = useTranslation();
  const { getTaskState } = useTask();
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState<string>('');

  const sortedTasks = tasks.filter((task) => task.createdAt && task.updatedAt).sort((a, b) => b.updatedAt!.localeCompare(a.updatedAt!));

  const handleTaskClick = (taskId: string) => {
    onTaskSelect(taskId);
  };

  const handleDeleteClick = (e: MouseEvent, taskId: string) => {
    e.stopPropagation();
    setDeleteConfirmTaskId(taskId);
    setEditingTaskId(null);
  };

  const handleConfirmDelete = async (taskId: string) => {
    try {
      if (deleteTask) {
        await deleteTask(baseDir, taskId);
      }
      setDeleteConfirmTaskId(null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete task:', error);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmTaskId(null);
  };

  const handleEditClick = (e: MouseEvent, taskId: string, taskName: string) => {
    e.stopPropagation();
    setEditingTaskId(taskId);
    setEditTaskName(taskName);
    setDeleteConfirmTaskId(null);
  };

  const handleConfirmEdit = async (taskId: string) => {
    try {
      if (updateTask && editTaskName.trim()) {
        await updateTask(baseDir, taskId, { name: editTaskName.trim() });
      }
      setEditingTaskId(null);
      setEditTaskName('');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update task:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditTaskName('');
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleConfirmEdit(editingTaskId!);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleCreateTask = () => {
    if (createNewTask) {
      createNewTask();
    }
  };

  const renderTaskStateIcon = (taskId: string, isCollapsed: boolean = false) => {
    const taskState = getTaskState(taskId, false);
    const iconSize = isCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4';

    if (taskState?.question) {
      return <span className={clsx('text-text-primary', isCollapsed ? 'text-xs' : 'text-sm')}>?</span>;
    }
    return taskState?.processing ? <CgSpinner className={clsx('animate-spin', iconSize, 'text-text-primary')} /> : null;
  };

  const renderExpandedTaskItem = (task: TaskData) => (
    <div>
      <div
        className={clsx(
          'group relative flex items-center justify-between py-1 pl-2.5 cursor-pointer transition-colors border',
          activeTaskId === task.id ? 'bg-bg-secondary border-border-dark-light' : 'hover:bg-bg-secondary border-transparent',
        )}
        onClick={() => handleTaskClick(task.id)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-text-primary truncate">{task.name}</div>
          <div className="text-2xs text-text-muted truncate">{formatDate(task.updatedAt!)}</div>
        </div>

        <div className="flex items-center pl-2">{renderTaskStateIcon(task.id, false)}</div>

        <TaskMenuButton
          onEdit={(e) => handleEditClick(e, task.id, task.name)}
          onDelete={(e) => handleDeleteClick(e, task.id)}
          onExportToMarkdown={onExportToMarkdown ? () => onExportToMarkdown(task.id) : undefined}
          onExportToImage={onExportToImage ? () => onExportToImage(task.id) : undefined}
          onCopyTaskId={onCopyTaskId ? () => onCopyTaskId(task.id) : undefined}
          onDuplicateTask={onDuplicateTask ? () => onDuplicateTask(task.id) : undefined}
        />
      </div>

      {editingTaskId === task.id && (
        <div className="m-2 p-2 bg-bg-primary border border-border-default rounded-md">
          <Input
            value={editTaskName}
            onChange={(e) => setEditTaskName(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder={t('taskSidebar.taskNamePlaceholder')}
            className="mb-2"
            size="sm"
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="text" size="xs" color="tertiary" onClick={handleCancelEdit}>
              {t('common.cancel')}
            </Button>
            <Button variant="contained" color="primary" size="xs" onClick={() => handleConfirmEdit(task.id)}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {deleteConfirmTaskId === task.id && (
        <div className="m-2 p-2 bg-bg-primary border border-border-default rounded-md">
          <div className="text-2xs text-text-primary mb-2">{t('taskSidebar.deleteConfirm')}</div>
          <div className="flex gap-2 justify-end">
            <Button variant="text" size="xs" color="tertiary" onClick={handleCancelDelete}>
              {t('common.cancel')}
            </Button>
            <Button variant="contained" color="danger" size="xs" onClick={() => handleConfirmDelete(task.id)}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <motion.div
      className={clsx('flex flex-col h-full border-r border-border-dark-light bg-bg-primary-light-strong', className)}
      animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <StyledTooltip id="task-sidebar-tooltip" />
      <div className="flex items-center justify-between bg-bg-primary-light p-2 border-b border-border-dark-light h-10">
        <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors" onClick={onToggleCollapse}>
          <RiMenuUnfold4Line className={clsx('w-5 h-5 text-text-primary transition-transform duration-300', isCollapsed && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between w-full ml-2"
            >
              <h3 className="text-sm font-semibold uppercase h-5">{t('taskSidebar.title')}</h3>
              {createNewTask && (
                <button
                  data-tooltip-id="task-sidebar-tooltip"
                  data-tooltip-content={t('taskSidebar.createTask')}
                  className="p-1 rounded-md hover:bg-bg-tertiary transition-colors"
                  onClick={handleCreateTask}
                >
                  <HiPlus className="w-5 h-5 text-text-primary" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-bg-primary-light-strong scrollbar-thumb-border-default bg-bg-primary-light-strong py-0.5">
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <CgSpinner className="animate-spin w-6 h-6 text-text-primary" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="text-center">
                    <div className="text-sm text-text-secondary">{t('taskSidebar.noTasks')}</div>
                  </div>
                </div>
              ) : (
                <div>
                  {sortedTasks.map((task) => (
                    <div key={task.id}>{renderExpandedTaskItem(task)}</div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isCollapsed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="h-full flex items-start justify-center py-1"
            >
              {createNewTask && (
                <button
                  data-tooltip-id="task-sidebar-tooltip"
                  data-tooltip-content={t('taskSidebar.createTask')}
                  className="p-2 rounded-md hover:bg-bg-tertiary transition-colors"
                  onClick={handleCreateTask}
                >
                  <HiPlus className="w-5 h-5 text-text-primary" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Custom comparison function for React.memo
const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  // Compare primitive props
  if (
    prevProps.baseDir !== nextProps.baseDir ||
    prevProps.loading !== nextProps.loading ||
    prevProps.activeTaskId !== nextProps.activeTaskId ||
    prevProps.isCollapsed !== nextProps.isCollapsed ||
    prevProps.className !== nextProps.className
  ) {
    return false;
  }

  // Compare function props
  if (
    prevProps.onTaskSelect !== nextProps.onTaskSelect ||
    prevProps.onToggleCollapse !== nextProps.onTaskSelect ||
    prevProps.createNewTask !== nextProps.createNewTask ||
    prevProps.updateTask !== nextProps.updateTask ||
    prevProps.deleteTask !== nextProps.deleteTask
  ) {
    return false;
  }

  // Compare tasks array - shallow check first, then deep check for task properties
  if (prevProps.tasks.length !== nextProps.tasks.length) {
    return false;
  }

  // Check if tasks have changed in meaningful ways
  for (let i = 0; i < prevProps.tasks.length; i++) {
    const prevTask = prevProps.tasks[i];
    const nextTask = nextProps.tasks[i];

    if (prevTask.id !== nextTask.id) {
      return false;
    }

    // Only check properties that affect rendering
    if (prevTask.name !== nextTask.name || prevTask.updatedAt !== nextTask.updatedAt || prevTask.createdAt !== nextTask.createdAt) {
      return false;
    }
  }

  return true;
};

export const TaskSidebar = memo(TaskSidebarComponent, arePropsEqual);
