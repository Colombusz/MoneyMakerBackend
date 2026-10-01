import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { PartnerService } from '../services/partnerService';
import { HTTP_STATUS } from '../constants';

export const generateInvite = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await PartnerService.generateInvite(req.userId!);
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const acceptInvite = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { inviteCode } = req.body;
    const result = await PartnerService.acceptInvite(req.userId!, inviteCode);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const unlinkPartner = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await PartnerService.unlinkPartner(req.userId!);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const getPartnerStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await PartnerService.getPartnerStatus(req.userId!);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

// Re-export shared goal handlers from sharedGoalController for backwards compatibility
export {
  getSharedGoals,
  getSharedGoalById,
  createSharedGoal,
  contributeToSharedGoal,
  leaveSharedGoal
} from './sharedGoalController';
