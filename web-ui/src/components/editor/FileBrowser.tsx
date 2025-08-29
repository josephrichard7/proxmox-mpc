import { useState, useEffect } from 'react';
import {
  Paper,
  ScrollArea,
  Text,
  Group,
  ActionIcon,
  Button,
  Modal,
  TextInput,
  Select,
  Stack,
  Loader,
  Alert,
  Tree,
  TreeNodeData,
} from '@mantine/core';
import {
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconPlus,
  IconTrash,
  IconEdit,
  IconGitBranch,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useNotifications } from '@mantine/notifications';

export interface FileSystemItem {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileSystemItem[];
  size?: number;
  modified?: Date;
  language?: string;
}

export interface FileBrowserProps {
  /** File system structure */
  files: FileSystemItem[];
  /** Currently selected file path */
  selectedFile?: string;
  /** Callback when a file is selected */
  onFileSelect: (file: FileSystemItem) => void;
  /** Callback when a file is created */
  onFileCreate?: (parentPath: string, name: string, type: 'file' | 'directory') => Promise<void>;
  /** Callback when a file is deleted */
  onFileDelete?: (path: string) => Promise<void>;
  /** Callback when a file is renamed */
  onFileRename?: (oldPath: string, newPath: string) => Promise<void>;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string;
  /** Enable git integration */
  gitEnabled?: boolean;
}

/**
 * File browser component for Infrastructure as Code file management
 * Provides file tree navigation, creation, deletion, and git integration
 */
