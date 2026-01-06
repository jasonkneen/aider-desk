import { CgSpinner } from 'react-icons/cg';
import { clsx } from 'clsx';

type Props = {
  message: string;
  spinnerSize?: 'sm' | 'md' | 'lg';
};

export const LoadingOverlay = ({ message, spinnerSize = 'md' }: Props) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-bg-primary to-bg-primary-light z-40">
      <CgSpinner className={clsx('animate-spin', sizeClasses[spinnerSize])} />
      <div className="mt-2 text-xs text-center text-text-primary">{message}</div>
    </div>
  );
};
