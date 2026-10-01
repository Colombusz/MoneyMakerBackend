import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { TransactionService } from '../services/transactionService';
import { HTTP_STATUS } from '../constants';

export const getTransactions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId, categoryId, type, startDate, endDate, limit, skip } = req.query;
    const transactions = await TransactionService.listTransactions(req.userId!, {
      accountId: accountId as string,
      categoryId: categoryId as string,
      type: type as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      skip: skip ? parseInt(skip as string, 10) : undefined
    });
    res.status(HTTP_STATUS.OK).json({ transactions });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const transaction = await TransactionService.getTransactionById(
      req.userId!,
      req.params.id as string
    );
    res.status(HTTP_STATUS.OK).json({ transaction });
  } catch (error) {
    next(error);
  }
};

export const createTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const transaction = await TransactionService.createTransaction(req.userId!, req.body);
    res.status(HTTP_STATUS.CREATED).json({ transaction });
  } catch (error) {
    next(error);
  }
};

export const updateTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const transaction = await TransactionService.updateTransaction(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.OK).json({ transaction });
  } catch (error) {
    next(error);
  }
};

export const deleteTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await TransactionService.deleteTransaction(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMonthSummary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year as string, 10);
    const m = parseInt(month as string, 10);
    const summary = await TransactionService.getMonthSummary(req.userId!, y, m);
    res.status(HTTP_STATUS.OK).json(summary);
  } catch (error) {
    next(error);
  }
};
