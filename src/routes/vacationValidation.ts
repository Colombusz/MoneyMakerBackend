import { z } from 'zod';

export const createVacationSchema = z.object({
  name: z.string().min(1, 'Vacation name is required'),
  description: z.string().optional()
});

export const joinVacationSchema = z.object({
  joinCode: z.string().min(1, 'Join code is required')
});

export const depositVacationSchema = z
  .object({
    amountCentavos: z.number().int().positive('Deposit amount must be positive'),
    fromAccountId: z.string().optional(),
    fundingAccountId: z.string().optional(),
    notes: z.string().optional()
  })
  .refine((data) => data.fromAccountId || data.fundingAccountId, {
    message: 'Funding account is required',
    path: ['fromAccountId']
  });

export const createExpenseItemSchema = z.object({
  title: z.string().min(1, 'Expense title is required'),
  amountCentavos: z.number().int().positive('Expense amount must be positive'),
  category: z.string().nullable().optional(),
  deductionSource: z.enum(['pool', 'main_pool', 'chip_in']).optional(),
  chipInId: z.string().nullable().optional(),
  date: z.string().or(z.date()).optional(),
  notes: z.string().optional()
});

export const logPersonalExpenseSchema = z.object({
  title: z.string().min(1, 'Expense title is required'),
  amountCentavos: z.number().int().positive('Expense amount must be positive'),
  category: z.string().nullable().optional(),
  fromAccountId: z.string().nullable().optional(),
  date: z.string().or(z.date()).optional(),
  notes: z.string().optional()
});

export const createChipInSchema = z.object({
  title: z.string().min(1, 'Chip-in title is required'),
  targetAmountCentavos: z.number().int().positive().nullable().optional(),
  description: z.string().optional()
});

export const contributeChipInSchema = z
  .object({
    amountCentavos: z.number().int().positive('Contribution amount must be positive'),
    fromAccountId: z.string().optional(),
    fundingAccountId: z.string().optional(),
    notes: z.string().optional()
  })
  .refine((data) => data.fromAccountId || data.fundingAccountId, {
    message: 'Funding account is required',
    path: ['fromAccountId']
  });

export const refundVacationSchema = z.object({
  memberUserId: z.string().min(1, 'Member user ID is required'),
  amountCentavos: z.number().int().positive('Refund amount must be positive'),
  toAccountId: z.string().optional(),
  refundSource: z.enum(['pool', 'chip_in']).optional(),
  chipInId: z.string().nullable().optional(),
  notes: z.string().optional()
});

export const reverseLogSchema = z.object({
  originalLogId: z.string().min(1, 'Original log ID is required'),
  reason: z.string().min(1, 'Reason for reversal is required')
});
