import { Transaction } from '../models/Transaction';
import { ITransaction } from '../types';

export interface TransactionFilter {
  userId: string;
  accountId?: string;
  categoryId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}

export class TransactionRepository {
  static async findWithFilter(filter: TransactionFilter): Promise<ITransaction[]> {
    const query: Record<string, unknown> = {
      userId: filter.userId,
      deletedAt: null
    };

    if (filter.accountId) query.accountId = filter.accountId;
    if (filter.categoryId) query.categoryId = filter.categoryId;
    if (filter.type) query.type = filter.type;

    if (filter.startDate || filter.endDate) {
      const dateQuery: Record<string, Date> = {};
      if (filter.startDate) dateQuery.$gte = filter.startDate;
      if (filter.endDate) dateQuery.$lte = filter.endDate;
      query.date = dateQuery;
    }

    let q = Transaction.find(query).sort({ date: -1, createdAt: -1 });
    if (filter.skip) q = q.skip(filter.skip);
    if (filter.limit) q = q.limit(filter.limit);

    return q.lean() as unknown as Promise<ITransaction[]>;
  }

  static async findById(id: string): Promise<ITransaction | null> {
    return Transaction.findById(id).lean() as unknown as Promise<ITransaction | null>;
  }

  static async create(data: Partial<ITransaction>): Promise<ITransaction> {
    const doc = await Transaction.create(data);
    return doc.toObject() as unknown as ITransaction;
  }

  static async update(id: string, updates: Partial<ITransaction>): Promise<ITransaction | null> {
    return Transaction.findByIdAndUpdate(id, updates, {
      new: true
    }).lean() as unknown as Promise<ITransaction | null>;
  }

  static async softDelete(id: string): Promise<ITransaction | null> {
    return Transaction.findByIdAndUpdate(
      id,
      { deletedAt: new Date(), updatedAt: new Date() },
      { new: true }
    ).lean() as unknown as Promise<ITransaction | null>;
  }

  static async findForAccountBalance(userId: string, accountId: string) {
    return Transaction.find({
      userId,
      deletedAt: null,
      $or: [{ accountId }, { destinationAccountId: accountId }]
    }).lean() as unknown as Promise<ITransaction[]>;
  }
}
