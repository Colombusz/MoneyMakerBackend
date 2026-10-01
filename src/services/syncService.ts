import { Account } from '../models/Account';
import { Category } from '../models/Category';
import { Transaction } from '../models/Transaction';
import { RecurringRule } from '../models/RecurringRule';
import { RecurringOverride } from '../models/RecurringOverride';
import { Goal } from '../models/Goal';
import { GoalContribution } from '../models/GoalContribution';
import { DayNote } from '../models/DayNote';
import { SyncPushChange, SyncPushResponse, SyncPullResponse } from '../types';
import { AccountService } from './accountService';

const getModelForEntity = (entityType: string): any => {
  switch (entityType) {
    case 'accounts':
      return Account;
    case 'categories':
      return Category;
    case 'transactions':
      return Transaction;
    case 'recurringRules':
      return RecurringRule;
    case 'recurringOverrides':
      return RecurringOverride;
    case 'goals':
      return Goal;
    case 'goalContributions':
      return GoalContribution;
    case 'dayNotes':
      return DayNote;
    default:
      return null;
  }
};

export class SyncService {
  static async pushChanges(userId: string, changes: SyncPushChange[]): Promise<SyncPushResponse> {
    const appliedIds: string[] = [];
    const conflicts: Array<{ id: string; reason: string }> = [];

    for (const change of changes) {
      const { id, entityType, action, payload, updatedAt } = change;
      const Model = getModelForEntity(entityType);

      if (!Model) {
        conflicts.push({ id, reason: `Unknown entity type: ${entityType}` });
        continue;
      }

      const clientUpdatedDate = new Date(updatedAt);

      try {
        const existing = await Model.findOne({ _id: id });

        if (existing) {
          if (existing.userId && existing.userId !== userId) {
            conflicts.push({ id, reason: 'Unauthorized entity access' });
            continue;
          }

          // Last-Write-Wins (LWW) check
          if (existing.updatedAt && new Date(existing.updatedAt) > clientUpdatedDate) {
            conflicts.push({
              id,
              reason: `Server has newer version (Server: ${existing.updatedAt.toISOString()}, Client: ${clientUpdatedDate.toISOString()})`
            });
            continue;
          }

          if (action === 'delete') {
            existing.deletedAt = clientUpdatedDate;
            existing.updatedAt = clientUpdatedDate;
            await existing.save();
          } else {
            Object.assign(existing, payload);
            existing.userId = userId;
            existing.deletedAt = null;
            existing.updatedAt = clientUpdatedDate;
            await existing.save();
          }
        } else {
          if (action === 'delete') {
            appliedIds.push(id);
            continue;
          }

          if (entityType === 'accounts') {
            const isCash = payload.type === 'cash' || (payload.name && payload.name.trim().toLowerCase() === 'cash');
            if (isCash) {
              const existingCash = await Account.findOne({
                userId,
                deletedAt: null,
                $or: [{ name: /^cash$/i }, { type: 'cash' }]
              });
              if (existingCash) {
                // A Cash account already exists for this user; acknowledge client push without creating duplicate
                appliedIds.push(id);
                continue;
              }
            }
          }

          await Model.create({
            ...payload,
            _id: id,
            userId,
            deletedAt: null,
            updatedAt: clientUpdatedDate
          });
        }

        appliedIds.push(id);
      } catch (err: any) {
        conflicts.push({ id, reason: err.message || 'Database error during apply' });
      }
    }

    // Refresh balances for affected accounts
    const accounts = await Account.find({ userId, deletedAt: null });
    for (const acc of accounts) {
      const bal = await AccountService.calculateAccountBalance(userId, acc._id);
      if (acc.currentBalanceCentavos !== bal) {
        acc.currentBalanceCentavos = bal;
        await acc.save();
      }
    }

    return {
      appliedIds,
      conflicts,
      serverTime: new Date().toISOString()
    };
  }

  static async pullChanges(userId: string, since?: string): Promise<SyncPullResponse> {
    const filter: Record<string, unknown> = { userId };
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        filter.updatedAt = { $gt: sinceDate };
      }
    }

    const [
      accounts,
      categories,
      transactions,
      recurringRules,
      recurringOverrides,
      goals,
      goalContributions,
      dayNotes
    ] = await Promise.all([
      Account.find(filter).lean(),
      Category.find(filter).lean(),
      Transaction.find(filter).lean(),
      RecurringRule.find(filter).lean(),
      RecurringOverride.find(filter).lean(),
      Goal.find(filter).lean(),
      GoalContribution.find(filter).lean(),
      DayNote.find(filter).lean()
    ]);

    return {
      cursor: new Date().toISOString(),
      accounts: accounts as any,
      categories: categories as any,
      transactions: transactions as any,
      recurringRules: recurringRules as any,
      recurringOverrides: recurringOverrides as any,
      goals: goals as any,
      goalContributions: goalContributions as any,
      dayNotes: dayNotes as any
    };
  }
}
