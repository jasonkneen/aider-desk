import { IoPlay } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';
import { DefaultTaskState, TaskData } from '@common/types';

import { InterruptedMessageBlock } from './InterruptedMessageBlock';
import { ReadyForReviewMessageBlock } from './ReadyForReviewMessageBlock';

import { Button } from '@/components/common/Button';

type Props = {
  task: TaskData;
  processedMessagesLength: number;
  lastUserMessageIndex: number;
  redoLastUserPrompt: () => void;
  onMarkAsDone: () => void;
};

export const MessagesActions = ({ task, processedMessagesLength, lastUserMessageIndex, redoLastUserPrompt, onMarkAsDone }: Props) => {
  const { t } = useTranslation();

  return (
    <>
      {task.state === DefaultTaskState.Interrupted && <InterruptedMessageBlock />}
      {task.state === DefaultTaskState.ReadyForReview && <ReadyForReviewMessageBlock onMarkAsDone={onMarkAsDone} />}
      {task.state !== DefaultTaskState.InProgress && lastUserMessageIndex === processedMessagesLength - 1 && (
        <div className="flex justify-center py-4 px-6">
          <Button variant="outline" color="primary" size="xs" onClick={redoLastUserPrompt}>
            <IoPlay className="mr-1 w-3 h-3" />
            {t('messages.execute')}
          </Button>
        </div>
      )}
    </>
  );
};
