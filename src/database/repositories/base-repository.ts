/**
 * Base repository interface and common types for all repositories
 */

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface QueryOptions {
  include?: Record<string, boolean>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  where?: Record<string, any>;
}

export interface FindManyOptions extends QueryOptions, PaginationOptions {}

export interface FindManyResult<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

/**
 * Base repository interface that all resource repositories implement
 */
export interface BaseRepository<T, TCreateInput, TUpdateInput, TKey = string | number> {
  // Core CRUD operations
  create(data: TCreateInput): Promise<T>;
  findById(id: TKey, options?: QueryOptions): Promise<T | null>;
  findMany(options?: FindManyOptions): Promise<FindManyResult<T>>;
  update(id: TKey, data: TUpdateInput): Promise<T>;
  delete(id: TKey): Promise<void>;

  // Bulk operations
  createMany(data: TCreateInput[]): Promise<T[]>;
  updateMany(where: Record<string, any>, data: Partial<TUpdateInput>): Promise<number>;
  deleteMany(where: Record<string, any>): Promise<number>;

  // Utility operations
  count(where?: Record<string, any>): Promise<number>;
  exists(id: TKey): Promise<boolean>;

  // Health and maintenance
  health(): Promise<{ status: string; timestamp: Date }>;
}

/**
 * Repository error types
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string | number) {
    super(`${resource} with ID ${id} not found`, 'NOT_FOUND');
  }
}

export class ValidationError extends RepositoryError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

/**
 * Data validation utilities
 */
export interface ValidationRule<T> {
  validate(value: T): Promise<string | null> | string | null;
}

export class Validator<T> {
  private rules: ValidationRule<T>[] = [];

  addRule(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  async validate(value: T): Promise<void> {
    for (const rule of this.rules) {
      const error = await rule.validate(value);
      if (error) {
        throw new ValidationError(error);
      }
    }
  }
}

/**
 * Common validation rules
 */
export const CommonValidators = {
  required: <T>(field: string): ValidationRule<T> => ({
    validate: (value: T) => {
      const obj = value as any;
      if (obj[field] === null || obj[field] === undefined || obj[field] === '') {
        return `${field} is required`;
      }
      return null;
    }
  }),

  minLength: <T>(field: string, min: number): ValidationRule<T> => ({
    validate: (value: T) => {
      const obj = value as any;
      if (obj[field] && obj[field].length < min) {
        return `${field} must be at least ${min} characters`;
      }
      return null;
    }
  }),

  maxLength: <T>(field: string, max: number): ValidationRule<T> => ({
    validate: (value: T) => {
      const obj = value as any;
      if (obj[field] && obj[field].length > max) {
        return `${field} must be no more than ${max} characters`;
      }
      return null;
    }
  }),

  range: <T>(field: string, min: number, max: number): ValidationRule<T> => ({
    validate: (value: T) => {
      const obj = value as any;
      if (obj[field] !== null && obj[field] !== undefined && (obj[field] < min || obj[field] > max)) {
        return `${field} must be between ${min} and ${max}`;
      }
      return null;
    }
  }),

  oneOf: <T>(field: string, values: any[]): ValidationRule<T> => ({
    validate: (value: T) => {
      const obj = value as any;
      if (obj[field] !== null && obj[field] !== undefined && !values.includes(obj[field])) {
        return `${field} must be one of: ${values.join(', ')}`;
      }
      return null;
    }
  })
};