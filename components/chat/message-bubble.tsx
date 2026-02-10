'use client'

import { cn } from '@/lib/utils'
import { DomainCard } from './domain-card'
import { SynthesisCard } from './synthesis-card'
import type { ChatMessage, ParsedMessage, DomainName } from '@/types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  parsedContent: ParsedMessage
  onCorrectDomain?: (domain: DomainName) => void
}

export function MessageBubble({ message, parsedContent, onCorrectDomain }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const hasCard = parsedContent.block &&
    (parsedContent.block.type === 'domain_summary' || parsedContent.block.type === 'life_map_synthesis')

  return (
    <div className={cn('flex flex-col w-full gap-2', isUser ? 'items-end' : 'items-start')}>
      {/* Text before block */}
      {parsedContent.textBefore && (
        <div
          className={cn(
            'max-w-[85%] rounded-lg px-4 py-3 animate-fade-up',
            isUser
              ? 'bg-bg border border-border'
              : 'bg-bg-sage border-l-[3px] border-l-accent-sage'
          )}
        >
          <p className="text-text whitespace-pre-wrap">{parsedContent.textBefore}</p>
        </div>
      )}

      {/* Structured card */}
      {parsedContent.block?.type === 'domain_summary' && (
        <div className="w-full max-w-[95%]">
          <DomainCard
            domain={parsedContent.block.data}
            onCorrect={onCorrectDomain || (() => {})}
          />
        </div>
      )}

      {parsedContent.block?.type === 'life_map_synthesis' && (
        <div className="w-full max-w-[95%]">
          <SynthesisCard synthesis={parsedContent.block.data} />
        </div>
      )}

      {/* session_summary blocks are not displayed — backend processing only */}

      {/* Text after block */}
      {parsedContent.textAfter && (
        <div
          className={cn(
            'max-w-[85%] rounded-lg px-4 py-3 animate-fade-up',
            isUser
              ? 'bg-bg border border-border'
              : 'bg-bg-sage border-l-[3px] border-l-accent-sage'
          )}
        >
          <p className="text-text whitespace-pre-wrap">{parsedContent.textAfter}</p>
        </div>
      )}

      {/* If no block and no textBefore, show the raw content */}
      {!hasCard && !parsedContent.textBefore && !parsedContent.block && (
        <div
          className={cn(
            'max-w-[85%] rounded-lg px-4 py-3 animate-fade-up',
            isUser
              ? 'bg-bg border border-border'
              : 'bg-bg-sage border-l-[3px] border-l-accent-sage'
          )}
        >
          <p className="text-text whitespace-pre-wrap">{message.content}</p>
        </div>
      )}
    </div>
  )
}
