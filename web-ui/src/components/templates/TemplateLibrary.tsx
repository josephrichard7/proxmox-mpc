import { useState, useEffect } from 'react';
import {
  Paper,
  Grid,
  Card,
  Text,
  Badge,
  Group,
  Button,
  Modal,
  Stack,
  TextInput,
  Textarea,
  Select,
  ActionIcon,
  Image,
  ScrollArea,
  Tabs,
  Alert,
} from '@mantine/core';
import {
  IconPlus,
  IconDownload,
  IconEdit,
  IconTrash,
  IconServer,
  IconContainer,
  IconNetworking,
  IconDatabase,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useNotifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface InfrastructureTemplate {
  id: string;
  name: string;
  description: string;
  category: 'vm' | 'container' | 'network' | 'storage' | 'multi-resource';
  tags: string[];
  author: string;
  version: string;
  thumbnail?: string;
  resources: {
    vms?: number;
    containers?: number;
    networks?: number;
    storage?: number;
  };
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    description: string;
    default?: any;
    required: boolean;
    options?: string[];
  }>;
  terraformConfig?: string;
  ansiblePlaybook?: string;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  rating: number;
}

export interface TemplateLibraryProps {
  /** Callback when template is selected for deployment */
  onDeployTemplate?: (template: InfrastructureTemplate, parameters: Record<string, any>) => void;
  /** Callback when template is selected for editing */
  onEditTemplate?: (template: InfrastructureTemplate) => void;
  /** Whether to show deployment controls */
  showDeployment?: boolean;
  /** Whether to show creation controls */
  showCreation?: boolean;
}

/**
 * Template Library component for Infrastructure as Code templates
 * Provides browsing, filtering, and deployment of infrastructure templates
 */
