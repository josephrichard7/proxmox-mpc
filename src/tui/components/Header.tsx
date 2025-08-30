import React from 'react';
import { Box, Text } from 'ink';
import { HeaderProps } from '../types';
import { getDisplayVersion } from '../../utils/version';

export const Header: React.FC<HeaderProps> = ({
  workspace,
  connectionStatus,
  currentScreen = 'Main Console'
}) => {
  // Get connection status indicator
  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { symbol: '🟢', text: 'Connected', color: 'green' };
      case 'disconnected':
        return { symbol: '🔴', text: 'Disconnected', color: 'red' };
      case 'connecting':
        return { symbol: '🟡', text: 'Connecting', color: 'yellow' };
      default:
        return { symbol: '⚪', text: 'Unknown', color: 'gray' };
    }
  };

  const status = getStatusIndicator();

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      {/* Main Header Row */}
      <Box justifyContent="space-between" width="100%">
        {/* Left: Application Branding */}
        <Box>
          <Text bold color="cyan">🔧 Proxmox-MPC</Text>
          <Text dimColor> {getDisplayVersion()}</Text>
          <Text dimColor> - Interactive Infrastructure Console</Text>
        </Box>
        
        {/* Right: Connection Status */}
        <Box>
          <Text>{status.symbol} </Text>
          <Text color={status.color as any}>{status.text}</Text>
        </Box>
      </Box>

      {/* Second Row: Workspace and Screen Information */}
      <Box justifyContent="space-between" width="100%" marginY={0}>
        {/* Left: Workspace Info */}
        <Box>
          {workspace ? (
            <>
              <Text color="green">📁 Workspace: </Text>
              <Text bold>{workspace.name}</Text>
              <Text dimColor> | Server: {workspace.config.host}:{workspace.config.port}</Text>
              <Text dimColor> | Node: {workspace.config.node}</Text>
            </>
          ) : (
            <Text dimColor>No workspace configured - Use /init to get started</Text>
          )}
        </Box>
        
        {/* Right: Current Screen */}
        <Box>
          <Text dimColor>Screen: </Text>
          <Text>{currentScreen}</Text>
        </Box>
      </Box>
    </Box>
  );
};