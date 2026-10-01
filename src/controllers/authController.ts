import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/auth';
import { HTTP_STATUS } from '../constants';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await AuthService.register(req.body);
    res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await AuthService.login(req.body);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    const result = await AuthService.refresh(token);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    const result = await AuthService.logout(token);
    res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await AuthService.getCurrentUser(req.userId!);
    res.status(HTTP_STATUS.OK).json({ user });
  } catch (error) {
    next(error);
  }
};
