import { z } from 'zod';
import { TRANSACTION_TYPES } from '../constants';

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  type: z.enum(TRANSACTION_TYPES),
  amountCentavos: z.number().int().positive('Amount must be positive'),
  categoryId: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  destinationAccountId: z.string().nullable().optional(),
  date: z.string().or(z.date()),
  notes: z.string().optional(),
  receiptImageUrl: z.string().nullable().optional(),
  receiptPublicId: z.string().nullable().optional(),
  recurringRuleId: z.string().nullable().optional(),
  recurringOccurrenceDate: z.string().or(z.date()).nullable().optional(),
  goalId: z.string().nullable().optional()
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const monthSummaryQuerySchema = z.object({
  year: z.string().transform((v) => parseInt(v, 10)),
  month: z.string().transform((v) => parseInt(v, 10))
});
