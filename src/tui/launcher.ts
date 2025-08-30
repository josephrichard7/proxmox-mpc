/**
 * TUI Launcher
 * Launches the Terminal User Interface with React Ink
 */

import { render } from "ink";
import React from "react";

import { App } from "./App";
import { ConsoleSession } from "./types";

export interface LaunchTUIOptions {
  session: ConsoleSession;
  connectionStatus?: "connected" | "disconnected" | "connecting";
  onCommand?: (command: string) => Promise<void>;
  onExit?: () => void;
}

export function launchTUI(options: LaunchTUIOptions) {
  const {
    session,
    connectionStatus = "disconnected",
    onCommand = async () => {},
    onExit = () => process.exit(0),
  } = options;

  // Render the TUI app
  const { waitUntilExit } = render(
    React.createElement(App, {
      session,
      connectionStatus,
      onCommand,
      onExit,
    }),
  );

  // Return promise that resolves when TUI exits
  return waitUntilExit();
}
