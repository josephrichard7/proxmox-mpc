/**
 * TUI Type Definitions
 * Defines the interface for Terminal User Interface components
 */

import { ProxmoxClient } from "../api";
import { ProjectWorkspace } from "../workspace";

// Re-export ConsoleSession interface for TUI compatibility
export interface ConsoleSession {
  workspace?: ProjectWorkspace;
  client?: ProxmoxClient;
  rl: any; // readline.Interface or TUI equivalent
  history: string[];
  startTime: Date;
}

// TUI-specific interfaces
export interface TUIProps {
  session: ConsoleSession;
  connectionStatus: "connected" | "disconnected" | "connecting";
  onCommand?: (command: string) => Promise<void>;
  onExit?: () => void;
}

export interface HeaderProps {
  workspace?: ProjectWorkspace;
  connectionStatus: "connected" | "disconnected" | "connecting";
  currentScreen?: string;
}

export interface StatusBarProps {
  session: ConsoleSession;
  connectionStatus: "connected" | "disconnected" | "connecting";
  showTime?: boolean;
}

export interface CommandPromptProps {
  onCommand: (command: string) => Promise<void>;
  history: string[];
  suggestions?: string[];
  loading?: boolean;
  prompt?: string;
}

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error";

export interface Screen {
  name: string;
  title: string;
  component: React.ComponentType<any>;
}

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  symbols: {
    success: string;
    error: string;
    warning: string;
    info: string;
    loading: string;
  };
}

export interface SessionContext {
  session: ConsoleSession;
  updateSession: (updates: Partial<ConsoleSession>) => void;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
}
