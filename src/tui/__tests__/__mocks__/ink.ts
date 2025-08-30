/**
 * Mock implementation of ink components for testing
 */
import React from "react";

interface BoxProps {
  children?: React.ReactNode;
  flexDirection?: "row" | "column";
  height?: string | number;
  width?: string | number;
  borderStyle?: string;
  paddingX?: number;
  paddingY?: number;
  marginX?: number;
  marginY?: number;
  marginBottom?: number;
  flexGrow?: number;
  justifyContent?: string;
  [key: string]: any;
}

interface TextProps {
  children?: React.ReactNode;
  bold?: boolean;
  color?: string;
  dimColor?: boolean;
  [key: string]: any;
}

export const Box: React.FC<BoxProps> = ({ children, ...props }) => {
  return React.createElement("div", { ...props }, children);
};

export const Text: React.FC<TextProps> = ({ children, ...props }) => {
  return React.createElement("span", { ...props }, children);
};

export const render = (element: React.ReactElement): any => {
  return {
    unmount: jest.fn(),
    cleanup: jest.fn(),
    waitUntilExit: jest.fn().mockResolvedValue(undefined),
  };
};
