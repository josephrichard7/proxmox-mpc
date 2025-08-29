import { useState, useEffect } from 'react';
import {
  Paper,
  Group,
  Text,
  Button,
  Stack,
  Checkbox,
  Select,
  Modal,
  Alert,
  Progress,
  Badge,
  Table,
  ActionIcon,
  Divider,
  Grid,
  Card,
  ScrollArea,
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconTrash,
  IconSettings,
  IconServer,
  IconContainer,
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useNotifications } from '@mantine/notifications';
import { useQuery, useMutation } from '@tanstack/react-query';

export interface Resource {
  id: string;
  name: string;
  type: 'vm' | 'container';
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  node: string;
  memory: number;
  cores?: number;
  uptime?: number;
  tags: string[];
}

export interface BatchOperation {
  id: string;
  name: string;
  type: 'start' | 'stop' | 'restart' | 'migrate' | 'backup' | 'delete' | 'update';
  description: string;
  applicableTo: ('vm' | 'container')[];
  requiresConfirmation: boolean;
  icon: any;
  color: string;
}

export interface BatchOperationProgress {
  operationId: string;
  resourceId: string;
  resourceName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface BatchOperationsProps {
  /** Available resources for batch operations */
  resources: Resource[];
  /** Callback when resources are updated */
  onResourcesUpdate?: () => void;
  /** Show operation progress */
  showProgress?: boolean;
}

/**
 * Batch Operations component for multi-resource management
 * Provides bulk operations on VMs and containers with progress tracking
 */
export function BatchOperations({
  resources = [],
  onResourcesUpdate,
  showProgress = true,
}: BatchOperationsProps) {
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<BatchOperation | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterNode, setFilterNode] = useState<string>('all');
  const [operationProgress, setOperationProgress] = useState<BatchOperationProgress[]>([]);
  const [isOperationRunning, setIsOperationRunning] = useState(false);

  const [confirmModalOpened, { open: openConfirmModal, close: closeConfirmModal }] = useDisclosure(false);
  const [progressModalOpened, { open: openProgressModal, close: closeProgressModal }] = useDisclosure(false);

  const notifications = useNotifications();

  // Available batch operations
  const batchOperations: BatchOperation[] = [
    {
      id: 'start',
      name: 'Start Resources',
      type: 'start',
      description: 'Start selected VMs and containers',
      applicableTo: ['vm', 'container'],
      requiresConfirmation: false,
      icon: IconPlayerPlay,
      color: 'green',
    },
    {
      id: 'stop',
      name: 'Stop Resources',
      type: 'stop',
      description: 'Stop selected VMs and containers',
      applicableTo: ['vm', 'container'],
      requiresConfirmation: true,
      icon: IconPlayerStop,
      color: 'orange',
    },
    {
      id: 'restart',
      name: 'Restart Resources',
      type: 'restart',
      description: 'Restart selected VMs and containers',
      applicableTo: ['vm', 'container'],
      requiresConfirmation: true,
      icon: IconRefresh,
      color: 'blue',
    },
    {
      id: 'migrate',
      name: 'Migrate Resources',
      type: 'migrate',
      description: 'Migrate selected VMs to different nodes',
      applicableTo: ['vm'],
      requiresConfirmation: true,
      icon: IconServer,
      color: 'purple',
    },
    {
      id: 'backup',
      name: 'Create Backups',
      type: 'backup',
      description: 'Create backups of selected resources',
      applicableTo: ['vm', 'container'],
      requiresConfirmation: false,
      icon: IconSettings,
      color: 'cyan',
    },
    {
      id: 'delete',
      name: 'Delete Resources',
      type: 'delete',
      description: 'Permanently delete selected resources',
      applicableTo: ['vm', 'container'],
      requiresConfirmation: true,
      icon: IconTrash,
      color: 'red',
    },
  ];

  // Filter resources based on selected criteria
  const filteredResources = resources.filter(resource => {
    const matchesStatus = filterStatus === 'all' || resource.status === filterStatus;
    const matchesType = filterType === 'all' || resource.type === filterType;
    const matchesNode = filterNode === 'all' || resource.node === filterNode;
    
    return matchesStatus && matchesType && matchesNode;
  });

