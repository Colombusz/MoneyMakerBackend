import { PartnerInvite } from '../models/PartnerInvite';
import { SharedGoal } from '../models/SharedGoal';
import { SharedAccount } from '../models/SharedAccount';
import { SharedAccountMovement } from '../models/SharedAccountMovement';
import { IPartnerInvite, ISharedAccount, ISharedAccountMovement, ISharedGoal } from '../types';

export class PartnerRepository {
  static async findPendingInviteByCode(code: string): Promise<IPartnerInvite | null> {
    return PartnerInvite.findOne({
      inviteCode: code.trim().toUpperCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).lean() as unknown as Promise<IPartnerInvite | null>;
  }

  static async cancelPendingInvites(userId: string): Promise<void> {
    await PartnerInvite.updateMany(
      { inviterUserId: userId, status: 'pending' },
      { status: 'cancelled' }
    );
  }

  static async createInvite(data: Partial<IPartnerInvite>): Promise<IPartnerInvite> {
    const doc = await PartnerInvite.create(data);
    return doc.toObject() as unknown as IPartnerInvite;
  }

  static async updateInviteStatus(
    id: string,
    status: 'accepted' | 'cancelled' | 'expired'
  ): Promise<void> {
    await PartnerInvite.findByIdAndUpdate(id, { status });
  }

  static async findSharedGoalsForUser(userId: string): Promise<ISharedGoal[]> {
    return SharedGoal.find({
      'members.userId': userId,
      isArchived: false,
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<ISharedGoal[]>;
  }

  static async findSharedGoalById(id: string): Promise<ISharedGoal | null> {
    return SharedGoal.findById(id).lean() as unknown as Promise<ISharedGoal | null>;
  }

  static async createSharedGoal(data: Partial<ISharedGoal>): Promise<ISharedGoal> {
    const doc = await SharedGoal.create(data);
    return doc.toObject() as unknown as ISharedGoal;
  }

  static async updateSharedGoal(
    id: string,
    updates: Partial<ISharedGoal>
  ): Promise<ISharedGoal | null> {
    return SharedGoal.findByIdAndUpdate(id, updates, {
      new: true
    }).lean() as unknown as Promise<ISharedGoal | null>;
  }

  static async archiveSharedGoalsForUsers(userId: string): Promise<void> {
    await SharedGoal.updateMany(
      { 'members.userId': userId, isArchived: false },
      { isArchived: true }
    );
  }

  static async findSharedAccountsForUser(userId: string): Promise<ISharedAccount[]> {
    return SharedAccount.find({
      'members.userId': userId,
      isArchived: false,
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<ISharedAccount[]>;
  }

  static async findSharedAccountById(id: string): Promise<ISharedAccount | null> {
    return SharedAccount.findById(id).lean() as unknown as Promise<ISharedAccount | null>;
  }

  static async createSharedAccount(data: Partial<ISharedAccount>): Promise<ISharedAccount> {
    const doc = await SharedAccount.create(data);
    return doc.toObject() as unknown as ISharedAccount;
  }

  static async updateSharedAccount(
    id: string,
    updates: Partial<ISharedAccount>
  ): Promise<ISharedAccount | null> {
    return SharedAccount.findByIdAndUpdate(id, updates, {
      new: true
    }).lean() as unknown as Promise<ISharedAccount | null>;
  }

  static async findMovementsForAccount(sharedAccountId: string): Promise<ISharedAccountMovement[]> {
    return SharedAccountMovement.find({
      sharedAccountId,
      deletedAt: null
    })
      .sort({ date: -1, createdAt: -1 })
      .lean() as unknown as Promise<ISharedAccountMovement[]>;
  }

  static async createMovement(
    data: Partial<ISharedAccountMovement>
  ): Promise<ISharedAccountMovement> {
    const doc = await SharedAccountMovement.create(data);
    return doc.toObject() as unknown as ISharedAccountMovement;
  }

  static async archiveSharedAccountsForUsers(userId: string): Promise<void> {
    await SharedAccount.updateMany(
      { 'members.userId': userId, isArchived: false },
      { isArchived: true }
    );
  }
}
