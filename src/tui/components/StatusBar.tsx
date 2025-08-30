import React from 'react';
import { Box, Text } from 'ink';
import { StatusBarProps } from '../types';

export const StatusBar: React.FC<StatusBarProps> = ({
  session,
  connectionStatus,
  showTime = true
}) => {
  // Calculate session duration
  const sessionDuration = session.startTime ? 
    Math.floor((Date.now() - session.startTime.getTime()) / 1000) : 0;
  
  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  // Get connection status info
  const getStatusInfo = () => {
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

  const status = getStatusInfo();
  const historyCount = session.history?.length || 0;

  return (
    <Box justifyContent="space-between" paddingX={1} borderStyle="single">
      {/* Left side: Session information */}
      <Box>
        <Text dimColor>Session: </Text>
        <Text>{formatDuration(sessionDuration)}</Text>
        <Text dimColor> | Commands: </Text>
        <Text color="cyan">{historyCount}</Text>
        {session.workspace ? (
          <>
            <Text dimColor> | Workspace: </Text>
            <Text bold>{session.workspace.name}</Text>
          </>
        ) : (
          <>
            <Text dimColor> | </Text>
            <Text color="yellow">No workspace</Text>
          </>
        )}
      </Box>

      {/* Right side: Connection status and optional time */}
      <Box>
        {showTime && (
          <>
            <Text dimColor>Uptime: </Text>
            <Text>{formatDuration(sessionDuration)}</Text>
            <Text dimColor> | </Text>
          </>
        )}
        <Text>{status.symbol} </Text>
        <Text color={status.color as any}>{status.text}</Text>
        {session.workspace && (
          <>
            <Text dimColor> | Server: </Text>
            <Text>{session.workspace.config.host}:{session.workspace.config.port}</Text>
          </>
        )}
      </Box>
    </Box>
  );
};