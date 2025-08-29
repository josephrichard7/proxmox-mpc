/**
 * Resource Usage Card Component
 * 
 * Reusable card component for displaying resource usage
 * with progress bars and visual indicators.
 */

import React from 'react';
import {
  Paper,
  Group,
  Text,
  Progress,
  RingProgress,
  Stack,
  Tooltip,
} from '@mantine/core';
import { TablerIconsProps } from '@tabler/icons-react';

interface ResourceUsageCardProps {
  /**
   * Title of the resource
   */
  title: string;
  
  /**
   * Current usage value
   */
  used: number;
  
  /**
   * Total available value
   */
  total: number;
  
  /**
   * Unit of measurement (e.g., 'GB', 'MB', '%')
   */
  unit?: string;
  
  /**
   * Icon component to display
   */
  icon?: React.ComponentType<TablerIconsProps>;
  
  /**
   * Display format: 'progress' for bar, 'ring' for circular
   */
  format?: 'progress' | 'ring';
  
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Custom color for the progress indicator
   */
  color?: string;
  
  /**
   * Additional details to show
   */
  details?: string;
  
  /**
   * Whether to show the percentage
   */
  showPercentage?: boolean;
  
  /**
   * Custom formatter for the values
   */
  formatter?: (value: number) => string;
  
  /**
   * Threshold values for color coding
   */
  thresholds?: {
    warning?: number;
    critical?: number;
  };
}

export const ResourceUsageCard: React.FC<ResourceUsageCardProps> = ({
  title,
  used,
  total,
  unit = '',
  icon: Icon,
  format = 'progress',
  size = 'md',
  color,
  details,
  showPercentage = true,
  formatter,
  thresholds = { warning: 75, critical: 90 },
}) => {
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  
  const getColor = (): string => {
    if (color) return color;
    
    if (thresholds.critical && percentage >= thresholds.critical) return 'red';
    if (thresholds.warning && percentage >= thresholds.warning) return 'orange';
    return 'blue';
  };

  const formatValue = (value: number): string => {
    if (formatter) return formatter(value);
    return `${value}${unit}`;
  };

  const getSizes = () => {
    switch (size) {
      case 'sm':
        return {
          iconSize: 16,
          ringSize: 50,
          progressSize: 'sm' as const,
          titleSize: 'sm' as const,
          valueSize: 'md' as const,
        };
      case 'lg':
        return {
          iconSize: 24,
          ringSize: 80,
          progressSize: 'lg' as const,
          titleSize: 'lg' as const,
          valueSize: 'xl' as const,
        };
      default:
        return {
          iconSize: 20,
          ringSize: 60,
          progressSize: 'md' as const,
          titleSize: 'md' as const,
          valueSize: 'lg' as const,
        };
    }
  };

  const sizes = getSizes();
  const progressColor = getColor();

  if (format === 'ring') {
    return (
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="xs">
          <Text c="dimmed" size={sizes.titleSize} tt="uppercase" fw={700}>
            {title}
          </Text>
          {showPercentage && (
            <Text size="xs" c="dimmed">
              {percentage}%
            </Text>
          )}
        </Group>
        
        <Group>
          <RingProgress
            size={sizes.ringSize}
            roundCaps
            thickness={6}
            sections={[{ value: percentage, color: progressColor }]}
            label={
              <div style={{ textAlign: 'center' }}>
                {Icon && <Icon size={sizes.iconSize} />}
              </div>
            }
          />
          
          <div>
            <Text fw={700} size={sizes.valueSize}>
              {formatValue(used)} / {formatValue(total)}
            </Text>
            {details && (
              <Text c="dimmed" size="sm">
                {details}
              </Text>
            )}
          </div>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          {Icon && <Icon size={sizes.iconSize} />}
          <Text c="dimmed" size={sizes.titleSize} tt="uppercase" fw={700}>
            {title}
          </Text>
        </Group>
        
        <Group gap="xs">
          {showPercentage && (
            <Text size="sm" c="dimmed">
              {percentage}%
            </Text>
          )}
          <Text size="sm" c="dimmed">
            {formatValue(used)} / {formatValue(total)}
          </Text>
        </Group>
      </Group>
      
      <Progress
        value={percentage}
        color={progressColor}
        size={sizes.progressSize}
      />
      
      {details && (
        <Text c="dimmed" size="sm" mt="xs">
          {details}
        </Text>
      )}
    </Paper>
  );
};

/**
 * Predefined resource usage cards for common resources
 */
export const CPUUsageCard: React.FC<Omit<ResourceUsageCardProps, 'title' | 'unit'>> = (props) => (
  <ResourceUsageCard
    title="CPU Usage"
    unit="%"
    {...props}
  />
);

export const MemoryUsageCard: React.FC<ResourceUsageCardProps> = (props) => (
  <ResourceUsageCard
    title="Memory Usage"
    formatter={(value) => {
      if (value >= 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }
      if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
      }
      return `${Math.round(value / 1024)} KB`;
    }}
    {...props}
  />
);

export const StorageUsageCard: React.FC<ResourceUsageCardProps> = (props) => (
  <ResourceUsageCard
    title="Storage Usage"
    formatter={(value) => {
      if (value >= 1024 * 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB`;
      }
      if (value >= 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }
      return `${Math.round(value / (1024 * 1024))} MB`;
    }}
    {...props}
  />
);