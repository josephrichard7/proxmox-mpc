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
  IconFilter,
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
} from '@tabler/icons-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useWebSocket } from '../../stores/WebSocketContext';
import { apiService, VM, CreateVMRequest, ListQueryParams } from '../../services/ApiService';

export const VMsPage: React.FC = () => {
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
  const [selectedVMs, setSelectedVMs] = useState<Set<string>>(new Set());

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

  // Fetch VMs
  const { 
    data: vmData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['vms', queryParams],
    queryFn: async () => {
      const response = await apiService.getVMs(queryParams);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch VMs');
      }
      return response.data!;
    },
    staleTime: 10000,
  });

  // Subscribe to VM updates
  useEffect(() => {
    if (isConnected) {
      subscribe('subscribe:vms');
      
      return () => {
        unsubscribe('subscribe:vms');
      };
    }
  }, [isConnected, subscribe, unsubscribe]);

  // Handle real-time updates
  useEffect(() => {
    const handleVMUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] });
    };

    if (isConnected) {
      // Listen for custom events dispatched by WebSocket context
      window.addEventListener('vm:update', handleVMUpdate);
      window.addEventListener('infrastructure:update', handleVMUpdate);

      return () => {
        window.removeEventListener('vm:update', handleVMUpdate);
        window.removeEventListener('infrastructure:update', handleVMUpdate);
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

  // VM form
  const vmForm = useForm<CreateVMRequest>({
    initialValues: {
      name: '',
      description: '',
      node: '',
      memory: 2048,
      cores: 2,
      disk: 32,
      template: '',
      tags: [],
      startOnBoot: false,
      protection: false,
    },
    validate: {
      name: (value) => (!value ? 'VM name is required' : null),
      node: (value) => (!value ? 'Node is required' : null),
      memory: (value) => (value < 512 ? 'Memory must be at least 512 MB' : null),
      cores: (value) => (value < 1 ? 'Cores must be at least 1' : null),
    },
  });

  // Create VM mutation
  const createVMMutation = useMutation({
    mutationFn: async (data: CreateVMRequest) => {
      const response = await apiService.createVM(data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create VM');
      }
      return response.data!;
    },
    onSuccess: () => {
      notifications.show({
        title: 'VM Created',
        message: 'Virtual machine created successfully',
        color: 'green',
      });
      closeCreateModal();
      vmForm.reset();
      queryClient.invalidateQueries({ queryKey: ['vms'] });
    },
    onError: (error) => {
      notifications.show({
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'Failed to create VM',
        color: 'red',
      });
    },
  });

  // VM action mutations
  const startVMMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiService.startVM(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to start VM');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] });
    },
  });

  const stopVMMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiService.stopVM(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to stop VM');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] });
    },
  });

  const restartVMMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiService.restartVM(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to restart VM');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] });
    },
  });

  const deleteVMMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiService.deleteVM(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete VM');
      }
    },
    onSuccess: () => {
      notifications.show({
        title: 'VM Deleted',
        message: 'Virtual machine deleted successfully',
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['vms'] });
    },
    onError: (error) => {
      notifications.show({
        title: 'Deletion Failed',
        message: error instanceof Error ? error.message : 'Failed to delete VM',
        color: 'red',
      });
    },
  });

  // Handle form submission
  const handleCreateVM = (values: CreateVMRequest) => {
    createVMMutation.mutate(values);
  };

  // Handle VM actions
  const handleVMAction = (action: 'start' | 'stop' | 'restart' | 'delete', vmId: string, vmName: string) => {
    const confirmAction = () => {
      switch (action) {
        case 'start':
          startVMMutation.mutate(vmId);
          break;
        case 'stop':
          stopVMMutation.mutate(vmId);
          break;
        case 'restart':
          restartVMMutation.mutate(vmId);
          break;
        case 'delete':
          if (window.confirm(`Are you sure you want to delete VM "${vmName}"? This action cannot be undone.`)) {
            deleteVMMutation.mutate(vmId);
          }
          break;
      }
    };

    confirmAction();
  };

  // Handle bulk actions
  const handleBulkAction = (action: 'start' | 'stop' | 'delete') => {
    if (selectedVMs.size === 0) return;

    const vmIds = Array.from(selectedVMs);
    const confirmMessage = `Are you sure you want to ${action} ${vmIds.length} VM(s)?`;
    
    if (window.confirm(confirmMessage)) {
      vmIds.forEach(vmId => {
        switch (action) {
          case 'start':
            startVMMutation.mutate(vmId);
            break;
          case 'stop':
            stopVMMutation.mutate(vmId);
            break;
          case 'delete':
            deleteVMMutation.mutate(vmId);
            break;
        }
      });
      setSelectedVMs(new Set());
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

  // Get VM status badge props
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

  // Available nodes for dropdown (mock data - in real app, fetch from API)
  const availableNodes = ['pve', 'node-1', 'node-2'];
  const availableTemplates = ['ubuntu-20.04', 'debian-11', 'centos-8'];

  return (
    <div>
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Virtual Machines</Title>
          <Text c="dimmed">
            Manage your virtual machines
            {vmData && (
              <> · {vmData.vms.length} of {vmData.pagination.total} VMs</>
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
            Create VM
          </Button>
        </Group>
      </Group>

      {/* Filters and Search */}
      <Paper withBorder p="md" mb="xl">
        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              placeholder="Search VMs..."
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
              {selectedVMs.size > 0 && (
                <>
                  <Text size="sm">{selectedVMs.size} selected</Text>
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

      {/* VM Table */}
      <Card withBorder>
        <div style={{ position: 'relative', minHeight: isLoading ? '200px' : 'auto' }}>
          <LoadingOverlay visible={isLoading} />
          
          {error ? (
            <Stack align="center" py="xl">
              <Text c="red" size="lg" fw={600}>
                Failed to load VMs
              </Text>
              <Text c="dimmed" ta="center">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </Text>
              <Button onClick={() => refetch()} leftSection={<IconRefresh size={16} />}>
                Retry
              </Button>
            </Stack>
          ) : vmData && vmData.vms.length > 0 ? (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      <input
                        type="checkbox"
                        checked={selectedVMs.size === vmData.vms.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVMs(new Set(vmData.vms.map(vm => vm.id.toString())));
                          } else {
                            setSelectedVMs(new Set());
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
                  {vmData.vms.map((vm) => {
                    const statusBadge = getStatusBadge(vm.status);
                    return (
                      <Table.Tr key={vm.id}>
                        <Table.Td>
                          <input
                            type="checkbox"
                            checked={selectedVMs.has(vm.id.toString())}
                            onChange={(e) => {
                              const newSelected = new Set(selectedVMs);
                              if (e.target.checked) {
                                newSelected.add(vm.id.toString());
                              } else {
                                newSelected.delete(vm.id.toString());
                              }
                              setSelectedVMs(newSelected);
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <div>
                            <Text fw={600}>{vm.name}</Text>
                            {vm.description && (
                              <Text size="sm" c="dimmed">{vm.description}</Text>
                            )}
                            {vm.tags.length > 0 && (
                              <Group gap="xs" mt="xs">
                                {vm.tags.slice(0, 3).map(tag => (
                                  <Badge key={tag} size="sm" variant="outline">
                                    {tag}
                                  </Badge>
                                ))}
                                {vm.tags.length > 3 && (
                                  <Badge size="sm" variant="outline">
                                    +{vm.tags.length - 3}
                                  </Badge>
                                )}
                              </Group>
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
                            <Text size="sm">{vm.node}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap="xs">
                            <Group gap="xs">
                              <IconCpu size={14} />
                              <Text size="sm">{vm.cores} cores ({vm.cpuUsage}%)</Text>
                            </Group>
                            <Group gap="xs">
                              <IconMemory size={14} />
                              <Text size="sm">{apiService.formatBytes(vm.memory * 1024 * 1024)} ({vm.memoryUsage}%)</Text>
                            </Group>
                            <Group gap="xs">
                              <IconHardDrive size={14} />
                              <Text size="sm">{apiService.formatBytes(vm.disk * 1024 * 1024 * 1024)}</Text>
                            </Group>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {vm.uptime > 0 ? apiService.formatUptime(vm.uptime) : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Tooltip label="Start VM">
                              <ActionIcon
                                variant="light"
                                color="green"
                                disabled={vm.status === 'running'}
                                onClick={() => handleVMAction('start', vm.id.toString(), vm.name)}
                                loading={startVMMutation.isPending}
                              >
                                <IconPlayerPlay size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Stop VM">
                              <ActionIcon
                                variant="light"
                                color="red"
                                disabled={vm.status === 'stopped'}
                                onClick={() => handleVMAction('stop', vm.id.toString(), vm.name)}
                                loading={stopVMMutation.isPending}
                              >
                                <IconPlayerStop size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Restart VM">
                              <ActionIcon
                                variant="light"
                                color="orange"
                                disabled={vm.status === 'stopped'}
                                onClick={() => handleVMAction('restart', vm.id.toString(), vm.name)}
                                loading={restartVMMutation.isPending}
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
                                  onClick={() => navigate(`/vms/${vm.id}`)}
                                >
                                  View Details
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item 
                                  leftSection={<IconTrash size={14} />}
                                  color="red"
                                  onClick={() => handleVMAction('delete', vm.id.toString(), vm.name)}
                                  disabled={vm.protection}
                                >
                                  Delete VM
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
                  total={vmData.pagination.totalPages}
                />
              </Group>
            </>
          ) : (
            <Stack align="center" py="xl">
              <Text size="lg" fw={600}>No Virtual Machines Found</Text>
              <Text c="dimmed" ta="center">
                {search || statusFilter || nodeFilter
                  ? 'No VMs match your current filters'
                  : 'Get started by creating your first virtual machine'
                }
              </Text>
              <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
                Create VM
              </Button>
            </Stack>
          )}
        </div>
      </Card>

      {/* Create VM Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Create Virtual Machine"
        size="lg"
      >
        <form onSubmit={vmForm.onSubmit(handleCreateVM)}>
          <Stack>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="VM Name"
                  placeholder="Enter VM name"
                  required
                  {...vmForm.getInputProps('name')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Node"
                  placeholder="Select node"
                  data={availableNodes}
                  required
                  {...vmForm.getInputProps('node')}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Description"
                  placeholder="Enter VM description"
                  {...vmForm.getInputProps('description')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="Memory (MB)"
                  min={512}
                  step={512}
                  required
                  {...vmForm.getInputProps('memory')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="CPU Cores"
                  min={1}
                  max={32}
                  required
                  {...vmForm.getInputProps('cores')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="Disk Size (GB)"
                  min={8}
                  step={8}
                  {...vmForm.getInputProps('disk')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Template"
                  placeholder="Select template (optional)"
                  data={availableTemplates}
                  clearable
                  {...vmForm.getInputProps('template')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
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
                  {...vmForm.getInputProps('tags')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Switch
                  label="Start on Boot"
                  description="Automatically start VM when node boots"
                  {...vmForm.getInputProps('startOnBoot', { type: 'checkbox' })}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Switch
                  label="Protection"
                  description="Prevent accidental deletion"
                  {...vmForm.getInputProps('protection', { type: 'checkbox' })}
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                loading={createVMMutation.isPending}
              >
                Create VM
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </div>
  );
};