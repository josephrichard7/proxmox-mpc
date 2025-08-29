/**
 * Authentication Routes
 * 
 * Handles user authentication, registration, and token management
 * for the Proxmox-MPC web dashboard.
 */

import { Router, Response } from 'express';
import { AuthService, AuthenticatedRequest, AuthUser } from '../middleware/auth';
import { validateBody, validationSchemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/error';
import { ApplicationError, ValidationError, AuthenticationError } from '../middleware/error';
import { logger } from '../../../observability/logger';

const router = Router();

// In-memory user store for development (replace with database in production)
interface StoredUser extends AuthUser {
  passwordHash: string;
  refreshTokens: string[];
  lastLogin?: Date;
}

const users: Map<string, StoredUser> = new Map();

// Create default admin user for development
const createDefaultUser = async () => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminUser: StoredUser = {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@proxmox-mpc.local',
    role: 'admin',
    passwordHash: await AuthService.hashPassword(adminPassword),
    refreshTokens: [],
    createdAt: new Date()
  };
  
  users.set('admin', adminUser);
  
  if (process.env.NODE_ENV === 'development') {
    logger.info('Default admin user created', {
      username: 'admin',
      password: adminPassword,
      warning: 'Change password in production!'
    });
  }
};

// Initialize default user
createDefaultUser();

/**
 * POST /api/auth/login
 * Authenticate user and return access/refresh tokens
 */
router.post('/login', 
  validateBody(validationSchemas.login),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { username, password, proxmoxServer, rememberMe } = req.body;
    
    // Find user
    const user = users.get(username);
    if (!user) {
      logger.warn('Login attempt with invalid username', { 
        username,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      throw new AuthenticationError('Invalid username or password');
    }
    
    // Verify password
    const isValidPassword = await AuthService.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', { 
        username,
        userId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      throw new AuthenticationError('Invalid username or password');
    }
    
    // Generate tokens
    const userForToken: Omit<AuthUser, 'createdAt'> = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      proxmoxServer: proxmoxServer || user.proxmoxServer
    };
    
    const accessToken = AuthService.generateAccessToken(userForToken);
    const refreshToken = AuthService.generateRefreshToken(user.id);
    
    // Store refresh token
    user.refreshTokens.push(refreshToken);
    user.lastLogin = new Date();
    
    // Update Proxmox server if provided
    if (proxmoxServer) {
      user.proxmoxServer = proxmoxServer;
    }
    
    logger.info('User login successful', {
      userId: user.id,
      username: user.username,
      role: user.role,
      proxmoxServer: proxmoxServer || user.proxmoxServer,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          proxmoxServer: proxmoxServer || user.proxmoxServer
        },
        tokens: {
          accessToken,
          refreshToken: rememberMe ? refreshToken : undefined,
          expiresIn: '24h',
          tokenType: 'Bearer'
        }
      }
    });
  })
);

/**
 * POST /api/auth/register
 * Register new user (admin only in production)
 */
router.post('/register',
  validateBody(validationSchemas.register),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { username, email, password, proxmoxServer } = req.body;
    
    // Check if user already exists
    if (users.has(username)) {
      throw new ValidationError('Username already exists', { username });
    }
    
    // Hash password
    const passwordHash = await AuthService.hashPassword(password);
    
    // Create new user
    const newUser: StoredUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username,
      email,
      role: 'user', // New users are 'user' role by default
      passwordHash,
      refreshTokens: [],
      proxmoxServer,
      createdAt: new Date()
    };
    
    users.set(username, newUser);
    
    logger.info('User registration successful', {
      userId: newUser.id,
      username,
      email,
      role: newUser.role,
      ip: req.ip
    });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        }
      }
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  validateBody({ refreshToken: validationSchemas.register.shape.password }), // Reuse password validation for token
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token is required');
    }
    
    // Verify refresh token
    const decoded = AuthService.verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid refresh token');
    }
    
    // Find user and validate refresh token
    const user = Array.from(users.values()).find(u => u.id === decoded.sub);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      throw new AuthenticationError('Invalid refresh token');
    }
    
    // Generate new access token
    const userForToken: Omit<AuthUser, 'createdAt'> = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      proxmoxServer: user.proxmoxServer
    };
    
    const newAccessToken = AuthService.generateAccessToken(userForToken);
    
    logger.info('Token refresh successful', {
      userId: user.id,
      username: user.username,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        expiresIn: '24h',
        tokenType: 'Bearer'
      }
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout user and invalidate refresh token
 */
router.post('/logout',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const refreshToken = req.body?.refreshToken;
    const authHeader = req.headers.authorization;
    
    // Extract user ID from access token if available
    let userId: string | undefined;
    if (authHeader) {
      const accessToken = AuthService.extractTokenFromHeader(authHeader);
      if (accessToken) {
        const decoded = AuthService.verifyToken(accessToken);
        if (decoded && decoded.type === 'access') {
          userId = decoded.sub;
        }
      }
    }
    
    // Remove refresh token if provided
    if (refreshToken && userId) {
      const user = Array.from(users.values()).find(u => u.id === userId);
      if (user) {
        user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
        
        logger.info('User logout successful', {
          userId,
          username: user.username,
          ip: req.ip
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError('Authentication required');
    }
    
    const token = AuthService.extractTokenFromHeader(authHeader);
    if (!token) {
      throw new AuthenticationError('Invalid authorization header');
    }
    
    const decoded = AuthService.verifyToken(token);
    if (!decoded || decoded.type !== 'access') {
      throw new AuthenticationError('Invalid access token');
    }
    
    const user = Array.from(users.values()).find(u => u.id === decoded.sub);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          proxmoxServer: user.proxmoxServer,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      }
    });
  })
);

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password',
  validateBody({
    currentPassword: validationSchemas.login.shape.password,
    newPassword: validationSchemas.register.shape.password,
    confirmPassword: validationSchemas.register.shape.confirmPassword
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AuthenticationError('Authentication required');
    }
    
    const token = AuthService.extractTokenFromHeader(authHeader);
    if (!token) {
      throw new AuthenticationError('Invalid authorization header');
    }
    
    const decoded = AuthService.verifyToken(token);
    if (!decoded || decoded.type !== 'access') {
      throw new AuthenticationError('Invalid access token');
    }
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      throw new ValidationError('Passwords do not match');
    }
    
    const user = Array.from(users.values()).find(u => u.id === decoded.sub);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    // Verify current password
    const isValidCurrentPassword = await AuthService.verifyPassword(currentPassword, user.passwordHash);
    if (!isValidCurrentPassword) {
      throw new ValidationError('Current password is incorrect');
    }
    
    // Hash new password
    user.passwordHash = await AuthService.hashPassword(newPassword);
    
    // Invalidate all refresh tokens (force re-login on other devices)
    user.refreshTokens = [];
    
    logger.info('Password change successful', {
      userId: user.id,
      username: user.username,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

/**
 * GET /api/auth/validate
 * Validate current token (useful for frontend token validation)
 */
router.get('/validate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError('Authentication required');
    }
    
    const token = AuthService.extractTokenFromHeader(authHeader);
    if (!token) {
      throw new AuthenticationError('Invalid authorization header');
    }
    
    const decoded = AuthService.verifyToken(token);
    if (!decoded || decoded.type !== 'access') {
      throw new AuthenticationError('Invalid access token');
    }
    
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        valid: true,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
        user: {
          id: decoded.sub,
          username: decoded.username,
          role: decoded.role
        }
      }
    });
  })
);

export default router;