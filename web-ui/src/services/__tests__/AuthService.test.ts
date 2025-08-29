/**
 * AuthService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import * as AuthService from '../AuthService';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    })),
    post: vi.fn(),
    get: vi.fn()
  }
}));

const mockAxios = vi.mocked(axios);
const mockPost = vi.fn();
const mockGet = vi.fn();

// Setup mock axios instance
mockAxios.create.mockReturnValue({
  post: mockPost,
  get: mockGet,
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  }
} as any);

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    const validLoginData = {
      username: 'testuser',
      password: 'password123',
      server: 'https://proxmox.example.com'
    };

    const mockLoginResponse = {
      data: {
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            role: 'admin',
            proxmoxServer: 'https://proxmox.example.com',
            createdAt: new Date().toISOString()
          }
        }
      }
    };

    it('successfully logs in with valid credentials', async () => {
      mockPost.mockResolvedValueOnce(mockLoginResponse);

      const result = await AuthService.login(validLoginData);

      expect(result).toEqual(mockLoginResponse.data);
      expect(mockPost).toHaveBeenCalledWith('/auth/login', validLoginData);
      expect(localStorage.getItem('auth_token')).toBe('mock-jwt-token');
    });

    it('stores user data in localStorage on successful login', async () => {
      mockPost.mockResolvedValueOnce(mockLoginResponse);

      await AuthService.login(validLoginData);

      expect(localStorage.getItem('auth_token')).toBe('mock-jwt-token');
      expect(localStorage.getItem('auth_user')).toBe(
        JSON.stringify(mockLoginResponse.data.data.user)
      );
    });

    it('handles login failure correctly', async () => {
      const errorResponse = {
        response: {
          data: {
            success: false,
            message: 'Invalid credentials'
          },
          status: 401
        }
      };

      mockPost.mockRejectedValueOnce(errorResponse);

      await expect(AuthService.login(validLoginData)).rejects.toEqual(errorResponse);
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('validates required fields', async () => {
      const invalidData = { username: '', password: '', server: '' };

      mockPost.mockRejectedValueOnce({
        response: {
          data: { success: false, message: 'Username is required' },
          status: 400
        }
      });

      await expect(AuthService.login(invalidData)).rejects.toThrow();
    });

    it('handles network errors', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network Error'));

      await expect(AuthService.login(validLoginData)).rejects.toThrow('Network Error');
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      localStorage.setItem('auth_token', 'mock-token');
      localStorage.setItem('auth_user', JSON.stringify({ id: 'user-123' }));
    });

    it('successfully logs out user', async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true }
      });

      const result = await AuthService.logout();

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('/auth/logout');
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
    });

    it('clears localStorage even on API failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Server Error'));

      await AuthService.logout();

      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
    });
  });

  describe('refreshToken', () => {
    beforeEach(() => {
      localStorage.setItem('auth_token', 'old-token');
    });

    it('successfully refreshes token', async () => {
      const refreshResponse = {
        data: {
          success: true,
          data: { token: 'new-token' }
        }
      };

      mockPost.mockResolvedValueOnce(refreshResponse);

      const result = await AuthService.refreshToken();

      expect(result).toEqual(refreshResponse.data);
      expect(mockPost).toHaveBeenCalledWith('/auth/refresh');
      expect(localStorage.getItem('auth_token')).toBe('new-token');
    });

    it('handles refresh failure', async () => {
      mockPost.mockRejectedValueOnce({
        response: {
          data: { success: false, message: 'Token expired' },
          status: 401
        }
      });

      await expect(AuthService.refreshToken()).rejects.toThrow();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('returns stored user data', () => {
      const userData = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com'
      };

      localStorage.setItem('auth_user', JSON.stringify(userData));

      const result = AuthService.getCurrentUser();
      expect(result).toEqual(userData);
    });

    it('returns null when no user data stored', () => {
      const result = AuthService.getCurrentUser();
      expect(result).toBeNull();
    });

    it('handles corrupted user data gracefully', () => {
      localStorage.setItem('auth_user', 'invalid-json');

      const result = AuthService.getCurrentUser();
      expect(result).toBeNull();
    });
  });

  describe('getToken', () => {
    it('returns stored token', () => {
      localStorage.setItem('auth_token', 'test-token');

      const result = AuthService.getToken();
      expect(result).toBe('test-token');
    });

    it('returns null when no token stored', () => {
      const result = AuthService.getToken();
      expect(result).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when token exists', () => {
      localStorage.setItem('auth_token', 'test-token');

      const result = AuthService.isAuthenticated();
      expect(result).toBe(true);
    });

    it('returns false when no token exists', () => {
      const result = AuthService.isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns false when token is empty string', () => {
      localStorage.setItem('auth_token', '');

      const result = AuthService.isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('clearAuthData', () => {
    beforeEach(() => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('auth_user', JSON.stringify({ id: 'user-123' }));
    });

    it('clears all authentication data', () => {
      AuthService.clearAuthData();

      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
    });
  });
});