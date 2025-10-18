import { MouseEvent, ReactNode, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { twMerge } from 'tailwind-merge';

import { StyledTooltip } from './StyledTooltip';

type Props = {
  icon: ReactNode;
  onClick?: () => void;
  tooltip?: ReactNode;
  className?: string;
  tooltipId?: string;
  disabled?: boolean;
};

export const IconButton = ({ icon, onClick, tooltip, className, tooltipId, disabled }: Props) => {
  const [dataTooltipId] = useState(tooltipId || `icon-button-tooltip-${uuidv4()}`);

  const combinedClassName = twMerge(
    'text-text-muted',
    'transition-opacity',
    'focus:outline-none',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-text-tertiary',
    className,
  );

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <>
      <div
        onClick={disabled || !onClick ? undefined : handleClick}
        data-tooltip-id={tooltip ? dataTooltipId : undefined}
        data-tooltip-content={typeof tooltip === 'string' && tooltipId ? tooltip : undefined}
        className={combinedClassName}
      >
        {icon}
      </div>
      {tooltip && !tooltipId && <StyledTooltip id={dataTooltipId} content={tooltip} />}
    </>
  );
};
