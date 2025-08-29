import React from 'react';
import { useAuth } from '../../stores/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null; // This will cause a redirect to login via the main App component
  }

  return <>{children}</>;
};