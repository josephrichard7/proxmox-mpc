/**
 * Error State Component
 * 
 * Consistent error state component with retry functionality
 * and customizable error messages.
 */

import React from 'react';
import {
  Stack,
  Text,
  Button,
  Card,
  Alert,
  ActionIcon,
  Group,
} from '@mantine/core';
import {
  IconRefresh,
  IconAlertTriangle,
  IconX,
} from '@tabler/icons-react';

interface ErrorStateProps {
  /**
   * Error object or error message
   */
  error?: Error | string | null;
  
  /**
   * Title for the error state
   */
  title?: string;
  
  /**
   * Optional retry function
   */
  onRetry?: () => void;
  
  /**
   * Retry button text
   */
  retryText?: string;
  
  /**
   * Whether to show as a card or inline alert
   */
  variant?: 'card' | 'alert' | 'inline';
  
  /**
   * Minimum height for card variant
   */
  minHeight?: number | string;
  
  /**
   * Whether the retry button should show loading state
   */
  retryLoading?: boolean;
  
  /**
   * Optional onDismiss for alert variant
   */
  onDismiss?: () => void;
  
  /**
   * Additional content to show below the error
   */
  children?: React.ReactNode;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  title = 'Something went wrong',
  onRetry,
  retryText = 'Try Again',
  variant = 'card',
  minHeight = 200,
  retryLoading = false,
  onDismiss,
  children,
}) => {
  const errorMessage = React.useMemo(() => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return 'An unexpected error occurred';
  }, [error]);

  const content = (
    <>
      <Stack align="center" gap="md">
        <IconAlertTriangle size={48} color="var(--mantine-color-red-6)" />
        <div style={{ textAlign: 'center' }}>
          <Text size="lg" fw={600} c="red" mb="xs">
            {title}
          </Text>
          <Text c="dimmed" size="sm" maw={400}>
            {errorMessage}
          </Text>
        </div>
        
        {children}
        
        {onRetry && (
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={onRetry}
            loading={retryLoading}
            variant="light"
          >
            {retryText}
          </Button>
        )}
      </Stack>
    </>
  );

  if (variant === 'alert') {
    return (
      <Alert
        variant="light"
        color="red"
        icon={<IconAlertTriangle />}
        title={title}
        withCloseButton={!!onDismiss}
        onClose={onDismiss}
      >
        <Text size="sm" mb={onRetry ? "md" : 0}>
          {errorMessage}
        </Text>
        
        {children}
        
        {onRetry && (
          <Group mt="md">
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={onRetry}
              loading={retryLoading}
              variant="light"
              size="xs"
            >
              {retryText}
            </Button>
          </Group>
        )}
      </Alert>
    );
  }

  if (variant === 'inline') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--mantine-spacing-md)' }}>
        {content}
      </div>
    );
  }

  return (
    <Card withBorder style={{ minHeight }}>
      <Stack justify="center" align="center" style={{ minHeight }}>
        {content}
      </Stack>
    </Card>
  );
};

/**
 * Hook for creating consistent error states
 */
export const useErrorState = (
  error: Error | string | null,
  retryFn?: () => void,
  retryLoading?: boolean
) => {
  return {
    ErrorComponent: ({ title, ...props }: Omit<ErrorStateProps, 'error' | 'onRetry' | 'retryLoading'>) => (
      <ErrorState
        error={error}
        onRetry={retryFn}
        retryLoading={retryLoading}
        title={title}
        {...props}
      />
    ),
    hasError: !!error,
    error,
  };
};