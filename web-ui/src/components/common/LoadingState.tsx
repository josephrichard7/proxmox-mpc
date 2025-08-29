/**
 * Loading State Component
 * 
 * Consistent loading state component with optional overlay
 * and customizable loading messages.
 */

import React from 'react';
import {
  LoadingOverlay,
  Stack,
  Text,
  Loader,
  Card,
} from '@mantine/core';

interface LoadingStateProps {
  /**
   * Whether to show as an overlay (absolute positioned)
   * or as a centered content block
   */
  overlay?: boolean;
  
  /**
   * Optional loading message to display
   */
  message?: string;
  
  /**
   * Minimum height for the loading container
   */
  minHeight?: number | string;
  
  /**
   * Size of the loader
   */
  loaderSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Whether the loading overlay is visible
   */
  visible?: boolean;
  
  /**
   * Additional styles for the container
   */
  style?: React.CSSProperties;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  overlay = false,
  message,
  minHeight = 200,
  loaderSize = 'md',
  visible = true,
  style,
}) => {
  if (overlay) {
    return (
      <div style={{ position: 'relative', minHeight, ...style }}>
        <LoadingOverlay visible={visible} loaderProps={{ size: loaderSize }} />
        {message && !visible && (
          <Stack align="center" justify="center" style={{ minHeight }}>
            <Text c="dimmed" ta="center">{message}</Text>
          </Stack>
        )}
      </div>
    );
  }

  return (
    <Card withBorder style={{ minHeight, ...style }}>
      <Stack align="center" justify="center" style={{ minHeight }}>
        {visible && (
          <>
            <Loader size={loaderSize} />
            {message && (
              <Text c="dimmed" ta="center" mt="md">
                {message}
              </Text>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
};

/**
 * Hook for creating consistent loading states
 */
export const useLoadingState = (isLoading: boolean, message?: string) => {
  return {
    LoadingComponent: ({ overlay = true, ...props }: Omit<LoadingStateProps, 'visible' | 'message'>) => (
      <LoadingState
        overlay={overlay}
        visible={isLoading}
        message={message}
        {...props}
      />
    ),
    isLoading,
  };
};