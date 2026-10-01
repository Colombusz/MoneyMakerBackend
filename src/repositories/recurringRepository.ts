import { RecurringRule } from '../models/RecurringRule';
import { RecurringOverride } from '../models/RecurringOverride';
import { IRecurringRule, IRecurringOverride } from '../types';

export class RecurringRepository {
  static async findRulesByUserId(userId: string): Promise<IRecurringRule[]> {
    return RecurringRule.find({ userId, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<IRecurringRule[]>;
  }

  static async findRuleById(id: string): Promise<IRecurringRule | null> {
    return RecurringRule.findById(id).lean() as unknown as Promise<IRecurringRule | null>;
  }

  static async createRule(data: Partial<IRecurringRule>): Promise<IRecurringRule> {
    const doc = await RecurringRule.create(data);
    return doc.toObject() as unknown as IRecurringRule;
  }

  static async updateRule(
    id: string,
    updates: Partial<IRecurringRule>
  ): Promise<IRecurringRule | null> {
    return RecurringRule.findByIdAndUpdate(id, updates, {
      new: true
    }).lean() as unknown as Promise<IRecurringRule | null>;
  }

  static async softDeleteRule(id: string): Promise<IRecurringRule | null> {
    return RecurringRule.findByIdAndUpdate(
      id,
      { deletedAt: new Date(), updatedAt: new Date() },
      { new: true }
    ).lean() as unknown as Promise<IRecurringRule | null>;
  }

  static async findOverridesForUser(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<IRecurringOverride[]> {
    const query: Record<string, unknown> = { userId, deletedAt: null };
    if (startDate || endDate) {
      const dateQuery: Record<string, Date> = {};
      if (startDate) dateQuery.$gte = startDate;
      if (endDate) dateQuery.$lte = endDate;
      query.occurrenceDate = dateQuery;
    }
    return RecurringOverride.find(query).lean() as unknown as Promise<IRecurringOverride[]>;
  }

  static async findOverride(
    userId: string,
    recurringRuleId: string,
    occurrenceDate: Date
  ): Promise<IRecurringOverride | null> {
    return RecurringOverride.findOne({
      userId,
      recurringRuleId,
      occurrenceDate,
      deletedAt: null
    }).lean() as unknown as Promise<IRecurringOverride | null>;
  }

  static async upsertOverride(data: Partial<IRecurringOverride>): Promise<IRecurringOverride> {
    const doc = await RecurringOverride.findOneAndUpdate(
      {
        userId: data.userId,
        recurringRuleId: data.recurringRuleId,
        occurrenceDate: data.occurrenceDate
      },
      { ...data, updatedAt: new Date() },
      { upsert: true, new: true }
    ).lean();
    return doc as unknown as IRecurringOverride;
  }
}
