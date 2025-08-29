import { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Title,
  Paper,
  Text,
  Group,
  Button,
  ActionIcon,
  Badge,
  Alert,
  Tabs,
  Modal,
  Stack,
  Code,
  Loader,
} from '@mantine/core';
import {
  IconCode,
  IconEye,
  IconTerminal,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconRefresh,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useNotifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { MonacoEditor } from '../components/editor/MonacoEditor';
import { FileBrowser, FileSystemItem } from '../components/editor/FileBrowser';
import { apiService } from '../services/ApiService';

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  warnings: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'warning';
  }>;
}

interface PreviewResult {
  changes: Array<{
    action: 'create' | 'update' | 'delete';
    resource: string;
    type: string;
    properties: Record<string, any>;
  }>;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration Editor page for Infrastructure as Code management
 * Provides file editing, validation, and preview capabilities
 */
export function ConfigurationPage() {
  const [selectedFile, setSelectedFile] = useState<FileSystemItem | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [activeTab, setActiveTab] = useState('editor');
  const [previewModalOpened, { open: openPreviewModal, close: closePreviewModal }] = useDisclosure(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  
  const notifications = useNotifications();
  const queryClient = useQueryClient();

  // Fetch file system structure
  const {
    data: files = [],
    isLoading: filesLoading,
    error: filesError,
  } = useQuery({
    queryKey: ['configuration-files'],
    queryFn: async () => {
      const response = await apiService.getInfrastructureFiles();
      return response.data.data as FileSystemItem[];
    },
  });

  // Fetch file content
  const {
    data: currentFileContent,
    isLoading: contentLoading,
  } = useQuery({
    queryKey: ['file-content', selectedFile?.path],
    queryFn: async () => {
      if (!selectedFile) return '';
      const response = await apiService.getFileContent(selectedFile.path);
      return response.data.data.content as string;
    },
    enabled: !!selectedFile,
  });

  // Save file mutation
  const saveFileMutation = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      return apiService.saveFile(path, content);
    },
    onSuccess: () => {
      notifications.show({
        title: 'File saved',
        message: 'Configuration file has been saved successfully',
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['file-content'] });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Save failed',
        message: error.response?.data?.message || 'Failed to save file',
        color: 'red',
      });
    },
  });

  // Create file mutation
  const createFileMutation = useMutation({
    mutationFn: async ({ parentPath, name, type }: { parentPath: string; name: string; type: 'file' | 'directory' }) => {
      return apiService.createFile(parentPath, name, type);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuration-files'] });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (path: string) => {
      return apiService.deleteFile(path);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuration-files'] });
    },
  });

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedFile) throw new Error('No file selected');
      
      const language = getFileLanguage(selectedFile.name);
      return apiService.validateConfiguration(
        selectedFile.path,
        content,
        language === 'hcl' ? 'terraform' : 'ansible'
      );
    },
    onSuccess: (response) => {
      setValidationResult(response.data);
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      return apiService.previewInfrastructure();
    },
    onSuccess: (response) => {
      setPreviewResult(response.data);
      openPreviewModal();
    },
  });

  // Update file content when file changes
  useEffect(() => {
    if (currentFileContent !== undefined) {
      setFileContent(currentFileContent);
    }
  }, [currentFileContent]);

  const handleFileSelect = (file: FileSystemItem) => {
    if (file.type === 'file') {
      setSelectedFile(file);
      setValidationResult(null);
    }
  };

  const handleFileCreate = async (parentPath: string, name: string, type: 'file' | 'directory') => {
    await createFileMutation.mutateAsync({ parentPath, name, type });
  };

  const handleFileDelete = async (path: string) => {
    await deleteFileMutation.mutateAsync(path);
  };

  const handleFileSave = async (content: string) => {
    if (!selectedFile) return;
    await saveFileMutation.mutateAsync({ path: selectedFile.path, content });
  };

  const handleValidate = () => {
    if (!selectedFile) return;
    validateMutation.mutate(fileContent);
  };

  const handlePreview = () => {
    previewMutation.mutate();
  };

  const getFileLanguage = (fileName: string): string => {
    if (fileName.endsWith('.tf')) return 'hcl';
    if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'yaml';
    if (fileName.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  const getValidationBadge = () => {
    if (!validationResult) return null;
    
    const errorCount = validationResult.errors.length;
    const warningCount = validationResult.warnings.length;
    
    if (errorCount > 0) {
      return <Badge color="red" size="sm">{errorCount} errors</Badge>;
    }
    if (warningCount > 0) {
      return <Badge color="yellow" size="sm">{warningCount} warnings</Badge>;
    }
    return <Badge color="green" size="sm">Valid</Badge>;
  };

  return (
    <Container fluid>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>Infrastructure as Code Editor</Title>
            <Text c="dimmed" size="sm">
              Edit Terraform and Ansible configurations with syntax highlighting and validation
            </Text>
          </div>
          <Group>
            <ActionIcon
              variant="light"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['configuration-files'] })}
              loading={filesLoading}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <Grid gutter="lg">
          {/* File Browser */}
          <Grid.Col span={3}>
            <FileBrowser
              files={files}
              selectedFile={selectedFile?.path}
              onFileSelect={handleFileSelect}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
              loading={filesLoading}
              error={filesError?.message}
              gitEnabled={true}
            />
          </Grid.Col>

          {/* Editor and Tools */}
          <Grid.Col span={9}>
            <Paper withBorder>
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="editor" leftSection={<IconCode size={16} />}>
                    Editor
                  </Tabs.Tab>
                  <Tabs.Tab 
                    value="validation" 
                    leftSection={<IconCheck size={16} />}
                    rightSection={getValidationBadge()}
                  >
                    Validation
                  </Tabs.Tab>
                  <Tabs.Tab value="preview" leftSection={<IconEye size={16} />}>
                    Preview
                  </Tabs.Tab>
                  <Tabs.Tab value="terminal" leftSection={<IconTerminal size={16} />}>
                    Terminal
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="editor" pt="md">
                  {selectedFile ? (
                    <Stack gap="md">
                      {/* Editor Actions */}
                      <Group justify="space-between" p="xs">
                        <Group>
                          <Text size="sm" fw={500}>
                            {selectedFile.name}
                          </Text>
                          <Badge size="xs" color="blue">
                            {getFileLanguage(selectedFile.name)}
                          </Badge>
                        </Group>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconCheck size={14} />}
                            onClick={handleValidate}
                            loading={validateMutation.isPending}
                          >
                            Validate
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconEye size={14} />}
                            onClick={handlePreview}
                            loading={previewMutation.isPending}
                          >
                            Preview Changes
                          </Button>
                        </Group>
                      </Group>

                      {/* Monaco Editor */}
                      <MonacoEditor
                        value={fileContent}
                        onChange={setFileContent}
                        language={getFileLanguage(selectedFile.name)}
                        fileName={selectedFile.name}
                        height="600px"
                        loading={contentLoading}
                        autoSave={true}
                        onSave={handleFileSave}
                      />
                    </Stack>
                  ) : (
                    <Group justify="center" p="xl">
                      <Text c="dimmed">Select a file to edit</Text>
                    </Group>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="validation" pt="md">
                  {validationResult ? (
                    <Stack gap="md">
                      <Group>
                        <Text fw={600}>Validation Results</Text>
                        {getValidationBadge()}
                      </Group>
                      
                      {validationResult.errors.map((error, index) => (
                        <Alert
                          key={index}
                          icon={<IconX size={16} />}
                          title={`Error in ${error.file}:${error.line}:${error.column}`}
                          color="red"
                        >
                          {error.message}
                        </Alert>
                      ))}
                      
                      {validationResult.warnings.map((warning, index) => (
                        <Alert
                          key={index}
                          icon={<IconAlertTriangle size={16} />}
                          title={`Warning in ${warning.file}:${warning.line}:${warning.column}`}
                          color="yellow"
                        >
                          {warning.message}
                        </Alert>
                      ))}
                      
                      {validationResult.valid && validationResult.errors.length === 0 && (
                        <Alert
                          icon={<IconCheck size={16} />}
                          title="Configuration Valid"
                          color="green"
                        >
                          All configuration files are valid and ready for deployment.
                        </Alert>
                      )}
                    </Stack>
                  ) : (
                    <Group justify="center" p="xl">
                      <Text c="dimmed">Run validation to see results</Text>
                    </Group>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="preview" pt="md">
                  <Group justify="center" p="md">
                    <Button
                      leftSection={<IconEye size={16} />}
                      onClick={handlePreview}
                      loading={previewMutation.isPending}
                    >
                      Generate Preview
                    </Button>
                  </Group>
                </Tabs.Panel>

                <Tabs.Panel value="terminal" pt="md">
                  <Paper p="md" style={{ backgroundColor: '#1e1e1e', color: '#d4d4d4' }}>
                    <Code block>
                      {`$ terraform plan
$ ansible-playbook --check playbook.yml
$ # Terminal output will appear here`}
                    </Code>
                  </Paper>
                </Tabs.Panel>
              </Tabs>
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>

      {/* Preview Modal */}
      <Modal
        opened={previewModalOpened}
        onClose={closePreviewModal}
        title="Infrastructure Changes Preview"
        size="lg"
      >
        {previewResult ? (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              The following changes will be applied to your infrastructure:
            </Text>
            
            {previewResult.changes.map((change, index) => (
              <Paper key={index} p="md" withBorder>
                <Group>
                  <Badge 
                    color={
                      change.action === 'create' ? 'green' : 
                      change.action === 'update' ? 'blue' : 'red'
                    }
                  >
                    {change.action}
                  </Badge>
                  <Text fw={500}>{change.resource}</Text>
                  <Badge variant="light">{change.type}</Badge>
                </Group>
              </Paper>
            ))}
            
            {previewResult.warnings.length > 0 && (
              <Alert icon={<IconAlertTriangle size={16} />} color="yellow">
                <Text size="sm" fw={500}>Warnings:</Text>
                {previewResult.warnings.map((warning, index) => (
                  <Text key={index} size="sm">{warning}</Text>
                ))}
              </Alert>
            )}
            
            {previewResult.errors.length > 0 && (
              <Alert icon={<IconX size={16} />} color="red">
                <Text size="sm" fw={500}>Errors:</Text>
                {previewResult.errors.map((error, index) => (
                  <Text key={index} size="sm">{error}</Text>
                ))}
              </Alert>
            )}
          </Stack>
        ) : (
          <Group justify="center" p="xl">
            <Loader size="sm" />
            <Text>Generating preview...</Text>
          </Group>
        )}
      </Modal>
    </Container>
  );
}