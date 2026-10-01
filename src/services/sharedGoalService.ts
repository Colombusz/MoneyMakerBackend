import { uuidv4 } from '../utils/uuid';
import { PartnerRepository } from '../repositories/partnerRepository';
import { GoalRepository } from '../repositories/goalRepository';
import { UserRepository } from '../repositories/userRepository';
import { AccountRepository } from '../repositories/accountRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { GoalPolicy } from '../policies/goalPolicy';
import { AuthPolicy } from '../policies/authPolicy';
import { AppError } from '../errors/AppError';
import { ISharedGoal } from '../types';

export class SharedGoalService {
  private static async buildGoalDTO(goal: ISharedGoal) {
    const contributions = await GoalRepository.findContributionsForSharedGoal(goal._id);
    const totalSavedCentavos = contributions.reduce((sum, c) => sum + c.amountCentavos, 0);
    const remainingCentavos = Math.max(0, goal.targetAmountCentavos - totalSavedCentavos);
    const percentage =
      goal.targetAmountCentavos > 0
        ? Math.min(100, Math.round((totalSavedCentavos / goal.targetAmountCentavos) * 100))
        : 0;

    const memberContributions: Record<string, number> = {};
    for (const m of goal.members) {
      memberContributions[m.userId] = 0;
    }
    for (const c of contributions) {
      memberContributions[c.userId] = (memberContributions[c.userId] || 0) + c.amountCentavos;
    }

    const userNameMap = new Map<string, string>();
    const membersWithNames = await Promise.all(
      goal.members.map(async (m) => {
        const u = await UserRepository.findById(m.userId);
        const name = u?.name || 'Partner';
        userNameMap.set(m.userId, name);
        return {
          userId: m.userId,
          name,
          role: m.role,
          status: m.status,
          totalContributedCentavos: memberContributions[m.userId] || 0
        };
      })
    );

    // Recent contributions: STRICT PRIVACY ISOLATION - never expose bank accounts or private IDs
    const recentContributions = contributions.slice(0, 10).map((c) => ({
      id: c._id,
      userId: c.userId,
      contributorName: userNameMap.get(c.userId) || 'Partner',
      amountCentavos: c.amountCentavos,
      date: c.date,
      notes: c.notes
    }));

    return {
      id: goal._id,
      name: goal.name,
      targetAmountCentavos: goal.targetAmountCentavos,
      totalSavedCentavos,
      remainingCentavos,
      percentage,
      targetDate: goal.targetDate,
      imageUrl: goal.imageUrl,
      createdByUserId: goal.createdByUserId,
      isArchived: goal.isArchived,
      members: membersWithNames,
      recentContributions,
      updatedAt: goal.updatedAt
    };
  }

  static async listSharedGoals(userId: string) {
    const goals = await PartnerRepository.findSharedGoalsForUser(userId);
    return Promise.all(goals.map((g) => this.buildGoalDTO(g)));
  }

  static async getSharedGoalById(userId: string, id: string) {
    const goal = await PartnerRepository.findSharedGoalById(id);
    GoalPolicy.assertMemberAccess(goal, userId);
    return this.buildGoalDTO(goal!);
  }

  static async createSharedGoal(
    userId: string,
    data: {
      name: string;
      targetAmountCentavos: number;
      targetDate?: string | Date | null;
      imageUrl?: string | null;
      imagePublicId?: string | null;
    }
  ) {
    const user = await UserRepository.findById(userId);
    if (!user || !user.partnerId) {
      throw AppError.badRequest('You must be connected to a partner to create a shared goal');
    }

    const partner = await UserRepository.findById(user.partnerId);
    if (!partner) {
      throw AppError.badRequest('Partner account not found');
    }

    const sharedGoal = await PartnerRepository.createSharedGoal({
      _id: uuidv4(),
      name: data.name.trim(),
      targetAmountCentavos: data.targetAmountCentavos,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      imageUrl: data.imageUrl || null,
      imagePublicId: data.imagePublicId || null,
      createdByUserId: userId,
      members: [
        { userId, role: 'owner', joinedAt: new Date(), status: 'active' },
        { userId: partner._id, role: 'member', joinedAt: new Date(), status: 'active' }
      ],
      isArchived: false,
      updatedAt: new Date()
    });

    return this.buildGoalDTO(sharedGoal);
  }

  static async contributeToSharedGoal(
    userId: string,
    sharedGoalId: string,
    data: {
      amountCentavos: number;
      accountId?: string;
      fromAccountId?: string;
      notes?: string;
      date?: string | Date;
    }
  ) {
    const goal = await PartnerRepository.findSharedGoalById(sharedGoalId);
    GoalPolicy.assertMemberAccess(goal, userId);
    GoalPolicy.assertNotArchived(goal!);
    // Block over-funding: compute current total first so a completed goal
    // rejects new contributions server-side (UI also hides the button).
    const existing = await GoalRepository.findContributionsForSharedGoal(sharedGoalId);
    const totalSaved = existing.reduce((sum, c) => sum + c.amountCentavos, 0);
    GoalPolicy.assertNotCompleted(goal!, totalSaved);

    const accountToDebit = data.fromAccountId || data.accountId;
    let transactionId = null;

    if (accountToDebit) {
      const account = await AccountRepository.findById(accountToDebit);
      AuthPolicy.assertOwnership(account, userId, 'Account');

      const transaction = await TransactionRepository.create({
        _id: uuidv4(),
        userId,
        accountId: accountToDebit,
        type: 'expense',
        amountCentavos: data.amountCentavos,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes || `Contribution to shared goal: ${goal!.name}`,
        goalId: goal!._id,
        updatedAt: new Date()
      });
      transactionId = transaction._id;
    }

    const contribution = await GoalRepository.createContribution({
      _id: uuidv4(),
      userId,
      sharedGoalId: goal!._id,
      amountCentavos: data.amountCentavos,
      transactionId,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes || '',
      updatedAt: new Date()
    });

    return {
      success: true,
      contribution: {
        id: contribution._id,
        userId: contribution.userId,
        sharedGoalId: contribution.sharedGoalId,
        amountCentavos: contribution.amountCentavos,
        date: contribution.date,
        notes: contribution.notes
      }
    };
  }

  static async leaveSharedGoal(userId: string, sharedGoalId: string) {
    const goal = await PartnerRepository.findSharedGoalById(sharedGoalId);
    GoalPolicy.assertMemberAccess(goal, userId);

    const updatedMembers = goal!.members.map((m) =>
      m.userId === userId ? { ...m, status: 'left' as const } : m
    );
    const activeMembers = updatedMembers.filter((m) => m.status === 'active');
    const shouldArchive = activeMembers.length === 0 || goal!.createdByUserId === userId;

    await PartnerRepository.updateSharedGoal(sharedGoalId, {
      members: updatedMembers,
      ...(shouldArchive ? { isArchived: true } : {})
    });

    return { success: true, message: 'Successfully left the shared goal' };
  }
}
