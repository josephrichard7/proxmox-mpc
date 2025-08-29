/**
 * Authentication Middleware
 * 
 * JWT-based authentication for the Proxmox-MPC web API.
 * Provides secure token validation and user context management.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from '../../../observability/logger';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'proxmox-mpc-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * User interface for JWT payload
 */
export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  role: 'admin' | 'user';
  proxmoxServer?: string;
  createdAt: Date;
}

/**
 * Extended Request interface with user context
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  token?: string;
}

/**
 * JWT payload interface
 */
interface JWTPayload {
  sub: string; // user id
  username: string;
  email?: string;
  role: 'admin' | 'user';
  proxmoxServer?: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

/**
 * Authentication service class
 */
export class AuthService {
  /**
   * Generate JWT access token
   */
  static generateAccessToken(user: Omit<AuthUser, 'createdAt'>): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      proxmoxServer: user.proxmoxServer,
      type: 'access'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'proxmox-mpc-web',
      audience: 'proxmox-mpc-api'
    });
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(userId: string): string {
    const payload = {
      sub: userId,
      type: 'refresh'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'proxmox-mpc-web',
      audience: 'proxmox-mpc-api'
    });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'proxmox-mpc-web',
        audience: 'proxmox-mpc-api'
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      logger.warn('JWT verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        token: token.substring(0, 20) + '...' 
      });
      return null;
    }
  }

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
}

/**
 * Authentication middleware
 * 
 * Validates JWT tokens and attaches user context to requests.
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No valid authorization token provided',
        code: 'AUTH_TOKEN_MISSING'
      });
      return;
    }

    const decoded = AuthService.verifyToken(token);
    
    if (!decoded) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid or expired token',
        code: 'AUTH_TOKEN_INVALID'
      });
      return;
    }

    if (decoded.type !== 'access') {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid token type',
        code: 'AUTH_TOKEN_TYPE_INVALID'
      });
      return;
    }

    // Attach user context to request
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      proxmoxServer: decoded.proxmoxServer,
      createdAt: new Date(decoded.iat * 1000)
    };
    
    req.token = token;

    logger.debug('Authentication successful', {
      userId: decoded.sub,
      username: decoded.username,
      role: decoded.role,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal authentication error',
      code: 'AUTH_INTERNAL_ERROR'
    });
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (requiredRole: 'admin' | 'user') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User context not found',
        code: 'AUTH_USER_CONTEXT_MISSING'
      });
      return;
    }

    if (req.user.role === 'admin' || req.user.role === requiredRole) {
      next();
      return;
    }

    logger.warn('Authorization failed', {
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      requiredRole,
      path: req.path,
      method: req.method
    });

    res.status(403).json({
      error: 'Authorization failed',
      message: `Role '${requiredRole}' required`,
      code: 'AUTH_INSUFFICIENT_PRIVILEGES'
    });
  };
};

/**
 * Optional authentication middleware
 * 
 * Attempts to authenticate but doesn't fail if no token is provided.
 * Useful for endpoints that work for both authenticated and anonymous users.
 */
export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      const decoded = AuthService.verifyToken(token);
      
      if (decoded && decoded.type === 'access') {
        req.user = {
          id: decoded.sub,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role,
          proxmoxServer: decoded.proxmoxServer,
          createdAt: new Date(decoded.iat * 1000)
        };
        req.token = token;
      }
    }

    next();
  } catch (error) {
    logger.warn('Optional authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method
    });

    // Continue without authentication for optional middleware
    next();
  }
};

export default authMiddleware;