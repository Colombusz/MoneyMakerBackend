import { z } from 'zod';

export const acceptInviteSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required')
});

export const createSharedGoalSchema = z.object({
  name: z.string().min(1, 'Shared goal name is required'),
  targetAmountCentavos: z.number().int().positive('Target amount must be positive'),
  targetDate: z.string().or(z.date()).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imagePublicId: z.string().nullable().optional()
});

export const contributeSharedGoalSchema = z.object({
  amountCentavos: z.number().int().positive('Amount must be positive'),
  fromAccountId: z.string().optional(),
  accountId: z.string().optional(),
  date: z.string().or(z.date()).optional(),
  notes: z.string().optional()
});

export const createSharedAccountSchema = z.object({
  name: z.string().min(1, 'Shared account name is required')
});

export const depositSharedAccountSchema = z.object({
  amountCentavos: z.number().int().positive('Amount must be positive'),
  fromAccountId: z.string().min(1, 'fromAccountId is required').optional(),
  // `fundingAccountId` is the web client's alias for the same field; accept
  // either so a client sending only one never 400s with "expected string,
  // received undefined".
  fundingAccountId: z.string().min(1).optional(),
  date: z.string().or(z.date()).optional(),
  notes: z.string().optional()
}).refine((d) => d.fromAccountId || d.fundingAccountId, {
  message: 'fromAccountId: Required',
  path: ['fromAccountId']
});

export const expenseSharedAccountSchema = z.object({
  amountCentavos: z.number().int().positive('Amount must be positive'),
  categoryId: z.string().nullable().optional(),
  date: z.string().or(z.date()).optional(),
  notes: z.string().optional()
});
