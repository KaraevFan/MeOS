'use client'

import { cn } from '@/lib/utils'
import type { ChatMessage, ParsedMessage, DomainName } from '@/types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  parsedContent: ParsedMessage
  onCorrectDomain?: (domain: DomainName) => void
}

export function MessageBubble({ message, parsedContent, onCorrectDomain }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-3 animate-fade-up',
          isUser
            ? 'bg-bg border border-border'
            : 'bg-bg-sage border-l-[3px] border-l-accent-sage'
        )}
      >
        {parsedContent.textBefore && (
          <p className="text-text whitespace-pre-wrap">{parsedContent.textBefore}</p>
        )}

        {parsedContent.block && (
          <div className="my-2">
            {/* Domain and synthesis cards will be rendered here by Task 9 */}
            <div className="text-text-secondary text-sm italic">
              [Structured block: {parsedContent.block.type}]
            </div>
          </div>
        )}

        {parsedContent.textAfter && (
          <p className="text-text whitespace-pre-wrap mt-2">{parsedContent.textAfter}</p>
        )}

        {/* If no block and no textBefore, show the raw content */}
        {!parsedContent.block && !parsedContent.textBefore && (
          <p className="text-text whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </div>
  )
}
