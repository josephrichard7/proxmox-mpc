import React, { useEffect } from 'react';
import {
  Grid,
  Paper,
  Text,
  Title,
  Group,
  RingProgress,
  ThemeIcon,
  SimpleGrid,
  Card,
  Badge,
  Button,
  LoadingOverlay,
  Stack,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconServer,
  IconDeviceDesktop,
  IconContainer,
  IconCpu,
  IconMemory,
  IconHardDrive,
  IconRefresh,
  IconPlus,
  IconChevronRight,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../stores/WebSocketContext';
import { apiService, InfrastructureStatus } from '../services/ApiService';

export const DashboardPage: React.FC = () => {
  const { subscribe, unsubscribe, isConnected } = useWebSocket();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch infrastructure status
  const { 
    data: infrastructureStatus, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<InfrastructureStatus>({
    queryKey: ['infrastructure', 'status'],
    queryFn: async () => {
      const response = await apiService.getInfrastructureStatus();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch infrastructure status');
      }
      return response.data!;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Subscribe to infrastructure updates
  useEffect(() => {
    if (isConnected) {
      subscribe('subscribe:infrastructure');
      
      return () => {
        unsubscribe('subscribe:infrastructure');
      };
    }
  }, [isConnected, subscribe, unsubscribe]);

  // Handle real-time updates
  useEffect(() => {
    const handleInfrastructureUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['infrastructure'] });
    };

    if (isConnected) {
      // Listen for custom events dispatched by WebSocket context
      window.addEventListener('infrastructure:update', handleInfrastructureUpdate);
      window.addEventListener('vm:update', handleInfrastructureUpdate);
      window.addEventListener('container:update', handleInfrastructureUpdate);
      window.addEventListener('node:update', handleInfrastructureUpdate);

      return () => {
        window.removeEventListener('infrastructure:update', handleInfrastructureUpdate);
        window.removeEventListener('vm:update', handleInfrastructureUpdate);
        window.removeEventListener('container:update', handleInfrastructureUpdate);
        window.removeEventListener('node:update', handleInfrastructureUpdate);
      };
    }
  }, [isConnected, queryClient]);

  // Handle sync infrastructure
  const handleSyncInfrastructure = async () => {
    try {
      const response = await apiService.syncInfrastructure();
      if (response.success) {
        notifications.show({
          title: 'Infrastructure Sync',
          message: 'Infrastructure synchronization started',
          color: 'blue',
        });
        // Refetch data after sync
        setTimeout(() => refetch(), 3000);
      } else {
        throw new Error(response.error || 'Sync failed');
      }
    } catch (error) {
      notifications.show({
        title: 'Sync Error',
        message: error instanceof Error ? error.message : 'Failed to sync infrastructure',
        color: 'red',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={{ position: 'relative', minHeight: '400px' }}>
        <LoadingOverlay visible />
      </div>
    );
  }

  // Error state
  if (error || !infrastructureStatus) {
    return (
      <Card withBorder p="xl">
        <Stack align="center">
          <Text c="red" size="lg" fw={600}>
            Failed to load infrastructure data
          </Text>
          <Text c="dimmed" ta="center">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </Text>
          <Button onClick={() => refetch()} leftSection={<IconRefresh size={16} />}>
            Retry
          </Button>
        </Stack>
      </Card>
    );
  }

  const { summary, nodes, lastUpdated } = infrastructureStatus;

  // Calculate overall CPU usage across all nodes
  const overallCpuUsage = nodes.length > 0 
    ? Math.round(nodes.reduce((sum, node) => sum + node.cpu.usage, 0) / nodes.length)
    : 0;

  const stats = [
    {
      title: 'Virtual Machines',
      value: summary.vms.total,
      running: summary.vms.running,
      stopped: summary.vms.stopped,
      icon: IconDeviceDesktop,
      color: 'blue',
      route: '/vms',
    },
    {
      title: 'Containers',
      value: summary.containers.total,
      running: summary.containers.running,
      stopped: summary.containers.stopped,
      icon: IconContainer,
      color: 'green',
      route: '/containers',
    },
    {
      title: 'Nodes',
      value: summary.nodes.total,
      running: summary.nodes.online,
      stopped: summary.nodes.offline,
      icon: IconServer,
      color: 'orange',
      route: '/nodes',
    },
  ];

  const resources = [
    {
      title: 'CPU Usage',
      value: overallCpuUsage,
      icon: IconCpu,
      color: overallCpuUsage > 80 ? 'red' : overallCpuUsage > 60 ? 'orange' : 'blue',
    },
    {
      title: 'Memory Usage',
      value: summary.resources.memory.percentage,
      icon: IconMemory,
      color: summary.resources.memory.percentage > 80 ? 'red' : summary.resources.memory.percentage > 60 ? 'orange' : 'green',
      details: `${apiService.formatBytes(summary.resources.memory.used)} / ${apiService.formatBytes(summary.resources.memory.total)}`,
    },
    {
      title: 'Storage Usage',
      value: summary.resources.storage.percentage,
      icon: IconHardDrive,
      color: summary.resources.storage.percentage > 80 ? 'red' : summary.resources.storage.percentage > 60 ? 'orange' : 'teal',
      details: `${apiService.formatBytes(summary.resources.storage.used)} / ${apiService.formatBytes(summary.resources.storage.total)}`,
    },
  ];

  return (
    <div>
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Infrastructure Dashboard</Title>
          <Text c="dimmed">
            Overview of your Proxmox infrastructure
            {lastUpdated && (
              <> · Last updated: {new Date(lastUpdated).toLocaleTimeString()}</>
            )}
          </Text>
        </div>
        
        <Group>
          <Badge
            color={isConnected ? 'green' : 'orange'}
            variant="light"
          >
            {isConnected ? 'Live Updates' : 'Offline'}
          </Badge>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={handleSyncInfrastructure}
          >
            Sync
          </Button>
        </Group>
      </Group>

      {/* Resource Statistics */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Paper 
              withBorder 
              p="md" 
              radius="md" 
              key={stat.title}
              style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
              onClick={() => navigate(stat.route)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Group justify="space-between" mb="xs">
                <div>
                  <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                    {stat.title}
                  </Text>
                  <Text fw={700} size="xl">
                    {stat.value}
                  </Text>
                  <Group gap="xs">
                    <Badge color="green" size="sm" variant="light">
                      {stat.running} running
                    </Badge>
                    {stat.stopped > 0 && (
                      <Badge color="gray" size="sm" variant="light">
                        {stat.stopped} stopped
                      </Badge>
                    )}
                  </Group>
                </div>
                <Group>
                  <ThemeIcon color={stat.color} variant="light" size={38}>
                    <Icon size={22} />
                  </ThemeIcon>
                  <ActionIcon variant="subtle" size="sm">
                    <IconChevronRight size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      {/* Quick Actions */}
      <Title order={3} mb="md">Quick Actions</Title>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Button 
          leftSection={<IconPlus size={16} />}
          variant="light" 
          color="blue"
          onClick={() => navigate('/vms?create=true')}
        >
          Create VM
        </Button>
        <Button 
          leftSection={<IconPlus size={16} />}
          variant="light" 
          color="green"
          onClick={() => navigate('/containers?create=true')}
        >
          Create Container
        </Button>
        <Button 
          leftSection={<IconServer size={16} />}
          variant="light" 
          color="orange"
          onClick={() => navigate('/nodes')}
        >
          Manage Nodes
        </Button>
        <Button 
          leftSection={<IconRefresh size={16} />}
          variant="light" 
          color="teal"
          onClick={handleSyncInfrastructure}
        >
          Sync Infrastructure
        </Button>
      </SimpleGrid>

      {/* Resource Usage */}
      <Title order={3} mb="md">Resource Usage</Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        {resources.map((resource) => {
          const Icon = resource.icon;
          return (
            <Paper withBorder p="md" radius="md" key={resource.title}>
              <Group>
                <RingProgress
                  size={80}
                  roundCaps
                  thickness={8}
                  sections={[{ value: resource.value, color: resource.color }]}
                  label={
                    <div style={{ textAlign: 'center' }}>
                      <Icon size={16} />
                    </div>
                  }
                />
                <div>
                  <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                    {resource.title}
                  </Text>
                  <Text fw={700} size="xl">
                    {resource.value}%
                  </Text>
                  {resource.details && (
                    <Text c="dimmed" size="sm">
                      {resource.details}
                    </Text>
                  )}
                </div>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      {/* Node Status */}
      <Title order={3} mb="md">Node Status</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} mb="xl">
        {nodes.map((node) => (
          <Paper withBorder p="md" radius="md" key={node.name}>
            <Group justify="space-between" mb="xs">
              <Text fw={600}>{node.name}</Text>
              <Badge 
                color={node.status === 'online' ? 'green' : 'red'} 
                variant="light" 
                size="sm"
              >
                {node.status}
              </Badge>
            </Group>
            
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">VMs / Containers</Text>
                <Text size="sm">{node.vms} / {node.containers}</Text>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm" c="dimmed">CPU Usage</Text>
                <Text size="sm">{node.cpu.usage}%</Text>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Memory</Text>
                <Text size="sm">
                  {node.memory.percentage}% ({apiService.formatBytes(node.memory.used)})
                </Text>
              </Group>
              
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Storage</Text>
                <Text size="sm">
                  {node.storage.percentage}% ({apiService.formatBytes(node.storage.used)})
                </Text>
              </Group>
              
              {node.uptime > 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Uptime</Text>
                  <Text size="sm">{apiService.formatUptime(node.uptime)}</Text>
                </Group>
              )}
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>

      {/* Recent Activity */}
      <Title order={3} mb="md">Infrastructure Overview</Title>
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500}>Total Resources</Text>
            <Tooltip label="Click to refresh data">
              <ActionIcon variant="subtle" onClick={() => refetch()}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <div>
              <Text size="xl" fw={700} c="blue">
                {summary.vms.total + summary.containers.total}
              </Text>
              <Text size="sm" c="dimmed">
                Total Resources
              </Text>
            </div>
            <div>
              <Text size="xl" fw={700} c="green">
                {summary.vms.running + summary.containers.running}
              </Text>
              <Text size="sm" c="dimmed">
                Running
              </Text>
            </div>
            <div>
              <Text size="xl" fw={700} c="orange">
                {summary.nodes.total}
              </Text>
              <Text size="sm" c="dimmed">
                Cluster Nodes
              </Text>
            </div>
            <div>
              <Text size="xl" fw={700} c="teal">
                {Math.round((summary.resources.memory.used + summary.resources.storage.used) / (1024 * 1024 * 1024))} GB
              </Text>
              <Text size="sm" c="dimmed">
                Resources Used
              </Text>
            </div>
          </SimpleGrid>
        </Stack>
      </Card>
    </div>
  );
};