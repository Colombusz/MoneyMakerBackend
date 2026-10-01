import { z } from 'zod';
import { RECURRING_FREQUENCIES } from '../constants';

export const createRecurringRuleSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  type: z.enum(['expense', 'income']).optional().default('expense'),
  amountCentavos: z.number().int().positive('Amount must be positive'),
  frequency: z.enum(RECURRING_FREQUENCIES),
  intervalDays: z.number().int().positive().nullable().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).nullable().optional(),
  maxOccurrences: z.number().int().positive().nullable().optional(),
  notes: z.string().optional()
});

export const updateRecurringRuleSchema = createRecurringRuleSchema.partial();

export const occurrencesQuerySchema = z
  .object({
    start: z.string().optional(),
    startDate: z.string().optional(),
    end: z.string().optional(),
    endDate: z.string().optional()
  })
  .refine((data) => (data.start || data.startDate) && (data.end || data.endDate), {
    message: 'start (or startDate) and end (or endDate) query dates are required'
  });

export const payOccurrenceSchema = z.object({
  ruleId: z.string().optional(),
  occurrenceDate: z.string().min(1, 'occurrenceDate is required'),
  accountId: z.string().optional(),
  amountCentavos: z.number().int().positive().optional(),
  overrideAmountCentavos: z.number().int().positive().optional(),
  notes: z.string().optional()
});

export const skipOccurrenceSchema = z.object({
  ruleId: z.string().optional(),
  occurrenceDate: z.string().min(1, 'occurrenceDate is required')
});
