import { Goal } from '../models/Goal';
import { GoalContribution } from '../models/GoalContribution';
import { IGoal, IGoalContribution } from '../types';

export class GoalRepository {
  static async findByUserId(userId: string): Promise<IGoal[]> {
    return Goal.find({ userId, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<IGoal[]>;
  }

  static async findById(id: string): Promise<IGoal | null> {
    return Goal.findById(id).lean() as unknown as Promise<IGoal | null>;
  }

  static async create(data: Partial<IGoal>): Promise<IGoal> {
    const doc = await Goal.create(data);
    return doc.toObject() as unknown as IGoal;
  }

  static async update(id: string, updates: Partial<IGoal>): Promise<IGoal | null> {
    return Goal.findByIdAndUpdate(id, updates, {
      new: true
    }).lean() as unknown as Promise<IGoal | null>;
  }

  static async softDelete(id: string): Promise<IGoal | null> {
    return Goal.findByIdAndUpdate(
      id,
      { deletedAt: new Date(), updatedAt: new Date() },
      { new: true }
    ).lean() as unknown as Promise<IGoal | null>;
  }

  static async findContributions(goalId: string): Promise<IGoalContribution[]> {
    return GoalContribution.find({ goalId, deletedAt: null })
      .sort({ date: -1 })
      .lean() as unknown as Promise<IGoalContribution[]>;
  }

  static async findContributionsForSharedGoal(sharedGoalId: string): Promise<IGoalContribution[]> {
    return GoalContribution.find({ sharedGoalId, deletedAt: null })
      .sort({ date: -1 })
      .lean() as unknown as Promise<IGoalContribution[]>;
  }

  static async createContribution(data: Partial<IGoalContribution>): Promise<IGoalContribution> {
    const doc = await GoalContribution.create(data);
    return doc.toObject() as unknown as IGoalContribution;
  }
}
