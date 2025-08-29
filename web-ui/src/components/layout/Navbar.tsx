import React from 'react';
import { NavLink, Stack, Text } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IconDashboard,
  IconServer,
  IconContainer,
  IconDeviceDesktop,
  IconSettings,
  IconDatabase,
  IconCode,
  IconTemplate,
  IconBolt,
  IconTopology,
} from '@tabler/icons-react';

const navigationItems = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: IconDashboard,
    description: 'Infrastructure overview',
  },
  {
    label: 'Virtual Machines',
    path: '/vms',
    icon: IconDeviceDesktop,
    description: 'VM management',
  },
  {
    label: 'Containers',
    path: '/containers',
    icon: IconContainer,
    description: 'Container management',
  },
  {
    label: 'Nodes',
    path: '/nodes',
    icon: IconServer,
    description: 'Cluster nodes',
  },
  {
    label: 'Storage',
    path: '/storage',
    icon: IconDatabase,
    description: 'Storage management',
  },
  {
    label: 'Configuration',
    path: '/configuration',
    icon: IconCode,
    description: 'Infrastructure as Code',
  },
  {
    label: 'Templates',
    path: '/templates',
    icon: IconTemplate,
    description: 'Template library & designer',
  },
  {
    label: 'Batch Operations',
    path: '/batch-operations',
    icon: IconBolt,
    description: 'Bulk resource management',
  },
  {
    label: 'Visualization',
    path: '/visualization',
    icon: IconTopology,
    description: 'Network topology & monitoring',
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: IconSettings,
    description: 'Application settings',
  },
];

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Stack gap="xs">
      <Text size="xs" fw={500} c="dimmed" tt="uppercase" pl="md">
        Navigation
      </Text>
      
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || 
          (item.path === '/dashboard' && location.pathname === '/');
        
        return (
          <NavLink
            key={item.path}
            label={item.label}
            description={item.description}
            leftSection={<Icon size={20} />}
            active={isActive}
            onClick={() => navigate(item.path)}
            variant="filled"
          />
        );
      })}
    </Stack>
  );
};