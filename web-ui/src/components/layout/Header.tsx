import React from 'react';
import { Group, Text, ActionIcon, Menu, Avatar } from '@mantine/core';
import { IconServer, IconUser, IconSettings, IconLogout } from '@tabler/icons-react';
import { useAuth } from '../../stores/AuthContext';
import { useWebSocket } from '../../stores/WebSocketContext';

interface HeaderProps {
  burger: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ burger }) => {
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group>
        {burger}
        <Group gap="xs">
          <IconServer size={28} color="#228be6" />
          <Text size="lg" fw={700}>
            Proxmox-MPC
          </Text>
        </Group>
      </Group>

      <Group gap="sm">
        {/* Connection status indicator */}
        <Group gap={4}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isConnected ? '#51cf66' : '#ffd43b',
            }}
          />
          <Text size="sm" c={isConnected ? 'green' : 'orange'}>
            {isConnected ? 'Live' : 'Offline'}
          </Text>
        </Group>

        {/* User menu */}
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" size="lg">
              <Avatar size="sm" color="blue">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>{user?.username || 'User'}</Menu.Label>
            <Menu.Label c="dimmed" fz="xs">
              {user?.role || 'Role'}
            </Menu.Label>
            
            <Menu.Divider />
            
            <Menu.Item leftSection={<IconUser size={14} />}>
              Profile
            </Menu.Item>
            
            <Menu.Item leftSection={<IconSettings size={14} />}>
              Settings
            </Menu.Item>
            
            <Menu.Divider />
            
            <Menu.Item
              leftSection={<IconLogout size={14} />}
              color="red"
              onClick={logout}
            >
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
};