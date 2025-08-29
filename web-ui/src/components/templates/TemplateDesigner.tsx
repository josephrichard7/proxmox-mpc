import { useState, useCallback } from 'react';
import {
  Paper,
  Group,
  Text,
  Button,
  Stack,
  Grid,
  Card,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Switch,
  Alert,
  Tabs,
  Code,
  ScrollArea,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconServer,
  IconContainer,
  IconNetworking,
  IconDatabase,
  IconDragDrop,
  IconCode,
  IconEye,
  IconDeviceFloppy,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useNotifications } from '@mantine/notifications';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export interface TemplateResource {
  id: string;
  type: 'vm' | 'container' | 'network' | 'storage';
  name: string;
  properties: Record<string, any>;
  dependencies: string[];
  position: { x: number; y: number };
}

export interface TemplateParameter {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  description: string;
  defaultValue: any;
  required: boolean;
  options?: string[];
}

export interface TemplateDesignerProps {
  /** Callback when template is saved */
  onSaveTemplate?: (template: any) => void;
  /** Initial template data for editing */
  initialTemplate?: any;
  /** Whether the designer is in edit mode */
  editMode?: boolean;
}

/**
 * Template Designer component for creating Infrastructure as Code templates
 * Provides drag-and-drop interface for designing infrastructure templates
 */
