import { ISharedAccount } from '../types';
import { AppError } from '../errors/AppError';

export class SharedAccountPolicy {
  /**
   * Asserts that a user is an active member of a shared account.
   * Throws 404 to avoid leaking existence to non-members (privacy isolation).
   */
  static assertMemberAccess(sharedAccount: ISharedAccount | null | undefined, userId: string): void {
    if (!sharedAccount) {
      throw AppError.notFound('Shared account not found');
    }
    const isMember = sharedAccount.members?.some((m) => m.userId === userId && m.status === 'active');
    if (!isMember) {
      throw AppError.notFound('Shared account not found');
    }
  }

  /**
   * Asserts that a shared account is not archived.
   */
  static assertNotArchived(sharedAccount: ISharedAccount): void {
    if (sharedAccount.isArchived) {
      throw AppError.badRequest('This shared account is archived and cannot receive new movements');
    }
  }
}
