import { IoClose } from 'react-icons/io5';
import { twMerge } from 'tailwind-merge';

import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  label: string;
  onRemove?: () => void;
  removeTooltip?: string;
  className?: string;
};

export const Chip = ({ label, onRemove, removeTooltip, className }: Props) => {
  const tooltipId = removeTooltip ? `chip-tooltip-${label.replace(/[^a-zA-Z0-9-_]/g, '')}` : undefined;

  return (
    <div
      className={twMerge(
        'flex items-center border border-border-default bg-bg-tertiary text-text-primary text-xs px-2 py-1 pr-1 rounded-full max-w-full',
        className,
      )}
    >
      <span className="mr-1 truncate">{label}</span>
      {onRemove && (
        <>
          <IconButton
            icon={<IoClose />}
            onClick={onRemove}
            tooltipId={tooltipId}
            tooltip={removeTooltip}
            className="p-0.5 rounded-full text-text-muted-light hover:text-text-primary hover:bg-bg-fourth"
          />
          {tooltipId && <StyledTooltip id={tooltipId} />}
        </>
      )}
    </div>
  );
};
