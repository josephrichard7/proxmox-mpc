import React from 'react';
import { Box, Text } from 'ink';
import { TUIProps } from './types';
import { getDisplayVersion } from '../utils/version';

export const App: React.FC<TUIProps> = ({ session, onCommand }) => {
  // Calculate session duration
  const sessionTime = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
  
  // Determine connection status based on workspace and client
  const connectionStatus = session.client ? 'connected' : 
                          session.workspace ? 'disconnected' : 'connecting';

  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Header Section */}
      <Box borderStyle="round" paddingX={1}>
        <Text bold color="cyan">
          🔧 Proxmox-MPC {getDisplayVersion()}
        </Text>
        <Text dimColor> - Interactive Infrastructure Console</Text>
      </Box>

      {/* Main Content Area */}
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        {/* Welcome/Status Message */}
        <Box marginY={1}>
          {session.workspace ? (
            <>
              <Text color="green">✅ Workspace: </Text>
              <Text bold>{session.workspace.name}</Text>
              <Text> | Server: {session.workspace.config.host} | Node: {session.workspace.config.node}</Text>
            </>
          ) : (
            <>
              <Text color="yellow">⚠️  No workspace initialized</Text>
              <Text dimColor> - Use /init to get started</Text>
            </>
          )}
        </Box>

        {/* Connection Status */}
        <Box marginBottom={1}>
          <Text>Status: </Text>
          <Text color={
            connectionStatus === 'connected' ? 'green' : 
            connectionStatus === 'disconnected' ? 'red' : 'yellow'
          }>
            {connectionStatus.toUpperCase()}
          </Text>
        </Box>

        {/* Help Text */}
        <Box marginBottom={1}>
          <Text dimColor>
            💡 Available: /help | /init | /status | Type 'help' for more commands
          </Text>
        </Box>

        {/* Command History Summary */}
        {session.history.length > 0 && (
          <Box marginBottom={1}>
            <Text>History: </Text>
            <Text color="cyan">{session.history.length} previous commands</Text>
            <Text dimColor> (Use arrow keys to browse)</Text>
          </Box>
        )}

        {/* Navigation Hints */}
        <Box marginBottom={1}>
          <Text dimColor>
            ⌨️  Navigation: Tab (next) | Shift+Tab (prev) | Ctrl+C (exit) | Enter (execute)
          </Text>
        </Box>
      </Box>

      {/* Command Area */}
      <Box borderStyle="single" paddingX={1}>
        <Text color="cyan" bold>proxmox-mpc&gt; </Text>
        <Text dimColor>Ready for input...</Text>
      </Box>

      {/* Status Bar */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text dimColor>Session time: {sessionTime}s</Text>
        <Text dimColor>
          {connectionStatus === 'connected' && '🟢'} 
          {connectionStatus === 'disconnected' && '🔴'} 
          {connectionStatus === 'connecting' && '🟡'} 
          {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
        </Text>
      </Box>
    </Box>
  );
};