import { uuidv4 } from '../utils/uuid';
import { TransactionRepository } from '../repositories/transactionRepository';
import { AccountRepository } from '../repositories/accountRepository';
import { AuthPolicy } from '../policies/authPolicy';
import { AppError } from '../errors/AppError';
import { ITransaction, TransactionType } from '../types';

export interface CreateTransactionDTO {
  accountId: string;
  type: TransactionType;
  amountCentavos: number;
  categoryId?: string | null;
  source?: string | null;
  destinationAccountId?: string | null;
  date: string | Date;
  notes?: string;
  receiptImageUrl?: string | null;
  receiptPublicId?: string | null;
  recurringRuleId?: string | null;
  recurringOccurrenceDate?: string | Date | null;
  goalId?: string | null;
}

export class TransactionService {
  static async listTransactions(
    userId: string,
    filter: {
      accountId?: string;
      categoryId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      skip?: number;
    }
  ) {
    return TransactionRepository.findWithFilter({
      userId,
      accountId: filter.accountId,
      categoryId: filter.categoryId,
      type: filter.type,
      startDate: filter.startDate ? new Date(filter.startDate) : undefined,
      endDate: filter.endDate ? new Date(filter.endDate) : undefined,
      limit: filter.limit,
      skip: filter.skip
    });
  }

  static async getTransactionById(userId: string, id: string) {
    const transaction = await TransactionRepository.findById(id);
    AuthPolicy.assertOwnership(transaction, userId, 'Transaction');
    return transaction;
  }

  static async createTransaction(userId: string, data: CreateTransactionDTO) {
    const sourceAccount = await AccountRepository.findById(data.accountId);
    AuthPolicy.assertOwnership(sourceAccount, userId, 'Source Account');

    if (data.type === 'transfer') {
      if (!data.destinationAccountId) {
        throw AppError.badRequest('Destination account is required for transfer transactions');
      }
      if (data.accountId === data.destinationAccountId) {
        throw AppError.badRequest('Source and destination accounts must be different');
      }
      const destAccount = await AccountRepository.findById(data.destinationAccountId);
      AuthPolicy.assertOwnership(destAccount, userId, 'Destination Account');
    }

    const transaction = await TransactionRepository.create({
      _id: uuidv4(),
      userId,
      accountId: data.accountId,
      type: data.type,
      amountCentavos: data.amountCentavos,
      categoryId: data.categoryId || null,
      source: data.source || null,
      destinationAccountId: data.destinationAccountId || null,
      date: new Date(data.date),
      notes: data.notes || '',
      receiptImageUrl: data.receiptImageUrl || null,
      receiptPublicId: data.receiptPublicId || null,
      recurringRuleId: data.recurringRuleId || null,
      recurringOccurrenceDate: data.recurringOccurrenceDate
        ? new Date(data.recurringOccurrenceDate)
        : null,
      goalId: data.goalId || null,
      updatedAt: new Date()
    });

    return transaction;
  }

  static async updateTransaction(
    userId: string,
    id: string,
    updates: Partial<CreateTransactionDTO>
  ) {
    const existing = await TransactionRepository.findById(id);
    AuthPolicy.assertOwnership(existing, userId, 'Transaction');

    if (updates.accountId) {
      const sourceAccount = await AccountRepository.findById(updates.accountId);
      AuthPolicy.assertOwnership(sourceAccount, userId, 'Source Account');
    }
    if (updates.type === 'transfer' || existing.type === 'transfer') {
      const destId =
        updates.destinationAccountId !== undefined
          ? updates.destinationAccountId
          : existing.destinationAccountId;
      if (destId) {
        const destAccount = await AccountRepository.findById(destId);
        AuthPolicy.assertOwnership(destAccount, userId, 'Destination Account');
      }
    }

    const { date, recurringOccurrenceDate, ...rest } = updates;
    const payload: Partial<ITransaction> = {
      ...rest,
      updatedAt: new Date(),
      ...(date ? { date: new Date(date) } : {}),
      ...(recurringOccurrenceDate
        ? { recurringOccurrenceDate: new Date(recurringOccurrenceDate) }
        : {})
    };

    const updated = await TransactionRepository.update(id, payload);
    return updated;
  }

  static async deleteTransaction(userId: string, id: string) {
    const existing = await TransactionRepository.findById(id);
    AuthPolicy.assertOwnership(existing, userId, 'Transaction');
    await TransactionRepository.softDelete(id);
  }

  static async getMonthSummary(userId: string, year: number, month: number) {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const transactions = await TransactionRepository.findWithFilter({
      userId,
      startDate: startOfMonth,
      endDate: endOfMonth
    });

    let totalIncomeCentavos = 0;
    let totalExpenseCentavos = 0;
    const categoryTotals: Record<string, number> = {};
    const dailyBreakdown: Record<
      string,
      { incomeCentavos: number; expenseCentavos: number; count: number }
    > = {};

    for (const t of transactions) {
      const dayKey = new Date(t.date).toISOString().split('T')[0];
      if (!dailyBreakdown[dayKey]) {
        dailyBreakdown[dayKey] = { incomeCentavos: 0, expenseCentavos: 0, count: 0 };
      }
      dailyBreakdown[dayKey].count += 1;

      if (t.type === 'income') {
        totalIncomeCentavos += t.amountCentavos;
        dailyBreakdown[dayKey].incomeCentavos += t.amountCentavos;
      } else if (t.type === 'expense') {
        totalExpenseCentavos += t.amountCentavos;
        dailyBreakdown[dayKey].expenseCentavos += t.amountCentavos;
        // Shared goal contributions and shared account deposits have no categoryId
        // but carry goalId/sharedAccountId — group them under virtual categories
        // so the pie chart / legend shows "Shared Goal Contribution" etc.
        // instead of leaving them as "Uncategorized".
        const catKey = t.categoryId
          ? t.categoryId
          : t.goalId
            ? '__shared_goal__'
            : t.sharedAccountId
              ? '__shared_account__'
              : '__uncategorized__';
        categoryTotals[catKey] = (categoryTotals[catKey] || 0) + t.amountCentavos;
      }
    }

    const netCentavos = totalIncomeCentavos - totalExpenseCentavos;

    return {
      year,
      month,
      totalIncomeCentavos,
      totalExpenseCentavos,
      netCentavos,
      categoryTotals,
      dailyBreakdown
    };
  }
}
