/**
 * Interactive Command Input Component
 * Simplified version compatible with current ink version
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';

export interface CommandInputProps {
  onCommand: (command: string) => Promise<void>;
  history: string[];
  suggestions?: string[];
  loading?: boolean;
  prompt?: string;
  currentInput?: string;
}

const AVAILABLE_COMMANDS = [
  '/init - Initialize new Proxmox project workspace',
  '/sync - Synchronize with Proxmox server',
  '/status - Show project and server status',
  '/help - Show available commands',
  '/exit - Exit the console',
  '/anonymize - Anonymize sensitive data',
  '/privacy - Show privacy settings',
  'create vm - Create virtual machine',
  'list vms - List virtual machines',
  'list containers - List containers',
];

export const CommandInput: React.FC<CommandInputProps> = ({
  onCommand,
  history,
  loading = false,
  prompt = 'proxmox-mpc> ',
  currentInput = '',
  suggestions,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <Box flexDirection="column">
      {/* Command Input Line */}
      <Box>
        <Text color="cyan" bold>
          {prompt}
        </Text>
        <Text>
          {currentInput}
          <Text color="gray">_</Text>
        </Text>
        {loading && <Text color="yellow"> (processing...)</Text>}
      </Box>

      {/* Help/Suggestions when input starts with / */}
      {currentInput.startsWith('/') && (
        <Box flexDirection="column" marginLeft={prompt.length} marginTop={1}>
          <Text color="gray" dimColor>Available commands:</Text>
          {AVAILABLE_COMMANDS
            .filter(cmd => cmd.toLowerCase().includes(currentInput.toLowerCase()))
            .slice(0, 5)
            .map((suggestion, index) => (
              <Box key={suggestion}>
                <Text color="cyan">
                  {'  '}
                  {suggestion}
                </Text>
              </Box>
            ))}
          
          {history.length > 0 && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                History: {history.length} commands • Use ↑/↓ to navigate
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Keyboard shortcuts help */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Tab: Autocomplete • ↑/↓: History • Enter: Execute • Ctrl+C: Exit
        </Text>
      </Box>
    </Box>
  );
};