export function TemplateDesigner({
  onSaveTemplate,
  initialTemplate,
  editMode = false,
}: TemplateDesignerProps) {
  const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
  const [templateDescription, setTemplateDescription] = useState(initialTemplate?.description || '');
  const [templateCategory, setTemplateCategory] = useState(initialTemplate?.category || 'multi-resource');
  const [templateTags, setTemplateTags] = useState<string[]>(initialTemplate?.tags || []);
  const [resources, setResources] = useState<TemplateResource[]>(initialTemplate?.resources || []);
  const [parameters, setParameters] = useState<TemplateParameter[]>(initialTemplate?.parameters || []);
  const [selectedResource, setSelectedResource] = useState<TemplateResource | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  
  const [resourceModalOpened, { open: openResourceModal, close: closeResourceModal }] = useDisclosure(false);
  const [parameterModalOpened, { open: openParameterModal, close: closeParameterModal }] = useDisclosure(false);
  const [previewModalOpened, { open: openPreviewModal, close: closePreviewModal }] = useDisclosure(false);
  const [editingResource, setEditingResource] = useState<TemplateResource | null>(null);
  const [editingParameter, setEditingParameter] = useState<TemplateParameter | null>(null);

  const notifications = useNotifications();

  const resourceTypes = [
    { value: 'vm', label: 'Virtual Machine', icon: IconServer, color: 'blue' },
    { value: 'container', label: 'Container', icon: IconContainer, color: 'green' },
    { value: 'network', label: 'Network', icon: IconNetworking, color: 'orange' },
    { value: 'storage', label: 'Storage', icon: IconDatabase, color: 'purple' },
  ];

  const categories = [
    { value: 'vm', label: 'Virtual Machine' },
    { value: 'container', label: 'Container' },
    { value: 'network', label: 'Network' },
    { value: 'storage', label: 'Storage' },
    { value: 'multi-resource', label: 'Multi-Resource' },
  ];

  const handleAddResource = (type: string) => {
    const newResource: TemplateResource = {
      id: `resource-${Date.now()}`,
      type: type as any,
      name: `${type}-${resources.length + 1}`,
      properties: getDefaultProperties(type),
      dependencies: [],
      position: { x: Math.random() * 400, y: Math.random() * 300 },
    };
    setEditingResource(newResource);
    openResourceModal();
  };

  const getDefaultProperties = (type: string): Record<string, any> => {
    switch (type) {
      case 'vm':
        return {
          node: 'pve',
          memory: 2048,
          cores: 2,
          disk: 20,
          template: 'ubuntu-22.04',
          network: 'vmbr0'
        };
      case 'container':
        return {
          node: 'pve',
          memory: 512,
          disk: 8,
          template: 'ubuntu-22.04-standard',
          network: 'vmbr0',
          unprivileged: true
        };
      case 'network':
        return {
          type: 'bridge',
          cidr: '192.168.1.0/24',
          vlan: null
        };
      case 'storage':
        return {
          type: 'directory',
          path: '/var/lib/vz',
          content: ['images', 'backup']
        };
      default:
        return {};
    }
  };

  const handleSaveResource = () => {
    if (!editingResource) return;

    if (resources.find(r => r.id === editingResource.id)) {
      setResources(prev => prev.map(r => r.id === editingResource.id ? editingResource : r));
    } else {
      setResources(prev => [...prev, editingResource]);
    }
    
    setEditingResource(null);
    closeResourceModal();
  };

  const handleDeleteResource = (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
    // Remove dependencies that reference this resource
    setResources(prev => prev.map(r => ({
      ...r,
      dependencies: r.dependencies.filter(dep => dep !== id)
    })));
  };

  const handleAddParameter = () => {
    const newParameter: TemplateParameter = {
      id: `param-${Date.now()}`,
      name: '',
      type: 'string',
      description: '',
      defaultValue: '',
      required: false,
    };
    setEditingParameter(newParameter);
    openParameterModal();
  };

  const handleSaveParameter = () => {
    if (!editingParameter) return;

    if (parameters.find(p => p.id === editingParameter.id)) {
      setParameters(prev => prev.map(p => p.id === editingParameter.id ? editingParameter : p));
    } else {
      setParameters(prev => [...prev, editingParameter]);
    }
    
    setEditingParameter(null);
    closeParameterModal();
  };

  const handleDeleteParameter = (id: string) => {
    setParameters(prev => prev.filter(p => p.id !== id));
  };

  const handleAddTag = () => {
    if (newTagInput.trim() && !templateTags.includes(newTagInput.trim())) {
      setTemplateTags(prev => [...prev, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTemplateTags(prev => prev.filter(t => t !== tag));
  };

  const generateTerraformConfig = (): string => {
    let config = '# Generated Terraform Configuration\n\n';
    
    // Add variables for parameters
    parameters.forEach(param => {
      config += `variable "${param.name}" {\n`;
      config += `  description = "${param.description}"\n`;
      config += `  type        = ${param.type === 'number' ? 'number' : 'string'}\n`;
      if (param.defaultValue !== undefined) {
        config += `  default     = ${JSON.stringify(param.defaultValue)}\n`;
      }
      if (param.type === 'boolean') {
        config += `  type = bool\n`;
      }
      config += '}\n\n';
    });

    // Add resources
    resources.forEach(resource => {
      switch (resource.type) {
        case 'vm':
          config += `resource "proxmox_vm_qemu" "${resource.name}" {\n`;
          config += `  name        = "${resource.name}"\n`;
          config += `  node        = "${resource.properties.node}"\n`;
          config += `  memory      = ${resource.properties.memory}\n`;
          config += `  cores       = ${resource.properties.cores}\n`;
          config += `  clone       = "${resource.properties.template}"\n`;
          config += '}\n\n';
          break;
        case 'container':
          config += `resource "proxmox_lxc" "${resource.name}" {\n`;
          config += `  hostname    = "${resource.name}"\n`;
          config += `  node        = "${resource.properties.node}"\n`;
          config += `  memory      = ${resource.properties.memory}\n`;
          config += `  template    = "${resource.properties.template}"\n`;
          config += `  unprivileged = ${resource.properties.unprivileged}\n`;
          config += '}\n\n';
          break;
      }
    });

    return config;
  };

  const generateAnsiblePlaybook = (): string => {
    let playbook = '---\n';
    playbook += `- name: Deploy ${templateName}\n`;
    playbook += '  hosts: localhost\n';
    playbook += '  gather_facts: false\n';
    playbook += '  tasks:\n\n';

    resources.forEach(resource => {
      switch (resource.type) {
        case 'vm':
          playbook += `    - name: Create VM ${resource.name}\n`;
          playbook += '      proxmox_kvm:\n';
          playbook += '        api_host: "{{ proxmox_api_host }}"\n';
          playbook += '        api_user: "{{ proxmox_api_user }}"\n';
          playbook += '        api_password: "{{ proxmox_api_password }}"\n';
          playbook += `        name: "${resource.name}"\n`;
          playbook += `        node: "${resource.properties.node}"\n`;
          playbook += `        memory: ${resource.properties.memory}\n`;
          playbook += `        cores: ${resource.properties.cores}\n`;
          playbook += `        clone: "${resource.properties.template}"\n`;
          playbook += '        state: present\n\n';
          break;
      }
    });

    return playbook;
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Template name is required',
        color: 'red',
      });
      return;
    }

    if (resources.length === 0) {
      notifications.show({
        title: 'Validation Error',
        message: 'At least one resource is required',
        color: 'red',
      });
      return;
    }

    const template = {
      name: templateName,
      description: templateDescription,
      category: templateCategory,
      tags: templateTags,
      resources: resources,
      parameters: parameters,
      terraformConfig: generateTerraformConfig(),
      ansiblePlaybook: generateAnsiblePlaybook(),
      version: '1.0.0',
      author: 'User',
    };

    if (onSaveTemplate) {
      onSaveTemplate(template);
    }

    notifications.show({
      title: 'Template Saved',
      message: `Template "${templateName}" has been saved successfully`,
      color: 'green',
    });
  };

  const getResourceIcon = (type: string) => {
    const resourceType = resourceTypes.find(rt => rt.value === type);
    if (resourceType) {
      const Icon = resourceType.icon;
      return <Icon size={20} />;
    }
    return <IconServer size={20} />;
  };

  const getResourceColor = (type: string) => {
    const resourceType = resourceTypes.find(rt => rt.value === type);
    return resourceType?.color || 'gray';
  };

  return (
    <Stack gap="lg">
      {/* Template Basic Info */}
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Text size="lg" fw={600}>Template Information</Text>
          
          <Grid>
            <Grid.Col span={8}>
              <TextInput
                label="Template Name"
                placeholder="Enter template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.currentTarget.value)}
                required
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Category"
                value={templateCategory}
                onChange={(value) => setTemplateCategory(value || 'multi-resource')}
                data={categories}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Description"
            placeholder="Describe what this template creates"
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.currentTarget.value)}
            minRows={3}
          />

          <div>
            <Text size="sm" fw={500} mb="xs">Tags</Text>
            <Group mb="xs">
              {templateTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="light"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag} ×
                </Badge>
              ))}
            </Group>
            <Group>
              <TextInput
                placeholder="Add tag"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                size="sm"
              />
              <Button size="sm" onClick={handleAddTag}>Add</Button>
            </Group>
          </div>
        </Stack>
      </Paper>

      {/* Resource Designer */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={600}>Resources</Text>
          <Group>
            {resourceTypes.map((type) => {
              const Icon = type.icon;
              return (
                <Button
                  key={type.value}
                  variant="light"
                  size="sm"
                  leftSection={<Icon size={16} />}
                  onClick={() => handleAddResource(type.value)}
                  color={type.color}
                >
                  Add {type.label}
                </Button>
              );
            })}
          </Group>
        </Group>

        {resources.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            No resources added yet. Click the buttons above to add infrastructure resources to your template.
          </Alert>
        ) : (
          <Grid>
            {resources.map((resource) => (
              <Grid.Col key={resource.id} span={4}>
                <Card shadow="sm" padding="md" radius="md" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Group>
                      {getResourceIcon(resource.type)}
                      <Text fw={500} size="sm">{resource.name}</Text>
                    </Group>
                    <Group gap="xs">
                      <ActionIcon
                        size="sm"
                        variant="light"
                        onClick={() => {
                          setEditingResource(resource);
                          openResourceModal();
                        }}
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="red"
                        onClick={() => handleDeleteResource(resource.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  
                  <Badge
                    size="sm"
                    color={getResourceColor(resource.type)}
                    variant="light"
                    mb="xs"
                  >
                    {resource.type}
                  </Badge>

                  <Stack gap="xs">
                    {Object.entries(resource.properties).slice(0, 3).map(([key, value]) => (
                      <Text key={key} size="xs" c="dimmed">
                        {key}: {String(value)}
                      </Text>
                    ))}
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Parameters */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={600}>Parameters</Text>
          <Button
            variant="light"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddParameter}
          >
            Add Parameter
          </Button>
        </Group>

        {parameters.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            No parameters defined. Parameters allow users to customize the template during deployment.
          </Alert>
        ) : (
          <Stack gap="xs">
            {parameters.map((parameter) => (
              <Paper key={parameter.id} p="sm" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>{parameter.name}</Text>
                    <Text size="xs" c="dimmed">{parameter.description}</Text>
                    <Group gap="xs" mt="xs">
                      <Badge size="xs" color="blue">{parameter.type}</Badge>
                      {parameter.required && <Badge size="xs" color="red">required</Badge>}
                    </Group>
                  </div>
                  <Group gap="xs">
                    <ActionIcon
                      size="sm"
                      variant="light"
                      onClick={() => {
                        setEditingParameter(parameter);
                        openParameterModal();
                      }}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="red"
                      onClick={() => handleDeleteParameter(parameter.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Actions */}
      <Group justify="space-between">
        <Button
          variant="light"
          leftSection={<IconEye size={16} />}
          onClick={openPreviewModal}
        >
          Preview Generated Code
        </Button>
        
        <Group>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSaveTemplate}
          >
            Save Template
          </Button>
        </Group>
      </Group>

      {/* Resource Edit Modal */}
      <Modal
        opened={resourceModalOpened}
        onClose={closeResourceModal}
        title={`${editingResource ? 'Edit' : 'Add'} Resource`}
        size="md"
      >
        {editingResource && (
          <Stack gap="md">
            <TextInput
              label="Resource Name"
              value={editingResource.name}
              onChange={(e) => setEditingResource({
                ...editingResource,
                name: e.currentTarget.value
              })}
            />

            {editingResource.type === 'vm' && (
              <>
                <TextInput
                  label="Node"
                  value={editingResource.properties.node}
                  onChange={(e) => setEditingResource({
                    ...editingResource,
                    properties: { ...editingResource.properties, node: e.currentTarget.value }
                  })}
                />
                <NumberInput
                  label="Memory (MB)"
                  value={editingResource.properties.memory}
                  onChange={(value) => setEditingResource({
                    ...editingResource,
                    properties: { ...editingResource.properties, memory: value }
                  })}
                />
                <NumberInput
                  label="CPU Cores"
                  value={editingResource.properties.cores}
                  onChange={(value) => setEditingResource({
                    ...editingResource,
                    properties: { ...editingResource.properties, cores: value }
                  })}
                />
                <NumberInput
                  label="Disk (GB)"
                  value={editingResource.properties.disk}
                  onChange={(value) => setEditingResource({
                    ...editingResource,
                    properties: { ...editingResource.properties, disk: value }
                  })}
                />
              </>
            )}

            <Group justify="flex-end" gap="sm">
              <Button variant="light" onClick={closeResourceModal}>
                Cancel
              </Button>
              <Button onClick={handleSaveResource}>
                Save Resource
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Parameter Edit Modal */}
      <Modal
        opened={parameterModalOpened}
        onClose={closeParameterModal}
        title={`${editingParameter ? 'Edit' : 'Add'} Parameter`}
        size="md"
      >
        {editingParameter && (
          <Stack gap="md">
            <TextInput
              label="Parameter Name"
              value={editingParameter.name}
              onChange={(e) => setEditingParameter({
                ...editingParameter,
                name: e.currentTarget.value
              })}
            />
            
            <Textarea
              label="Description"
              value={editingParameter.description}
              onChange={(e) => setEditingParameter({
                ...editingParameter,
                description: e.currentTarget.value
              })}
            />

            <Select
              label="Type"
              value={editingParameter.type}
              onChange={(value) => setEditingParameter({
                ...editingParameter,
                type: value as any
              })}
              data={[
                { value: 'string', label: 'String' },
                { value: 'number', label: 'Number' },
                { value: 'boolean', label: 'Boolean' },
                { value: 'select', label: 'Select' },
              ]}
            />

            <Switch
              label="Required"
              checked={editingParameter.required}
              onChange={(e) => setEditingParameter({
                ...editingParameter,
                required: e.currentTarget.checked
              })}
            />

            <Group justify="flex-end" gap="sm">
              <Button variant="light" onClick={closeParameterModal}>
                Cancel
              </Button>
              <Button onClick={handleSaveParameter}>
                Save Parameter
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal
        opened={previewModalOpened}
        onClose={closePreviewModal}
        title="Generated Code Preview"
        size="xl"
      >
        <Tabs defaultValue="terraform">
          <Tabs.List>
            <Tabs.Tab value="terraform" leftSection={<IconCode size={16} />}>
              Terraform
            </Tabs.Tab>
            <Tabs.Tab value="ansible" leftSection={<IconCode size={16} />}>
              Ansible
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="terraform" pt="md">
            <ScrollArea h={400}>
              <Code block>{generateTerraformConfig()}</Code>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="ansible" pt="md">
            <ScrollArea h={400}>
              <Code block>{generateAnsiblePlaybook()}</Code>
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </Stack>
  );
}