import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { HTTP_STATUS } from '../constants';

export const errorHandler = (
  err: Error | AppError | ZodError | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {})
    });
    return;
  }

  if (err instanceof ZodError) {
    const issueMessages = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: `Validation error: ${issueMessages}`,
      details: err.issues
    });
    return;
  }

  console.error('Unhandled server error:', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    error: 'Internal server error'
  });
};
