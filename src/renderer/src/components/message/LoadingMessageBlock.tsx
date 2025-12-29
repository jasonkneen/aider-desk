import { Message } from '@/types/message';
import { useTypingAnimation } from '@/hooks/useTypingAnimation';

type Props = {
  message: Message;
};

export const LoadingMessageBlock = ({ message }: Props) => {
  const displayedText = useTypingAnimation(message.content, 60, 3000);

  const baseClasses =
    'rounded-md p-3 mb-2 max-w-full break-words whitespace-pre-wrap text-xs bg-bg-secondary border border-border-dark-light text-text-primary';

  return (
    <div className={`${baseClasses} text-text-secondary relative group flex items-center`}>
      <span className="flex-grow">{displayedText || ' '}</span>
    </div>
  );
};
