import { Account } from '../models/Account';
import { IAccount } from '../types';

export class AccountRepository {
  static async findByUserId(userId: string): Promise<IAccount[]> {
    return Account.find({ userId, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<IAccount[]>;
  }

  static async findById(id: string): Promise<IAccount | null> {
    return Account.findById(id).lean() as unknown as Promise<IAccount | null>;
  }

  static async create(data: Partial<IAccount>): Promise<IAccount> {
    const doc = await Account.create(data);
    return doc.toObject() as unknown as IAccount;
  }

  static async update(id: string, updates: Partial<IAccount>): Promise<IAccount | null> {
    return Account.findByIdAndUpdate(id, updates, {
      new: true
    }).lean() as unknown as Promise<IAccount | null>;
  }

  static async softDelete(id: string): Promise<IAccount | null> {
    return Account.findByIdAndUpdate(
      id,
      { isArchived: true, deletedAt: new Date(), updatedAt: new Date() },
      { new: true }
    ).lean() as unknown as Promise<IAccount | null>;
  }
}
