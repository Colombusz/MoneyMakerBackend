import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { SharedGoalService } from '../services/sharedGoalService';
import { HTTP_STATUS } from '../constants';

export const getSharedGoals = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const goals = await SharedGoalService.listSharedGoals(req.userId!);
    res.status(HTTP_STATUS.OK).json({ sharedGoals: goals, goals });
  } catch (error) {
    next(error);
  }
};

export const getSharedGoalById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const goal = await SharedGoalService.getSharedGoalById(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json({ sharedGoal: goal, goal });
  } catch (error) {
    next(error);
  }
};

export const createSharedGoal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const goal = await SharedGoalService.createSharedGoal(req.userId!, req.body);
    res.status(HTTP_STATUS.CREATED).json({ sharedGoal: goal, goal });
  } catch (error) {
    next(error);
  }
};

export const contributeToSharedGoal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await SharedGoalService.contributeToSharedGoal(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const leaveSharedGoal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await SharedGoalService.leaveSharedGoal(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};
