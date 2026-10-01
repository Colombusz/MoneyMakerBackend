import { uuidv4 } from '../utils/uuid';
import { RecurringRepository } from '../repositories/recurringRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { AccountRepository } from '../repositories/accountRepository';
import { AuthPolicy } from '../policies/authPolicy';
import { generateOccurrencesForRange, ProjectedOccurrence } from '../utils/recurringGenerator';
import { IRecurringRule, RecurringFrequency } from '../types';

export interface CreateRecurringRuleDTO {
  accountId: string;
  categoryId: string;
  type?: 'expense' | 'income';
  amountCentavos: number;
  frequency: RecurringFrequency;
  intervalDays?: number | null;
  startDate: string | Date;
  endDate?: string | Date | null;
  maxOccurrences?: number | null;
  notes?: string;
}

const formatRule = (r: IRecurringRule) => ({
  id: r._id || (r as any).id,
  userId: r.userId,
  accountId: r.accountId,
  categoryId: r.categoryId,
  type: r.type,
  amountCentavos: r.amountCentavos,
  frequency: r.frequency,
  intervalDays: r.intervalDays,
  startDate: r.startDate,
  endDate: r.endDate,
  maxOccurrences: r.maxOccurrences,
  notes: r.notes,
  updatedAt: r.updatedAt
});

export class RecurringService {
  static async listRules(userId: string) {
    const rules = await RecurringRepository.findRulesByUserId(userId);
    return rules.map(formatRule);
  }

  static async getRuleById(userId: string, id: string) {
    const rule = await RecurringRepository.findRuleById(id);
    AuthPolicy.assertOwnership(rule, userId, 'Recurring Rule');
    return formatRule(rule);
  }

  static async createRule(userId: string, data: CreateRecurringRuleDTO) {
    const account = await AccountRepository.findById(data.accountId);
    AuthPolicy.assertOwnership(account, userId, 'Account');

    const created = await RecurringRepository.createRule({
      _id: uuidv4(),
      userId,
      accountId: data.accountId,
      categoryId: data.categoryId,
      type: data.type || 'expense',
      amountCentavos: data.amountCentavos,
      frequency: data.frequency,
      intervalDays: data.intervalDays || null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      maxOccurrences: data.maxOccurrences || null,
      notes: data.notes || '',
      updatedAt: new Date()
    });

    return formatRule(created);
  }

  static async updateRule(userId: string, id: string, updates: Partial<CreateRecurringRuleDTO>) {
    const existing = await RecurringRepository.findRuleById(id);
    AuthPolicy.assertOwnership(existing, userId, 'Recurring Rule');

    const { startDate, endDate, ...rest } = updates;
    const payload: Partial<IRecurringRule> = {
      ...rest,
      updatedAt: new Date(),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {})
    };

    const updated = await RecurringRepository.updateRule(id, payload);
    return updated ? formatRule(updated) : null;
  }

  static async deleteRule(userId: string, id: string) {
    const existing = await RecurringRepository.findRuleById(id);
    AuthPolicy.assertOwnership(existing, userId, 'Recurring Rule');
    await RecurringRepository.softDeleteRule(id);
  }

  static async getOccurrences(
    userId: string,
    startStr: string,
    endStr: string
  ): Promise<ProjectedOccurrence[]> {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const [rules, overrides] = await Promise.all([
      RecurringRepository.findRulesByUserId(userId),
      RecurringRepository.findOverridesForUser(userId, startDate, endDate)
    ]);

    return generateOccurrencesForRange(rules, overrides, startDate, endDate);
  }

  static async payOccurrence(
    userId: string,
    id: string,
    occurrenceDateStr: string,
    accountId?: string,
    amountCentavos?: number,
    notes?: string
  ) {
    const rule = await RecurringRepository.findRuleById(id);
    AuthPolicy.assertOwnership(rule, userId, 'Recurring Rule');

    const occurrenceDate = new Date(occurrenceDateStr);
    const payAccountId = accountId || rule.accountId;
    const payAmount = amountCentavos !== undefined ? amountCentavos : rule.amountCentavos;

    const account = await AccountRepository.findById(payAccountId);
    AuthPolicy.assertOwnership(account, userId, 'Account');

    const transaction = await TransactionRepository.create({
      _id: uuidv4(),
      userId,
      accountId: payAccountId,
      categoryId: rule.categoryId,
      type: rule.type || 'expense',
      amountCentavos: payAmount,
      date: occurrenceDate,
      notes: notes || rule.notes || 'Recurring payment',
      recurringRuleId: rule._id,
      recurringOccurrenceDate: occurrenceDate,
      updatedAt: new Date()
    });

    const override = await RecurringRepository.upsertOverride({
      _id: uuidv4(),
      userId,
      recurringRuleId: rule._id,
      occurrenceDate,
      status: 'paid',
      overrideAmountCentavos: payAmount,
      transactionId: transaction._id
    });

    return {
      success: true,
      transactionId: transaction._id,
      transaction: {
        id: transaction._id,
        userId: transaction.userId,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        amountCentavos: transaction.amountCentavos,
        date: transaction.date,
        notes: transaction.notes
      },
      override
    };
  }

  static async skipOccurrence(userId: string, id: string, occurrenceDateStr: string) {
    const rule = await RecurringRepository.findRuleById(id);
    AuthPolicy.assertOwnership(rule, userId, 'Recurring Rule');

    const occurrenceDate = new Date(occurrenceDateStr);
    const override = await RecurringRepository.upsertOverride({
      _id: uuidv4(),
      userId,
      recurringRuleId: rule._id,
      occurrenceDate,
      status: 'skipped'
    });

    return {
      success: true,
      message: 'Occurrence skipped',
      override
    };
  }
}
