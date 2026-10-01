import { uuidv4 } from '../utils/uuid';
import { GoalRepository } from '../repositories/goalRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { AccountRepository } from '../repositories/accountRepository';
import { AccountService } from './accountService';
import { AuthPolicy } from '../policies/authPolicy';
import { IGoal } from '../types';

export interface CreateGoalDTO {
  name: string;
  targetAmountCentavos: number;
  targetDate?: string | Date | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  linkedAccountId?: string | null;
}

export class GoalService {
  static async computeMetrics(goal: IGoal) {
    const contributions = await GoalRepository.findContributions(goal._id);
    const contributionsTotal = contributions.reduce((sum, c) => sum + c.amountCentavos, 0);

    let linkedBalance = 0;
    if (goal.linkedAccountId) {
      try {
        const bal = await AccountService.calculateAccountBalance(goal.userId, goal.linkedAccountId);
        linkedBalance = Math.max(0, bal);
      } catch {
        linkedBalance = 0;
      }
    }

    const totalSavedCentavos = contributionsTotal + linkedBalance;
    const remainingCentavos = Math.max(0, goal.targetAmountCentavos - totalSavedCentavos);
    const percentage =
      goal.targetAmountCentavos > 0
        ? Math.min(100, Math.round((totalSavedCentavos / goal.targetAmountCentavos) * 100))
        : 100;

    let projectedCompletionDate = null;
    if (remainingCentavos > 0 && contributions.length >= 2) {
      const sorted = [...contributions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const firstDate = new Date(sorted[0].date).getTime();
      const lastDate = new Date(sorted[sorted.length - 1].date).getTime();
      const diffDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
      const ratePerDay = totalSavedCentavos / diffDays;
      if (ratePerDay > 0) {
        const daysNeeded = Math.ceil(remainingCentavos / ratePerDay);
        const proj = new Date(Date.now() + daysNeeded * 24 * 60 * 60 * 1000);
        projectedCompletionDate = proj.toISOString().split('T')[0];
      }
    }

    return {
      totalSavedCentavos,
      remainingCentavos,
      percentage,
      projectedCompletionDate,
      contributionsCount: contributions.length
    };
  }

  static async listGoals(userId: string) {
    const goals = await GoalRepository.findByUserId(userId);
    return Promise.all(
      goals.map(async (goal) => {
        const metrics = await this.computeMetrics(goal);
        return {
          id: goal._id,
          userId: goal.userId,
          name: goal.name,
          targetAmountCentavos: goal.targetAmountCentavos,
          targetDate: goal.targetDate,
          imageUrl: goal.imageUrl,
          imagePublicId: goal.imagePublicId,
          linkedAccountId: goal.linkedAccountId,
          isShared: goal.isShared,
          updatedAt: goal.updatedAt,
          ...metrics
        };
      })
    );
  }

  static async getGoalById(userId: string, id: string) {
    const goal = await GoalRepository.findById(id);
    AuthPolicy.assertOwnership(goal, userId, 'Goal');

    const metrics = await this.computeMetrics(goal);
    const contributions = await GoalRepository.findContributions(id);

    return {
      id: goal._id,
      userId: goal.userId,
      name: goal.name,
      targetAmountCentavos: goal.targetAmountCentavos,
      targetDate: goal.targetDate,
      imageUrl: goal.imageUrl,
      imagePublicId: goal.imagePublicId,
      linkedAccountId: goal.linkedAccountId,
      isShared: goal.isShared,
      updatedAt: goal.updatedAt,
      ...metrics,
      contributions
    };
  }

  static async createGoal(userId: string, data: CreateGoalDTO) {
    if (data.linkedAccountId) {
      const account = await AccountRepository.findById(data.linkedAccountId);
      AuthPolicy.assertOwnership(account, userId, 'Linked Account');
    }

    const goal = await GoalRepository.create({
      _id: uuidv4(),
      userId,
      name: data.name.trim(),
      targetAmountCentavos: data.targetAmountCentavos,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      imageUrl: data.imageUrl || null,
      imagePublicId: data.imagePublicId || null,
      linkedAccountId: data.linkedAccountId || null,
      isShared: false,
      updatedAt: new Date()
    });

    const metrics = await this.computeMetrics(goal);

    return {
      id: goal._id,
      userId: goal.userId,
      name: goal.name,
      targetAmountCentavos: goal.targetAmountCentavos,
      targetDate: goal.targetDate,
      imageUrl: goal.imageUrl,
      imagePublicId: goal.imagePublicId,
      linkedAccountId: goal.linkedAccountId,
      isShared: goal.isShared,
      updatedAt: goal.updatedAt,
      ...metrics
    };
  }

  static async updateGoal(userId: string, id: string, updates: Partial<CreateGoalDTO>) {
    const existing = await GoalRepository.findById(id);
    AuthPolicy.assertOwnership(existing, userId, 'Goal');

    const payload: Record<string, unknown> = { ...updates, updatedAt: new Date() };
    if (updates.targetDate) payload.targetDate = new Date(updates.targetDate);

    const updated = await GoalRepository.update(id, payload);
    const metrics = await this.computeMetrics(updated!);
    return {
      id: updated!._id,
      userId: updated!.userId,
      name: updated!.name,
      targetAmountCentavos: updated!.targetAmountCentavos,
      targetDate: updated!.targetDate,
      imageUrl: updated!.imageUrl,
      imagePublicId: updated!.imagePublicId,
      linkedAccountId: updated!.linkedAccountId,
      isShared: updated!.isShared,
      updatedAt: updated!.updatedAt,
      ...metrics
    };
  }

  static async deleteGoal(userId: string, id: string) {
    const existing = await GoalRepository.findById(id);
    AuthPolicy.assertOwnership(existing, userId, 'Goal');
    await GoalRepository.softDelete(id);
  }

  static async contributeToGoal(
    userId: string,
    goalId: string,
    data: {
      amountCentavos: number;
      accountId?: string;
      fromAccountId?: string;
      notes?: string;
      date?: string | Date;
    }
  ) {
    const goal = await GoalRepository.findById(goalId);
    AuthPolicy.assertOwnership(goal, userId, 'Goal');

    const accountToDebit = data.fromAccountId || data.accountId || goal.linkedAccountId;
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
        notes: data.notes || `Contribution to goal: ${goal.name}`,
        goalId: goal._id,
        updatedAt: new Date()
      });
      transactionId = transaction._id;
    }

    const contribution = await GoalRepository.createContribution({
      _id: uuidv4(),
      userId,
      goalId: goal._id,
      amountCentavos: data.amountCentavos,
      transactionId,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes || '',
      updatedAt: new Date()
    });

    const metrics = await this.computeMetrics(goal);
    return {
      contribution: {
        id: contribution._id,
        userId: contribution.userId,
        goalId: contribution.goalId,
        amountCentavos: contribution.amountCentavos,
        transactionId: contribution.transactionId,
        date: contribution.date,
        notes: contribution.notes
      },
      goalMetrics: metrics
    };
  }
}
