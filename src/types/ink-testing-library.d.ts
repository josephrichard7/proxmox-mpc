declare module "ink-testing-library" {
  import { ReactElement } from "react";

  interface RenderResult {
    lastFrame(): string;
    frames: string[];
    rerender(element: ReactElement): void;
    unmount(): void;
    stdin: {
      write(text: string): void;
    };
    stdout: {
      lastFrame(): string;
      frames: string[];
    };
    stderr: {
      lastFrame(): string;
      frames: string[];
    };
  }

  export function render(element: ReactElement): RenderResult;
}
