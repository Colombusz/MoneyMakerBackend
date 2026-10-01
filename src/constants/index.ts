export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionTypeConst = (typeof TRANSACTION_TYPES)[number];

export const ACCOUNT_TYPES = ['savings', 'payroll', 'goals', 'cash', 'other'] as const;
export type AccountTypeConst = (typeof ACCOUNT_TYPES)[number];

export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const;
export type RecurringFrequencyConst = (typeof RECURRING_FREQUENCIES)[number];

export const OVERRIDE_STATUSES = ['skipped', 'paid', 'modified'] as const;
export type OverrideStatusConst = (typeof OVERRIDE_STATUSES)[number];

export const PARTNER_INVITE_STATUSES = ['pending', 'accepted', 'cancelled', 'expired'] as const;
export type PartnerInviteStatusConst = (typeof PARTNER_INVITE_STATUSES)[number];

export const SYNC_ENTITIES = [
  'accounts',
  'categories',
  'transactions',
  'recurringRules',
  'recurringOverrides',
  'goals',
  'goalContributions',
  'dayNotes'
] as const;
export type SyncEntityConst = (typeof SYNC_ENTITIES)[number];

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
} as const;

export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: '30d',
  REFRESH_TOKEN_DAYS: 60,
  INVITE_EXPIRY_DAYS: 7
} as const;
