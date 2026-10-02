import { IVacation, IVacationChipIn } from '../types';
import { AppError } from '../errors/AppError';

export class VacationPolicy {
  /**
   * Asserts that a user is a member of the vacation.
   * Throws 404 to avoid leaking existence to non-members.
   */
  static assertMemberAccess(vacation: IVacation | null | undefined, userId: string): void {
    if (!vacation) {
      throw AppError.notFound('Vacation not found');
    }
    const isMember = vacation.members?.some((m) => m.userId === userId);
    if (!isMember) {
      throw AppError.notFound('Vacation not found');
    }
  }

  /**
   * Asserts that the caller is the Vacation Master.
   */
  static assertMaster(vacation: IVacation, userId: string): void {
    const member = vacation.members?.find((m) => m.userId === userId);
    if (!member || member.role !== 'master') {
      throw AppError.forbidden('Only the vacation master can perform this action');
    }
  }

  /**
   * Asserts that the vacation is active and accepting changes.
   */
  static assertActive(vacation: IVacation): void {
    if (vacation.status !== 'active') {
      throw AppError.badRequest('Vacation is concluded and is read-only');
    }
  }

  /**
   * Asserts that the vacation account has enough funds for an expense.
   * Prevents overdrafts.
   */
  static assertExpenseBalance(vacation: IVacation, amountCentavos: number): void {
    if (amountCentavos <= 0) {
      throw AppError.badRequest('Expense amount must be greater than zero');
    }
    if (vacation.balanceCentavos < amountCentavos) {
      throw AppError.badRequest(
        `Expense amount (${amountCentavos} centavos) exceeds current vacation balance (${vacation.balanceCentavos} centavos). Please add funds or select a funded chip-in item.`
      );
    }
  }

  /**
   * Asserts that a chip-in item has enough available collected funds for an expense.
   * Prevents overdrafts.
   */
  static assertChipInExpenseBalance(chipIn: IVacationChipIn, amountCentavos: number): void {
    if (amountCentavos <= 0) {
      throw AppError.badRequest('Expense amount must be greater than zero');
    }
    const availableCentavos =
      chipIn.totalCollectedCentavos - (chipIn.totalSpentCentavos || 0) - (chipIn.totalRefundedCentavos || 0);
    if (availableCentavos < amountCentavos) {
      throw AppError.badRequest(
        `Expense amount (${amountCentavos} centavos) exceeds available balance for chip-in item "${chipIn.title}" (${availableCentavos} centavos).`
      );
    }
  }

  /**
   * Asserts that a chip-in item has enough available collected funds for a refund.
   * Refunds cannot exceed remaining available balance.
   */
  static assertChipInRefundBalance(chipIn: IVacationChipIn, amountCentavos: number): void {
    if (amountCentavos <= 0) {
      throw AppError.badRequest('Refund amount must be greater than zero');
    }
    const availableCentavos =
      chipIn.totalCollectedCentavos - (chipIn.totalSpentCentavos || 0) - (chipIn.totalRefundedCentavos || 0);
    if (availableCentavos < amountCentavos) {
      throw AppError.badRequest(
        `Refund amount (${amountCentavos} centavos) exceeds remaining available balance for chip-in item "${chipIn.title}" (${availableCentavos} centavos)`
      );
    }
  }

  /**
   * Asserts that the vacation account has enough funds for a refund.
   * Refunds cannot exceed the remaining balance.
   */
  static assertRefundBalance(vacation: IVacation, amountCentavos: number): void {
    if (amountCentavos <= 0) {
      throw AppError.badRequest('Refund amount must be greater than zero');
    }
    if (vacation.balanceCentavos < amountCentavos) {
      throw AppError.badRequest(
        `Refund amount (${amountCentavos} centavos) exceeds remaining vacation balance (${vacation.balanceCentavos} centavos)`
      );
    }
  }

  /**
   * Asserts that the vacation account balance and all chip-ins have zero remaining balance before concluding.
   */
  static assertZeroBalanceForConclusion(vacation: IVacation, chipIns?: IVacationChipIn[]): void {
    if (vacation.balanceCentavos !== 0) {
      throw AppError.badRequest(
        `Cannot conclude vacation while balance is not zero (current balance: ${vacation.balanceCentavos} centavos). Please record expenses or refund remaining funds to members.`
      );
    }
    if (chipIns && chipIns.length > 0) {
      for (const chipIn of chipIns) {
        const remaining =
          chipIn.totalCollectedCentavos - (chipIn.totalSpentCentavos || 0) - (chipIn.totalRefundedCentavos || 0);
        if (remaining > 0) {
          throw AppError.badRequest(
            `Cannot conclude vacation while chip-in "${chipIn.title}" has a remaining balance of ${remaining} centavos. Please record expenses or refund remaining funds to members.`
          );
        }
      }
    }
  }
}
