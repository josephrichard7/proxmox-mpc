/**
 * Status Badge Component
 * 
 * Reusable status badge component with consistent styling
 * and color coding for different status types.
 */

import React from 'react';
import { Badge, BadgeProps } from '@mantine/core';

interface StatusBadgeProps extends Omit<BadgeProps, 'color'> {
  status: string;
  type?: 'vm' | 'container' | 'node' | 'generic';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'generic',
  ...props
}) => {
  const getStatusProps = () => {
    const normalizedStatus = status.toLowerCase();
    
    switch (normalizedStatus) {
      case 'running':
        return { color: 'green', label: 'Running' };
      case 'stopped':
        return { color: 'gray', label: 'Stopped' };
      case 'paused':
        return { color: 'orange', label: 'Paused' };
      case 'online':
        return { color: 'green', label: 'Online' };
      case 'offline':
        return { color: 'gray', label: 'Offline' };
      case 'unknown':
        return { color: 'orange', label: 'Unknown' };
      case 'error':
        return { color: 'red', label: 'Error' };
      case 'starting':
        return { color: 'blue', label: 'Starting' };
      case 'stopping':
        return { color: 'orange', label: 'Stopping' };
      case 'creating':
        return { color: 'blue', label: 'Creating' };
      case 'deleting':
        return { color: 'red', label: 'Deleting' };
      case 'migrating':
        return { color: 'cyan', label: 'Migrating' };
      case 'backup':
        return { color: 'indigo', label: 'Backup' };
      case 'restore':
        return { color: 'violet', label: 'Restore' };
      default:
        // Capitalize first letter for unknown statuses
        const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
        return { color: 'blue', label: capitalizedStatus };
    }
  };

  const { color, label } = getStatusProps();

  return (
    <Badge
      color={color}
      variant="light"
      size="sm"
      {...props}
    >
      {label}
    </Badge>
  );
};