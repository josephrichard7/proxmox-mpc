import React, { useEffect } from 'react';
import {
  Title,
  Text,
  Group,
  Button,
  Card,
  Stack,
  LoadingOverlay,
  Paper,
  Grid,
  Badge,
  RingProgress,
  SimpleGrid,
  Progress,
  Tooltip,
  ActionIcon,
  Divider,
} from '@mantine/core';
import {
  IconRefresh,
  IconServer,
  IconCpu,
  IconMemory,
  IconHardDrive,
  IconActivity,
  IconClock,
  IconDeviceDesktop,
  IconContainer,
  IconNetwork,
  IconChevronRight,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../stores/WebSocketContext';
import { apiService } from '../../services/ApiService';

interface NodeData {
  name: string;
  status: string;
  type: string;
  online: boolean;
  uptime: number;
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  loadAverage: number[];
  kernelVersion: string;
  proxmoxVersion: string;
  error?: string;
}

interface NodesResponse {
  nodes: NodeData[];
  summary: {
    total: number;
    online: number;
    offline: number;
  };
}

export const NodesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe, isConnected } = useWebSocket();

  // Fetch nodes
  const { 
    data: nodesData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<NodesResponse>({
    queryKey: ['nodes'],
    queryFn: async () => {
      const response = await apiService.getNodes();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch nodes');
      }
      return response.data!;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Subscribe to node updates
  useEffect(() => {
    if (isConnected) {
      subscribe('subscribe:nodes');
      
      return () => {
        unsubscribe('subscribe:nodes');
      };
    }
  }, [isConnected, subscribe, unsubscribe]);

  // Handle real-time updates
  useEffect(() => {
    const handleNodeUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    };

    if (isConnected) {
      // Listen for custom events dispatched by WebSocket context
      window.addEventListener('node:update', handleNodeUpdate);
      window.addEventListener('infrastructure:update', handleNodeUpdate);

      return () => {
        window.removeEventListener('node:update', handleNodeUpdate);
        window.removeEventListener('infrastructure:update', handleNodeUpdate);
      };
    }
  }, [isConnected, queryClient]);

  // Get node status badge props
  const getStatusBadge = (node: NodeData) => {
    if (node.error) {
      return { color: 'red', label: 'Error' };
    }
    switch (node.status.toLowerCase()) {
      case 'online':
        return { color: 'green', label: 'Online' };
      case 'offline':
        return { color: 'gray', label: 'Offline' };
      case 'unknown':
        return { color: 'orange', label: 'Unknown' };
      default:
        return { color: 'blue', label: node.status };
    }
  };

  // Get resource usage color
  const getUsageColor = (percentage: number): string => {
    if (percentage > 90) return 'red';
    if (percentage > 75) return 'orange';
    if (percentage > 50) return 'yellow';
    return 'green';
  };

  // Loading state
  if (isLoading) {
    return (
      <div>
        <Group justify="space-between" mb="xl">
          <div>
            <Title order={2}>Cluster Nodes</Title>
            <Text c="dimmed">Monitor your Proxmox cluster nodes</Text>
          </div>
        </Group>
        <div style={{ position: 'relative', minHeight: '400px' }}>
          <LoadingOverlay visible />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !nodesData) {
    return (
      <div>
        <Group justify="space-between" mb="xl">
          <div>
            <Title order={2}>Cluster Nodes</Title>
            <Text c="dimmed">Monitor your Proxmox cluster nodes</Text>
          </div>
        </Group>
        <Card withBorder p="xl">
          <Stack align="center">
            <Text c="red" size="lg" fw={600}>
              Failed to load nodes
            </Text>
            <Text c="dimmed" ta="center">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </Text>
            <Button onClick={() => refetch()} leftSection={<IconRefresh size={16} />}>
              Retry
            </Button>
          </Stack>
        </Card>
      </div>
    );
  }

  const { nodes, summary } = nodesData;

  return (
    <div>
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Cluster Nodes</Title>
          <Text c="dimmed">
            Monitor your Proxmox cluster nodes
            {summary && (
              <> · {summary.total} nodes ({summary.online} online, {summary.offline} offline)</>
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
            onClick={() => refetch()}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* Cluster Summary */}
      {summary && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
          <Paper withBorder p="md" radius="md">
            <Group>
              <RingProgress
                size={60}
                roundCaps
                thickness={6}
                sections={[{ value: (summary.online / summary.total) * 100, color: 'green' }]}
                label={
                  <div style={{ textAlign: 'center' }}>
                    <IconServer size={16} />
                  </div>
                }
              />
              <div>
                <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                  Cluster Health
                </Text>
                <Text fw={700} size="xl">
                  {Math.round((summary.online / summary.total) * 100)}%
                </Text>
                <Text c="dimmed" size="sm">
                  {summary.online} of {summary.total} online
                </Text>
              </div>
            </Group>
          </Paper>
          
          <Paper withBorder p="md" radius="md">
            <Group>
              <RingProgress
                size={60}
                roundCaps
                thickness={6}
                sections={[{ 
                  value: nodes.length > 0 ? (nodes.reduce((sum, node) => sum + node.cpu, 0) / nodes.length) : 0, 
                  color: 'blue' 
                }]}
                label={
                  <div style={{ textAlign: 'center' }}>
                    <IconCpu size={16} />
                  </div>
                }
              />
              <div>
                <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                  Average CPU
                </Text>
                <Text fw={700} size="xl">
                  {nodes.length > 0 ? Math.round(nodes.reduce((sum, node) => sum + node.cpu, 0) / nodes.length) : 0}%
                </Text>
                <Text c="dimmed" size="sm">
                  Cluster average
                </Text>
              </div>
            </Group>
          </Paper>
          
          <Paper withBorder p="md" radius="md">
            <Group>
              <RingProgress
                size={60}
                roundCaps
                thickness={6}
                sections={[{ 
                  value: nodes.length > 0 ? (nodes.reduce((sum, node) => sum + node.memory.percentage, 0) / nodes.length) : 0, 
                  color: 'teal' 
                }]}
                label={
                  <div style={{ textAlign: 'center' }}>
                    <IconMemory size={16} />
                  </div>
                }
              />
              <div>
                <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                  Average Memory
                </Text>
                <Text fw={700} size="xl">
                  {nodes.length > 0 ? Math.round(nodes.reduce((sum, node) => sum + node.memory.percentage, 0) / nodes.length) : 0}%
                </Text>
                <Text c="dimmed" size="sm">
                  Cluster average
                </Text>
              </div>
            </Group>
          </Paper>
        </SimpleGrid>
      )}

      {/* Node Cards */}
      {nodes.length > 0 ? (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {nodes.map((node) => {
            const statusBadge = getStatusBadge(node);
            
            return (
              <Card
                key={node.name}
                withBorder
                padding="lg"
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onClick={() => navigate(`/nodes/${node.name}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <Group justify="space-between" mb="md">
                  <Group>
                    <IconServer size={24} />
                    <div>
                      <Text fw={600} size="lg">{node.name}</Text>
                      <Badge color={statusBadge.color} variant="light" size="sm">
                        {statusBadge.label}
                      </Badge>
                    </div>
                  </Group>
                  <Group>
                    {node.uptime > 0 && (
                      <Tooltip label={`Uptime: ${apiService.formatUptime(node.uptime)}`}>
                        <ActionIcon variant="subtle" size="sm">
                          <IconClock size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <ActionIcon variant="subtle" size="sm">
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                </Group>

                {node.error ? (
                  <Text c="red" size="sm" mb="md">
                    Error: {node.error}
                  </Text>
                ) : (
                  <>
                    {/* Resource Usage */}
                    <Stack gap="sm" mb="md">
                      {/* CPU Usage */}
                      <div>
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <IconCpu size={16} />
                            <Text size="sm" fw={500}>CPU Usage</Text>
                          </Group>
                          <Text size="sm" c="dimmed">{node.cpu.toFixed(1)}%</Text>
                        </Group>
                        <Progress
                          value={node.cpu}
                          color={getUsageColor(node.cpu)}
                          size="sm"
                        />
                      </div>

                      {/* Memory Usage */}
                      <div>
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <IconMemory size={16} />
                            <Text size="sm" fw={500}>Memory Usage</Text>
                          </Group>
                          <Text size="sm" c="dimmed">
                            {node.memory.percentage}% ({apiService.formatBytes(node.memory.used)} / {apiService.formatBytes(node.memory.total)})
                          </Text>
                        </Group>
                        <Progress
                          value={node.memory.percentage}
                          color={getUsageColor(node.memory.percentage)}
                          size="sm"
                        />
                      </div>

                      {/* Storage Usage */}
                      <div>
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <IconHardDrive size={16} />
                            <Text size="sm" fw={500}>Storage Usage</Text>
                          </Group>
                          <Text size="sm" c="dimmed">
                            {node.storage.percentage}% ({apiService.formatBytes(node.storage.used)} / {apiService.formatBytes(node.storage.total)})
                          </Text>
                        </Group>
                        <Progress
                          value={node.storage.percentage}
                          color={getUsageColor(node.storage.percentage)}
                          size="sm"
                        />
                      </div>
                    </Stack>

                    {/* Load Average */}
                    {node.loadAverage && node.loadAverage.length > 0 && (
                      <div>
                        <Group gap="xs" mb="xs">
                          <IconActivity size={16} />
                          <Text size="sm" fw={500}>Load Average</Text>
                        </Group>
                        <Group gap="md">
                          <div>
                            <Text size="xs" c="dimmed">1m</Text>
                            <Text size="sm" fw={600}>{node.loadAverage[0]?.toFixed(2) || '0.00'}</Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">5m</Text>
                            <Text size="sm" fw={600}>{node.loadAverage[1]?.toFixed(2) || '0.00'}</Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">15m</Text>
                            <Text size="sm" fw={600}>{node.loadAverage[2]?.toFixed(2) || '0.00'}</Text>
                          </div>
                        </Group>
                      </div>
                    )}
                  </>
                )}

                <Divider mt="md" mb="sm" />

                {/* Version Info */}
                <Group justify="space-between" align="center">
                  <div>
                    {node.kernelVersion && (
                      <Text size="xs" c="dimmed">Kernel: {node.kernelVersion}</Text>
                    )}
                    {node.proxmoxVersion && (
                      <Text size="xs" c="dimmed">Proxmox: {node.proxmoxVersion}</Text>
                    )}
                  </div>
                  <Group gap="xs">
                    <Tooltip label="View VMs">
                      <ActionIcon variant="subtle" size="sm">
                        <IconDeviceDesktop size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="View Containers">
                      <ActionIcon variant="subtle" size="sm">
                        <IconContainer size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Network Info">
                      <ActionIcon variant="subtle" size="sm">
                        <IconNetwork size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
      ) : (
        <Card withBorder>
          <Stack align="center" py="xl">
            <Text size="lg" fw={600}>No Nodes Found</Text>
            <Text c="dimmed" ta="center">
              No cluster nodes are currently available. Check your Proxmox server connection.
            </Text>
            <Button leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
              Refresh
            </Button>
          </Stack>
        </Card>
      )}
    </div>
  );
};