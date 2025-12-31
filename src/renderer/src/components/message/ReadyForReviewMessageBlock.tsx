import { RiCheckLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { Button } from '@/components/common/Button';

const baseClasses = 'rounded-md p-3 mb-2 max-w-full break-words text-xs border border-border-dark-light relative group';

type Props = {
  onMarkAsDone: () => void;
};

export const ReadyForReviewMessageBlock = ({ onMarkAsDone }: Props) => {
  const { t } = useTranslation();

  return (
    <div className={clsx(baseClasses, 'bg-info-light/10 border-info-light/30')}>
      <div className="flex items-center gap-3">
        <RiCheckLine className="h-4 w-4 flex-shrink-0 text-info-light" />
        <div className="flex-1 text-text-secondary">{t('messages.taskReadyForReview')}</div>
        <Button variant="outline" color="primary" size="xs" onClick={onMarkAsDone}>
          {t('messages.markAsDone')}
        </Button>
      </div>
    </div>
  );
};
