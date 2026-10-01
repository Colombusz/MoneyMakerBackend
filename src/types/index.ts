export type AccountType = 'savings' | 'payroll' | 'goals' | 'cash' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type OverrideStatus = 'skipped' | 'paid' | 'modified';
export type MemberRole = 'owner' | 'member';
export type MemberStatus = 'active' | 'left';
export type PartnerInviteStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';

export interface IUser {
  _id: string; // UUID
  email: string;
  passwordHash: string;
  name: string;
  currency: string;
  partnerId?: string | null;
  refreshTokenHash?: string | null;
  refreshTokenHashes?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccount {
  _id: string; // UUID
  userId: string;
  name: string;
  type: AccountType;
  startingBalanceCentavos: number;
  currentBalanceCentavos: number;
  isArchived: boolean;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ICategory {
  _id: string; // UUID
  userId: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  isDefault: boolean;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface IDayNote {
  _id: string; // UUID
  userId: string;
  /**
   * UTC midnight of the calendar day this note belongs to. The calendar buckets
   * entries by `toISOString().split('T')[0]`, so notes are keyed the same way to
   * guarantee a note written on the 5th always appears on the 5th.
   */
  date: Date;
  notes: string;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ITransaction {
  _id: string; // UUID
  userId: string;
  accountId: string;
  type: TransactionType;
  amountCentavos: number;
  categoryId?: string | null;
  source?: string | null;
  destinationAccountId?: string | null;
  date: Date;
  notes?: string;
  receiptImageUrl?: string | null;
  receiptPublicId?: string | null;
  recurringRuleId?: string | null;
  recurringOccurrenceDate?: Date | null;
  goalId?: string | null;
  sharedAccountId?: string | null;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface IRecurringRule {
  _id: string; // UUID
  userId: string;
  accountId: string;
  categoryId: string;
  type: 'expense' | 'income';
  amountCentavos: number;
  frequency: RecurringFrequency;
  intervalDays?: number | null;
  startDate: Date;
  endDate?: Date | null;
  maxOccurrences?: number | null;
  notes?: string;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface IRecurringOverride {
  _id: string; // UUID
  userId: string;
  recurringRuleId: string;
  occurrenceDate: Date;
  status: OverrideStatus;
  overrideAmountCentavos?: number | null;
  transactionId?: string | null;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface IGoal {
  _id: string; // UUID
  userId: string;
  name: string;
  targetAmountCentavos: number;
  targetDate?: Date | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  linkedAccountId?: string | null;
  isShared: boolean;
  sharedGoalId?: string | null;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ISharedGoalMember {
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  status: MemberStatus;
}

export interface ISharedGoal {
  _id: string; // UUID
  name: string;
  targetAmountCentavos: number;
  targetDate?: Date | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  createdByUserId: string;
  members: ISharedGoalMember[];
  isArchived: boolean;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface IGoalContribution {
  _id: string; // UUID
  userId: string;
  goalId?: string | null;
  sharedGoalId?: string | null;
  amountCentavos: number;
  transactionId?: string | null;
  date: Date;
  notes?: string;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ISharedAccountMember {
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  status: MemberStatus;
}

export interface ISharedAccount {
  _id: string; // UUID
  name: string;
  createdByUserId: string;
  members: ISharedAccountMember[];
  isArchived: boolean;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type SharedAccountMovementType = 'deposit' | 'expense';

export interface ISharedAccountMovement {
  _id: string; // UUID
  sharedAccountId: string;
  type: SharedAccountMovementType;
  userId: string;
  amountCentavos: number;
  privateAccountId?: string | null;
  privateTransactionId?: string | null;
  date: Date;
  notes?: string;
  categoryId?: string | null;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface IPartnerInvite {
  _id: string;
  inviterUserId: string;
  inviteCode: string;
  expiresAt: Date;
  status: PartnerInviteStatus;
  createdAt: Date;
}

// Sync DTOs
export interface SyncPushChange {
  id: string;
  entityType:
    | 'accounts'
    | 'categories'
    | 'transactions'
    | 'recurringRules'
    | 'recurringOverrides'
    | 'goals'
    | 'goalContributions'
    | 'dayNotes';
  action: 'upsert' | 'delete';
  payload: any;
  updatedAt: number; // millisecond timestamp
}

export interface SyncPushRequest {
  changes: SyncPushChange[];
}

export interface SyncPushResponse {
  appliedIds: string[];
  conflicts: Array<{ id: string; reason: string }>;
  serverTime: string;
}

export interface SyncPullResponse {
  cursor: string;
  accounts: IAccount[];
  categories: ICategory[];
  transactions: ITransaction[];
  recurringRules: IRecurringRule[];
  recurringOverrides: IRecurringOverride[];
  goals: IGoal[];
  goalContributions: IGoalContribution[];
  dayNotes: IDayNote[];
}
