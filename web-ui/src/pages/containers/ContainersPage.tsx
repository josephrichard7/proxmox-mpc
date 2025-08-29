import React, { useState, useEffect } from 'react';
import {
  Title,
  Text,
  Group,
  Button,
  Table,
  Badge,
  ActionIcon,
  Menu,
  TextInput,
  Select,
  Pagination,
  Card,
  Stack,
  LoadingOverlay,
  Modal,
  Paper,
  Grid,
  NumberInput,
  Textarea,
  MultiSelect,
  Switch,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefreshDot,
  IconTrash,
  IconEdit,
  IconDots,
  IconCpu,
  IconMemory,
  IconHardDrive,
  IconServer,
  IconContainer,
} from '@tabler/icons-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useWebSocket } from '../../stores/WebSocketContext';
import { apiService, Container, CreateContainerRequest, ListQueryParams } from '../../services/ApiService';

export const ContainersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe, isConnected } = useWebSocket();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [nodeFilter, setNodeFilter] = useState<string>('');
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());

  const limit = 10;

  // Build query parameters
  const queryParams: ListQueryParams = {
    page,
    limit,
    search: search || undefined,
    status: statusFilter || undefined,
    node: nodeFilter || undefined,
    sort: 'name',
    order: 'asc',
  };

  // Fetch Containers
  const { 
    data: containerData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['containers', queryParams],
    queryFn: async () => {
      const response = await apiService.getContainers(queryParams);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch containers');
      }
      return response.data!;
    },
    staleTime: 10000,
  });

  // Subscribe to container updates
  useEffect(() => {
    if (isConnected) {
      subscribe('subscribe:containers');
      
      return () => {
        unsubscribe('subscribe:containers');
      };
    }
  }, [isConnected, subscribe, unsubscribe]);

  // Handle real-time updates
  useEffect(() => {
    const handleContainerUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    };

    if (isConnected) {
      // Listen for custom events dispatched by WebSocket context
      window.addEventListener('container:update', handleContainerUpdate);
      window.addEventListener('infrastructure:update', handleContainerUpdate);

      return () => {
        window.removeEventListener('container:update', handleContainerUpdate);
        window.removeEventListener('infrastructure:update', handleContainerUpdate);
      };
    }
  }, [isConnected, queryClient]);

  // Check if create modal should be opened from URL params
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      openCreateModal();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, openCreateModal, setSearchParams]);

  // Container form
  const containerForm = useForm<CreateContainerRequest>({
    initialValues: {
      name: '',
      description: '',
      node: '',
      template: '',
      memory: 1024,
      disk: 16,
      tags: [],
      unprivileged: true,
      protection: false,
      startOnBoot: false,
    },
    validate: {
      name: (value) => (!value ? 'Container name is required' : null),
      node: (value) => (!value ? 'Node is required' : null),
      template: (value) => (!value ? 'Template is required' : null),
      memory: (value) => (value < 256 ? 'Memory must be at least 256 MB' : null),
    },
  });

  // Create Container mutation
  const createContainerMutation = useMutation({
    mutationFn: async (data: CreateContainerRequest) => {
      const response = await apiService.createContainer(data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create container');
      }
      return response.data!;
    },
    onSuccess: () => {
      notifications.show({
        title: 'Container Created',
        message: 'Container created successfully',
        color: 'green',
      });
      closeCreateModal();
      containerForm.reset();
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
    onError: (error) => {
      notifications.show({
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'Failed to create container',
        color: 'red',
      });
    },
  });

  // Container action mutations
  const startContainerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiService.startContainer(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to start container');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });

  const stopContainerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiService.stopContainer(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to stop container');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });

  const restartContainerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiService.restartContainer(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to restart container');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });

  const deleteContainerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiService.deleteContainer(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete container');
      }
    },
    onSuccess: () => {
      notifications.show({
        title: 'Container Deleted',
        message: 'Container deleted successfully',
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
    onError: (error) => {
      notifications.show({
        title: 'Deletion Failed',
        message: error instanceof Error ? error.message : 'Failed to delete container',
        color: 'red',
      });
    },
  });

  // Handle form submission
  const handleCreateContainer = (values: CreateContainerRequest) => {
    createContainerMutation.mutate(values);
  };

  // Handle container actions
  const handleContainerAction = (action: 'start' | 'stop' | 'restart' | 'delete', containerId: string, containerName: string) => {
    const confirmAction = () => {
      switch (action) {
        case 'start':
          startContainerMutation.mutate(containerId);
          break;
        case 'stop':
          stopContainerMutation.mutate(containerId);
          break;
        case 'restart':
          restartContainerMutation.mutate(containerId);
          break;
        case 'delete':
          if (window.confirm(`Are you sure you want to delete container "${containerName}"? This action cannot be undone.`)) {
            deleteContainerMutation.mutate(containerId);
          }
          break;
      }
    };

    confirmAction();
  };

  // Handle bulk actions
  const handleBulkAction = (action: 'start' | 'stop' | 'delete') => {
    if (selectedContainers.size === 0) return;

    const containerIds = Array.from(selectedContainers);
    const confirmMessage = `Are you sure you want to ${action} ${containerIds.length} container(s)?`;
    
    if (window.confirm(confirmMessage)) {
      containerIds.forEach(containerId => {
        switch (action) {
          case 'start':
            startContainerMutation.mutate(containerId);
            break;
          case 'stop':
            stopContainerMutation.mutate(containerId);
            break;
          case 'delete':
            deleteContainerMutation.mutate(containerId);
            break;
        }
      });
      setSelectedContainers(new Set());
    }
  };

  // Handle search and filters
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilterChange = (filterType: 'status' | 'node', value: string) => {
    if (filterType === 'status') {
      setStatusFilter(value);
    } else {
      setNodeFilter(value);
    }
    setPage(1);
  };

  // Get container status badge props
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return { color: 'green', label: 'Running' };
      case 'stopped':
        return { color: 'gray', label: 'Stopped' };
      case 'paused':
        return { color: 'orange', label: 'Paused' };
      default:
        return { color: 'blue', label: status };
    }
  };

  // Available nodes and templates (mock data - in real app, fetch from API)
  const availableNodes = ['pve', 'node-1', 'node-2'];
  const availableTemplates = [
    'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
    'local:vztmpl/debian-11-standard_11.7-1_amd64.tar.zst',
    'local:vztmpl/alpine-3.18-default_20230607_amd64.tar.xz',
  ];

  return (
    <div>
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Containers</Title>
          <Text c="dimmed">
            Manage your LXC containers
            {containerData && (
              <> · {containerData.containers.length} of {containerData.pagination.total} containers</>
            )}
          </Text>
        </div>
        
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={() => refetch()}
            loading={isLoading}
          >
            Refresh
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openCreateModal}
          >
            Create Container
          </Button>
        </Group>
      </Group>

      {/* Filters and Search */}
      <Paper withBorder p="md" mb="xl">
        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              placeholder="Search containers..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 2 }}>
            <Select
              placeholder="Status"
              data={['running', 'stopped', 'paused']}
              value={statusFilter}
              onChange={(value) => handleFilterChange('status', value || '')}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 2 }}>
            <Select
              placeholder="Node"
              data={availableNodes}
              value={nodeFilter}
              onChange={(value) => handleFilterChange('node', value || '')}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Group>
              {selectedContainers.size > 0 && (
                <>
                  <Text size="sm">{selectedContainers.size} selected</Text>
                  <Button.Group>
                    <Button size="xs" variant="light" onClick={() => handleBulkAction('start')}>
                      Start
                    </Button>
                    <Button size="xs" variant="light" onClick={() => handleBulkAction('stop')}>
                      Stop
                    </Button>
                    <Button size="xs" variant="light" color="red" onClick={() => handleBulkAction('delete')}>
                      Delete
                    </Button>
                  </Button.Group>
                </>
              )}
            </Group>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Container Table */}
      <Card withBorder>
        <div style={{ position: 'relative', minHeight: isLoading ? '200px' : 'auto' }}>
          <LoadingOverlay visible={isLoading} />
          
          {error ? (
            <Stack align="center" py="xl">
              <Text c="red" size="lg" fw={600}>
                Failed to load containers
              </Text>
              <Text c="dimmed" ta="center">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </Text>
              <Button onClick={() => refetch()} leftSection={<IconRefresh size={16} />}>
                Retry
              </Button>
            </Stack>
          ) : containerData && containerData.containers.length > 0 ? (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      <input
                        type="checkbox"
                        checked={selectedContainers.size === containerData.containers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContainers(new Set(containerData.containers.map(container => container.id.toString())));
                          } else {
                            setSelectedContainers(new Set());
                          }
                        }}
                      />
                    </Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Node</Table.Th>
                    <Table.Th>Resources</Table.Th>
                    <Table.Th>Uptime</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {containerData.containers.map((container) => {
                    const statusBadge = getStatusBadge(container.status);
                    return (
                      <Table.Tr key={container.id}>
                        <Table.Td>
                          <input
                            type="checkbox"
                            checked={selectedContainers.has(container.id.toString())}
                            onChange={(e) => {
                              const newSelected = new Set(selectedContainers);
                              if (e.target.checked) {
                                newSelected.add(container.id.toString());
                              } else {
                                newSelected.delete(container.id.toString());
                              }
                              setSelectedContainers(newSelected);
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <div>
                            <Text fw={600}>{container.name}</Text>
                            {container.description && (
                              <Text size="sm" c="dimmed">{container.description}</Text>
                            )}
                            {container.tags.length > 0 && (
                              <Group gap="xs" mt="xs">
                                {container.tags.slice(0, 3).map(tag => (
                                  <Badge key={tag} size="sm" variant="outline">
                                    {tag}
                                  </Badge>
                                ))}
                                {container.tags.length > 3 && (
                                  <Badge size="sm" variant="outline">
                                    +{container.tags.length - 3}
                                  </Badge>
                                )}
                              </Group>
                            )}
                            {container.unprivileged && (
                              <Badge size="sm" variant="light" color="blue" mt="xs">
                                Unprivileged
                              </Badge>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={statusBadge.color} variant="light">
                            {statusBadge.label}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <IconServer size={16} />
                            <Text size="sm">{container.node}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap="xs">
                            <Group gap="xs">
                              <IconMemory size={14} />
                              <Text size="sm">{apiService.formatBytes(container.memory * 1024 * 1024)} ({container.memoryUsage}%)</Text>
                            </Group>
                            <Group gap="xs">
                              <IconHardDrive size={14} />
                              <Text size="sm">{apiService.formatBytes(container.disk * 1024 * 1024 * 1024)} ({container.diskUsage}%)</Text>
                            </Group>
                            <Group gap="xs">
                              <IconContainer size={14} />
                              <Text size="sm">{container.template}</Text>
                            </Group>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {container.uptime > 0 ? apiService.formatUptime(container.uptime) : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Tooltip label="Start Container">
                              <ActionIcon
                                variant="light"
                                color="green"
                                disabled={container.status === 'running'}
                                onClick={() => handleContainerAction('start', container.id.toString(), container.name)}
                                loading={startContainerMutation.isPending}
                              >
                                <IconPlayerPlay size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Stop Container">
                              <ActionIcon
                                variant="light"
                                color="red"
                                disabled={container.status === 'stopped'}
                                onClick={() => handleContainerAction('stop', container.id.toString(), container.name)}
                                loading={stopContainerMutation.isPending}
                              >
                                <IconPlayerStop size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Restart Container">
                              <ActionIcon
                                variant="light"
                                color="orange"
                                disabled={container.status === 'stopped'}
                                onClick={() => handleContainerAction('restart', container.id.toString(), container.name)}
                                loading={restartContainerMutation.isPending}
                              >
                                <IconRefreshDot size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Menu withinPortal>
                              <Menu.Target>
                                <ActionIcon variant="light">
                                  <IconDots size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item 
                                  leftSection={<IconEdit size={14} />}
                                  onClick={() => navigate(`/containers/${container.id}`)}
                                >
                                  View Details
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item 
                                  leftSection={<IconTrash size={14} />}
                                  color="red"
                                  onClick={() => handleContainerAction('delete', container.id.toString(), container.name)}
                                  disabled={container.protection}
                                >
                                  Delete Container
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>

              {/* Pagination */}
              <Group justify="center" mt="md">
                <Pagination
                  value={page}
                  onChange={setPage}
                  total={containerData.pagination.totalPages}
                />
              </Group>
            </>
          ) : (
            <Stack align="center" py="xl">
              <Text size="lg" fw={600}>No Containers Found</Text>
              <Text c="dimmed" ta="center">
                {search || statusFilter || nodeFilter
                  ? 'No containers match your current filters'
                  : 'Get started by creating your first container'
                }
              </Text>
              <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
                Create Container
              </Button>
            </Stack>
          )}
        </div>
      </Card>

      {/* Create Container Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Create Container"
        size="lg"
      >
        <form onSubmit={containerForm.onSubmit(handleCreateContainer)}>
          <Stack>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Container Name"
                  placeholder="Enter container name"
                  required
                  {...containerForm.getInputProps('name')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Node"
                  placeholder="Select node"
                  data={availableNodes}
                  required
                  {...containerForm.getInputProps('node')}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Description"
                  placeholder="Enter container description"
                  {...containerForm.getInputProps('description')}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Select
                  label="Template"
                  placeholder="Select OS template"
                  data={availableTemplates.map(template => ({
                    value: template,
                    label: template.split('/').pop()?.split('.')[0] || template
                  }))}
                  required
                  {...containerForm.getInputProps('template')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Memory (MB)"
                  min={256}
                  step={256}
                  required
                  {...containerForm.getInputProps('memory')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Disk Size (GB)"
                  min={4}
                  step={4}
                  {...containerForm.getInputProps('disk')}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <MultiSelect
                  label="Tags"
                  placeholder="Add tags"
                  data={[]}
                  searchable
                  creatable
                  getCreateLabel={(query) => `+ Create ${query}`}
                  onCreate={(query) => {
                    const item = { value: query, label: query };
                    return item;
                  }}
                  {...containerForm.getInputProps('tags')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Switch
                  label="Unprivileged"
                  description="Run as unprivileged container (recommended)"
                  {...containerForm.getInputProps('unprivileged', { type: 'checkbox' })}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Switch
                  label="Start on Boot"
                  description="Automatically start container when node boots"
                  {...containerForm.getInputProps('startOnBoot', { type: 'checkbox' })}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Switch
                  label="Protection"
                  description="Prevent accidental deletion"
                  {...containerForm.getInputProps('protection', { type: 'checkbox' })}
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                loading={createContainerMutation.isPending}
              >
                Create Container
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </div>
  );
};