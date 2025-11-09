import { TaskData, WorkingMode } from '@common/types';
import { useState } from 'react';
import { AiFillFolderOpen } from 'react-icons/ai';
import { IoGitBranch } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';

import { ItemConfig, ItemSelector } from '@/components/common/ItemSelector';
import { useResponsive } from '@/hooks/useResponsive';
import { WorktreeMergeButton } from '@/components/project/WorktreeMergeButton';
import { WorktreeRevertButton } from '@/components/project/WorktreeRevertButton';
import { useApi } from '@/contexts/ApiContext';

const WORKING_MODE_ITEMS: ItemConfig<WorkingMode>[] = [
  {
    value: 'local',
    icon: AiFillFolderOpen,
    labelKey: 'workingMode.local',
    tooltipKey: 'workingModeTooltip.local',
  },
  {
    value: 'worktree',
    icon: IoGitBranch,
    labelKey: 'workingMode.worktree',
    tooltipKey: 'workingModeTooltip.worktree',
  },
];

type Props = {
  task: TaskData;
  onMerge: () => void;
  onSquash: () => void;
  onOnlyUncommitted: () => void;
  onRevert: () => void;
  isMerging: boolean;
};

export const TaskWorkingMode = ({ task, onMerge, onSquash, onOnlyUncommitted, onRevert, isMerging }: Props) => {
  const { isMobile } = useResponsive();
  const { t } = useTranslation();
  const api = useApi();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleWorkingModeChanged = async (mode: WorkingMode) => {
    setIsSwitching(true);
    try {
      await api.updateTask(task.baseDir, task.id, { workingMode: mode });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update task:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="flex items-center gap-1 max-h-5">
      {isSwitching ? (
        <span className="text-2xs">{t('workingMode.switching')}</span>
      ) : (
        <>
          {task.workingMode === 'worktree' && (
            <>
              {task.lastMergeState && <WorktreeRevertButton onRevert={onRevert} disabled={isMerging} />}
              <WorktreeMergeButton onMerge={onMerge} onSquash={onSquash} onOnlyUncommitted={onOnlyUncommitted} disabled={isMerging} />
            </>
          )}
          <ItemSelector
            items={WORKING_MODE_ITEMS}
            selectedValue={task.workingMode!}
            onChange={handleWorkingModeChanged}
            popupPlacement="bottom-right"
            minWidth={120}
            iconOnly={isMobile}
          />
        </>
      )}
    </div>
  );
};
