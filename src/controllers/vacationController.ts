import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { VacationService } from '../services/vacationService';
import { HTTP_STATUS } from '../constants';

export const createVacation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vacation = await VacationService.createVacation(req.userId!, req.body);
    res.status(HTTP_STATUS.CREATED).json({ vacation });
  } catch (error) {
    next(error);
  }
};

export const joinVacation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vacation = await VacationService.joinVacation(req.userId!, req.body.joinCode);
    res.status(HTTP_STATUS.OK).json({ vacation });
  } catch (error) {
    next(error);
  }
};

export const getActiveVacations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vacations = await VacationService.getActiveVacations(req.userId!);
    res.status(HTTP_STATUS.OK).json({ vacations });
  } catch (error) {
    next(error);
  }
};

export const getPastVacations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vacations = await VacationService.getPastVacations(req.userId!);
    res.status(HTTP_STATUS.OK).json({ vacations });
  } catch (error) {
    next(error);
  }
};

export const getVacationById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await VacationService.getVacationById(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(data);
  } catch (error) {
    next(error);
  }
};

export const getPastVacationSummary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summary = await VacationService.getPastVacationSummary(
      req.userId!,
      req.params.id as string
    );
    res.status(HTTP_STATUS.OK).json(summary);
  } catch (error) {
    next(error);
  }
};

export const depositToVacation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = {
      ...req.body,
      fromAccountId: req.body?.fromAccountId ?? req.body?.fundingAccountId
    };
    const result = await VacationService.deposit(req.userId!, req.params.id as string, body);
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const createExpenseItem = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await VacationService.createExpenseItem(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const logPersonalExpense = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await VacationService.logPersonalExpense(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const createChipIn = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await VacationService.createChipIn(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const contributeChipIn = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = {
      ...req.body,
      fromAccountId: req.body?.fromAccountId ?? req.body?.fundingAccountId
    };
    const result = await VacationService.contributeChipIn(
      req.userId!,
      req.params.id as string,
      req.params.chipInId as string,
      body
    );
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const refundVacation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await VacationService.refund(req.userId!, req.params.id as string, req.body);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const reverseLog = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await VacationService.reverseLog(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const concludeVacation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await VacationService.concludeVacation(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};
