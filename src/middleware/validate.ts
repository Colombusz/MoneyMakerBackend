import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { HTTP_STATUS } from '../constants';

export interface RequestValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validateRequest = (schemas: RequestValidationSchemas) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        try {
          Object.defineProperty(req, 'query', {
            value: parsedQuery,
            writable: true,
            configurable: true
          });
        } catch (_e) {
          Object.assign(req.query, parsedQuery);
        }
      }
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        try {
          Object.defineProperty(req, 'params', {
            value: parsedParams,
            writable: true,
            configurable: true
          });
        } catch (_e) {
          Object.assign(req.params, parsedParams);
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: issues || 'Invalid request payload',
          details: error.issues
        });
        return;
      }
      next(error);
    }
  };
};