export function FileBrowser({
  files,
  selectedFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  loading = false,
  error,
  gitEnabled = false,
}: FileBrowserProps) {
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileSystemItem } | null>(null);
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [renameModalOpened, { open: openRenameModal, close: closeRenameModal }] = useDisclosure(false);
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'file' | 'directory'>('file');
  const notifications = useNotifications();

  // Convert file system items to tree data
  useEffect(() => {
    const convertToTreeData = (items: FileSystemItem[]): TreeNodeData[] => {
      return items.map((item) => {
        const getFileIcon = (name: string, type: string) => {
          if (type === 'directory') {
            return expandedNodes.includes(item.path) ? <IconFolderOpen size={16} /> : <IconFolder size={16} />;
          }
          
          // File type icons
          if (name.endsWith('.tf')) return '🏗️';
          if (name.endsWith('.yml') || name.endsWith('.yaml')) return '📋';
          if (name.endsWith('.json')) return '📄';
          if (name.endsWith('.md')) return '📖';
          return <IconFile size={16} />;
        };

        return {
          value: item.path,
          label: (
            <Group gap="xs" style={{ cursor: 'pointer' }}>
              {getFileIcon(item.name, item.type)}
              <Text 
                size="sm" 
                fw={selectedFile === item.path ? 600 : 400}
                c={selectedFile === item.path ? 'blue' : undefined}
              >
                {item.name}
              </Text>
            </Group>
          ),
          children: item.children ? convertToTreeData(item.children) : undefined,
        };
      });
    };

    setTreeData(convertToTreeData(files));
  }, [files, selectedFile, expandedNodes]);

  // Expand parent directories by default
  useEffect(() => {
    const expandParents = (items: FileSystemItem[], parentPath = '') => {
      const expanded: string[] = [];
      items.forEach((item) => {
        const fullPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        if (item.type === 'directory') {
          expanded.push(fullPath);
          if (item.children) {
            expanded.push(...expandParents(item.children, fullPath));
          }
        }
      });
      return expanded;
    };

    setExpandedNodes(expandParents(files));
  }, [files]);

  const handleNodeClick = (nodeValue: string) => {
    const findItem = (items: FileSystemItem[], path: string): FileSystemItem | null => {
      for (const item of items) {
        if (item.path === path) return item;
        if (item.children) {
          const found = findItem(item.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    const item = findItem(files, nodeValue);
    if (item) {
      if (item.type === 'directory') {
        setExpandedNodes((prev) => 
          prev.includes(nodeValue) 
            ? prev.filter(path => path !== nodeValue)
            : [...prev, nodeValue]
        );
      } else {
        onFileSelect(item);
      }
    }
  };

  const handleCreateFile = async () => {
    if (!newItemName.trim() || !onFileCreate) return;

    try {
      const parentPath = selectedItem?.type === 'directory' ? selectedItem.path : '';
      await onFileCreate(parentPath, newItemName, newItemType);
      notifications.show({
        title: 'File created',
        message: `${newItemType === 'file' ? 'File' : 'Directory'} "${newItemName}" has been created`,
        color: 'green',
      });
      setNewItemName('');
      closeCreateModal();
    } catch (error) {
      notifications.show({
        title: 'Creation failed',
        message: `Failed to create ${newItemType}: ${error}`,
        color: 'red',
      });
    }
  };

  const handleRenameFile = async () => {
    if (!newItemName.trim() || !onFileRename || !selectedItem) return;

    try {
      const newPath = selectedItem.path.replace(selectedItem.name, newItemName);
      await onFileRename(selectedItem.path, newPath);
      notifications.show({
        title: 'File renamed',
        message: `"${selectedItem.name}" has been renamed to "${newItemName}"`,
        color: 'green',
      });
      setNewItemName('');
      closeRenameModal();
    } catch (error) {
      notifications.show({
        title: 'Rename failed',
        message: `Failed to rename file: ${error}`,
        color: 'red',
      });
    }
  };

  const handleDeleteFile = async (item: FileSystemItem) => {
    if (!onFileDelete) return;

    try {
      await onFileDelete(item.path);
      notifications.show({
        title: 'File deleted',
        message: `"${item.name}" has been deleted`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Delete failed',
        message: `Failed to delete file: ${error}`,
        color: 'red',
      });
    }
  };

  const getFileLanguage = (fileName: string): string => {
    if (fileName.endsWith('.tf')) return 'hcl';
    if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'yaml';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.md')) return 'markdown';
    if (fileName.endsWith('.sh')) return 'shell';
    return 'plaintext';
  };

  if (loading) {
    return (
      <Paper p="md" withBorder h={400}>
        <Group justify="center" align="center" h="100%">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading files...</Text>
        </Group>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper p="md" withBorder h={400}>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      </Paper>
    );
  }

  return (
    <>
      <Paper withBorder>
        {/* Header */}
        <Group p="xs" justify="space-between" style={{ borderBottom: '1px solid #e9ecef' }}>
          <Text size="sm" fw={600}>Files</Text>
          <Group gap="xs">
            {gitEnabled && (
              <ActionIcon variant="subtle" size="sm" title="Git Status">
                <IconGitBranch size={16} />
              </ActionIcon>
            )}
            {onFileCreate && (
              <ActionIcon 
                variant="subtle" 
                size="sm" 
                onClick={() => {
                  setNewItemName('');
                  setNewItemType('file');
                  openCreateModal();
                }}
                title="New File"
              >
                <IconPlus size={16} />
              </ActionIcon>
            )}
          </Group>
        </Group>

        {/* File Tree */}
        <ScrollArea h={360}>
          {treeData.length === 0 ? (
            <Group justify="center" p="xl">
              <Text size="sm" c="dimmed">No files found</Text>
            </Group>
          ) : (
            <Tree
              data={treeData}
              levelOffset={20}
              expandedState={[expandedNodes, setExpandedNodes]}
              renderNode={(payload) => (
                <Group 
                  gap="xs" 
                  onClick={() => handleNodeClick(payload.node.value)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const item = files.find(f => f.path === payload.node.value);
                    if (item) {
                      setContextMenu({ x: e.clientX, y: e.clientY, item });
                    }
                  }}
                  style={{ 
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: '#f8f9fa',
                    }
                  }}
                >
                  {payload.node.label}
                </Group>
              )}
            />
          )}
        </ScrollArea>
      </Paper>

      {/* Create File Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Create New Item"
        size="sm"
      >
        <Stack gap="md">
          <Select
            label="Type"
            value={newItemType}
            onChange={(value) => setNewItemType(value as 'file' | 'directory')}
            data={[
              { value: 'file', label: 'File' },
              { value: 'directory', label: 'Directory' },
            ]}
          />
          
          <TextInput
            label="Name"
            value={newItemName}
            onChange={(e) => setNewItemName(e.currentTarget.value)}
            placeholder={newItemType === 'file' ? 'main.tf' : 'terraform'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFile();
            }}
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button onClick={handleCreateFile} disabled={!newItemName.trim()}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Rename File Modal */}
      <Modal
        opened={renameModalOpened}
        onClose={closeRenameModal}
        title="Rename Item"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="New Name"
            value={newItemName}
            onChange={(e) => setNewItemName(e.currentTarget.value)}
            placeholder={selectedItem?.name}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameFile();
            }}
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={closeRenameModal}>
              Cancel
            </Button>
            <Button onClick={handleRenameFile} disabled={!newItemName.trim()}>
              Rename
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}