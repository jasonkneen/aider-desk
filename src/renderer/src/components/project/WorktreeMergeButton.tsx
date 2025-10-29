import { useState, useRef } from 'react';
import { FaDownload } from 'react-icons/fa6';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '@reactuses/core';

import { useClickOutside } from '@/hooks/useClickOutside';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Checkbox } from '@/components/common/Checkbox';

type Props = {
  onMerge: () => void;
  onSquash: () => void;
  onOnlyUncommitted: () => void;
  disabled?: boolean;
};

export const WorktreeMergeButton = ({ onMerge, onSquash, onOnlyUncommitted, disabled }: Props) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [showSquashConfirm, setShowSquashConfirm] = useState(false);
  const [showOnlyUncommittedConfirm, setShowOnlyUncommittedConfirm] = useState(false);
  const [mergeDisabled, setMergeDisabled] = useLocalStorage('worktree-merge-confirmation-disabled', false);
  const [squashDisabled, setSquashDisabled] = useLocalStorage('worktree-squash-confirmation-disabled', false);
  const [onlyUncommittedDisabled, setOnlyUncommittedDisabled] = useLocalStorage('worktree-only-uncommitted-confirmation-disabled', false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleMergeClick = () => {
    setIsOpen(false);
    if (mergeDisabled) {
      onMerge();
    } else {
      setShowMergeConfirm(true);
    }
  };

  const handleSquashClick = () => {
    setIsOpen(false);
    if (squashDisabled) {
      onSquash();
    } else {
      setShowSquashConfirm(true);
    }
  };

  const handleOnlyUncommittedClick = () => {
    setIsOpen(false);
    if (onlyUncommittedDisabled) {
      onOnlyUncommitted();
    } else {
      setShowOnlyUncommittedConfirm(true);
    }
  };

  const handleMergeConfirm = () => {
    setShowMergeConfirm(false);
    onMerge();
  };

  const handleSquashConfirm = () => {
    setShowSquashConfirm(false);
    onSquash();
  };

  const handleOnlyUncommittedConfirm = () => {
    setShowOnlyUncommittedConfirm(false);
    onOnlyUncommitted();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 text-text-tertiary hover:bg-bg-secondary-light hover:text-text-primary focus:outline-none transition-colors duration-200 text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed"
        data-tooltip-id="merge-button-tooltip"
        data-tooltip-content={t('worktree.mergeTooltip')}
      >
        <FaDownload className="w-4 h-4" />
        <MdKeyboardArrowDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-bg-primary-light border border-border-default-dark rounded shadow-lg z-50 min-w-[140px]">
          <button onClick={handleMergeClick} className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors">
            {t('worktree.merge')}
          </button>
          <button onClick={handleSquashClick} className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors">
            {t('worktree.squash')}
          </button>
          <button
            onClick={handleOnlyUncommittedClick}
            className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {t('worktree.onlyUncommitted')}
          </button>
        </div>
      )}

      {showMergeConfirm && (
        <ConfirmDialog
          title={t('worktree.confirmMergeTitle')}
          onConfirm={handleMergeConfirm}
          onCancel={() => setShowMergeConfirm(false)}
          confirmButtonText={t('worktree.merge')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('worktree.confirmMergeMessage')}</p>
          <Checkbox label={t('worktree.dontAskAgain')} checked={mergeDisabled || false} onChange={setMergeDisabled} />
        </ConfirmDialog>
      )}

      {showSquashConfirm && (
        <ConfirmDialog
          title={t('worktree.confirmSquashTitle')}
          onConfirm={handleSquashConfirm}
          onCancel={() => setShowSquashConfirm(false)}
          confirmButtonText={t('worktree.squash')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('worktree.confirmSquashMessage')}</p>
          <Checkbox label={t('worktree.dontAskAgain')} checked={squashDisabled || false} onChange={setSquashDisabled} />
        </ConfirmDialog>
      )}

      {showOnlyUncommittedConfirm && (
        <ConfirmDialog
          title={t('worktree.confirmOnlyUncommittedTitle')}
          onConfirm={handleOnlyUncommittedConfirm}
          onCancel={() => setShowOnlyUncommittedConfirm(false)}
          confirmButtonText={t('worktree.onlyUncommitted')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('worktree.confirmOnlyUncommittedMessage')}</p>
          <Checkbox label={t('worktree.dontAskAgain')} checked={onlyUncommittedDisabled || false} onChange={setOnlyUncommittedDisabled} />
        </ConfirmDialog>
      )}
    </div>
  );
};
