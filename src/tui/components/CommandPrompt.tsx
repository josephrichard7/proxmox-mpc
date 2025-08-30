import React from 'react';
import { Box, Text } from 'ink';
import { CommandPromptProps } from '../types';

export const CommandPrompt: React.FC<CommandPromptProps> = ({
  onCommand,
  history,
  suggestions,
  loading = false,
  prompt = 'proxmox-mpc> '
}) => {
  const historyCount = history?.length || 0;
  const hasHistory = historyCount > 0;
  const hasSuggestions = suggestions && suggestions.length > 0;

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      {/* Command Input Area */}
      <Box justifyContent="space-between" width="100%">
        {/* Left: Prompt */}
        <Box>
          <Text bold color="cyan">{prompt}</Text>
          {loading ? (
            <Text color="yellow">⏳ Processing command...</Text>
          ) : (
            <Text dimColor>Ready for input</Text>
          )}
        </Box>
        
        {/* Right: Status */}
        <Box>
          {hasHistory ? (
            <>
              <Text dimColor>History: </Text>
              <Text color="cyan">{historyCount} commands</Text>
            </>
          ) : (
            <Text dimColor>No history - First command</Text>
          )}
        </Box>
      </Box>

      {/* Help and Navigation Hints */}
      <Box flexDirection="column" marginTop={1}>
        {/* Navigation hints */}
        <Box>
          <Text dimColor>⌨️  Navigation: </Text>
          <Text dimColor>Enter (execute) | </Text>
          {hasHistory && <Text dimColor>↑↓ (browse history) | </Text>}
          {hasSuggestions && <Text dimColor>Tab (complete) | </Text>}
          <Text dimColor>Ctrl+C (exit)</Text>
        </Box>
        
        {/* Command suggestions */}
        <Box marginTop={0}>
          <Text dimColor>💡 Quick commands: </Text>
          {hasSuggestions ? (
            <Text color="green">{suggestions.slice(0, 3).join(' | ')}</Text>
          ) : (
            <Text color="green">/help | /status | /init | create vm</Text>
          )}
        </Box>

        {/* History hint */}
        {hasHistory && (
          <Box marginTop={0}>
            <Text dimColor>📚 Recent: </Text>
            <Text color="cyan">"{history[history.length - 1]}"</Text>
            <Text dimColor> (Use ↑ to browse history)</Text>
          </Box>
        )}

        {/* Loading message */}
        {loading && (
          <Box marginTop={0}>
            <Text color="yellow">🔄 Processing your command...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};