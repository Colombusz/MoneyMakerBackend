import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { SyncService } from '../services/syncService';
import { HTTP_STATUS } from '../constants';
import { SyncPushRequest } from '../types';

export const syncPush = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { changes } = req.body as SyncPushRequest;
    const result = await SyncService.pushChanges(req.userId!, changes);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const syncPull = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { since } = req.query;
    const result = await SyncService.pullChanges(req.userId!, since as string);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};
