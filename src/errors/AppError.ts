import { HTTP_STATUS } from '../constants';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = HTTP_STATUS.BAD_REQUEST, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, details);
  }

  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED);
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, HTTP_STATUS.FORBIDDEN);
  }

  static notFound(message: string = 'Resource not found'): AppError {
    return new AppError(message, HTTP_STATUS.NOT_FOUND);
  }

  static conflict(message: string): AppError {
    return new AppError(message, HTTP_STATUS.CONFLICT);
  }

  static internal(message: string = 'Internal server error'): AppError {
    const error = new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    (error as any).isOperational = false;
    return error;
  }
}
