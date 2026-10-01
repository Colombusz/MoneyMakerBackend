import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { GoalService } from '../services/goalService';
import { HTTP_STATUS } from '../constants';

export const getGoals = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const goals = await GoalService.listGoals(req.userId!);
    res.status(HTTP_STATUS.OK).json({ goals });
  } catch (error) {
    next(error);
  }
};

export const getGoalById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const goal = await GoalService.getGoalById(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json({ goal });
  } catch (error) {
    next(error);
  }
};

export const createGoal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const goal = await GoalService.createGoal(req.userId!, req.body);
    res.status(HTTP_STATUS.CREATED).json({ goal });
  } catch (error) {
    next(error);
  }
};

export const updateGoal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const goal = await GoalService.updateGoal(req.userId!, req.params.id as string, req.body);
    res.status(HTTP_STATUS.OK).json({ goal });
  } catch (error) {
    next(error);
  }
};

export const deleteGoal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await GoalService.deleteGoal(req.userId!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json({ message: 'Goal deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const contributeToGoal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await GoalService.contributeToGoal(
      req.userId!,
      req.params.id as string,
      req.body
    );
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};
