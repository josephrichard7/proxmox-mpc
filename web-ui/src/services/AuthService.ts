import axios from 'axios';
import { z } from 'zod';

// Base API URL
const API_BASE_URL = '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token might be expired, try to refresh
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const newTokens = await AuthService.refreshToken(refreshToken);
          localStorage.setItem('accessToken', newTokens.accessToken);
          
          // Retry the original request with new token
          error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return api.request(error.config);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Type definitions
export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'admin' | 'user';
  proxmoxServer?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  proxmoxServer?: string;
  rememberMe?: boolean;
}

export interface AuthResult {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: string;
    tokenType: string;
  };
}

export interface RefreshTokenResult {
  accessToken: string;
  expiresIn: string;
  tokenType: string;
}

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  proxmoxServer: z.string().url().optional(),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  proxmoxServer: z.string().url().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Auth service class
export class AuthService {
  /**
   * Login user with credentials
   */
  static async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Validate input
    const validatedCredentials = loginSchema.parse(credentials);
    
    try {
      const response = await api.post('/auth/login', validatedCredentials);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Login failed');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Register new user
   */
  static async register(userData: {
    username: string;
    email?: string;
    password: string;
    confirmPassword: string;
    proxmoxServer?: string;
  }): Promise<{ user: Omit<User, 'createdAt' | 'lastLogin'> }> {
    // Validate input
    const validatedData = registerSchema.parse(userData);
    
    try {
      const response = await api.post('/auth/register', validatedData);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Registration failed');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<RefreshTokenResult> {
    try {
      const response = await api.post('/auth/refresh', { refreshToken });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Token refresh failed');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Logout user
   */
  static async logout(refreshToken?: string): Promise<void> {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch (error) {
      // Logout errors are not critical - we still want to clear local state
      console.warn('Logout error:', error);
    }
  }

  /**
   * Validate current token and get user info
   */
  static async validateToken(): Promise<User> {
    try {
      const response = await api.get('/auth/validate');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Token validation failed');
      }
      
      return response.data.data.user;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(): Promise<User> {
    try {
      const response = await api.get('/auth/me');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get user profile');
      }
      
      return response.data.data.user;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Change password
   */
  static async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Password change failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }
}

export default AuthService;