import { z } from 'zod';
import { ACCOUNT_TYPES } from '../constants';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(ACCOUNT_TYPES),
  startingBalanceCentavos: z.number().int().optional().default(0)
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  startingBalanceCentavos: z.number().int().optional(),
  isArchived: z.boolean().optional()
});

export const transferSchema = z.object({
  fromAccountId: z.string().min(1, 'Source account is required'),
  toAccountId: z.string().min(1, 'Destination account is required'),
  amountCentavos: z.number().int().positive('Amount must be positive'),
  date: z.string().or(z.date()).optional(),
  notes: z.string().optional()
});
