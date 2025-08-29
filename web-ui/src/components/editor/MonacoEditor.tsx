import { useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { Paper, Group, Text, ActionIcon, Loader, Alert } from '@mantine/core';
import { IconDeviceFloppy, IconReload, IconAlertCircle } from '@tabler/icons-react';
import { useNotifications } from '@mantine/notifications';

export interface MonacoEditorProps {
  /** File content to display */
  value: string;
  /** Callback when content changes */
  onChange: (value: string) => void;
  /** File language (typescript, yaml, json, etc.) */
  language: string;
  /** File name for display */
  fileName?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Height of the editor */
  height?: string | number;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string;
  /** Auto-save functionality */
  autoSave?: boolean;
  /** Save callback */
  onSave?: (content: string) => Promise<void>;
}

/**
 * Monaco Editor component with Terraform and Ansible syntax highlighting
 * Provides professional IDE-like experience for Infrastructure as Code editing
 */
export function MonacoEditor({
  value,
  onChange,
  language,
  fileName,
  readOnly = false,
  height = '400px',
  loading = false,
  error,
  autoSave = false,
  onSave,
}: MonacoEditorProps) {
  const editorRef = useRef<any>(null);
  const notifications = useNotifications();

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && onSave) {
      const timeoutId = setTimeout(async () => {
        try {
          await onSave(value);
          notifications.show({
            title: 'Auto-saved',
            message: `${fileName || 'File'} has been auto-saved`,
            color: 'green',
            autoClose: 2000,
          });
        } catch (error) {
          notifications.show({
            title: 'Auto-save failed',
            message: `Failed to auto-save ${fileName || 'file'}`,
            color: 'red',
          });
        }
      }, 2000); // 2 second delay for auto-save

      return () => clearTimeout(timeoutId);
    }
  }, [value, autoSave, onSave, fileName, notifications]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Configure Terraform syntax highlighting
    if (language === 'hcl' || fileName?.endsWith('.tf')) {
      monaco.languages.register({ id: 'hcl' });
      monaco.languages.setMonarchTokensProvider('hcl', {
        tokenizer: {
          root: [
            [/[a-z_$][\w$]*/, 'identifier'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string'],
            [/[{}()\[\]]/, '@brackets'],
            [/[<>=!+\-*/&|^~?:]/, 'operator'],
            [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\d+/, 'number'],
            [/[;,.]/, 'delimiter'],
            [/#.*$/, 'comment'],
          ],
          string: [
            [/[^\\"]+/, 'string'],
            [/"/, 'string', '@pop'],
          ],
        },
      });

      // Add Terraform-specific auto-completion
      monaco.languages.registerCompletionItemProvider('hcl', {
        provideCompletionItems: () => ({
          suggestions: [
            {
              label: 'resource',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'resource "${1:type}" "${2:name}" {\n  $0\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
              label: 'variable',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'variable "${1:name}" {\n  type = ${2:string}\n  description = "${3:description}"\n  $0\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
              label: 'proxmox_vm_qemu',
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: 'proxmox_vm_qemu "${1:vm_name}" {\n  name = "${1:vm_name}"\n  node = "${2:node}"\n  clone = "${3:template}"\n  cores = ${4:2}\n  memory = ${5:2048}\n  $0\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
          ],
        }),
      });
    }

    // Configure YAML/Ansible syntax highlighting enhancements
    if (language === 'yaml' && fileName?.includes('ansible')) {
      monaco.languages.registerCompletionItemProvider('yaml', {
        provideCompletionItems: () => ({
          suggestions: [
            {
              label: 'playbook',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '---\n- name: ${1:Playbook name}\n  hosts: ${2:all}\n  become: yes\n  tasks:\n    - name: ${3:Task name}\n      ${4:module}:\n        $0',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
              label: 'proxmox_kvm',
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: 'proxmox_kvm:\n  api_host: "${1:proxmox_host}"\n  api_user: "${2:root@pam}"\n  api_password: "${3:password}"\n  name: "${4:vm_name}"\n  node: "${5:node}"\n  clone: "${6:template}"\n  cores: ${7:2}\n  memory: ${8:2048}\n  state: present',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
          ],
        }),
      });
    }

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 20,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'boundary',
      formatOnPaste: true,
      formatOnType: true,
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) {
        handleSave();
      }
    });
  };

  const handleSave = async () => {
    if (!onSave) return;

    try {
      await onSave(value);
      notifications.show({
        title: 'Saved',
        message: `${fileName || 'File'} has been saved successfully`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Save failed',
        message: `Failed to save ${fileName || 'file'}: ${error}`,
        color: 'red',
      });
    }
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.trigger('editor', 'editor.action.formatDocument');
    }
  };

  if (loading) {
    return (
      <Paper p="md" withBorder>
        <Group justify="center" p="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading editor...
          </Text>
        </Group>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Editor Error" color="red">
        {error}
      </Alert>
    );
  }

  return (
    <Paper withBorder>
      {/* Editor Header */}
      <Group p="xs" justify="space-between" style={{ borderBottom: '1px solid #e9ecef' }}>
        <Text size="sm" fw={500}>
          {fileName || 'Untitled'}
        </Text>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleFormat}
            title="Format Document"
          >
            <IconReload size={16} />
          </ActionIcon>
          {onSave && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={handleSave}
              title="Save (Ctrl+S)"
            >
              <IconDeviceFloppy size={16} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* Monaco Editor */}
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(newValue) => onChange(newValue || '')}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          theme: 'vs-light',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          minimap: { enabled: height !== '200px' }, // Disable minimap for small editors
        }}
        loading={<Loader size="sm" />}
      />
    </Paper>
  );
}