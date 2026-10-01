import { z } from 'zod';

export const createGoalSchema = z.object({
  name: z.string().min(1, 'Goal name is required'),
  targetAmountCentavos: z.number().int().positive('Target amount must be positive'),
  targetDate: z.string().or(z.date()).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imagePublicId: z.string().nullable().optional(),
  linkedAccountId: z.string().nullable().optional()
});

export const updateGoalSchema = createGoalSchema.partial();

export const contributeGoalSchema = z.object({
  amountCentavos: z.number().int().positive('Contribution amount must be positive'),
  accountId: z.string().optional(),
  fromAccountId: z.string().optional(),
  date: z.string().or(z.date()).optional(),
  notes: z.string().optional()
});
