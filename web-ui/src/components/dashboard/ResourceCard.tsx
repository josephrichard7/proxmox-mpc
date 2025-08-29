/**
 * Resource Card Component
 * 
 * Reusable card component for displaying infrastructure resources
 * with click navigation and hover effects.
 */

import React from 'react';
import {
  Paper,
  Text,
  Group,
  Badge,
  ThemeIcon,
  ActionIcon,
} from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface ResourceCardProps {
  title: string;
  total: number;
  running: number;
  stopped: number;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  route: string;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  total,
  running,
  stopped,
  icon: Icon,
  color,
  route,
}) => {
  const navigate = useNavigate();

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{ 
        cursor: 'pointer', 
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onClick={() => navigate(route)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <Group justify="space-between" mb="xs">
        <div>
          <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
            {title}
          </Text>
          <Text fw={700} size="xl">
            {total}
          </Text>
          <Group gap="xs">
            <Badge color="green" size="sm" variant="light">
              {running} running
            </Badge>
            {stopped > 0 && (
              <Badge color="gray" size="sm" variant="light">
                {stopped} stopped
              </Badge>
            )}
          </Group>
        </div>
        <Group>
          <ThemeIcon color={color} variant="light" size={38}>
            <Icon size={22} />
          </ThemeIcon>
          <ActionIcon variant="subtle" size="sm">
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
};