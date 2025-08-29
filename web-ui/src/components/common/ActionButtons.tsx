/**
 * Action Buttons Component
 * 
 * Responsive action buttons that adapt to screen size
 * and provide consistent interaction patterns.
 */

import React from 'react';
import {
  Group,
  Button,
  ActionIcon,
  Menu,
  Tooltip,
  useMatches,
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconRefreshDot,
  IconTrash,
  IconEdit,
  IconDots,
  IconEye,
} from '@tabler/icons-react';

interface ActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'filled' | 'light' | 'outline' | 'subtle';
  destructive?: boolean;
}

interface ActionButtonsProps {
  /**
   * Array of action items to display
   */
  actions: ActionItem[];
  
  /**
   * Maximum number of actions to show as buttons before collapsing
   */
  maxVisibleActions?: number;
  
  /**
   * Size of the buttons/icons
   */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  
  /**
   * Whether to use compact mode (icons only)
   */
  compact?: boolean;
  
  /**
   * Breakpoint for responsive behavior
   */
  collapseBreakpoint?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Custom overflow menu trigger icon
   */
  overflowIcon?: React.ComponentType<{ size?: number }>;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  actions,
  maxVisibleActions = 3,
  size = 'sm',
  compact = false,
  collapseBreakpoint = 'sm',
  overflowIcon: OverflowIcon = IconDots,
}) => {
  // Use responsive hook to determine if we should collapse
  const shouldCollapse = useMatches({
    base: true,
    [collapseBreakpoint]: false,
  });

  const iconSize = {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 20,
  }[size];

  // Separate primary and overflow actions
  const visibleActions = shouldCollapse || compact
    ? actions.slice(0, Math.min(maxVisibleActions - 1, actions.length))
    : actions.slice(0, maxVisibleActions);
  
  const overflowActions = shouldCollapse || compact
    ? actions.slice(Math.min(maxVisibleActions - 1, actions.length))
    : actions.slice(maxVisibleActions);

  const renderAction = (action: ActionItem, asMenuItem = false) => {
    const IconComponent = action.icon;
    
    if (asMenuItem) {
      return (
        <Menu.Item
          key={action.id}
          leftSection={<IconComponent size={iconSize} />}
          onClick={action.onClick}
          disabled={action.disabled}
          color={action.destructive ? 'red' : action.color}
        >
          {action.label}
        </Menu.Item>
      );
    }

    if (compact || shouldCollapse) {
      return (
        <Tooltip key={action.id} label={action.label}>
          <ActionIcon
            variant={action.variant || 'light'}
            color={action.color || (action.destructive ? 'red' : 'blue')}
            size={size}
            disabled={action.disabled}
            loading={action.loading}
            onClick={action.onClick}
          >
            <IconComponent size={iconSize} />
          </ActionIcon>
        </Tooltip>
      );
    }

    return (
      <Button
        key={action.id}
        leftSection={<IconComponent size={iconSize} />}
        variant={action.variant || 'light'}
        color={action.color || (action.destructive ? 'red' : 'blue')}
        size={size}
        disabled={action.disabled}
        loading={action.loading}
        onClick={action.onClick}
      >
        {action.label}
      </Button>
    );
  };

  return (
    <Group gap="xs">
      {visibleActions.map(action => renderAction(action))}
      
      {overflowActions.length > 0 && (
        <Menu withinPortal justify="bottom-end">
          <Menu.Target>
            <ActionIcon variant="light" size={size}>
              <OverflowIcon size={iconSize} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {overflowActions.map(action => renderAction(action, true))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
};

/**
 * Predefined action button sets for common use cases
 */

interface VMActionButtonsProps {
  status: string;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onView: () => void;
  onDelete: () => void;
  isProtected?: boolean;
  loading?: {
    start?: boolean;
    stop?: boolean;
    restart?: boolean;
    delete?: boolean;
  };
  size?: ActionButtonsProps['size'];
  compact?: boolean;
}

export const VMActionButtons: React.FC<VMActionButtonsProps> = ({
  status,
  onStart,
  onStop,
  onRestart,
  onView,
  onDelete,
  isProtected = false,
  loading = {},
  size = 'sm',
  compact = false,
}) => {
  const actions: ActionItem[] = [
    {
      id: 'start',
      label: 'Start VM',
      icon: IconPlayerPlay,
      onClick: onStart,
      color: 'green',
      disabled: status === 'running',
      loading: loading.start,
    },
    {
      id: 'stop',
      label: 'Stop VM',
      icon: IconPlayerStop,
      onClick: onStop,
      color: 'red',
      disabled: status === 'stopped',
      loading: loading.stop,
    },
    {
      id: 'restart',
      label: 'Restart VM',
      icon: IconRefreshDot,
      onClick: onRestart,
      color: 'orange',
      disabled: status === 'stopped',
      loading: loading.restart,
    },
    {
      id: 'view',
      label: 'View Details',
      icon: IconEye,
      onClick: onView,
      variant: 'subtle',
    },
    {
      id: 'delete',
      label: 'Delete VM',
      icon: IconTrash,
      onClick: onDelete,
      disabled: isProtected,
      loading: loading.delete,
      destructive: true,
    },
  ];

  return (
    <ActionButtons
      actions={actions}
      size={size}
      compact={compact}
      maxVisibleActions={3}
    />
  );
};

export const ContainerActionButtons: React.FC<VMActionButtonsProps> = ({
  status,
  onStart,
  onStop,
  onRestart,
  onView,
  onDelete,
  isProtected = false,
  loading = {},
  size = 'sm',
  compact = false,
}) => {
  const actions: ActionItem[] = [
    {
      id: 'start',
      label: 'Start Container',
      icon: IconPlayerPlay,
      onClick: onStart,
      color: 'green',
      disabled: status === 'running',
      loading: loading.start,
    },
    {
      id: 'stop',
      label: 'Stop Container',
      icon: IconPlayerStop,
      onClick: onStop,
      color: 'red',
      disabled: status === 'stopped',
      loading: loading.stop,
    },
    {
      id: 'restart',
      label: 'Restart Container',
      icon: IconRefreshDot,
      onClick: onRestart,
      color: 'orange',
      disabled: status === 'stopped',
      loading: loading.restart,
    },
    {
      id: 'view',
      label: 'View Details',
      icon: IconEye,
      onClick: onView,
      variant: 'subtle',
    },
    {
      id: 'delete',
      label: 'Delete Container',
      icon: IconTrash,
      onClick: onDelete,
      disabled: isProtected,
      loading: loading.delete,
      destructive: true,
    },
  ];

  return (
    <ActionButtons
      actions={actions}
      size={size}
      compact={compact}
      maxVisibleActions={3}
    />
  );
};