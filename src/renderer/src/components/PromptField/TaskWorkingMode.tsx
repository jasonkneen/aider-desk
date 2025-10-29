import { TaskData, WorkingMode } from '@common/types';
import { AiFillFolderOpen } from 'react-icons/ai';
import { IoGitBranch } from 'react-icons/io5';

import { ItemConfig, ItemSelector } from '@/components/common/ItemSelector';
import { WorktreeMergeButton } from '@/components/project/WorktreeMergeButton';
import { WorktreeRevertButton } from '@/components/project/WorktreeRevertButton';

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
  onWorkingModeChange: (mode: WorkingMode) => void;
  onMerge: () => void;
  onSquash: () => void;
  onOnlyUncommitted: () => void;
  onRevert: () => void;
  isMerging: boolean;
};

export const TaskWorkingMode = ({ task, onWorkingModeChange, onMerge, onSquash, onOnlyUncommitted, onRevert, isMerging }: Props) => {
  return (
    <div className="flex items-center gap-1">
      {task.workingMode === 'worktree' && (
        <>
          {task.lastMergeState && <WorktreeRevertButton onRevert={onRevert} disabled={isMerging} />}
          <WorktreeMergeButton onMerge={onMerge} onSquash={onSquash} onOnlyUncommitted={onOnlyUncommitted} disabled={isMerging} />
        </>
      )}
      <ItemSelector items={WORKING_MODE_ITEMS} selectedValue={task.workingMode!} onChange={onWorkingModeChange} popupPlacement="bottom-right" minWidth={120} />
    </div>
  );
};
