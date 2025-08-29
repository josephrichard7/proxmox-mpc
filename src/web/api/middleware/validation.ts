/**
 * Validation Middleware
 * 
 * Request validation using Zod schemas for the Proxmox-MPC web API.
 * Provides type-safe request validation with comprehensive error handling.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, z } from 'zod';
import { logger } from '../../../observability/logger';
import { ValidationError } from './error';

/**
 * Validation target types
 */
export type ValidationTarget = 'body' | 'query' | 'params' | 'headers';

/**
 * Validation options
 */
export interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  allowUnknown?: boolean;
}

/**
 * Validation schemas for common patterns
 */
export const commonSchemas = {
  // MongoDB-style ID
  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid object ID format'),
  
  // UUID v4
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Pagination parameters
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('asc')
  }),
  
  // Common VM/Container parameters
  vmId: z.union([
    z.string().regex(/^\d+$/, 'VM ID must be numeric'),
    z.number().int().positive('VM ID must be a positive integer')
  ]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val),
  
  containerId: z.union([
    z.string().regex(/^\d+$/, 'Container ID must be numeric'),
    z.number().int().positive('Container ID must be a positive integer')
  ]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val),
  
  // Node name validation
  nodeName: z.string().min(1).max(63).regex(
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
    'Invalid node name format'
  ),
  
  // Memory size (in MB)
  memory: z.union([
    z.string().regex(/^\d+$/).transform(Number),
    z.number()
  ]).refine(val => val >= 64 && val <= 1048576, {
    message: 'Memory must be between 64MB and 1TB'
  }),
  
  // CPU cores
  cores: z.union([
    z.string().regex(/^\d+$/).transform(Number),
    z.number()
  ]).refine(val => val >= 1 && val <= 128, {
    message: 'CPU cores must be between 1 and 128'
  }),
  
  // Disk size (in GB)
  disk: z.union([
    z.string().regex(/^\d+$/).transform(Number),
    z.number()
  ]).refine(val => val >= 1 && val <= 32768, {
    message: 'Disk size must be between 1GB and 32TB'
  }),
  
  // IP address (IPv4)
  ipv4: z.string().regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    'Invalid IPv4 address'
  ),
  
  // CIDR notation
  cidr: z.string().regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:3[0-2]|[12]?[0-9])$/,
    'Invalid CIDR notation'
  )
};

/**
 * Create validation middleware for specific schema and target
 */
export const validate = (
  schema: ZodSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req[target];
      
      // Parse and validate data
      const validatedData = await schema.parseAsync(data);
      
      // Replace request data with validated (and potentially transformed) data
      (req as any)[target] = validatedData;
      
      logger.debug('Request validation successful', {
        target,
        path: req.path,
        method: req.method,
        dataKeys: Object.keys(validatedData || {})
      });
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationDetails = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
          received: issue.received
        }));
        
        logger.warn('Request validation failed', {
          target,
          path: req.path,
          method: req.method,
          errors: validationDetails,
          errorCount: error.issues.length
        });
        
        next(error);
      } else {
        logger.error('Validation middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          target,
          path: req.path,
          method: req.method
        });
        
        next(new ValidationError('Validation processing error'));
      }
    }
  };
};

/**
 * Validate request body
 */
export const validateBody = (schema: ZodSchema, options?: ValidationOptions) => {
  return validate(schema, 'body', options);
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema: ZodSchema, options?: ValidationOptions) => {
  return validate(schema, 'query', options);
};

/**
 * Validate URL parameters
 */
export const validateParams = (schema: ZodSchema, options?: ValidationOptions) => {
  return validate(schema, 'params', options);
};

/**
 * Validate request headers
 */
export const validateHeaders = (schema: ZodSchema, options?: ValidationOptions) => {
  return validate(schema, 'headers', options);
};

/**
 * Combined validation for multiple targets
 */
export const validateRequest = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate each target that has a schema
      for (const [target, schema] of Object.entries(schemas)) {
        if (schema) {
          const data = (req as any)[target];
          const validatedData = await schema.parseAsync(data);
          (req as any)[target] = validatedData;
        }
      }
      
      logger.debug('Multi-target request validation successful', {
        targets: Object.keys(schemas),
        path: req.path,
        method: req.method
      });
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Multi-target request validation failed', {
          path: req.path,
          method: req.method,
          errors: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code
          }))
        });
      }
      
      next(error);
    }
  };
};

/**
 * Pre-built validation schemas for common API operations
 */
export const validationSchemas = {
  // VM operations
  createVM: z.object({
    name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9]([a-zA-Z0-9-_.])*$/, 'Invalid VM name'),
    node: commonSchemas.nodeName,
    memory: commonSchemas.memory,
    cores: commonSchemas.cores,
    disk: commonSchemas.disk,
    template: z.string().optional(),
    description: z.string().max(500).optional(),
    tags: z.array(z.string()).optional(),
    startOnBoot: z.boolean().optional().default(false),
    protection: z.boolean().optional().default(false)
  }),
  
  updateVM: z.object({
    name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9]([a-zA-Z0-9-_.])*$/).optional(),
    memory: commonSchemas.memory.optional(),
    cores: commonSchemas.cores.optional(),
    description: z.string().max(500).optional(),
    tags: z.array(z.string()).optional(),
    startOnBoot: z.boolean().optional(),
    protection: z.boolean().optional()
  }),
  
  vmParams: z.object({
    id: commonSchemas.vmId
  }),
  
  // Container operations
  createContainer: z.object({
    name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9]([a-zA-Z0-9-_.])*$/, 'Invalid container name'),
    node: commonSchemas.nodeName,
    memory: commonSchemas.memory,
    cores: commonSchemas.cores,
    disk: commonSchemas.disk,
    template: z.string().min(1, 'Template is required'),
    description: z.string().max(500).optional(),
    tags: z.array(z.string()).optional(),
    unprivileged: z.boolean().optional().default(true),
    startOnBoot: z.boolean().optional().default(false),
    protection: z.boolean().optional().default(false)
  }),
  
  containerParams: z.object({
    id: commonSchemas.containerId
  }),
  
  // Authentication
  login: z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(1),
    proxmoxServer: z.string().url().optional(),
    rememberMe: z.boolean().optional().default(false)
  }),
  
  register: z.object({
    username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    email: z.string().email().optional(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
    proxmoxServer: z.string().url().optional()
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  }),
  
  // Pagination and filtering
  listQuery: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(val => val <= 100, 'Limit cannot exceed 100').optional().default(10),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
    search: z.string().optional(),
    status: z.enum(['running', 'stopped', 'paused']).optional(),
    node: commonSchemas.nodeName.optional(),
    tags: z.string().optional() // Comma-separated tags
  }),
  
  // Node parameters
  nodeParams: z.object({
    name: commonSchemas.nodeName
  })
};

export default validate;