import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { AuthService, LoginCredentials, User } from '../services/AuthService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize authentication state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          // Validate existing token
          const userData = await AuthService.validateToken();
          setUser(userData);
        }
      } catch (error) {
        // Token is invalid, clear it
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        console.warn('Invalid stored token, clearing authentication');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const authResult = await AuthService.login(credentials);
      
      // Store tokens
      localStorage.setItem('accessToken', authResult.tokens.accessToken);
      if (authResult.tokens.refreshToken) {
        localStorage.setItem('refreshToken', authResult.tokens.refreshToken);
      }
      
      setUser(authResult.user);
      
      notifications.show({
        title: 'Login Successful',
        message: `Welcome back, ${authResult.user.username}!`,
        color: 'green',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      notifications.show({
        title: 'Login Failed',
        message: errorMessage,
        color: 'red',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint to invalidate tokens
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
    } catch (error) {
      console.warn('Error during logout:', error);
    } finally {
      // Clear local storage and state regardless of API call result
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      
      notifications.show({
        title: 'Logged Out',
        message: 'You have been logged out successfully',
        color: 'blue',
      });
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const newTokens = await AuthService.refreshToken(refreshToken);
      localStorage.setItem('accessToken', newTokens.accessToken);
      
      // Optionally get updated user info
      const userData = await AuthService.validateToken();
      setUser(userData);
    } catch (error) {
      // Refresh failed, log out user
      console.warn('Token refresh failed:', error);
      await logout();
      throw error;
    }
  }, [logout]);

  // Set up automatic token refresh
  useEffect(() => {
    if (!user) return;

    // Check token validity every 5 minutes
    const interval = setInterval(async () => {
      try {
        await AuthService.validateToken();
      } catch (error) {
        console.warn('Token validation failed, attempting refresh:', error);
        try {
          await refreshToken();
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // User will be logged out by refreshToken function
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, refreshToken]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};