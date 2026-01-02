import { IoPlay } from 'react-icons/io5';
import { RiAlertLine, RiCheckLine, RiPlayLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useState } from 'react';
import { DefaultTaskState, TaskData } from '@common/types';

import { Button } from '@/components/common/Button';

type Props = {
  task: TaskData;
  onResumeTask: () => void;
  onMarkAsDone: () => void;
  onProceed?: () => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onDeleteTask?: () => void;
};

const baseClasses = 'rounded-md p-3 mb-2 max-w-full break-words text-xs border border-border-dark-light relative group';

export const TaskStateActions = ({ task, onResumeTask, onMarkAsDone, onProceed, onArchiveTask, onUnarchiveTask, onDeleteTask }: Props) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = () => {
    setIsDeleting(true);
  };

  const handleCancelDelete = () => {
    setIsDeleting(false);
  };

  const handleConfirmDelete = () => {
    setIsDeleting(false);
    onDeleteTask?.();
  };

  const handleProceedClick = () => {
    onProceed?.();
  };

  const handleArchiveClick = () => {
    onArchiveTask?.();
  };

  const handleUnarchiveClick = () => {
    onUnarchiveTask?.();
  };

  if (task.state === DefaultTaskState.Todo) {
    return (
      <div className={clsx(baseClasses, 'bg-bg-primary-light-strong border-border-dark')}>
        <div className="flex items-center gap-3">
          <RiPlayLine className="h-4 w-4 flex-shrink-0 text-info-light" />
          <div className="flex-1 text-text-secondary">{t('messages.taskTodoDescription')}</div>
          <Button variant="outline" color="primary" size="xs" onClick={onResumeTask}>
            <IoPlay className="mr-1 w-3 h-3" />
            {t('messages.execute')}
          </Button>
        </div>
      </div>
    );
  }

  if (task.state === DefaultTaskState.Interrupted) {
    return (
      <>
        <div className={clsx(baseClasses, 'bg-bg-primary-light-strong border-border-dark')}>
          <div className="flex items-center gap-3">
            <RiAlertLine className="h-4 w-4 flex-shrink-0 text-warning" />
            <div className="flex-1 text-text-secondary">{t('messages.taskInterrupted')}</div>
            <Button variant="outline" color="primary" size="xs" onClick={onResumeTask}>
              <IoPlay className="mr-1 w-3 h-3" />
              {t('messages.resume')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (task.state === DefaultTaskState.ReadyForReview) {
    return (
      <div className={clsx(baseClasses, 'bg-bg-primary-light-strong border-border-dark')}>
        <div className="flex items-center gap-3">
          <RiCheckLine className="h-4 w-4 flex-shrink-0 text-info-light" />
          <div className="flex-1 text-text-secondary">{t('messages.taskReadyForReview')}</div>
          <Button variant="outline" color="primary" size="xs" onClick={onMarkAsDone}>
            {t('messages.markAsDone')}
          </Button>
        </div>
      </div>
    );
  }

  if (task.state === DefaultTaskState.ReadyForImplementation) {
    return (
      <div className={clsx(baseClasses, 'bg-bg-primary-light-strong border-border-dark')}>
        <div className="flex items-center gap-3">
          <RiCheckLine className="h-4 w-4 flex-shrink-0 text-info-light" />
          <div className="flex-1 text-text-secondary">{t('messages.taskReadyForImplementation')}</div>
          <Button variant="outline" color="primary" size="xs" onClick={handleProceedClick}>
            <IoPlay className="mr-1 w-3 h-3" />
            {t('messages.proceed')}
          </Button>
        </div>
      </div>
    );
  }

  if (task.state === DefaultTaskState.Done) {
    const isArchived = task.archived === true;

    return (
      <div className={clsx(baseClasses, 'bg-bg-primary-light-strong border-border-dark')}>
        <div className="flex items-center gap-3">
          <RiCheckLine className="h-4 w-4 flex-shrink-0 text-success" />
          <div className="flex-1 text-text-secondary">{isArchived ? t('messages.taskDoneArchived') : t('messages.taskDone')}</div>
          {isDeleting ? (
            <>
              <Button variant="text" size="xs" onClick={handleCancelDelete}>
                {t('common.cancel')}
              </Button>
              <Button variant="contained" color="danger" size="xs" onClick={handleConfirmDelete}>
                {t('messages.confirmDelete')}
              </Button>
            </>
          ) : (
            <>
              {isArchived ? (
                <Button variant="outline" color="primary" size="xs" onClick={handleUnarchiveClick}>
                  {t('messages.unarchive')}
                </Button>
              ) : (
                <Button variant="outline" color="primary" size="xs" onClick={handleArchiveClick}>
                  {t('messages.archive')}
                </Button>
              )}
              <Button variant="outline" color="danger" size="xs" onClick={handleDeleteClick}>
                {t('common.delete')}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};