  // Get unique values for filters
  const uniqueStatuses = ['all', ...Array.from(new Set(resources.map(r => r.status)))];
  const uniqueTypes = ['all', ...Array.from(new Set(resources.map(r => r.type)))];
  const uniqueNodes = ['all', ...Array.from(new Set(resources.map(r => r.node)))];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedResources(filteredResources.map(r => r.id));
    } else {
      setSelectedResources([]);
    }
  };

  const handleResourceSelect = (resourceId: string, checked: boolean) => {
    if (checked) {
      setSelectedResources(prev => [...prev, resourceId]);
    } else {
      setSelectedResources(prev => prev.filter(id => id !== resourceId));
    }
  };

  const handleOperationSelect = (operation: BatchOperation) => {
    const applicableResources = selectedResources.filter(id => {
      const resource = resources.find(r => r.id === id);
      return resource && operation.applicableTo.includes(resource.type);
    });

    if (applicableResources.length === 0) {
      notifications.show({
        title: 'No applicable resources',
        message: `No selected resources are compatible with ${operation.name}`,
        color: 'orange',
      });
      return;
    }

    setSelectedOperation(operation);
    
    if (operation.requiresConfirmation) {
      openConfirmModal();
    } else {
      executeOperation(operation, applicableResources);
    }
  };

  const executeOperation = async (operation: BatchOperation, resourceIds: string[]) => {
    setIsOperationRunning(true);
    
    // Initialize progress tracking
    const initialProgress: BatchOperationProgress[] = resourceIds.map(id => {
      const resource = resources.find(r => r.id === id);
      return {
        operationId: operation.id,
        resourceId: id,
        resourceName: resource?.name || 'Unknown',
        status: 'pending',
        startTime: new Date(),
      };
    });
    
    setOperationProgress(initialProgress);
    openProgressModal();
    closeConfirmModal();

    // Simulate batch operation execution
    for (let i = 0; i < resourceIds.length; i++) {
      const resourceId = resourceIds[i];
      const resource = resources.find(r => r.id === resourceId);
      
      if (!resource) continue;

      // Update progress to running
      setOperationProgress(prev => 
        prev.map(p => 
          p.resourceId === resourceId 
            ? { ...p, status: 'running', message: `${operation.name} in progress...` }
            : p
        )
      );

      // Simulate operation delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

      // Simulate success/failure (90% success rate)
      const success = Math.random() > 0.1;
      
      setOperationProgress(prev => 
        prev.map(p => 
          p.resourceId === resourceId 
            ? { 
                ...p, 
                status: success ? 'completed' : 'failed',
                message: success 
                  ? `${operation.name} completed successfully`
                  : `${operation.name} failed: Resource unavailable`,
                endTime: new Date(),
              }
            : p
        )
      );
    }

    setIsOperationRunning(false);
    
    const completedCount = operationProgress.filter(p => p.status === 'completed').length;
    const totalCount = resourceIds.length;
    
    notifications.show({
      title: 'Batch Operation Completed',
      message: `${completedCount}/${totalCount} resources processed successfully`,
      color: completedCount === totalCount ? 'green' : 'orange',
    });

    // Refresh resources if callback provided
    if (onResourcesUpdate) {
      onResourcesUpdate();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <IconPlayerPlay size={14} color="green" />;
      case 'stopped': return <IconPlayerStop size={14} color="red" />;
      case 'error': return <IconX size={14} color="red" />;
      case 'starting':
      case 'stopping': return <IconClock size={14} color="orange" />;
      default: return <IconCheck size={14} color="gray" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running': return 'green';
      case 'stopped': return 'red';
      case 'error': return 'red';
      case 'starting':
      case 'stopping': return 'orange';
      default: return 'gray';
    }
  };

  const getProgressStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <IconCheck size={16} color="green" />;
      case 'failed': return <IconX size={16} color="red" />;
      case 'running': return <IconClock size={16} color="orange" />;
      default: return <IconClock size={16} color="gray" />;
    }
  };

  const getProgressColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'green';
      case 'failed': return 'red';
      case 'running': return 'blue';
      default: return 'gray';
    }
  };

  const selectedResourcesInfo = selectedResources
    .map(id => resources.find(r => r.id === id))
    .filter(Boolean) as Resource[];

  const completedOperations = operationProgress.filter(p => p.status === 'completed').length;
  const totalOperations = operationProgress.length;
  const progressPercentage = totalOperations > 0 ? (completedOperations / totalOperations) * 100 : 0;

  return (
    <Stack gap="lg">
      {/* Filters and Controls */}
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="lg" fw={600}>Batch Operations</Text>
            <Text size="sm" c="dimmed">
              {selectedResources.length} of {filteredResources.length} resources selected
            </Text>
          </Group>

          {/* Filters */}
          <Group>
            <Select
              placeholder="Filter by status"
              value={filterStatus}
              onChange={(value) => setFilterStatus(value || 'all')}
              data={uniqueStatuses.map(status => ({
                value: status,
                label: status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)
              }))}
              w={150}
            />
            <Select
              placeholder="Filter by type"
              value={filterType}
              onChange={(value) => setFilterType(value || 'all')}
              data={uniqueTypes.map(type => ({
                value: type,
                label: type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)
              }))}
              w={150}
            />
            <Select
              placeholder="Filter by node"
              value={filterNode}
              onChange={(value) => setFilterNode(value || 'all')}
              data={uniqueNodes.map(node => ({
                value: node,
                label: node === 'all' ? 'All Nodes' : node
              }))}
              w={150}
            />
          </Group>

          {/* Batch Operations */}
          {selectedResources.length > 0 && (
            <>
              <Divider />
              <Group>
                <Text size="sm" fw={500}>Available Operations:</Text>
                {batchOperations.map((operation) => {
                  const Icon = operation.icon;
                  const applicableCount = selectedResourcesInfo.filter(r => 
                    operation.applicableTo.includes(r.type)
                  ).length;
                  
                  return (
                    <Button
                      key={operation.id}
                      variant="light"
                      size="sm"
                      color={operation.color}
                      leftSection={<Icon size={16} />}
                      onClick={() => handleOperationSelect(operation)}
                      disabled={applicableCount === 0 || isOperationRunning}
                    >
                      {operation.name} ({applicableCount})
                    </Button>
                  );
                })}
              </Group>
            </>
          )}
        </Stack>
      </Paper>

      {/* Resource List */}
      <Paper withBorder>
        <ScrollArea>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <Checkbox
                    checked={selectedResources.length === filteredResources.length && filteredResources.length > 0}
                    indeterminate={selectedResources.length > 0 && selectedResources.length < filteredResources.length}
                    onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                  />
                </Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Node</Table.Th>
                <Table.Th>Memory</Table.Th>
                <Table.Th>Tags</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredResources.map((resource) => (
                <Table.Tr key={resource.id}>
                  <Table.Td>
                    <Checkbox
                      checked={selectedResources.includes(resource.id)}
                      onChange={(e) => handleResourceSelect(resource.id, e.currentTarget.checked)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {resource.type === 'vm' ? <IconServer size={16} /> : <IconContainer size={16} />}
                      <Text size="sm" fw={500}>{resource.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={resource.type === 'vm' ? 'blue' : 'green'}>
                      {resource.type.toUpperCase()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {getStatusIcon(resource.status)}
                      <Badge size="sm" color={getStatusColor(resource.status)}>
                        {resource.status}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>{resource.node}</Table.Td>
                  <Table.Td>{resource.memory} MB</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {resource.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} size="xs" color="gray">
                          {tag}
                        </Badge>
                      ))}
                      {resource.tags.length > 2 && (
                        <Badge size="xs" color="gray">
                          +{resource.tags.length - 2}
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {filteredResources.length === 0 && (
          <Group justify="center" p="xl">
            <Text c="dimmed">No resources match the current filters</Text>
          </Group>
        )}
      </Paper>

      {/* Confirmation Modal */}
      <Modal
        opened={confirmModalOpened}
        onClose={closeConfirmModal}
        title={`Confirm: ${selectedOperation?.name}`}
        size="md"
      >
        {selectedOperation && (
          <Stack gap="md">
            <Alert
              icon={<IconAlertTriangle size={16} />}
              title="Confirm Operation"
              color="orange"
            >
              {selectedOperation.description}
            </Alert>

            <Text size="sm">
              This operation will be applied to the following {selectedResourcesInfo.length} resource(s):
            </Text>

            <Stack gap="xs" mah={200} style={{ overflowY: 'auto' }}>
              {selectedResourcesInfo
                .filter(resource => selectedOperation.applicableTo.includes(resource.type))
                .map((resource) => (
                <Group key={resource.id} gap="xs">
                  {resource.type === 'vm' ? <IconServer size={16} /> : <IconContainer size={16} />}
                  <Text size="sm">{resource.name}</Text>
                  <Badge size="xs" color={getStatusColor(resource.status)}>
                    {resource.status}
                  </Badge>
                </Group>
              ))}
            </Stack>

            <Group justify="flex-end" gap="sm">
              <Button variant="light" onClick={closeConfirmModal}>
                Cancel
              </Button>
              <Button
                color={selectedOperation.color}
                onClick={() => {
                  const applicableResources = selectedResources.filter(id => {
                    const resource = resources.find(r => r.id === id);
                    return resource && selectedOperation.applicableTo.includes(resource.type);
                  });
                  executeOperation(selectedOperation, applicableResources);
                }}
              >
                Confirm {selectedOperation.name}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Progress Modal */}
      <Modal
        opened={progressModalOpened}
        onClose={closeProgressModal}
        title="Batch Operation Progress"
        size="lg"
        closeOnClickOutside={false}
        withCloseButton={!isOperationRunning}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              Overall Progress: {completedOperations}/{totalOperations}
            </Text>
            <Text size="sm" c="dimmed">
              {Math.round(progressPercentage)}% completed
            </Text>
          </Group>

          <Progress value={progressPercentage} size="lg" radius="md" />

          <ScrollArea h={300}>
            <Stack gap="xs">
              {operationProgress.map((progress) => (
                <Paper key={progress.resourceId} p="sm" withBorder>
                  <Group justify="space-between">
                    <Group>
                      {getProgressStatusIcon(progress.status)}
                      <Text size="sm" fw={500}>{progress.resourceName}</Text>
                    </Group>
                    <Badge size="sm" color={getProgressColor(progress.status)}>
                      {progress.status}
                    </Badge>
                  </Group>
                  {progress.message && (
                    <Text size="xs" c="dimmed" ml={24}>
                      {progress.message}
                    </Text>
                  )}
                </Paper>
              ))}
            </Stack>
          </ScrollArea>

          {!isOperationRunning && (
            <Group justify="flex-end">
              <Button onClick={closeProgressModal}>Close</Button>
            </Group>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}