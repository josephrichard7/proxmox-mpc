/**
 * Accessible Dialog Component
 * 
 * WCAG 2.1 AA compliant modal dialog with focus management and keyboard navigation.
 */

import React, { useEffect, useRef } from 'react';
import { Modal, Button, Group, Stack, Text } from '@mantine/core';
import { useFocusTrap, useAnnouncer } from '../../hooks/useAccessibility';

interface AccessibleDialogProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  loading?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  centered?: boolean;
  scrollAreaComponent?: any;
  overlayProps?: any;
  transitionProps?: any;
  keepMounted?: boolean;
  trapFocus?: boolean;
  returnFocus?: boolean;
  lockScroll?: boolean;
  withinPortal?: boolean;
  portalProps?: any;
  shadow?: string;
  padding?: string | number;
  radius?: string | number;
  withCloseButton?: boolean;
  closeButtonProps?: any;
  fullScreen?: boolean;
  target?: HTMLElement | (() => HTMLElement);
  zIndex?: number;
}

export const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  opened,
  onClose,
  title,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel = onClose,
  loading = false,
  ...modalProps
}) => {
  const focusTrapRef = useFocusTrap(opened);
  const announce = useAnnouncer();
  const titleId = `dialog-title-${Date.now()}`;
  const descriptionId = `dialog-description-${Date.now()}`;

  // Announce dialog opening/closing
  useEffect(() => {
    if (opened) {
      announce(`Dialog opened: ${title}`, 'polite');
    } else {
      announce('Dialog closed', 'polite');
    }
  }, [opened, title, announce]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: CustomEvent) => {
      if (opened) {
        onClose();
      }
    };

    if (focusTrapRef.current) {
      focusTrapRef.current.addEventListener('accessibility:escape', handleEscape as EventListener);
      return () => {
        focusTrapRef.current?.removeEventListener('accessibility:escape', handleEscape as EventListener);
      };
    }
  }, [opened, onClose, focusTrapRef]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      closeOnClickOutside={false}
      closeOnEscape={true}
      trapFocus={true}
      returnFocus={true}
      withCloseButton={true}
      {...modalProps}
    >
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-modal="true"
      >
        <Stack gap="md">
          <div id={descriptionId}>
            {children}
          </div>

          <Group justify="right" gap="sm">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              aria-label={`${cancelText} - closes dialog`}
            >
              {cancelText}
            </Button>
            
            {onConfirm && (
              <Button
                onClick={onConfirm}
                loading={loading}
                aria-label={`${confirmText} - performs action and closes dialog`}
              >
                {confirmText}
              </Button>
            )}
          </Group>
        </Stack>
      </div>
    </Modal>
  );
};

// Confirmation Dialog
interface ConfirmationDialogProps extends Omit<AccessibleDialogProps, 'children'> {
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  message,
  type = 'info',
  ...props
}) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'red';
      case 'warning': return 'yellow';
      case 'success': return 'green';
      default: return 'blue';
    }
  };

  const getAriaLevel = (type: string) => {
    switch (type) {
      case 'error': return 'assertive';
      case 'warning': return 'assertive';
      default: return 'polite';
    }
  };

  return (
    <AccessibleDialog {...props}>
      <div
        role="alert"
        aria-live={getAriaLevel(type)}
        style={{
          color: `var(--mantine-color-${getTypeColor(type)}-7)`,
          padding: '1rem',
          borderRadius: '4px',
          backgroundColor: `var(--mantine-color-${getTypeColor(type)}-0)`,
          border: `1px solid var(--mantine-color-${getTypeColor(type)}-3)`
        }}
      >
        <Text size="md" fw={500}>
          {message}
        </Text>
      </div>
    </AccessibleDialog>
  );
};