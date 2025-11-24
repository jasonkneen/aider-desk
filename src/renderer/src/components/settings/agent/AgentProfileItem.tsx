import { AgentProfile } from '@common/types';
import { clsx } from 'clsx';

type Props = {
  profile: AgentProfile;
  isSelected: boolean;
  onClick: (id: string) => void;
};

export const AgentProfileItem = ({ profile, isSelected, onClick }: Props) => {
  return (
    <div
      onClick={() => onClick(profile.id)}
      className={clsx(
        'px-2 py-1.5 rounded-sm text-sm transition-colors cursor-pointer flex items-center justify-between',
        isSelected ? 'bg-bg-secondary-light text-text-primary' : 'text-text-primary hover:bg-bg-secondary-light',
      )}
    >
      <div className="flex items-center">
        {profile.subagent.enabled && <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: profile.subagent.color }} />}
        <span className="flex-1 text-sm">{profile.name}</span>
      </div>
    </div>
  );
};
