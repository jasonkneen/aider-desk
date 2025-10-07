import { useTranslation } from 'react-i18next';
import { RiFileTextLine, RiCheckboxCircleFill, RiErrorWarningFill, RiCloseCircleFill } from 'react-icons/ri';
import { getLanguageFromPath } from '@common/utils';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { CodeBlock } from '@/components/common/CodeBlock';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
};

export const FileReadToolMessage = ({ message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();

  const filePath = message.args.filePath as string;
  const content = message.content && JSON.parse(message.content);
  const language = getLanguageFromPath(filePath);

  const isError = content && content.startsWith('Error: ');
  const isDenied = content && content.startsWith(`File read of '${filePath}' denied by user.`);

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <RiFileTextLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.fileRead')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{filePath.split(/[/\\]/).pop()}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />}
      {content &&
        (isError ? (
          <span className="text-left">
            <StyledTooltip id={`file-read-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill className="w-3 h-3 text-error" data-tooltip-id={`file-read-error-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : isDenied ? (
          <span className="text-left">
            <StyledTooltip id={`file-read-denied-tooltip-${message.id}`} maxWidth={600} />
            <RiCloseCircleFill className="w-3 h-3 text-warning" data-tooltip-id={`file-read-denied-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : (
          <RiCheckboxCircleFill className="w-3 h-3 text-success" />
        ))}
    </div>
  );

  const renderContent = () => (
    <div className="px-3 text-xs text-text-tertiary bg-bg-secondary">
      {!isError && !isDenied && content && (
        <CodeBlock baseDir="" language={language} file={filePath} isComplete={true}>
          {content}
        </CodeBlock>
      )}
      {isDenied && (
        <div className="text-warning">
          <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
            {content}
          </pre>
        </div>
      )}
    </div>
  );

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} initialExpanded={false} />;
};
