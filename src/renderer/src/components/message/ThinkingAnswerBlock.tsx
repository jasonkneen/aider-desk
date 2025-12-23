import { MouseEvent, useState } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { TfiThought } from 'react-icons/tfi';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

import { CopyMessageButton } from './CopyMessageButton';

import { useParsedContent } from '@/hooks/useParsedContent';

type Props = {
  thinking: string;
  answer?: string | null;
  baseDir?: string;
  allFiles?: string[];
  renderMarkdown: boolean;
};

export const ThinkingAnswerBlock = ({ thinking, answer, baseDir = '', allFiles = [], renderMarkdown }: Props) => {
  const { t } = useTranslation();
  const parsedThinking = useParsedContent(baseDir, thinking, allFiles, renderMarkdown);
  const parsedAnswer = useParsedContent(baseDir, answer, allFiles, renderMarkdown);
  const hasAnswer = Boolean(answer && parsedAnswer);

  // Internal state for manual toggle control
  const [manualToggleState, setManualToggleState] = useState<boolean | null>(null);

  // Determine expansion state:
  // - Start expanded (true) when there's no answer
  // - When answer arrives, auto-collapse to false
  // - Manual toggle overrides auto-collapse
  const isThinkingExpanded = manualToggleState !== null ? manualToggleState : !hasAnswer;

  const handleToggleThinking = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setManualToggleState(!isThinkingExpanded);
  };

  if (!parsedThinking) {
    return null;
  }

  return (
    <div className="flex flex-col w-full gap-1 pt-0">
      {/* Thinking section */}
      {parsedThinking && (
        <div className="border border-border-default-dark rounded-md overflow-hidden ml-2">
          <div
            className="flex items-center justify-between gap-2 px-3 py-1 bg-bg-secondary-light cursor-pointer hover:bg-bg-tertiary w-full"
            onClick={handleToggleThinking}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="text-text-secondary">
                <TfiThought className="w-4 h-4" />
              </div>
              <div className="font-medium text-text-secondary flex-1">{t('thinkingAnswer.thinking')}</div>
            </div>
            {thinking && <CopyMessageButton content={thinking} className="text-text-muted-dark hover:text-text-tertiary" />}
            <motion.div initial={false} animate={{ rotate: isThinkingExpanded ? 0 : -90 }} transition={{ duration: 0.2 }} className="text-text-secondary">
              {isThinkingExpanded ? <FaChevronDown className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}
            </motion.div>
          </div>

          <AnimatePresence initial={false}>
            {isThinkingExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className={clsx('p-3 text-xs text-text-primary bg-bg-secondary overflow-hidden', !renderMarkdown && 'whitespace-pre-wrap break-words')}
              >
                {parsedThinking}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* Answer section - only show if we have an answer or we're streaming */}
      {answer && parsedAnswer && (
        <div className="overflow-hidden relative">
          <div
            className={clsx('text-xs text-text-primary bg-bg-secondary', !renderMarkdown && 'whitespace-pre-wrap break-words', parsedThinking ? 'p-3' : 'p-0')}
          >
            {parsedAnswer}
          </div>
        </div>
      )}
    </div>
  );
};
