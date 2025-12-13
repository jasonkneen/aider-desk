import { useTranslation } from 'react-i18next';
import { MdDoneAll } from 'react-icons/md';
import { VscLock, VscUnlock } from 'react-icons/vsc';

import { IconButton } from '@/components/common/IconButton';

type Props = {
  enabled: boolean;
  locked: boolean;
  onChange?: (enabled: boolean) => void;
  onLockChange?: (locked: boolean) => void;
};

export const AutoApprove = ({ enabled, locked, onChange, onLockChange }: Props) => {
  const { t } = useTranslation();

  const handleClick = () => {
    onChange?.(!enabled);
    if (enabled) {
      onLockChange?.(false);
    }
  };

  const handleLockClick = () => {
    onLockChange?.(!locked);
  };

  return (
    <div className="flex items-center ml-1 group gap-2" onClick={handleClick}>
      <div
        className="flex items-center gap-1"
        data-tooltip-id="prompt-field-tooltip"
        data-tooltip-content={t('promptField.autoApproveTooltip')}
        data-tooltip-delay-show={800}
      >
        <IconButton icon={<MdDoneAll className={`w-3.5 h-3.5 ${enabled ? 'text-agent-auto-approve' : 'text-text-muted group-hover:text-text-tertiary'}`} />} />
        <div className={`cursor-pointer text-2xs focus:outline-none ${enabled ? 'text-text-primary' : 'text-text-muted group-hover:text-text-tertiary'}`}>
          {t('promptField.autoApprove')}
        </div>
      </div>
      {enabled && (
        <IconButton
          icon={locked ? <VscLock className="w-3.5 h-3.5" /> : <VscUnlock className="w-3.5 h-3.5" />}
          onClick={handleLockClick}
          tooltip={t('promptField.autoApproveLockTooltip')}
        />
      )}
    </div>
  );
};
