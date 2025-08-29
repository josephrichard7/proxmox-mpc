import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { notifications } from '@mantine/notifications';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (event: string, data?: any) => void;
  unsubscribe: (event: string, data?: any) => void;
  emit: (event: string, data?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Disconnect if user is not authenticated
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create WebSocket connection
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(window.location.origin, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setIsConnected(true);
      
      notifications.show({
        title: 'Connected',
        message: 'Real-time updates enabled',
        color: 'green',
        autoClose: 3000,
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      
      if (reason !== 'io client disconnect') {
        notifications.show({
          title: 'Connection Lost',
          message: 'Attempting to reconnect...',
          color: 'orange',
          autoClose: 5000,
        });
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      
      notifications.show({
        title: 'Connection Error',
        message: 'Failed to connect to server',
        color: 'red',
        autoClose: 5000,
      });
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      
      notifications.show({
        title: 'Reconnected',
        message: 'Real-time updates restored',
        color: 'green',
        autoClose: 3000,
      });
    });

    // Infrastructure update handlers
    newSocket.on('infrastructure:update', (data) => {
      console.log('Infrastructure update:', data);
      // Trigger infrastructure data refresh
      window.dispatchEvent(new CustomEvent('infrastructure:update', { detail: data }));
    });

    newSocket.on('vm:update', (data) => {
      console.log('VM update:', data);
      // Trigger VM data refresh
      window.dispatchEvent(new CustomEvent('vm:update', { detail: data }));
    });

    newSocket.on('container:update', (data) => {
      console.log('Container update:', data);
      // Trigger container data refresh
      window.dispatchEvent(new CustomEvent('container:update', { detail: data }));
    });

    newSocket.on('node:update', (data) => {
      console.log('Node update:', data);
      // Trigger node data refresh
      window.dispatchEvent(new CustomEvent('node:update', { detail: data }));
    });

    // Notification handler
    newSocket.on('notification', (notification) => {
      notifications.show({
        title: notification.title,
        message: notification.message,
        color: getNotificationColor(notification.type),
        autoClose: notification.type === 'error' ? false : 5000,
      });
    });

    newSocket.on('system:notification', (notification) => {
      notifications.show({
        title: `System: ${notification.title}`,
        message: notification.message,
        color: getNotificationColor(notification.type),
        autoClose: false,
      });
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, user]);

  const subscribe = useCallback((event: string, data?: any) => {
    if (!socket || !isConnected) return;
    
    console.log('Subscribing to:', event, data);
    socket.emit(event, data);
  }, [socket, isConnected]);

  const unsubscribe = useCallback((event: string, data?: any) => {
    if (!socket || !isConnected) return;
    
    console.log('Unsubscribing from:', event, data);
    socket.emit('unsubscribe', { type: event.replace('subscribe:', ''), ...data });
  }, [socket, isConnected]);

  const emit = useCallback((event: string, data?: any) => {
    if (!socket || !isConnected) return;
    
    socket.emit(event, data);
  }, [socket, isConnected]);

  // Health check ping
  useEffect(() => {
    if (!socket || !isConnected) return;

    const interval = setInterval(() => {
      socket.emit('ping', (response: any) => {
        console.log('WebSocket ping response:', response);
      });
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [socket, isConnected]);

  const value: WebSocketContextType = {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
    emit,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// Helper function to map notification types to colors
function getNotificationColor(type: string): string {
  switch (type) {
    case 'error':
      return 'red';
    case 'warning':
      return 'orange';
    case 'success':
      return 'green';
    case 'info':
    default:
      return 'blue';
  }
}