import { uuidv4 } from '../utils/uuid';
import { seedDefaultAccounts } from '../utils/defaults';
import { AccountRepository } from '../repositories/accountRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { AuthPolicy } from '../policies/authPolicy';
import { AppError } from '../errors/AppError';
import { AccountType } from '../types';

export class AccountService {
  static async calculateAccountBalance(userId: string, accountId: string): Promise<number> {
    const account = await AccountRepository.findById(accountId);
    AuthPolicy.assertOwnership(account, userId, 'Account');

    const transactions = await TransactionRepository.findForAccountBalance(userId, accountId);

    let balance = account.startingBalanceCentavos;
    for (const t of transactions) {
      if (t.type === 'income') {
        balance += t.amountCentavos;
      } else if (t.type === 'expense') {
        balance -= t.amountCentavos;
      } else if (t.type === 'transfer') {
        if (t.accountId === accountId) {
          balance -= t.amountCentavos;
        }
        if (t.destinationAccountId === accountId) {
          balance += t.amountCentavos;
        }
      }
    }
    return balance;
  }

  static async listAccounts(userId: string) {
    await seedDefaultAccounts(userId);
    const accounts = await AccountRepository.findByUserId(userId);
    const enriched = await Promise.all(
      accounts.map(async (acc) => {
        const currentBalance = await this.calculateAccountBalance(userId, acc._id);
        return {
          id: acc._id,
          userId: acc.userId,
          name: acc.name,
          type: acc.type,
          startingBalanceCentavos: acc.startingBalanceCentavos,
          currentBalanceCentavos: currentBalance,
          isArchived: acc.isArchived,
          updatedAt: acc.updatedAt
        };
      })
    );
    const totalBalanceCentavos = enriched.reduce((sum, acc) => sum + acc.currentBalanceCentavos, 0);
    return { accounts: enriched, totalBalanceCentavos };
  }

  static async getAccountById(userId: string, accountId: string) {
    const account = await AccountRepository.findById(accountId);
    AuthPolicy.assertOwnership(account, userId, 'Account');
    const currentBalance = await this.calculateAccountBalance(userId, accountId);
    return {
      id: account._id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      startingBalanceCentavos: account.startingBalanceCentavos,
      currentBalanceCentavos: currentBalance,
      isArchived: account.isArchived,
      updatedAt: account.updatedAt
    };
  }

  static async createAccount(
    userId: string,
    data: { name: string; type: AccountType; startingBalanceCentavos?: number }
  ) {
    if (data.name.trim().toLowerCase() === 'cash' || data.type === 'cash') {
      const existing = await AccountRepository.findByUserId(userId);
      const hasCash = existing.some(
        (a) => a.name.toLowerCase() === 'cash' || a.type === 'cash'
      );
      if (hasCash) {
        throw AppError.badRequest('A default Cash account already exists');
      }
    }

    const newAccount = await AccountRepository.create({
      _id: uuidv4(),
      userId,
      name: data.name.trim(),
      type: data.type,
      startingBalanceCentavos: data.startingBalanceCentavos || 0,
      currentBalanceCentavos: data.startingBalanceCentavos || 0,
      isArchived: false,
      updatedAt: new Date()
    });
    return {
      id: newAccount._id,
      userId: newAccount.userId,
      name: newAccount.name,
      type: newAccount.type,
      startingBalanceCentavos: newAccount.startingBalanceCentavos,
      currentBalanceCentavos: newAccount.startingBalanceCentavos,
      isArchived: newAccount.isArchived,
      updatedAt: newAccount.updatedAt
    };
  }

  static async updateAccount(
    userId: string,
    accountId: string,
    updates: {
      name?: string;
      type?: AccountType;
      startingBalanceCentavos?: number;
      isArchived?: boolean;
    }
  ) {
    const existing = await AccountRepository.findById(accountId);
    AuthPolicy.assertOwnership(existing, userId, 'Account');

    if (existing.name.toLowerCase() === 'cash' || existing.type === 'cash') {
      if (updates.name && updates.name.trim().toLowerCase() !== 'cash') {
        throw AppError.badRequest('The default Cash account cannot be renamed');
      }
      if (updates.type && updates.type !== 'cash') {
        throw AppError.badRequest('The Cash account type cannot be changed');
      }
    }

    const updated = await AccountRepository.update(accountId, {
      ...updates,
      updatedAt: new Date()
    });
    if (!updated) throw AppError.notFound('Account not found');

    const currentBalance = await this.calculateAccountBalance(userId, accountId);
    return {
      id: updated._id,
      userId: updated.userId,
      name: updated.name,
      type: updated.type,
      startingBalanceCentavos: updated.startingBalanceCentavos,
      currentBalanceCentavos: currentBalance,
      isArchived: updated.isArchived,
      updatedAt: updated.updatedAt
    };
  }

  static async deleteAccount(userId: string, accountId: string) {
    const existing = await AccountRepository.findById(accountId);
    AuthPolicy.assertOwnership(existing, userId, 'Account');
    if (existing.name.toLowerCase() === 'cash' || existing.type === 'cash') {
      throw AppError.badRequest('The default Cash account cannot be deleted');
    }
    await AccountRepository.softDelete(accountId);
  }

  static async transfer(
    userId: string,
    data: {
      fromAccountId: string;
      toAccountId: string;
      amountCentavos: number;
      date?: string | Date;
      notes?: string;
    }
  ) {
    if (data.fromAccountId === data.toAccountId) {
      throw AppError.badRequest('Source and destination accounts must be different');
    }
    const from = await AccountRepository.findById(data.fromAccountId);
    AuthPolicy.assertOwnership(from, userId, 'Source account');

    const to = await AccountRepository.findById(data.toAccountId);
    AuthPolicy.assertOwnership(to, userId, 'Destination account');

    const tx = await TransactionRepository.create({
      _id: uuidv4(),
      userId,
      accountId: data.fromAccountId,
      destinationAccountId: data.toAccountId,
      type: 'transfer',
      amountCentavos: data.amountCentavos,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes || 'Account transfer',
      updatedAt: new Date()
    });

    return tx;
  }
}
