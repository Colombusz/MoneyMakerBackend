import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AccountService } from '../services/accountService';
import { HTTP_STATUS } from '../constants';

export const calculateAccountBalance = async (
  accountId: string,
  startingBalanceCentavos?: number
): Promise<number> => {
  try {
    const { Account } = await import('../models/Account');
    const acc = await Account.findById(accountId);
    if (!acc) return startingBalanceCentavos || 0;
    return AccountService.calculateAccountBalance(acc.userId, accountId);
  } catch (_e) {
    return startingBalanceCentavos || 0;
  }
};

export const getAccounts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await AccountService.listAccounts(req.userId!);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAccountById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const account = await AccountService.getAccountById(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json({ account });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const account = await AccountService.createAccount(req.userId!, req.body);
    res.status(HTTP_STATUS.CREATED).json({ account });
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const account = await AccountService.updateAccount(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.OK).json({ account });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await AccountService.deleteAccount(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json({ success: true, message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
};

export const transferBetweenAccounts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tx = await AccountService.transfer(req.userId!, req.body);
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      transaction: {
        id: tx._id,
        userId: tx.userId,
        accountId: tx.accountId,
        destinationAccountId: tx.destinationAccountId,
        type: tx.type,
        amountCentavos: tx.amountCentavos,
        date: tx.date,
        notes: tx.notes,
        updatedAt: tx.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};
