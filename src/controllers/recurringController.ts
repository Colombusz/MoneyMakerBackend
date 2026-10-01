import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { RecurringService } from '../services/recurringService';
import { HTTP_STATUS } from '../constants';

export const getRecurringRules = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rules = await RecurringService.listRules(req.userId!);
    res.status(HTTP_STATUS.OK).json({ rules });
  } catch (error) {
    next(error);
  }
};

export const getRecurringRuleById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rule = await RecurringService.getRuleById(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json({ rule });
  } catch (error) {
    next(error);
  }
};

export const createRecurringRule = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rule = await RecurringService.createRule(req.userId!, req.body);
    res.status(HTTP_STATUS.CREATED).json({ rule });
  } catch (error) {
    next(error);
  }
};

export const updateRecurringRule = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rule = await RecurringService.updateRule(req.userId!, req.params.id as string, req.body);
    res.status(HTTP_STATUS.OK).json({ rule });
  } catch (error) {
    next(error);
  }
};

export const deleteRecurringRule = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await RecurringService.deleteRule(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json({ message: 'Recurring rule deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getOccurrences = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const start = (req.query.start || req.query.startDate) as string;
    const end = (req.query.end || req.query.endDate) as string;
    const occurrences = await RecurringService.getOccurrences(req.userId!, start, end);
    res.status(HTTP_STATUS.OK).json({ occurrences });
  } catch (error) {
    next(error);
  }
};

export const payOccurrence = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ruleId = req.params.id || (req.params as any).ruleId || req.body.ruleId;
    const { occurrenceDate, accountId, amountCentavos, overrideAmountCentavos, notes } = req.body;
    const finalAmount =
      overrideAmountCentavos !== undefined ? overrideAmountCentavos : amountCentavos;
    const result = await RecurringService.payOccurrence(
      req.userId!,
      ruleId,
      occurrenceDate,
      accountId,
      finalAmount,
      notes
    );
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const skipOccurrence = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ruleId = req.params.id || (req.params as any).ruleId || req.body.ruleId;
    const { occurrenceDate } = req.body;
    const result = await RecurringService.skipOccurrence(req.userId!, ruleId, occurrenceDate);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};
