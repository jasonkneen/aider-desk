import React, { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';

import { isGroupMessage, isUserMessage, Message } from '@/types/message';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { groupMessagesByPromptContext } from '@/components/message/utils';

export type VirtualizedMessagesRef = {
  exportToImage: () => void;
  container: HTMLDivElement | null;
  scrollToBottom: () => void;
};

type Props = {
  baseDir: string;
  messages: Message[];
  allFiles?: string[];
  renderMarkdown: boolean;
  removeMessage: (message: Message) => void;
  redoLastUserPrompt: () => void;
  editLastUserMessage: (content: string) => void;
};

export const VirtualizedMessages = forwardRef<VirtualizedMessagesRef, Props>(
  ({ baseDir, messages, allFiles = [], renderMarkdown, removeMessage, redoLastUserPrompt, editLastUserMessage }, ref) => {
    const { t } = useTranslation();
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [scrollingPaused, setScrollingPaused] = useState(false);

    // Group messages by promptContext.group.id
    const processedMessages = useMemo(() => groupMessagesByPromptContext(messages), [messages]);
    const lastUserMessageIndex = processedMessages.findLastIndex(isUserMessage);

    // Create virtualizer for dynamic sized items
    const virtualizer = useVirtualizer({
      count: processedMessages.length,
      getScrollElement: () => messagesContainerRef.current,
      estimateSize: () => 44, // Initial estimate, will be measured
      overscan: 5,
      scrollToFn: (offset, { behavior }) => {
        messagesContainerRef.current?.scrollTo({
          top: offset + 32,
          behavior,
        });
      },
    });

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const element = e.currentTarget;

      // Check if content is smaller than scroll area (no scrollbar needed)
      const contentSmallerThanArea = element.scrollHeight <= element.clientHeight;

      // If content is smaller than area, never pause scrolling
      if (contentSmallerThanArea) {
        setScrollingPaused(false);
      }
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      // Only pause when scrolling up (negative deltaY)
      if (e.deltaY < 0) {
        setScrollingPaused(true);
      } else if (e.deltaY > 0) {
        const element = e.currentTarget;
        const isAtBottom = element.scrollHeight - element.scrollTop < element.clientHeight + e.deltaY + 20;

        if (isAtBottom) {
          setScrollingPaused(false);
        }
      }
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      const element = e.currentTarget;
      element.dataset.touchStartY = touch.clientY.toString();
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      const element = e.currentTarget;
      const touchStartY = element.dataset.touchStartY ? parseFloat(element.dataset.touchStartY) : touch.clientY;

      // Detect swipe up (touch moving up, so current Y is less than start Y)
      if (touch.clientY < touchStartY - 10) {
        // 10px threshold to avoid accidental triggers
        setScrollingPaused(true);
      }
    };

    useLayoutEffect(() => {
      if (!scrollingPaused && processedMessages.length > 0) {
        // Scroll to the last item when new messages arrive
        virtualizer.scrollToIndex(processedMessages.length - 1, {
          align: 'end',
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processedMessages]);

    const exportToImage = async () => {
      const messagesContainer = messagesContainerRef.current;
      if (messagesContainer === null) {
        return;
      }

      try {
        const dataUrl = await toPng(messagesContainer, {
          cacheBust: true,
          height: messagesContainer.scrollHeight,
        });
        const link = document.createElement('a');
        link.download = `session-${new Date().toISOString().replace(/:/g, '-').substring(0, 19)}.png`;
        link.href = dataUrl;
        link.click();
        link.remove();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to export chat as PNG', err);
      }
    };

    const scrollToBottom = () => {
      setScrollingPaused(false);
      if (processedMessages.length > 0) {
        virtualizer.scrollToIndex(processedMessages.length - 1, {
          align: 'end',
        });
      }
    };

    useImperativeHandle(ref, () => ({
      exportToImage,
      container: messagesContainerRef.current,
      scrollToBottom,
    }));

    const items = virtualizer.getVirtualItems();

    return (
      <div className="relative flex flex-col h-full">
        <StyledTooltip id="usage-info-tooltip" />

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4
            scrollbar-thin
            scrollbar-track-bg-primary-light
            scrollbar-thumb-bg-tertiary
            hover:scrollbar-thumb-bg-fourth"
          onScroll={handleScroll}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {items.map((virtualRow) => {
              const message = processedMessages[virtualRow.index];

              return (
                <div
                  key={message.id || virtualRow.index}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {isGroupMessage(message) ? (
                    <GroupMessageBlock
                      baseDir={baseDir}
                      message={message}
                      allFiles={allFiles}
                      renderMarkdown={renderMarkdown}
                      remove={(msg: Message) => removeMessage(msg)}
                      redo={redoLastUserPrompt}
                      edit={editLastUserMessage}
                    />
                  ) : (
                    <MessageBlock
                      baseDir={baseDir}
                      message={message}
                      allFiles={allFiles}
                      renderMarkdown={renderMarkdown}
                      remove={virtualRow.index === messages.length - 1 ? () => removeMessage(message) : undefined}
                      redo={virtualRow.index === lastUserMessageIndex ? redoLastUserPrompt : undefined}
                      edit={virtualRow.index === lastUserMessageIndex ? editLastUserMessage : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {scrollingPaused && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <IconButton
              icon={<MdKeyboardArrowDown className="h-6 w-6" />}
              onClick={scrollToBottom}
              tooltip={t('messages.scrollToBottom')}
              className="bg-bg-primary-light border border-border-default shadow-lg hover:bg-bg-secondary transition-colors duration-200"
              aria-label={t('messages.scrollToBottom')}
            />
          </div>
        )}
      </div>
    );
  },
);

VirtualizedMessages.displayName = 'VirtualizedMessages';
