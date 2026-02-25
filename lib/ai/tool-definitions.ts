import type Anthropic from '@anthropic-ai/sdk'

/**
 * Tool definitions for Claude function calling.
 *
 * Tool categories:
 * - Instant: save_file — server awaits write, returns { success, path, bytes }
 * - Lifecycle: complete_session, enter_structured_arc — server executes, returns enriched result
 * - Interactive: show_options — split-conversation, client renders pills, resumes with selection
 * - Split-conversation: show_pulse_check — client renders UI, resumes after user interaction
 */

export const SAVE_FILE_TOOL: Anthropic.Tool = {
  name: 'save_file',
  description:
    'Save or update a markdown file in the user\'s life context store. ' +
    'Use this for all content writes: domains, overview, life plan, check-ins, ' +
    'daily logs, day plans, weekly plans, sage context, sage patterns, captures, ' +
    'and reflection prompts. The system generates YAML frontmatter automatically — ' +
    'write only the markdown body.',
  input_schema: {
    type: 'object' as const,
    required: ['file_type', 'content'],
    properties: {
      file_type: {
        type: 'string',
        enum: [
          'domain', 'overview', 'life-plan', 'check-in', 'daily-log',
          'day-plan', 'weekly-plan', 'sage-context', 'sage-patterns',
          'capture', 'reflection-prompt',
        ],
        description: 'The type of file to save. Determines the storage path and frontmatter schema.',
      },
      file_name: {
        type: 'string',
        description:
          'Semantic name for the file. Required for domain files (e.g. "Career / Work"). ' +
          'Optional date for daily-log, day-plan, check-in (defaults to today). ' +
          'Omit for singleton files (overview, life-plan, sage-context, etc.).',
      },
      content: {
        type: 'string',
        description: 'Full markdown body content. Do NOT include YAML frontmatter — the system generates it.',
      },
      attributes: {
        type: 'object',
        description: 'Structured metadata passed as typed attributes. The system converts these to YAML frontmatter fields.',
        properties: {
          status: {
            type: 'string',
            enum: ['thriving', 'stable', 'needs_attention', 'in_crisis'],
            description: 'Domain status (only for domain file_type).',
          },
          updated_rating: {
            type: 'string',
            description: 'Numeric domain rating as string, e.g. "4" (only for domain file_type).',
          },
          energy: {
            type: 'string',
            enum: ['high', 'moderate', 'low'],
            description: 'Energy level (for daily-log file_type).',
          },
          mood_signal: {
            type: 'string',
            description: 'Brief mood description (for daily-log file_type).',
          },
          domains_touched: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of domain names discussed (for daily-log file_type).',
          },
          preview_line: {
            type: 'string',
            description: 'One-line summary for domain card display (only for domain file_type).',
          },
          intention: {
            type: 'string',
            description: 'Day plan intention (for day-plan file_type).',
          },
          carried_forward_from: {
            type: 'string',
            description: 'Date of previous day plan if carrying forward (for day-plan file_type).',
          },
        },
      },
    },
  },
}

export const COMPLETE_SESSION_TOOL: Anthropic.Tool = {
  name: 'complete_session',
  description:
    'Mark the current session or structured arc as complete. Call this when the conversation ' +
    'has reached its natural conclusion — after all artifacts are saved and the user has confirmed. ' +
    'For structured arcs within open_conversation, this returns the user to the base conversation layer.',
  input_schema: {
    type: 'object' as const,
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        enum: ['session', 'arc'],
        description:
          '"session" to complete the entire session. ' +
          '"arc" to complete a structured arc and return to open conversation.',
      },
      summary: {
        type: 'string',
        description: 'Brief summary of what was accomplished in this session/arc.',
      },
    },
  },
}

export const ENTER_STRUCTURED_ARC_TOOL: Anthropic.Tool = {
  name: 'enter_structured_arc',
  description:
    'Transition into a structured arc within the current open conversation. ' +
    'Use this when context signals suggest a structured flow would help: ' +
    'morning routine (open_day), evening reflection (close_day), weekly check-in, or life mapping.',
  input_schema: {
    type: 'object' as const,
    required: ['arc_type'],
    properties: {
      arc_type: {
        type: 'string',
        enum: ['open_day', 'close_day', 'weekly_checkin', 'life_mapping'],
        description: 'The structured arc to enter.',
      },
    },
  },
}

export const SHOW_PULSE_CHECK_TOOL: Anthropic.Tool = {
  name: 'show_pulse_check',
  description:
    'Display the interactive pulse check UI for the user to rate their life domains. ' +
    'This pauses the conversation — the user interacts with the UI, and the conversation ' +
    'resumes with their ratings as context. Use during weekly check-ins or when a domain ' +
    'reassessment would be valuable.',
  input_schema: {
    type: 'object' as const,
    properties: {
      context: {
        type: 'string',
        description: 'Brief context for why the pulse check is being shown (e.g. "weekly check-in re-rating").',
      },
    },
  },
}

export const SHOW_OPTIONS_TOOL: Anthropic.Tool = {
  name: 'show_options',
  description:
    'Display interactive option pills for the user to choose from. ' +
    'This pauses the conversation — the user taps an option, and the conversation ' +
    'resumes with their selection. Use for suggesting next topics, offering choices, ' +
    'or presenting reflection prompts.',
  input_schema: {
    type: 'object' as const,
    required: ['options'],
    properties: {
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of 2-4 option strings for the user to choose from.',
      },
    },
  },
}

/**
 * Get tool definitions for a given session context.
 *
 * All sessions get save_file + complete_session.
 * open_conversation also gets enter_structured_arc.
 * Weekly check-in and life_mapping get show_pulse_check.
 * All sessions get show_options for suggestion pills.
 */
export function getToolDefinitions(
  sessionType: string,
  activeMode?: string | null
): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [
    SAVE_FILE_TOOL,
    COMPLETE_SESSION_TOOL,
    SHOW_OPTIONS_TOOL,
  ]

  const effectiveType = activeMode ?? sessionType

  // open_conversation can enter structured arcs
  if (sessionType === 'open_conversation' && !activeMode) {
    tools.push(ENTER_STRUCTURED_ARC_TOOL)
  }

  // Weekly check-in and life_mapping can show pulse check
  if (effectiveType === 'weekly_checkin' || effectiveType === 'life_mapping') {
    tools.push(SHOW_PULSE_CHECK_TOOL)
  }

  return tools
}
