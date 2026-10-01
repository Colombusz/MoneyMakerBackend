import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token';
import { authLimiter } from './rateLimiter';

export { generateAccessToken, generateRefreshToken, verifyRefreshToken, authLimiter };

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_key_12345';

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
};
