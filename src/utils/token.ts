import jwt from 'jsonwebtoken';
import { uuidv4 } from './uuid';
import { TOKEN_EXPIRY } from '../constants';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_key_12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_key_67890';

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_ACCESS_SECRET, { expiresIn: TOKEN_EXPIRY.ACCESS_TOKEN });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId, jti: uuidv4() }, JWT_REFRESH_SECRET, {
    expiresIn: `${TOKEN_EXPIRY.REFRESH_TOKEN_DAYS}d`
  });
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
};
