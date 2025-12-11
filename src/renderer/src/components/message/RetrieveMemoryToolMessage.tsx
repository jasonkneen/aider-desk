import { useTranslation } from 'react-i18next';
import { FaBrain, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
};

export const RetrieveMemoryToolMessage = ({ message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();

  const query = message.args.query as string;
  const limit = (message.args.limit as number) ?? 5;
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && content.startsWith('Failed to retrieve memories');
  const isDenied = content && typeof content === 'string' && content.includes('denied');
  const memoryCount = Array.isArray(content) ? content.length : 0;

  const title = (
    <div className="flex items-center gap-2 w-full text-left">
      <div className="text-text-muted">
        <FaBrain className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        {!content ? (
          <span>{t('toolMessage.memory.retrievingMemories')}</span>
        ) : isError || isDenied ? (
          <span>{t('toolMessage.memory.retrievingMemories')}</span>
        ) : (
          <span>{memoryCount > 0 ? t('toolMessage.memory.foundMemories', { count: memoryCount }) : t('toolMessage.memory.noMemoriesFound')}</span>
        )}
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`retrieve-memory-error-tooltip-${message.id}`} maxWidth={600} />
            <FaExclamationTriangle
              className="w-3 h-3 text-error"
              data-tooltip-id={`retrieve-memory-error-tooltip-${message.id}`}
              data-tooltip-content={content}
            />
          </span>
        ) : isDenied ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`retrieve-memory-denied-tooltip-${message.id}`} maxWidth={600} />
            <FaTimesCircle className="w-3 h-3 text-warning" data-tooltip-id={`retrieve-memory-denied-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : (
          <FaCheckCircle className="w-3 h-3 text-success flex-shrink-0" />
        ))}
    </div>
  );

  const renderContent = () => {
    if (!content) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="flex items-center gap-2">
            <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />
            <span>{t('toolMessage.memory.retrievingMemories')}</span>
          </div>
        </div>
      );
    }

    if (isError || isDenied) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className={`${isDenied ? 'text-warning' : 'text-error'}`}>
            <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
              {content}
            </pre>
          </div>
        </div>
      );
    }

    if (Array.isArray(content)) {
      if (content.length === 0) {
        return (
          <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
              <div className="text-text-muted">{t('toolMessage.memory.noRelevantMemories')}</div>
            </div>
          </div>
        );
      }

      return (
        <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="space-y-3">
            {/* Query parameters */}
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1">
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.memory.query')}:</span> {query}
              </div>
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.memory.limit')}:</span> {limit}
              </div>
            </div>
            {/* Memory List */}
            <div className="space-y-2">
              {content.map((memory) => (
                <div key={memory.id} className="border border-border-dark-light rounded bg-bg-primary-light p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xs text-text-muted bg-bg-secondary px-2 py-1 rounded">{memory.type}</span>
                    <span className="text-3xs text-text-muted">{new Date(memory.timestamp).toLocaleDateString()}</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-2xs text-text-primary max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
                    {memory.content}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Fallback for unexpected content (backward compatibility)
    return (
      <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
        <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} />;
};