export function TemplateLibrary({
  onDeployTemplate,
  onEditTemplate,
  showDeployment = true,
  showCreation = true,
}: TemplateLibraryProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<InfrastructureTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deployParameters, setDeployParameters] = useState<Record<string, any>>({});
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [deployModalOpened, { open: openDeployModal, close: closeDeployModal }] = useDisclosure(false);
  const [previewModalOpened, { open: openPreviewModal, close: closePreviewModal }] = useDisclosure(false);

  const notifications = useNotifications();
  const queryClient = useQueryClient();

  // Mock templates data - in real implementation, this would come from API
  const mockTemplates: InfrastructureTemplate[] = [
    {
      id: '1',
      name: 'LAMP Stack',
      description: 'Complete LAMP (Linux, Apache, MySQL, PHP) stack with load balancer',
      category: 'multi-resource',
      tags: ['web', 'database', 'php', 'mysql'],
      author: 'Proxmox Community',
      version: '1.2.0',
      thumbnail: '/templates/lamp-stack.png',
      resources: { vms: 3, networks: 2, storage: 2 },
      parameters: [
        {
          name: 'environment',
          type: 'select',
          description: 'Deployment environment',
          default: 'development',
          required: true,
          options: ['development', 'staging', 'production']
        },
        {
          name: 'domain_name',
          type: 'string',
          description: 'Domain name for the application',
          default: 'example.com',
          required: true
        },
        {
          name: 'mysql_root_password',
          type: 'string',
          description: 'MySQL root password',
          required: true
        }
      ],
      terraformConfig: '',
      ansiblePlaybook: '',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-02-01T14:30:00Z',
      downloads: 1247,
      rating: 4.8
    },
    {
      id: '2',
      name: 'Kubernetes Cluster',
      description: 'Production-ready Kubernetes cluster with 3 master and 3 worker nodes',
      category: 'multi-resource',
      tags: ['kubernetes', 'container', 'cluster', 'docker'],
      author: 'DevOps Team',
      version: '1.0.3',
      resources: { vms: 6, networks: 3, storage: 4 },
      parameters: [
        {
          name: 'cluster_name',
          type: 'string',
          description: 'Name of the Kubernetes cluster',
          default: 'k8s-cluster',
          required: true
        },
        {
          name: 'node_count',
          type: 'number',
          description: 'Number of worker nodes',
          default: 3,
          required: true
        },
        {
          name: 'enable_monitoring',
          type: 'boolean',
          description: 'Enable Prometheus monitoring',
          default: true,
          required: false
        }
      ],
      terraformConfig: '',
      ansiblePlaybook: '',
      createdAt: '2024-02-10T09:15:00Z',
      updatedAt: '2024-02-20T16:45:00Z',
      downloads: 892,
      rating: 4.6
    },
    {
      id: '3',
      name: 'Web Server VM',
      description: 'Nginx web server with SSL/TLS termination and automatic certificate renewal',
      category: 'vm',
      tags: ['nginx', 'web', 'ssl', 'https'],
      author: 'Security Team',
      version: '2.1.0',
      resources: { vms: 1, networks: 1 },
      parameters: [
        {
          name: 'vm_name',
          type: 'string',
          description: 'Name for the web server VM',
          default: 'web-server',
          required: true
        },
        {
          name: 'memory_mb',
          type: 'number',
          description: 'Memory allocation in MB',
          default: 2048,
          required: true
        },
        {
          name: 'disk_gb',
          type: 'number',
          description: 'Disk size in GB',
          default: 20,
          required: true
        }
      ],
      terraformConfig: '',
      ansiblePlaybook: '',
      createdAt: '2024-01-20T14:20:00Z',
      updatedAt: '2024-02-15T11:10:00Z',
      downloads: 2341,
      rating: 4.9
    },
    {
      id: '4',
      name: 'Database Container',
      description: 'PostgreSQL database container with automated backups',
      category: 'container',
      tags: ['postgresql', 'database', 'backup', 'container'],
      author: 'Data Team',
      version: '1.1.2',
      resources: { containers: 1, storage: 2 },
      parameters: [
        {
          name: 'db_name',
          type: 'string',
          description: 'Database name',
          default: 'appdb',
          required: true
        },
        {
          name: 'db_user',
          type: 'string',
          description: 'Database username',
          default: 'postgres',
          required: true
        },
        {
          name: 'backup_schedule',
          type: 'select',
          description: 'Backup frequency',
          default: 'daily',
          required: true,
          options: ['hourly', 'daily', 'weekly']
        }
      ],
      terraformConfig: '',
      ansiblePlaybook: '',
      createdAt: '2024-02-05T08:30:00Z',
      updatedAt: '2024-02-25T13:20:00Z',
      downloads: 756,
      rating: 4.4
    }
  ];

  // Filter templates based on search and category
  const filteredTemplates = mockTemplates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { value: 'all', label: 'All Templates' },
    { value: 'vm', label: 'Virtual Machines' },
    { value: 'container', label: 'Containers' },
    { value: 'network', label: 'Networking' },
    { value: 'storage', label: 'Storage' },
    { value: 'multi-resource', label: 'Multi-Resource' },
  ];

  const handleDeployTemplate = (template: InfrastructureTemplate) => {
    setSelectedTemplate(template);
    // Initialize parameters with defaults
    const initialParams = template.parameters.reduce((acc, param) => {
      acc[param.name] = param.default;
      return acc;
    }, {} as Record<string, any>);
    setDeployParameters(initialParams);
    openDeployModal();
  };

  const handleConfirmDeployment = () => {
    if (selectedTemplate && onDeployTemplate) {
      onDeployTemplate(selectedTemplate, deployParameters);
      closeDeployModal();
      notifications.show({
        title: 'Deployment Started',
        message: `Template "${selectedTemplate.name}" deployment has been initiated`,
        color: 'green',
      });
    }
  };

  const getResourceIcon = (category: string) => {
    switch (category) {
      case 'vm': return <IconServer size={16} />;
      case 'container': return <IconContainer size={16} />;
      case 'network': return <IconNetworking size={16} />;
      case 'storage': return <IconDatabase size={16} />;
      default: return <IconServer size={16} />;
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'vm': return 'blue';
      case 'container': return 'green';
      case 'network': return 'orange';
      case 'storage': return 'purple';
      case 'multi-resource': return 'red';
      default: return 'gray';
    }
  };

  const renderParameterInput = (parameter: any) => {
    const value = deployParameters[parameter.name] || parameter.default || '';
    
    const handleChange = (newValue: any) => {
      setDeployParameters(prev => ({
        ...prev,
        [parameter.name]: newValue
      }));
    };

    switch (parameter.type) {
      case 'select':
        return (
          <Select
            label={parameter.name}
            description={parameter.description}
            value={value}
            onChange={handleChange}
            data={parameter.options?.map(opt => ({ value: opt, label: opt })) || []}
            required={parameter.required}
          />
        );
      case 'number':
        return (
          <TextInput
            label={parameter.name}
            description={parameter.description}
            type="number"
            value={value}
            onChange={(e) => handleChange(Number(e.currentTarget.value))}
            required={parameter.required}
          />
        );
      case 'boolean':
        return (
          <Select
            label={parameter.name}
            description={parameter.description}
            value={String(value)}
            onChange={(val) => handleChange(val === 'true')}
            data={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' }
            ]}
            required={parameter.required}
          />
        );
      default:
        return (
          <TextInput
            label={parameter.name}
            description={parameter.description}
            value={value}
            onChange={(e) => handleChange(e.currentTarget.value)}
            required={parameter.required}
          />
        );
    }
  };

  return (
    <>
      <Stack gap="lg">
        {/* Header and Controls */}
        <Group justify="space-between">
          <div>
            <Text size="lg" fw={600}>Infrastructure Templates</Text>
            <Text size="sm" c="dimmed">
              Deploy production-ready infrastructure with pre-configured templates
            </Text>
          </div>
          {showCreation && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
            >
              Create Template
            </Button>
          )}
        </Group>

        {/* Filters */}
        <Group>
          <TextInput
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Category"
            value={selectedCategory}
            onChange={(value) => setSelectedCategory(value || 'all')}
            data={categories}
            w={200}
          />
        </Group>

        {/* Template Grid */}
        <Grid>
          {filteredTemplates.map((template) => (
            <Grid.Col key={template.id} span={{ base: 12, sm: 6, lg: 4 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
                <Card.Section>
                  {template.thumbnail ? (
                    <Image
                      src={template.thumbnail}
                      height={120}
                      alt={template.name}
                      fallbackSrc="/placeholder-template.png"
                    />
                  ) : (
                    <div
                      style={{
                        height: 120,
                        backgroundColor: '#f8f9fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getResourceIcon(template.category)}
                    </div>
                  )}
                </Card.Section>

                <Stack gap="sm" pt="md">
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Text fw={600} size="md" lineClamp={1}>
                        {template.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        v{template.version} • {template.author}
                      </Text>
                    </div>
                    <Badge
                      color={getCategoryColor(template.category)}
                      size="sm"
                      variant="light"
                    >
                      {template.category}
                    </Badge>
                  </Group>

                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {template.description}
                  </Text>

                  {/* Resource Summary */}
                  <Group gap="xs">
                    {template.resources.vms && (
                      <Badge size="xs" variant="outline">
                        {template.resources.vms} VMs
                      </Badge>
                    )}
                    {template.resources.containers && (
                      <Badge size="xs" variant="outline">
                        {template.resources.containers} Containers
                      </Badge>
                    )}
                    {template.resources.networks && (
                      <Badge size="xs" variant="outline">
                        {template.resources.networks} Networks
                      </Badge>
                    )}
                  </Group>

                  {/* Tags */}
                  <Group gap="xs">
                    {template.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} size="xs" color="gray">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge size="xs" color="gray">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </Group>

                  {/* Stats */}
                  <Group justify="space-between" mt="auto">
                    <Text size="xs" c="dimmed">
                      ⭐ {template.rating} • {template.downloads} downloads
                    </Text>
                  </Group>

                  {/* Actions */}
                  <Group gap="xs" mt="sm">
                    {showDeployment && (
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconDownload size={14} />}
                        onClick={() => handleDeployTemplate(template)}
                        style={{ flex: 1 }}
                      >
                        Deploy
                      </Button>
                    )}
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        openPreviewModal();
                      }}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        {filteredTemplates.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} title="No templates found">
            No templates match your current search criteria. Try adjusting your search or category filter.
          </Alert>
        )}
      </Stack>

      {/* Deploy Template Modal */}
      <Modal
        opened={deployModalOpened}
        onClose={closeDeployModal}
        title={`Deploy Template: ${selectedTemplate?.name}`}
        size="md"
      >
        {selectedTemplate && (
          <Stack gap="md">
            <Alert icon={<IconCheck size={16} />} color="blue">
              This will create the following resources:
              {selectedTemplate.resources.vms && ` ${selectedTemplate.resources.vms} VMs`}
              {selectedTemplate.resources.containers && ` ${selectedTemplate.resources.containers} containers`}
              {selectedTemplate.resources.networks && ` ${selectedTemplate.resources.networks} networks`}
            </Alert>

            <Text size="sm" fw={500}>Configure Parameters:</Text>

            {selectedTemplate.parameters.map((parameter) => (
              <div key={parameter.name}>
                {renderParameterInput(parameter)}
              </div>
            ))}

            <Group justify="flex-end" gap="sm" mt="md">
              <Button variant="light" onClick={closeDeployModal}>
                Cancel
              </Button>
              <Button onClick={handleConfirmDeployment}>
                Deploy Template
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Preview Template Modal */}
      <Modal
        opened={previewModalOpened}
        onClose={closePreviewModal}
        title={`Template: ${selectedTemplate?.name}`}
        size="lg"
      >
        {selectedTemplate && (
          <Tabs defaultValue="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="parameters">Parameters</Tabs.Tab>
              <Tabs.Tab value="resources">Resources</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="md">
              <Stack gap="md">
                <Text>{selectedTemplate.description}</Text>
                <Group>
                  <Text size="sm" fw={500}>Version:</Text>
                  <Badge>{selectedTemplate.version}</Badge>
                </Group>
                <Group>
                  <Text size="sm" fw={500}>Author:</Text>
                  <Text size="sm">{selectedTemplate.author}</Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500}>Tags:</Text>
                  {selectedTemplate.tags.map((tag) => (
                    <Badge key={tag} size="sm" color="gray">
                      {tag}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="parameters" pt="md">
              <Stack gap="md">
                {selectedTemplate.parameters.map((param) => (
                  <Paper key={param.name} p="md" withBorder>
                    <Text size="sm" fw={500}>{param.name}</Text>
                    <Text size="xs" c="dimmed">{param.description}</Text>
                    <Group mt="xs">
                      <Badge size="xs" color="blue">{param.type}</Badge>
                      {param.required && <Badge size="xs" color="red">required</Badge>}
                      {param.default && (
                        <Text size="xs" c="dimmed">
                          default: {String(param.default)}
                        </Text>
                      )}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="resources" pt="md">
              <Stack gap="md">
                {selectedTemplate.resources.vms && (
                  <Group>
                    <IconServer size={20} />
                    <Text>{selectedTemplate.resources.vms} Virtual Machines</Text>
                  </Group>
                )}
                {selectedTemplate.resources.containers && (
                  <Group>
                    <IconContainer size={20} />
                    <Text>{selectedTemplate.resources.containers} Containers</Text>
                  </Group>
                )}
                {selectedTemplate.resources.networks && (
                  <Group>
                    <IconNetworking size={20} />
                    <Text>{selectedTemplate.resources.networks} Networks</Text>
                  </Group>
                )}
                {selectedTemplate.resources.storage && (
                  <Group>
                    <IconDatabase size={20} />
                    <Text>{selectedTemplate.resources.storage} Storage Volumes</Text>
                  </Group>
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        )}
      </Modal>

      {/* Create Template Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Create New Template"
        size="lg"
      >
        <Alert icon={<IconAlertCircle size={16} />} color="blue" mb="md">
          Template creation feature coming soon! This will allow you to create custom templates from existing infrastructure.
        </Alert>
      </Modal>
    </>
  );
}