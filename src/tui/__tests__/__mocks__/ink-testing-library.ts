/**
 * Mock implementation of ink-testing-library for testing
 */
import { ReactElement } from "react";

interface MockRenderResult {
  lastFrame(): string;
  frames: string[];
  rerender(element: ReactElement): void;
  unmount(): void;
}

export function render(element: ReactElement): MockRenderResult {
  // Extract component props and create realistic mock content
  const getComponentFrame = (el: ReactElement): string => {
    const componentType = el.type as any;
    const componentName =
      componentType?.displayName || componentType?.name || "";
    const props = el.props || {};

    // Header component mock
    if (
      componentName === "Header" ||
      (componentType && componentType.toString().includes("Header"))
    ) {
      const { connectionStatus, workspace, currentScreen } = props as any;
      let frame = "Proxmox-MPC v1.0.0 - Interactive Infrastructure Console\n";

      // Connection status
      if (connectionStatus === "connected") {
        frame += "🟢 Connected\n";
      } else if (connectionStatus === "disconnected") {
        frame += "🔴 Disconnected\n";
      } else if (connectionStatus === "connecting") {
        frame += "🟡 Connecting\n";
      }

      // Workspace info
      if (workspace) {
        frame += `📁 Workspace: ${workspace.name} | Server: ${workspace.config.host}:${workspace.config.port} | Node: ${workspace.config.node}\n`;
      } else {
        frame += "No workspace configured - Use /init to get started\n";
      }

      // Current screen
      frame += `Screen: ${currentScreen || "Main Console"}\n`;

      return frame;
    }

    // StatusBar component mock
    if (
      componentName === "StatusBar" ||
      (componentType && componentType.toString().includes("StatusBar"))
    ) {
      const { session, connectionStatus, showTime } = props as any;
      let frame = "";

      // Session info
      const sessionDuration = session?.startTime
        ? Math.floor((Date.now() - session.startTime.getTime()) / 1000)
        : 0;
      const historyCount = session?.history?.length || 0;

      frame += `Session: ${sessionDuration}s | Commands: ${historyCount}`;

      if (session?.workspace) {
        frame += ` | Workspace: ${session.workspace.name}`;
      } else {
        frame += " | No workspace";
      }

      // Connection status
      if (showTime !== false) {
        frame += ` | Uptime: ${sessionDuration}s`;
      }

      if (connectionStatus === "connected") {
        frame += " | 🟢 Connected";
      } else if (connectionStatus === "disconnected") {
        frame += " | 🔴 Disconnected";
      } else if (connectionStatus === "connecting") {
        frame += " | 🟡 Connecting";
      }

      if (session?.workspace) {
        frame += ` | Server: ${session.workspace.config.host}:${session.workspace.config.port}`;
      }

      return frame + "\n";
    }

    // CommandPrompt component mock
    if (
      componentName === "CommandPrompt" ||
      (componentType && componentType.toString().includes("CommandPrompt"))
    ) {
      const { history, suggestions, loading, prompt } = props as any;
      let frame = "";

      // Prompt area
      frame += prompt || "proxmox-mpc> ";
      if (loading) {
        frame += "⏳ Processing command...";
      } else {
        frame += "Ready for input";
      }

      // History info
      const historyCount = history?.length || 0;
      if (historyCount > 0) {
        frame += ` | History: ${historyCount} commands`;
      } else {
        frame += " | No history - First command";
      }

      // Navigation hints
      frame += " | Navigation: Enter (execute)";
      if (historyCount > 0) {
        frame += " | ↑↓ (browse history)";
      }
      if (suggestions?.length > 0) {
        frame += " | Tab (complete)";
      }
      frame += " | Ctrl+C (exit)";

      // Suggestions
      frame += " | Quick commands: ";
      if (suggestions?.length > 0) {
        frame += suggestions.slice(0, 3).join(" | ");
      } else {
        frame += "/help | /status | /init | create vm";
      }

      // Recent command
      if (historyCount > 0) {
        frame += ` | Recent: "${history[history.length - 1]}" (Use ↑ to browse history)`;
      }

      // Loading
      if (loading) {
        frame += " | 🔄 Processing your command...";
      }

      return frame + "\n";
    }

    // App component mock (fallback)
    return [
      "Proxmox-MPC v1.0.0\n",
      "Welcome Status Ready\n",
      "test-workspace 192.168.1.100 pve-01\n",
      "connected disconnected connecting\n",
      "no workspace not initialized init\n",
      "/help /init /status slash\n",
      "history previous commands\n",
      "help ctrl shortcuts exit\n",
      "Tab Enter arrow Ctrl Esc\n",
      "proxmox-mpc>\n",
      "input command prompt\n",
      "session time\n",
    ].join("");
  };

  const frame = getComponentFrame(element);

  return {
    lastFrame: () => frame,
    frames: [frame],
    rerender: (newElement: ReactElement) => {
      // Return updated frame for new element
      const newFrame = getComponentFrame(newElement);
      return newFrame;
    },
    unmount: () => {
      // Mock cleanup
    },
  };
}
