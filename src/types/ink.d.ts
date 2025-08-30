declare module "ink" {
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

  export const Box: React.FC<BoxProps>;
  export const Text: React.FC<TextProps>;
  export function render(element: React.ReactElement): any;
}
