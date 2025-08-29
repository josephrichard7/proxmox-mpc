import { useState, useEffect } from 'react';
import {
  Container,
  Stack,
  Title,
  Text,
  Alert,
  LoadingOverlay,
  Tabs,
  Grid,
  Card,
  Group,
  Badge,
  Button,
} from '@mantine/core';
import {
  IconTopology,
  IconServer,
  IconContainer,
  IconNetworking,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { NetworkTopology, NetworkNode, NetworkLink } from '../components/visualization/NetworkTopology';
import { apiService } from '../services/ApiService';

/**
 * Visualization page for infrastructure topology and monitoring
 * Provides network topology visualization and infrastructure insights
 */
export function VisualizationPage() {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);

  // Fetch infrastructure data for visualization
  const {
    data: infrastructureStatus,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['infrastructure-status-viz'],
    queryFn: async () => {
      const response = await apiService.getInfrastructureStatus();
      return response;
    },
  });

  // Fetch VMs
  const {
    data: vmsResponse,
    isLoading: vmsLoading,
  } = useQuery({
    queryKey: ['vms-viz'],
    queryFn: async () => {
      const response = await apiService.getVMs();
      return response;
    },
  });

  // Fetch Containers
  const {
    data: containersResponse,
    isLoading: containersLoading,
  } = useQuery({
    queryKey: ['containers-viz'],
    queryFn: async () => {
      const response = await apiService.getContainers();
      return response;
    },
  });

  // Transform data into network topology format
  useEffect(() => {
    if (!infrastructureStatus?.success) return;

    const networkNodes: NetworkNode[] = [];
    const networkLinks: NetworkLink[] = [];

    // Add cluster nodes
    if (infrastructureStatus.data?.nodes) {
      infrastructureStatus.data.nodes.forEach((node, index) => {
        networkNodes.push({
          id: `node-${node.name}`,
          name: node.name,
          type: 'node',
          status: node.status === 'online' ? 'online' : 'offline',
          group: 0,
          properties: {
            cpu: node.cpu.usage,
            memory: node.memory.used,
            storage: node.storage.used,
            uptime: node.uptime,
          },
        });
      });
    }

    // Add VMs
    if (vmsResponse?.success && vmsResponse.data?.vms) {
      vmsResponse.data.vms.forEach((vm) => {
        networkNodes.push({
          id: `vm-${vm.id}`,
          name: vm.name,
          type: 'vm',
          status: vm.status as any,
          group: 1,
          properties: {
            cpu: vm.cpuUsage,
            memory: vm.memory,
            uptime: vm.uptime,
          },
        });

        // Create link to node
        const nodeId = `node-${vm.node}`;
        if (networkNodes.find(n => n.id === nodeId)) {
          networkLinks.push({
            source: nodeId,
            target: `vm-${vm.id}`,
            type: 'virtual',
            strength: 1,
            properties: {},
          });
        }
      });
    }

    // Add Containers
    if (containersResponse?.success && containersResponse.data?.containers) {
      containersResponse.data.containers.forEach((container) => {
        networkNodes.push({
          id: `container-${container.id}`,
          name: container.name,
          type: 'container',
          status: container.status as any,
          group: 2,
          properties: {
            cpu: container.cpuUsage,
            memory: container.memory,
            uptime: container.uptime,
          },
        });

        // Create link to node
        const nodeId = `node-${container.node}`;
        if (networkNodes.find(n => n.id === nodeId)) {
          networkLinks.push({
            source: nodeId,
            target: `container-${container.id}`,
            type: 'virtual',
            strength: 0.8,
            properties: {},
          });
        }
      });
    }

    // Add some mock network and storage nodes for demonstration
    networkNodes.push(
      {
        id: 'network-vmbr0',
        name: 'vmbr0',
        type: 'network',
        status: 'online',
        group: 3,
        properties: {
          network: '192.168.1.0/24',
        },
      },
      {
        id: 'storage-local',
        name: 'Local Storage',
        type: 'storage',
        status: 'online',
        group: 4,
        properties: {
          storage: 500000, // 500GB in MB
        },
      }
    );

    // Create links from nodes to network and storage
    if (infrastructureStatus.data?.nodes) {
      infrastructureStatus.data.nodes.forEach((node) => {
        const nodeId = `node-${node.name}`;
        
        // Link to network
        networkLinks.push({
          source: nodeId,
          target: 'network-vmbr0',
          type: 'network',
          strength: 0.6,
          properties: {
            bandwidth: '1Gbps',
          },
        });

        // Link to storage
        networkLinks.push({
          source: nodeId,
          target: 'storage-local',
          type: 'storage',
          strength: 0.5,
          properties: {
            protocol: 'Local',
          },
        });
      });
    }

    setNodes(networkNodes);
    setLinks(networkLinks);
  }, [infrastructureStatus, vmsResponse, containersResponse]);

  const handleNodeSelect = (node: NetworkNode) => {
    console.log('Selected node:', node);
  };

  const handleRefresh = () => {
    refetchStatus();
  };

  const isLoading = statusLoading || vmsLoading || containersLoading;

  // Calculate statistics
  const stats = {
    totalNodes: nodes.length,
    onlineNodes: nodes.filter(n => n.status === 'online' || n.status === 'running').length,
    offlineNodes: nodes.filter(n => n.status === 'offline' || n.status === 'stopped').length,
    errorNodes: nodes.filter(n => n.status === 'error').length,
    totalLinks: links.length,
  };

  const nodeTypeStats = {
    nodes: nodes.filter(n => n.type === 'node').length,
    vms: nodes.filter(n => n.type === 'vm').length,
    containers: nodes.filter(n => n.type === 'container').length,
    networks: nodes.filter(n => n.type === 'network').length,
    storage: nodes.filter(n => n.type === 'storage').length,
  };

  if (isLoading) {
    return (
      <Container fluid style={{ position: 'relative', minHeight: 400 }}>
        <LoadingOverlay visible />
      </Container>
    );
  }

  return (
    <Container fluid>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconTopology size={28} />
              Infrastructure Visualization
            </Title>
            <Text c="dimmed" size="sm">
              Interactive network topology and infrastructure monitoring visualization
            </Text>
          </div>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={handleRefresh}
            loading={isLoading}
          >
            Refresh Data
          </Button>
        </Group>

        {/* Error Alert */}
        {statusError && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Data"
            color="red"
          >
            Failed to load infrastructure data for visualization: {statusError.message}
          </Alert>
        )}

        {/* Statistics Cards */}
        <Grid>
          <Grid.Col span={2}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Total Resources
                  </Text>
                  <Text fw={700} size="xl">
                    {stats.totalNodes}
                  </Text>
                </div>
                <IconServer size={24} color="blue" />
              </Group>
            </Card>
          </Grid.Col>
          
          <Grid.Col span={2}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Online
                  </Text>
                  <Text fw={700} size="xl" c="green">
                    {stats.onlineNodes}
                  </Text>
                </div>
                <Badge color="green" variant="light" size="lg">
                  {stats.totalNodes > 0 ? Math.round((stats.onlineNodes / stats.totalNodes) * 100) : 0}%
                </Badge>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={2}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Virtual Machines
                  </Text>
                  <Text fw={700} size="xl">
                    {nodeTypeStats.vms}
                  </Text>
                </div>
                <IconServer size={24} color="green" />
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={2}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Containers
                  </Text>
                  <Text fw={700} size="xl">
                    {nodeTypeStats.containers}
                  </Text>
                </div>
                <IconContainer size={24} color="red" />
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={2}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Connections
                  </Text>
                  <Text fw={700} size="xl">
                    {stats.totalLinks}
                  </Text>
                </div>
                <IconNetworking size={24} color="orange" />
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={2}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Errors
                  </Text>
                  <Text fw={700} size="xl" c={stats.errorNodes > 0 ? "red" : "gray"}>
                    {stats.errorNodes}
                  </Text>
                </div>
                <Badge 
                  color={stats.errorNodes > 0 ? "red" : "gray"} 
                  variant="light" 
                  size="lg"
                >
                  {stats.errorNodes > 0 ? "Issues" : "OK"}
                </Badge>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Network Topology Tabs */}
        <Tabs defaultValue="topology">
          <Tabs.List>
            <Tabs.Tab value="topology" leftSection={<IconTopology size={16} />}>
              Network Topology
            </Tabs.Tab>
            <Tabs.Tab value="monitoring" leftSection={<IconServer size={16} />}>
              Resource Monitoring
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="topology" pt="xl">
            {nodes.length === 0 ? (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="No Infrastructure Data"
                color="blue"
              >
                <Text size="sm">
                  No infrastructure data available for visualization. 
                  Ensure your Proxmox infrastructure is synchronized and contains resources.
                </Text>
                <Button
                  variant="light"
                  size="sm"
                  mt="sm"
                  onClick={handleRefresh}
                >
                  Refresh Data
                </Button>
              </Alert>
            ) : (
              <NetworkTopology
                nodes={nodes}
                links={links}
                width={1200}
                height={700}
                interactive={true}
                onNodeSelect={handleNodeSelect}
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="monitoring" pt="xl">
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Resource Monitoring"
              color="blue"
            >
              <Text size="sm">
                Real-time resource monitoring charts and metrics will be available here.
                This feature is planned for future implementation.
              </Text>
            </Alert>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}