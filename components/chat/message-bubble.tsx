'use client'

import { cn } from '@/lib/utils'
import { DomainCard } from './domain-card'
import { SynthesisCard } from './synthesis-card'
import type { ChatMessage, ParsedMessage, ParsedSegment, DomainName } from '@/types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  parsedContent: ParsedMessage
  onCorrectDomain?: (domain: DomainName) => void
}

function TextSegment({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <div
      className={cn(
        'max-w-[85%] rounded-lg px-4 py-3 animate-fade-up',
        isUser
          ? 'bg-bg border border-border'
          : 'bg-bg-sage border-l-[3px] border-l-accent-sage'
      )}
    >
      <p className="text-text whitespace-pre-wrap">{content}</p>
    </div>
  )
}

function SegmentRenderer({
  segment,
  isUser,
  onCorrectDomain,
}: {
  segment: ParsedSegment
  isUser: boolean
  onCorrectDomain?: (domain: DomainName) => void
}) {
  if (segment.type === 'text') {
    return <TextSegment content={segment.content} isUser={isUser} />
  }

  if (segment.blockType === 'domain_summary') {
    return (
      <div className="w-full max-w-[95%]">
        <DomainCard
          domain={segment.data}
          onCorrect={onCorrectDomain || (() => {})}
        />
      </div>
    )
  }

  if (segment.blockType === 'life_map_synthesis') {
    return (
      <div className="w-full max-w-[95%]">
        <SynthesisCard synthesis={segment.data} isInline />
      </div>
    )
  }

  // session_summary blocks are not displayed — backend processing only
  return null
}

export function MessageBubble({ message, parsedContent, onCorrectDomain }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const hasAnyBlock = parsedContent.segments.some((s) => s.type === 'block')

  // If no blocks and only text segments, render plainly
  if (!hasAnyBlock && parsedContent.segments.length === 1 && parsedContent.segments[0].type === 'text') {
    return (
      <div className={cn('flex flex-col w-full gap-2', isUser ? 'items-end' : 'items-start')}>
        <TextSegment content={parsedContent.segments[0].content} isUser={isUser} />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col w-full gap-2', isUser ? 'items-end' : 'items-start')}>
      {parsedContent.segments.map((segment, i) => (
        <SegmentRenderer
          key={i}
          segment={segment}
          isUser={isUser}
          onCorrectDomain={onCorrectDomain}
        />
      ))}
    </div>
  )
}
