import { RiAlertLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

const baseClasses = 'rounded-md p-3 mb-2 max-w-full break-words text-xs border border-border-dark-light relative group';

export const InterruptedMessageBlock = () => {
  const { t } = useTranslation();

  return (
    <div className={clsx(baseClasses, 'bg-warning/10 border-warning/30')}>
      <div className="flex items-center gap-3">
        <RiAlertLine className="h-4 w-4 flex-shrink-0 text-warning" />
        <div className="flex-1 text-text-secondary">{t('messages.taskInterrupted')}</div>
      </div>
    </div>
  );
};
