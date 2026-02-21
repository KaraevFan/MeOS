'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DomainCard } from './domain-card'
import { SynthesisCard } from './synthesis-card'
import { MarkdownDomainCard } from './markdown-domain-card'
import { MarkdownSynthesisCard } from './markdown-synthesis-card'
import { JournalCard } from './journal-card'
import { InlineCard } from './inline-card'
import { DayPlanConfirmationCard } from './day-plan-confirmation-card'
import type { ChatMessage, ParsedMessage, ParsedSegment, DomainName } from '@/types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  parsedContent: ParsedMessage
  onCorrectDomain?: (domain: DomainName) => void
}

function renderInlineMarkdown(text: string): ReactNode {
  // Support **bold** and *italic* only — no headers, code blocks, or tables in chat
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function TextSegment({ content, isUser }: { content: string; isUser: boolean }) {
  // Split into paragraphs on blank lines for Sage messages; preserve raw for user messages
  const paragraphs = isUser ? [content] : content.split(/\n\n+/)
  return (
    <div
      className={cn(
        'max-w-[85%] rounded-lg px-4 py-3 animate-fade-up',
        isUser
          ? 'bg-bg border border-border'
          : 'bg-bg-sage border-l-[3px] border-l-accent-sage'
      )}
    >
      {isUser ? (
        <p className="text-text whitespace-pre-wrap">{content}</p>
      ) : (
        paragraphs.map((para, i) => (
          <p key={i} className={cn('text-text', i > 0 && 'mt-3')}>
            {renderInlineMarkdown(para)}
          </p>
        ))
      )}
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

  if (segment.blockType === 'file_update') {
    if (segment.data.fileType === 'domain') {
      return (
        <div className="w-full max-w-[95%]">
          <MarkdownDomainCard data={segment.data} />
        </div>
      )
    }
    if (segment.data.fileType === 'overview') {
      return (
        <div className="w-full max-w-[95%]">
          <MarkdownSynthesisCard data={segment.data} />
        </div>
      )
    }
    if (segment.data.fileType === 'daily-log') {
      return (
        <div className="w-full max-w-[95%]">
          <JournalCard data={segment.data} />
        </div>
      )
    }
    if (segment.data.fileType === 'day-plan') {
      // Day plan file updates are consumed silently — the DayPlanConfirmationCard from DAY_PLAN_DATA handles the UI
      return null
    }
    // Other file_update types (life-plan, check-in, sage-context, sage-patterns) are silently consumed
    return null
  }

  if (segment.blockType === 'inline_card') {
    return (
      <div className="w-full max-w-[95%]">
        <InlineCard data={segment.data} />
      </div>
    )
  }

  if (segment.blockType === 'day_plan_data') {
    return (
      <div className="w-full max-w-[95%]">
        <DayPlanConfirmationCard data={segment.data} />
      </div>
    )
  }

  // suggested_replies, intention_card, and session_summary blocks are handled outside MessageBubble
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
