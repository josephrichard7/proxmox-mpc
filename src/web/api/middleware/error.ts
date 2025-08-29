/**
 * Error Handling Middleware
 * 
 * Centralized error handling for the Proxmox-MPC web API.
 * Provides consistent error responses and comprehensive logging.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../../observability/logger';

/**
 * Standard API error interface
 */
export interface APIError {
  error: string;
  message: string;
  code: string;
  details?: any;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
}

/**
 * Custom application error class
 */
export class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    
    this.name = 'ApplicationError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error class for request validation failures
 */
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends ApplicationError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    super(message, 404, 'RESOURCE_NOT_FOUND', { resource, identifier });
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, 409, 'RESOURCE_CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends ApplicationError {
  constructor(message: string = 'Insufficient privileges') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Proxmox API error class
 */
export class ProxmoxAPIError extends ApplicationError {
  constructor(message: string, statusCode: number = 502, details?: any) {
    super(message, statusCode, 'PROXMOX_API_ERROR', details);
    this.name = 'ProxmoxAPIError';
  }
}

/**
 * Generate unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format error response
 */
function formatErrorResponse(
  error: Error,
  req: Request,
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR'
): APIError {
  return {
    error: error.name || 'Error',
    message: error.message,
    code,
    details: (error as ApplicationError).details,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    requestId: generateRequestId()
  };
}

/**
 * Handle Zod validation errors
 */
function handleZodError(error: ZodError): {
  statusCode: number;
  code: string;
  message: string;
  details: any;
} {
  const details = error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
    received: issue.received
  }));

  return {
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: {
      validationErrors: details,
      errorCount: error.issues.length
    }
  };
}

/**
 * Main error handling middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let details = undefined;

  // Handle different error types
  if (error instanceof ApplicationError) {
    statusCode = error.statusCode;
    code = error.code;
    details = error.details;
  } else if (error instanceof ZodError) {
    const zodErrorInfo = handleZodError(error);
    statusCode = zodErrorInfo.statusCode;
    code = zodErrorInfo.code;
    details = zodErrorInfo.details;
    error.message = zodErrorInfo.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID_FORMAT';
    error.message = 'Invalid resource ID format';
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    error.message = 'Resource already exists';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    error.message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    error.message = 'Authentication token has expired';
  }

  // Log error with appropriate level
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code,
      statusCode
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type'),
        'origin': req.get('Origin')
      },
      ip: req.ip
    },
    user: (req as any).user ? {
      id: (req as any).user.id,
      username: (req as any).user.username,
      role: (req as any).user.role
    } : undefined
  };

  logger[logLevel]('API error occurred', logData);

  // Format and send error response
  const errorResponse = formatErrorResponse(error, req, statusCode, code);
  
  // Remove sensitive information in production
  if (process.env.NODE_ENV === 'production') {
    if (statusCode >= 500) {
      errorResponse.message = 'Internal server error';
      delete errorResponse.details;
    }
    // Don't expose stack traces in production
    delete (error as any).stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler for unmatched routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError('Route', req.path);
  next(error);
};

/**
 * Async error wrapper for handling async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Global unhandled error handlers
 */
export const setupGlobalErrorHandlers = (): void => {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.toString(),
      stack: reason?.stack,
      promise: promise.toString()
    });
    
    // Graceful shutdown in production
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

export default errorHandler;