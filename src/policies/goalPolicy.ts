import { ISharedGoal } from '../types';
import { AppError } from '../errors/AppError';

export class GoalPolicy {
  /**
   * Asserts that a user is an active member of a shared goal.
   * Throws 404 to avoid leaking the existence of shared goals to non-members.
   */
  static assertMemberAccess(sharedGoal: ISharedGoal | null | undefined, userId: string): void {
    if (!sharedGoal) {
      throw AppError.notFound('Shared goal not found');
    }
    const isMember = sharedGoal.members?.some((m) => m.userId === userId && m.status === 'active');
    if (!isMember) {
      throw AppError.notFound('Shared goal not found');
    }
  }

  /**
   * Asserts that a shared goal is not archived.
   */
  static assertNotArchived(sharedGoal: ISharedGoal): void {
    if (sharedGoal.isArchived) {
      throw AppError.badRequest(
        'This shared goal is archived and cannot receive new contributions'
      );
    }
  }

  /**
   * Asserts that a shared goal has not already been fully funded.
   * Completion here means total saved >= target (computed from contributions,
   * so callers pass the precomputed total when available to avoid an extra
   * query; falls back to a best-effort member-count heuristic of 0).
   */
  static assertNotCompleted(
    sharedGoal: ISharedGoal,
    totalSavedCentavos?: number
  ): void {
    const saved = totalSavedCentavos ?? 0;
    if (saved >= sharedGoal.targetAmountCentavos && sharedGoal.targetAmountCentavos > 0) {
      throw AppError.badRequest('This shared goal is already completed');
    }
  }
}
