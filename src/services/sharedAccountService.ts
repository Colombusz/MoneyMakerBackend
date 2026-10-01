import { uuidv4 } from '../utils/uuid';
import { PartnerRepository } from '../repositories/partnerRepository';
import { UserRepository } from '../repositories/userRepository';
import { AccountRepository } from '../repositories/accountRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { SharedAccountPolicy } from '../policies/sharedAccountPolicy';
import { AuthPolicy } from '../policies/authPolicy';
import { AppError } from '../errors/AppError';
import { ISharedAccount } from '../types';

export class SharedAccountService {
  private static async buildAccountDTO(account: ISharedAccount, viewerUserId?: string) {
    const movements = await PartnerRepository.findMovementsForAccount(account._id);
    let totalDepositsCentavos = 0;
    let totalExpensesCentavos = 0;
    const memberTotals: Record<string, { depositedCentavos: number; spentCentavos: number }> = {};
    for (const m of account.members) {
      memberTotals[m.userId] = { depositedCentavos: 0, spentCentavos: 0 };
    }
    for (const mv of movements) {
      if (mv.type === 'deposit') {
        totalDepositsCentavos += mv.amountCentavos;
        if (memberTotals[mv.userId]) memberTotals[mv.userId].depositedCentavos += mv.amountCentavos;
      } else {
        totalExpensesCentavos += mv.amountCentavos;
        if (memberTotals[mv.userId]) memberTotals[mv.userId].spentCentavos += mv.amountCentavos;
      }
    }
    const balanceCentavos = totalDepositsCentavos - totalExpensesCentavos;
    const userNameMap = new Map<string, string>();
    const membersWithNames = await Promise.all(
      account.members.map(async (m) => {
        const u = await UserRepository.findById(m.userId);
        const name = u?.name || 'Partner';
        userNameMap.set(m.userId, name);
        return {
          userId: m.userId,
          name,
          role: m.role,
          status: m.status,
          depositedCentavos: memberTotals[m.userId]?.depositedCentavos || 0,
          spentCentavos: memberTotals[m.userId]?.spentCentavos || 0
        };
      })
    );
    const ownAccountNameCache = new Map<string, string>();
    const recentMovements = await Promise.all(
      movements.slice(0, 20).map(async (mv) => {
        const isOwn = viewerUserId ? mv.userId === viewerUserId : false;
        let fundingAccountName: string | undefined;
        if (isOwn && mv.privateAccountId) {
          if (ownAccountNameCache.has(mv.privateAccountId)) {
            fundingAccountName = ownAccountNameCache.get(mv.privateAccountId);
          } else {
            const acct = await AccountRepository.findById(mv.privateAccountId);
            if (acct && acct.userId === viewerUserId) {
              fundingAccountName = acct.name;
              ownAccountNameCache.set(mv.privateAccountId, acct.name);
            }
          }
        }
        return {
          id: mv._id,
          type: mv.type,
          userId: mv.userId,
          contributorName: userNameMap.get(mv.userId) || 'Partner',
          amountCentavos: mv.amountCentavos,
          date: mv.date,
          notes: mv.notes,
          categoryId: mv.categoryId || null,
          ...(fundingAccountName ? { fundingAccountName } : {})
        };
      })
    );
    return {
      id: account._id,
      name: account.name,
      balanceCentavos,
      totalDepositsCentavos,
      totalExpensesCentavos,
      createdByUserId: account.createdByUserId,
      isArchived: account.isArchived,
      members: membersWithNames,
      recentMovements,
      updatedAt: account.updatedAt
    };
  }

  static async listSharedAccounts(userId: string) {
    const accounts = await PartnerRepository.findSharedAccountsForUser(userId);
    return Promise.all(accounts.map((a) => this.buildAccountDTO(a, userId)));
  }

  static async getSharedAccountById(userId: string, id: string) {
    const account = await PartnerRepository.findSharedAccountById(id);
    SharedAccountPolicy.assertMemberAccess(account, userId);
    return this.buildAccountDTO(account!, userId);
  }

  static async createSharedAccount(userId: string, data: { name: string }) {
    const user = await UserRepository.findById(userId);
    if (!user || !user.partnerId) {
      throw AppError.badRequest('You must be connected to a partner to create a shared account');
    }
    const partner = await UserRepository.findById(user.partnerId);
    if (!partner) {
      throw AppError.badRequest('Partner account not found');
    }
    const account = await PartnerRepository.createSharedAccount({
      _id: uuidv4(),
      name: data.name.trim(),
      createdByUserId: userId,
      members: [
        { userId, role: 'owner', joinedAt: new Date(), status: 'active' },
        { userId: partner._id, role: 'member', joinedAt: new Date(), status: 'active' }
      ],
      isArchived: false,
      updatedAt: new Date()
    });
    return this.buildAccountDTO(account, userId);
  }

  static async deposit(
    userId: string,
    sharedAccountId: string,
    data: { amountCentavos: number; fromAccountId: string; date?: string | Date; notes?: string }
  ) {
    const account = await PartnerRepository.findSharedAccountById(sharedAccountId);
    SharedAccountPolicy.assertMemberAccess(account, userId);
    SharedAccountPolicy.assertNotArchived(account!);
    const fundingAccount = await AccountRepository.findById(data.fromAccountId);
    AuthPolicy.assertOwnership(fundingAccount, userId, 'Account');
    const transaction = await TransactionRepository.create({
      _id: uuidv4(),
      userId,
      accountId: data.fromAccountId,
      type: 'expense',
      amountCentavos: data.amountCentavos,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes || `Deposit to shared account: ${account!.name}`,
      sharedAccountId: account!._id,
      updatedAt: new Date()
    });
    const movement = await PartnerRepository.createMovement({
      _id: uuidv4(),
      sharedAccountId: account!._id,
      type: 'deposit',
      userId,
      amountCentavos: data.amountCentavos,
      privateAccountId: data.fromAccountId,
      privateTransactionId: transaction._id,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes || '',
      updatedAt: new Date()
    });
    const dto = await this.buildAccountDTO(
      (await PartnerRepository.findSharedAccountById(account!._id))!,
      userId
    );
    return {
      success: true,
      movement: {
        id: movement._id,
        type: movement.type,
        amountCentavos: movement.amountCentavos,
        date: movement.date,
        notes: movement.notes,
        privateTransactionId: movement.privateTransactionId
      },
      privateTransaction: { id: transaction._id, accountId: transaction.accountId },
      sharedAccount: dto
    };
  }

  static async recordExpense(
    userId: string,
    sharedAccountId: string,
    data: { amountCentavos: number; categoryId?: string | null; date?: string | Date; notes?: string }
  ) {
    const account = await PartnerRepository.findSharedAccountById(sharedAccountId);
    SharedAccountPolicy.assertMemberAccess(account, userId);
    SharedAccountPolicy.assertNotArchived(account!);
    const movement = await PartnerRepository.createMovement({
      _id: uuidv4(),
      sharedAccountId: account!._id,
      type: 'expense',
      userId,
      amountCentavos: data.amountCentavos,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes || '',
      categoryId: data.categoryId || null,
      updatedAt: new Date()
    });
    const dto = await this.buildAccountDTO(
      (await PartnerRepository.findSharedAccountById(account!._id))!,
      userId
    );
    return {
      success: true,
      movement: {
        id: movement._id,
        type: movement.type,
        amountCentavos: movement.amountCentavos,
        date: movement.date,
        notes: movement.notes,
        categoryId: movement.categoryId
      },
      sharedAccount: dto
    };
  }

}
