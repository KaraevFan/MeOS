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

export const CalendarIntegrationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  provider: z.string(),
  access_token: z.string(),
  refresh_token: z.string().nullable(),
  token_expires_at: z.string().nullable(),
  scopes: z.array(z.string()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type CalendarIntegration = z.infer<typeof CalendarIntegrationSchema>
