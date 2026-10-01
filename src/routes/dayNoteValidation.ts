import { z } from 'zod';

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be a YYYY-MM-DD calendar day');

export const saveDayNoteSchema = z.object({
  date: calendarDate,
  // An empty string is allowed and means "clear the note for this day".
  notes: z.string().max(5000).optional().default('')
});

export const dayNoteQuerySchema = z.object({
  start: z.string().optional(),
  startDate: z.string().optional(),
  end: z.string().optional(),
  endDate: z.string().optional()
});

export const dayNoteParamSchema = z.object({
  date: calendarDate
});