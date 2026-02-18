import { z } from 'zod'

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.string(), // ISO datetime
  endTime: z.string(),   // ISO datetime
  allDay: z.boolean().optional(),
  attendees: z.array(z.string()).optional(),
})

export type CalendarEvent = z.infer<typeof CalendarEventSchema>

export interface CalendarIntegration {
  id: string
  user_id: string
  provider: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  scopes: string[] | null
  created_at: string
  updated_at: string
}
