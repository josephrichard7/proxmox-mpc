import { useState, useEffect } from 'react';
import {
  Container,
  Stack,
  Title,
  Text,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import { IconAlertCircle, IconBolt } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { BatchOperations, Resource } from '../components/operations/BatchOperations';
import { apiService } from '../services/ApiService';

/**
 * Batch Operations page for bulk resource management
 * Provides interface for selecting and operating on multiple resources
 */
export function BatchOperationsPage() {
  const [resources, setResources] = useState<Resource[]>([]);

  // Fetch VMs
  const {
    data: vmsResponse,
    isLoading: vmsLoading,
    error: vmsError,
  } = useQuery({
    queryKey: ['vms-batch'],
    queryFn: async () => {
      const response = await apiService.getVMs();
      return response;
    },
  });

  // Fetch Containers
  const {
    data: containersResponse,
    isLoading: containersLoading,
    error: containersError,
  } = useQuery({
    queryKey: ['containers-batch'],
    queryFn: async () => {
      const response = await apiService.getContainers();
      return response;
    },
  });

  // Combine resources from VMs and containers
  useEffect(() => {
    const combinedResources: Resource[] = [];

    // Add VMs
    if (vmsResponse?.success && vmsResponse.data?.vms) {
      const vmResources: Resource[] = vmsResponse.data.vms.map(vm => ({
        id: vm.id.toString(),
        name: vm.name,
        type: 'vm' as const,
        status: vm.status as any,
        node: vm.node,
        memory: vm.memory,
        cores: vm.cores,
        uptime: vm.uptime,
        tags: vm.tags || [],
      }));
      combinedResources.push(...vmResources);
    }

    // Add Containers
    if (containersResponse?.success && containersResponse.data?.containers) {
      const containerResources: Resource[] = containersResponse.data.containers.map(container => ({
        id: container.id.toString(),
        name: container.name,
        type: 'container' as const,
        status: container.status as any,
        node: container.node,
        memory: container.memory,
        uptime: container.uptime,
        tags: container.tags || [],
      }));
      combinedResources.push(...containerResources);
    }

    setResources(combinedResources);
  }, [vmsResponse, containersResponse]);

  const isLoading = vmsLoading || containersLoading;
  const hasError = vmsError || containersError;

  const handleResourcesUpdate = () => {
    // Trigger a refetch of both VMs and containers
    // This would typically be done by invalidating the queries
    console.log('Resources updated - refresh data');
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
        <div>
          <Title order={2} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconBolt size={28} />
            Batch Operations
          </Title>
          <Text c="dimmed" size="sm">
            Perform bulk operations on multiple VMs and containers simultaneously.
            Select resources using the checkboxes and choose an operation to apply.
          </Text>
        </div>

        {/* Error Alert */}
        {hasError && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Resources"
            color="red"
          >
            Failed to load some resources. Some operations may not be available.
            {vmsError && <Text size="sm" mt="xs">VMs: {vmsError.message}</Text>}
            {containersError && <Text size="sm" mt="xs">Containers: {containersError.message}</Text>}
          </Alert>
        )}

        {/* Safety Notice */}
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Safety Notice"
          color="blue"
        >
          <Text size="sm">
            Batch operations affect multiple resources simultaneously and cannot be easily undone.
            Always verify your selection before proceeding with destructive operations like stop, restart, or delete.
          </Text>
        </Alert>

        {/* Batch Operations Component */}
        <BatchOperations
          resources={resources}
          onResourcesUpdate={handleResourcesUpdate}
          showProgress={true}
        />
      </Stack>
    </Container>
  );
}