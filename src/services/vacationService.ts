import crypto from 'crypto';
import { uuidv4 } from '../utils/uuid';
import { VacationRepository } from '../repositories/vacationRepository';
import { UserRepository } from '../repositories/userRepository';
import { AccountRepository } from '../repositories/accountRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { VacationPolicy } from '../policies/vacationPolicy';
import { AuthPolicy } from '../policies/authPolicy';
import { AccountService } from './accountService';
import { AppError } from '../errors/AppError';
import { IVacation } from '../types';

export class VacationService {
  private static async generateUniqueJoinCode(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const code = 'V' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
      const existing = await VacationRepository.findVacationByJoinCode(code);
      if (!existing) {
        return code;
      }
    }
    return 'V' + Date.now().toString(36).toUpperCase().slice(-5);
  }

  static async createVacation(userId: string, data: { name: string; description?: string }) {
    if (!data.name || !data.name.trim()) {
      throw AppError.badRequest('Vacation name is required');
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const joinCode = await this.generateUniqueJoinCode();
    const vacationId = uuidv4();

    const vacation = await VacationRepository.createVacation({
      _id: vacationId,
      name: data.name.trim(),
      description: data.description ? data.description.trim() : '',
      joinCode,
      creatorUserId: userId,
      status: 'active',
      members: [
        {
          userId,
          name: user.name || 'Vacation Master',
          role: 'master',
          joinedAt: new Date()
        }
      ],
      balanceCentavos: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await VacationRepository.createLogEntry({
      _id: uuidv4(),
      vacationId: vacation._id,
      type: 'deposit',
      userId,
      userName: user.name || 'Vacation Master',
      amountCentavos: 0,
      description: `Vacation created by ${user.name || 'Vacation Master'}`,
      date: new Date(),
      createdAt: new Date()
    });

    return vacation;
  }

  static async joinVacation(userId: string, joinCode: string) {
    if (!joinCode || !joinCode.trim()) {
      throw AppError.badRequest('Vacation code is required');
    }

    const vacation = await VacationRepository.findVacationByJoinCode(joinCode);
    if (!vacation) {
      throw AppError.notFound('Invalid vacation code');
    }

    if (vacation.status !== 'active') {
      throw AppError.badRequest('This vacation has concluded and is no longer accepting new members');
    }

    const alreadyMember = vacation.members.some((m) => m.userId === userId);
    if (alreadyMember) {
      return vacation;
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const updated = await VacationRepository.updateVacation(vacation._id, {
      $push: {
        members: {
          userId,
          name: user.name || 'Vacation Member',
          role: 'member',
          joinedAt: new Date()
        }
      },
      updatedAt: new Date()
    } as any);

    await VacationRepository.createLogEntry({
      _id: uuidv4(),
      vacationId: vacation._id,
      type: 'deposit',
      userId,
      userName: user.name || 'Vacation Member',
      amountCentavos: 0,
      description: `${user.name || 'Member'} joined the vacation`,
      date: new Date(),
      createdAt: new Date()
    });

    return updated!;
  }

  static async getActiveVacations(userId: string) {
    return VacationRepository.findActiveVacationsForUser(userId);
  }

  static async getPastVacations(userId: string) {
    return VacationRepository.findPastVacationsForUser(userId);
  }

  static async getVacationById(userId: string, vacationId: string) {
    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);

    const [expenseItems, loggedExpenses, chipIns, logs] = await Promise.all([
      VacationRepository.findExpenseItems(vacationId),
      VacationRepository.findLoggedExpenses(vacationId, vacation!.status === 'concluded' ? userId : undefined),
      VacationRepository.findChipIns(vacationId),
      VacationRepository.findLogs(vacationId)
    ]);

    return {
      vacation: vacation!,
      expenseItems,
      loggedExpenses,
      chipIns,
      logs
    };
  }

  static async getPastVacationSummary(userId: string, vacationId: string) {
    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);

    const [myLoggedExpenses, allChipIns, allLogs, sharedExpenses] = await Promise.all([
      VacationRepository.findLoggedExpenses(vacationId, userId),
      VacationRepository.findChipIns(vacationId),
      VacationRepository.findLogs(vacationId),
      VacationRepository.findExpenseItems(vacationId)
    ]);

    // Privacy isolation: only viewing member's own chip-in contributions
    const myChipIns = allChipIns
      .map((chipIn) => ({
        ...chipIn,
        contributions: chipIn.contributions.filter((c) => c.userId === userId)
      }))
      .filter((chipIn) => chipIn.contributions.length > 0);

    const totalSharedExpensesCentavos = sharedExpenses.reduce(
      (sum, item) => sum + item.amountCentavos,
      0
    );

    const myChipInContributionsCentavos = myChipIns.reduce((sum, chipIn) => {
      const contribTotal = chipIn.contributions.reduce((cSum, c) => cSum + c.amountCentavos, 0);
      return sum + contribTotal;
    }, 0);

    const myLoggedExpensesCentavos = myLoggedExpenses.reduce(
      (sum, item) => sum + item.amountCentavos,
      0
    );

    const myDepositsCentavos = allLogs
      .filter((log) => log.userId === userId && log.type === 'deposit')
      .reduce((sum, log) => sum + log.amountCentavos, 0);

    const myRefundsCentavos = allLogs
      .filter((log) => log.userId === userId && log.type === 'refund')
      .reduce((sum, log) => sum + log.amountCentavos, 0);

    const myTotalSpentCentavos =
      myLoggedExpensesCentavos + myDepositsCentavos + myChipInContributionsCentavos - myRefundsCentavos;

    return {
      vacation: {
        _id: vacation!._id,
        name: vacation!.name,
        description: vacation!.description,
        joinCode: vacation!.joinCode,
        creatorUserId: vacation!.creatorUserId,
        status: vacation!.status,
        createdAt: vacation!.createdAt,
        concludedAt: vacation!.concludedAt
      },
      sharedExpenses,
      myLoggedExpenses,
      myChipIns,
      summary: {
        totalSharedExpensesCentavos,
        myLoggedExpensesCentavos,
        myChipInContributionsCentavos,
        myDepositsCentavos,
        myRefundsCentavos,
        myTotalSpentCentavos
      }
    };
  }

  static async deposit(
    userId: string,
    vacationId: string,
    data: { amountCentavos: number; fromAccountId: string; notes?: string }
  ) {
    if (!data.amountCentavos || data.amountCentavos <= 0) {
      throw AppError.badRequest('Deposit amount must be greater than zero');
    }
    if (!data.fromAccountId) {
      throw AppError.badRequest('Funding account is required');
    }

    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);
    VacationPolicy.assertActive(vacation!);

    const fundingAccount = await AccountRepository.findById(data.fromAccountId);
    AuthPolicy.assertOwnership(fundingAccount, userId, 'Account');

    // Overdraft check: member cannot deposit more than their local account balance
    const currentBalance = await AccountService.calculateAccountBalance(userId, data.fromAccountId);
    if (currentBalance < data.amountCentavos) {
      throw AppError.badRequest(
        `Insufficient funds in account ${fundingAccount.name}. Available: ${currentBalance} centavos, requested: ${data.amountCentavos} centavos.`
      );
    }

    const user = await UserRepository.findById(userId);
    const userName = user?.name || 'Member';

    // Record local expense transaction in member's account
    const transaction = await TransactionRepository.create({
      _id: uuidv4(),
      userId,
      accountId: data.fromAccountId,
      type: 'expense',
      amountCentavos: data.amountCentavos,
      date: new Date(),
      notes: data.notes || `Vacation deposit: ${vacation!.name}`,
      updatedAt: new Date()
    });

    const newLocalBalance = await AccountService.calculateAccountBalance(userId, data.fromAccountId);
    await AccountRepository.update(fundingAccount._id, {
      currentBalanceCentavos: newLocalBalance,
      updatedAt: new Date()
    });

    // Add funds to vacation balance
    const updatedVacation = await VacationRepository.updateVacation(vacationId, {
      $inc: { balanceCentavos: data.amountCentavos },
      updatedAt: new Date()
    } as any);

    // Append to transparent immutable log
    const log = await VacationRepository.createLogEntry({
      _id: uuidv4(),
      vacationId,
      type: 'deposit',
      userId,
      userName,
      amountCentavos: data.amountCentavos,
      description: data.notes || `Deposit into vacation pool from ${fundingAccount.name}`,
      date: new Date(),
      createdAt: new Date()
    });

    return {
      success: true,
      vacation: updatedVacation!,
      log,
      transactionId: transaction._id
    };
  }

  static async createExpenseItem(
    userId: string,
    vacationId: string,
    data: {
      title: string;
      amountCentavos: number;
      category?: string | null;
      deductionSource?: 'pool' | 'main_pool' | 'chip_in';
      chipInId?: string | null;
      date?: string | Date;
      notes?: string;
    }
  ) {
    if (!data.title || !data.title.trim()) {
      throw AppError.badRequest('Expense title is required');
    }
    if (!data.amountCentavos || data.amountCentavos <= 0) {
      throw AppError.badRequest('Expense amount must be greater than zero');
    }

    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);
    VacationPolicy.assertActive(vacation!);
    VacationPolicy.assertMaster(vacation!, userId);

    const isChipIn = data.deductionSource === 'chip_in';
    let targetChipIn: any = null;
    let updatedVacation: IVacation | null = vacation;

    if (isChipIn) {
      if (!data.chipInId) {
        throw AppError.badRequest('Chip-in item is required when deduction source is chip-in');
      }
      targetChipIn = await VacationRepository.findChipInById(data.chipInId);
      if (!targetChipIn || targetChipIn.vacationId !== vacationId) {
        throw AppError.notFound('Chip-in item not found');
      }
      VacationPolicy.assertChipInExpenseBalance(targetChipIn, data.amountCentavos);

      // Deduct from chip-in item total spent
      await VacationRepository.updateChipIn(data.chipInId, {
        $inc: { totalSpentCentavos: data.amountCentavos }
      });
    } else {
      // Overdraft check: Master cannot spend more than vacation balance
      VacationPolicy.assertExpenseBalance(vacation!, data.amountCentavos);

      // Deduct from vacation balance
      updatedVacation = await VacationRepository.updateVacation(vacationId, {
        $inc: { balanceCentavos: -data.amountCentavos },
        updatedAt: new Date()
      } as any);
    }

    const user = await UserRepository.findById(userId);
    const userName = user?.name || 'Vacation Master';

    const expenseItem = await VacationRepository.createExpenseItem({
      _id: uuidv4(),
      vacationId,
      createdByUserId: userId,
      createdByName: userName,
      title: data.title.trim(),
      amountCentavos: data.amountCentavos,
      category: data.category || null,
      deductionSource: isChipIn ? 'chip_in' : 'pool',
      chipInId: isChipIn ? data.chipInId : null,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes || '',
      createdAt: new Date()
    });

    const description = isChipIn
      ? `[Chip-in: ${targetChipIn.title}] ${data.title.trim()}${data.notes ? ' (' + data.notes.trim() + ')' : ''}`
      : `${data.title.trim()}${data.notes ? ' (' + data.notes.trim() + ')' : ''}`;

    // Append to transparent immutable log
    const log = await VacationRepository.createLogEntry({
      _id: uuidv4(),
      vacationId,
      type: 'expense',
      userId,
      userName,
      amountCentavos: data.amountCentavos,
      description,
      relatedItemId: expenseItem._id,
      date: expenseItem.date,
      createdAt: new Date()
    });

    return {
      success: true,
      expenseItem,
      vacation: updatedVacation!,
      log
    };
  }

  static async logPersonalExpense(
    userId: string,
    vacationId: string,
    data: {
      title: string;
      amountCentavos: number;
      category?: string | null;
      fromAccountId?: string | null;
      date?: string | Date;
      notes?: string;
    }
  ) {
    if (!data.title || !data.title.trim()) {
      throw AppError.badRequest('Expense title is required');
    }
    if (!data.amountCentavos || data.amountCentavos <= 0) {
      throw AppError.badRequest('Expense amount must be greater than zero');
    }

    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);

    const user = await UserRepository.findById(userId);
    const userName = user?.name || 'Member';

    // If funding account is selected, deduct from member's local account
    if (data.fromAccountId) {
      const fundingAccount = await AccountRepository.findById(data.fromAccountId);
      AuthPolicy.assertOwnership(fundingAccount, userId, 'Account');

      // Overdraft check: member cannot spend more than their local account balance
      const currentBalance = await AccountService.calculateAccountBalance(userId, data.fromAccountId);
      if (currentBalance < data.amountCentavos) {
        throw AppError.badRequest(
          `Insufficient funds in account ${fundingAccount.name}. Available: ${currentBalance} centavos, requested: ${data.amountCentavos} centavos.`
        );
      }

      await TransactionRepository.create({
        _id: uuidv4(),
        userId,
        accountId: data.fromAccountId,
        type: 'expense',
        amountCentavos: data.amountCentavos,
        date: data.date ? new Date(data.date) : new Date(),
        notes: `Vacation personal expense: ${vacation!.name} - ${data.title.trim()}${data.notes ? ' (' + data.notes.trim() + ')' : ''}`,
        updatedAt: new Date()
      });

      const newLocalBalance = await AccountService.calculateAccountBalance(userId, data.fromAccountId);
      await AccountRepository.update(fundingAccount._id, {
        currentBalanceCentavos: newLocalBalance,
        updatedAt: new Date()
      });
    }

    // Logged expenses are records only and do NOT change the vacation account balance!
    const loggedExpense = await VacationRepository.createLoggedExpense({
      _id: uuidv4(),
      vacationId,
      userId,
      userName,
      title: data.title.trim(),
      amountCentavos: data.amountCentavos,
      category: data.category || null,
      fromAccountId: data.fromAccountId || undefined,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes || '',
      createdAt: new Date()
    });

    return {
      success: true,
      loggedExpense
    };
  }

  static async createChipIn(
    userId: string,
    vacationId: string,
    data: {
      title: string;
      targetAmountCentavos?: number | null;
      description?: string;
    }
  ) {
    if (!data.title || !data.title.trim()) {
      throw AppError.badRequest('Chip-in title is required');
    }

    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);
    VacationPolicy.assertActive(vacation!);
    VacationPolicy.assertMaster(vacation!, userId);

    const user = await UserRepository.findById(userId);
    const userName = user?.name || 'Vacation Master';

    const chipIn = await VacationRepository.createChipIn({
      _id: uuidv4(),
      vacationId,
      createdByUserId: userId,
      createdByName: userName,
      title: data.title.trim(),
      targetAmountCentavos: data.targetAmountCentavos || null,
      totalCollectedCentavos: 0,
      description: data.description ? data.description.trim() : '',
      status: 'open',
      contributions: [],
      createdAt: new Date()
    });

    return {
      success: true,
      chipIn
    };
  }

  static async contributeChipIn(
    userId: string,
    vacationId: string,
    chipInId: string,
    data: {
      amountCentavos: number;
      fromAccountId: string;
      notes?: string;
    }
  ) {
    if (!data.amountCentavos || data.amountCentavos <= 0) {
      throw AppError.badRequest('Contribution amount must be greater than zero');
    }
    if (!data.fromAccountId) {
      throw AppError.badRequest('Funding account is required');
    }

    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);
    VacationPolicy.assertActive(vacation!);

    const chipIn = await VacationRepository.findChipInById(chipInId);
    if (!chipIn || chipIn.vacationId !== vacationId) {
      throw AppError.notFound('Chip-in item not found');
    }
    if (chipIn.status !== 'open') {
      throw AppError.badRequest('This chip-in item is closed');
    }

    const fundingAccount = await AccountRepository.findById(data.fromAccountId);
    AuthPolicy.assertOwnership(fundingAccount, userId, 'Account');

    // Overdraft check: member cannot chip in more than local account balance
    const currentBalance = await AccountService.calculateAccountBalance(userId, data.fromAccountId);
    if (currentBalance < data.amountCentavos) {
      throw AppError.badRequest(
        `Insufficient funds in account ${fundingAccount.name}. Available: ${currentBalance} centavos, requested: ${data.amountCentavos} centavos.`
      );
    }

    const user = await UserRepository.findById(userId);
    const userName = user?.name || 'Member';

    // Record local expense transaction for member
    const transaction = await TransactionRepository.create({
      _id: uuidv4(),
      userId,
      accountId: data.fromAccountId,
      type: 'expense',
      amountCentavos: data.amountCentavos,
      date: new Date(),
      notes: data.notes || `Chip-in for ${chipIn.title}`,
      updatedAt: new Date()
    });

    const newLocalBalance = await AccountService.calculateAccountBalance(userId, data.fromAccountId);
    await AccountRepository.update(fundingAccount._id, {
      currentBalanceCentavos: newLocalBalance,
      updatedAt: new Date()
    });

    // Add contribution to chipIn
    const updatedChipIn = await VacationRepository.addChipInContribution(
      chipInId,
      {
        _id: uuidv4(),
        chipInId,
        vacationId,
        userId,
        userName,
        amountCentavos: data.amountCentavos,
        fromAccountId: data.fromAccountId,
        date: new Date(),
        notes: data.notes || ''
      },
      data.amountCentavos
    );

    // Chip-in contributions do NOT add to main vacation pool balance

    // Append to transparent immutable log
    const log = await VacationRepository.createLogEntry({
      _id: uuidv4(),
      vacationId,
      type: 'chip_in',
      userId,
      userName,
      amountCentavos: data.amountCentavos,
      description: `Chip-in contribution: ${chipIn.title}${data.notes ? ' (' + data.notes + ')' : ''}`,
      relatedItemId: chipInId,
      date: new Date(),
      createdAt: new Date()
    });

    return {
      success: true,
      chipIn: updatedChipIn!,
      vacation: vacation!,
      log,
      transactionId: transaction._id
    };
  }

  static async refund(
    userId: string,
    vacationId: string,
    data: {
      memberUserId: string;
      amountCentavos: number;
      toAccountId?: string;
      refundSource?: 'pool' | 'chip_in';
      chipInId?: string | null;
      notes?: string;
    }
  ) {
    if (!data.amountCentavos || data.amountCentavos <= 0) {
      throw AppError.badRequest('Refund amount must be greater than zero');
    }
    if (!data.memberUserId) {
      throw AppError.badRequest('Recipient member is required');
    }

    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);
    VacationPolicy.assertActive(vacation!);
    VacationPolicy.assertMaster(vacation!, userId);

    let chipIn: any = null;
    if (data.refundSource === 'chip_in') {
      if (!data.chipInId) {
        throw AppError.badRequest('Chip-in item is required when refunding from a chip-in item');
      }
      chipIn = await VacationRepository.findChipInById(data.chipInId);
      if (!chipIn || chipIn.vacationId !== vacationId) {
        throw AppError.notFound('Chip-in item not found');
      }
      VacationPolicy.assertChipInRefundBalance(chipIn, data.amountCentavos);
    } else {
      // Overdraft check: Refunds cannot exceed remaining vacation pool balance
      VacationPolicy.assertRefundBalance(vacation!, data.amountCentavos);
    }

    const recipientMember = vacation!.members.find((m) => m.userId === data.memberUserId);
    if (!recipientMember) {
      throw AppError.badRequest('Recipient is not a member of this vacation');
    }

    // Determine target local account for the recipient
    let targetAccount: any;
    if (data.toAccountId) {
      targetAccount = await AccountRepository.findById(data.toAccountId);
      AuthPolicy.assertOwnership(targetAccount, data.memberUserId, 'Account');
    } else {
      const accounts = await AccountRepository.findByUserId(data.memberUserId);
      targetAccount =
        accounts.find((a) => a.type === 'cash' || a.name.toLowerCase() === 'cash') || accounts[0];
      if (!targetAccount) {
        throw AppError.badRequest('Recipient member has no active account to receive the refund');
      }
    }

    // Record local income transaction in recipient's account
    const transaction = await TransactionRepository.create({
      _id: uuidv4(),
      userId: data.memberUserId,
      accountId: targetAccount._id,
      type: 'income',
      amountCentavos: data.amountCentavos,
      date: new Date(),
      notes:
        data.notes ||
        (data.refundSource === 'chip_in' && chipIn
          ? `Chip-in refund (${chipIn.title}): ${vacation!.name}`
          : `Vacation refund: ${vacation!.name}`),
      updatedAt: new Date()
    });

    const newLocalBalance = await AccountService.calculateAccountBalance(
      data.memberUserId,
      targetAccount._id
    );
    await AccountRepository.update(targetAccount._id, {
      currentBalanceCentavos: newLocalBalance,
      updatedAt: new Date()
    });

    let updatedVacation: IVacation | null = vacation;
    if (data.refundSource === 'chip_in' && data.chipInId) {
      chipIn = await VacationRepository.updateChipIn(data.chipInId, {
        $inc: { totalRefundedCentavos: data.amountCentavos }
      });
    } else {
      // Deduct refunded amount from vacation pool
      updatedVacation = await VacationRepository.updateVacation(vacationId, {
        $inc: { balanceCentavos: -data.amountCentavos },
        updatedAt: new Date()
      } as any);
    }

    const refundDesc =
      data.refundSource === 'chip_in' && chipIn
        ? `Refund to ${recipientMember.name} from chip-in "${chipIn.title}"${data.notes ? ' (' + data.notes + ')' : ''}`
        : `Refund to ${recipientMember.name}${data.notes ? ' (' + data.notes + ')' : ''}`;

    // Append to transparent immutable log
    const log = await VacationRepository.createLogEntry({
      _id: uuidv4(),
      vacationId,
      type: 'refund',
      userId: data.memberUserId,
      userName: recipientMember.name,
      amountCentavos: data.amountCentavos,
      description: refundDesc,
      relatedItemId: data.refundSource === 'chip_in' ? data.chipInId : null,
      date: new Date(),
      createdAt: new Date()
    });

    return {
      success: true,
      vacation: updatedVacation!,
      chipIn,
      log,
      transactionId: transaction._id
    };
  }

  static async reverseLog(
    userId: string,
    vacationId: string,
    data: {
      originalLogId: string;
      reason: string;
    }
  ) {
    if (!data.originalLogId) {
      throw AppError.badRequest('Original log ID is required');
    }
    if (!data.reason || !data.reason.trim()) {
      throw AppError.badRequest('Reason for reversal is required');
    }

    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);
    VacationPolicy.assertActive(vacation!);
    VacationPolicy.assertMaster(vacation!, userId);

    const originalLog = await VacationRepository.findLogById(data.originalLogId);
    if (!originalLog || originalLog.vacationId !== vacationId) {
      throw AppError.notFound('Transaction log entry not found');
    }

    if (originalLog.type === 'reversal' || originalLog.type === 'concluded') {
      throw AppError.badRequest('Cannot reverse this type of log entry');
    }

    // Check if this log has already been reversed
    const logs = await VacationRepository.findLogs(vacationId);
    const alreadyReversed = logs.some(
      (l) => l.type === 'reversal' && l.relatedItemId === originalLog._id
    );
    if (alreadyReversed) {
      throw AppError.badRequest('This log entry has already been reversed');
    }

    let updatedVacation: IVacation | null = vacation;

    // Apply reversing effect on vacation balance or chip-in item
    if (originalLog.type === 'expense') {
      const expenseItem = originalLog.relatedItemId
        ? await VacationRepository.findExpenseItemById(originalLog.relatedItemId)
        : null;

      if (expenseItem?.deductionSource === 'chip_in' && expenseItem.chipInId) {
        // Reversing an expense from chip-in restores money to the chip-in item
        await VacationRepository.updateChipIn(expenseItem.chipInId, {
          $inc: { totalSpentCentavos: -originalLog.amountCentavos }
        });
      } else {
        // Reversing an expense gives money back to the vacation pool
        updatedVacation = await VacationRepository.updateVacation(vacationId, {
          $inc: { balanceCentavos: originalLog.amountCentavos },
          updatedAt: new Date()
        } as any);
      }
    } else if (originalLog.type === 'deposit') {
      // Reversing a deposit removes money from the pool (if balance permits) and refunds user
      if (vacation!.balanceCentavos < originalLog.amountCentavos) {
        throw AppError.badRequest(
          'Insufficient vacation balance to reverse this deposit. Please adjust expenses or chip-ins first.'
        );
      }
      updatedVacation = await VacationRepository.updateVacation(vacationId, {
        $inc: { balanceCentavos: -originalLog.amountCentavos },
        updatedAt: new Date()
      } as any);

      // Refund the member
      const memberAccounts = await AccountRepository.findByUserId(originalLog.userId);
      const acc = memberAccounts.find((a) => a.type === 'cash') || memberAccounts[0];
      if (acc) {
        await TransactionRepository.create({
          _id: uuidv4(),
          userId: originalLog.userId,
          accountId: acc._id,
          type: 'income',
          amountCentavos: originalLog.amountCentavos,
          date: new Date(),
          notes: `Reversal of vacation deposit: ${vacation!.name}`,
          updatedAt: new Date()
        });
        const newBal = await AccountService.calculateAccountBalance(originalLog.userId, acc._id);
        await AccountRepository.update(acc._id, { currentBalanceCentavos: newBal, updatedAt: new Date() });
      }
    } else if (originalLog.type === 'refund') {
      // Reversing a refund returns money to the chip-in or pool
      if (originalLog.relatedItemId) {
        const chipIn = await VacationRepository.findChipInById(originalLog.relatedItemId);
        if (chipIn) {
          await VacationRepository.updateChipIn(originalLog.relatedItemId, {
            $inc: { totalRefundedCentavos: -originalLog.amountCentavos }
          });
        } else {
          updatedVacation = await VacationRepository.updateVacation(vacationId, {
            $inc: { balanceCentavos: originalLog.amountCentavos },
            updatedAt: new Date()
          } as any);
        }
      } else {
        updatedVacation = await VacationRepository.updateVacation(vacationId, {
          $inc: { balanceCentavos: originalLog.amountCentavos },
          updatedAt: new Date()
        } as any);
      }

      // Reverse recipient member's local income transaction
      const memberAccounts = await AccountRepository.findByUserId(originalLog.userId);
      const acc = memberAccounts.find((a) => a.type === 'cash') || memberAccounts[0];
      if (acc) {
        await TransactionRepository.create({
          _id: uuidv4(),
          userId: originalLog.userId,
          accountId: acc._id,
          type: 'expense',
          amountCentavos: originalLog.amountCentavos,
          date: new Date(),
          notes: `Reversal of vacation refund: ${vacation!.name}`,
          updatedAt: new Date()
        });
        const newBal = await AccountService.calculateAccountBalance(originalLog.userId, acc._id);
        await AccountRepository.update(acc._id, { currentBalanceCentavos: newBal, updatedAt: new Date() });
      }
    }

    const user = await UserRepository.findById(userId);
    const masterName = user?.name || 'Vacation Master';

    // Append new reversing entry to immutable log
    const reversingLog = await VacationRepository.createLogEntry({
      _id: uuidv4(),
      vacationId,
      type: 'reversal',
      userId,
      userName: masterName,
      amountCentavos: originalLog.amountCentavos,
      description: `Reversal of ${originalLog.type} (${originalLog.description}). Reason: ${data.reason.trim()}`,
      relatedItemId: originalLog._id,
      date: new Date(),
      createdAt: new Date()
    });

    return {
      success: true,
      vacation: updatedVacation!,
      reversingLog
    };
  }

  static async concludeVacation(userId: string, vacationId: string) {
    const vacation = await VacationRepository.findVacationById(vacationId);
    VacationPolicy.assertMemberAccess(vacation, userId);
    VacationPolicy.assertActive(vacation!);
    VacationPolicy.assertMaster(vacation!, userId);

    // Rule: Concluding is blocked until the balance and all chip-ins are exactly zero!
    const chipIns = await VacationRepository.findChipIns(vacationId);
    VacationPolicy.assertZeroBalanceForConclusion(vacation!, chipIns);

    const user = await UserRepository.findById(userId);
    const masterName = user?.name || 'Vacation Master';

    const concluded = await VacationRepository.updateVacation(vacationId, {
      status: 'concluded',
      concludedAt: new Date(),
      updatedAt: new Date()
    });

    const log = await VacationRepository.createLogEntry({
      _id: uuidv4(),
      vacationId,
      type: 'concluded',
      userId,
      userName: masterName,
      amountCentavos: 0,
      description: `Vacation concluded by ${masterName}. Vacation is now archived and read-only.`,
      date: new Date(),
      createdAt: new Date()
    });

    return {
      success: true,
      vacation: concluded!,
      log
    };
  }
}
