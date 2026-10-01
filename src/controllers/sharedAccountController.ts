import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { SharedAccountService } from '../services/sharedAccountService';
import { HTTP_STATUS } from '../constants';

export const getSharedAccounts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const accounts = await SharedAccountService.listSharedAccounts(req.userId!);
    res.status(HTTP_STATUS.OK).json({ sharedAccounts: accounts });
  } catch (error) {
    next(error);
  }
};

export const getSharedAccountById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const account = await SharedAccountService.getSharedAccountById(
      req.userId!,
      req.params.id as string
    );
    res.status(HTTP_STATUS.OK).json({ sharedAccount: account });
  } catch (error) {
    next(error);
  }
};

export const createSharedAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const account = await SharedAccountService.createSharedAccount(req.userId!, req.body);
    res.status(HTTP_STATUS.CREATED).json({ sharedAccount: account });
  } catch (error) {
    next(error);
  }
};

export const depositToSharedAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Normalise the funding-account alias: web sends `fundingAccountId`,
    // Android sends both, backend schema accepts either.
    const body = {
      ...req.body,
      fromAccountId: req.body?.fromAccountId ?? req.body?.fundingAccountId
    };
    const result = await SharedAccountService.deposit(
      req.userId!,
      req.params.id as string,
      body
    );
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const recordSharedAccountExpense = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await SharedAccountService.recordExpense(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};
