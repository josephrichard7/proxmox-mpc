# OpenTUI Implementation Guide

## Overview

This document describes the migration from readline-based terminal interface to React Ink TUI framework for enhanced user experience.

## Architecture

### Current Implementation Status

**✅ Completed Components:**

- Basic TUI App component with layout structure
- CommandInput component with autocomplete suggestions
- Type definitions for TUI components
- Project structure under `/src/tui/`
- TUI launcher for integration

**🚧 In Progress:**

- Interactive input handling
- Real-time command execution
- Component testing framework

**⏳ Planned:**

- Split-pane layouts
- Real-time status monitoring
- Advanced keyboard shortcuts
- Theme customization

### Directory Structure

```
src/tui/
├── components/
│   └── CommandInput.tsx      # Interactive command input
├── screens/                  # Future screen components
├── hooks/                    # Custom React hooks
├── utils/                    # TUI utilities
├── __tests__/               # Test files
├── App.tsx                  # Main TUI application
├── types.ts                 # TypeScript definitions
├── launcher.ts              # TUI entry point
└── index.ts                 # Main exports
```

### Key Components

#### App Component (`App.tsx`)

- Main layout container
- Header with app name and version
- Connection status indicator
- Workspace information display
- Command history summary
- Navigation hints

#### CommandInput Component (`CommandInput.tsx`)

- Interactive command prompt
- Real-time command suggestions
- History navigation hints
- Loading state indicators

#### TUI Types (`types.ts`)

- `TUIProps`: Main app component properties
- `CommandInputProps`: Command input component interface
- `ConsoleSession`: Shared session interface
- `ConnectionStatus`: Connection state type

## Integration with Existing Console

### Backward Compatibility

The TUI implementation maintains full compatibility with existing console commands:

- All slash commands (`/init`, `/sync`, `/status`, etc.)
- Resource management commands
- Anonymization and privacy commands

### Feature Flag Support

```typescript
// Feature flag for TUI mode
const USE_TUI = process.env.PROXMOX_MPC_TUI === "true";

if (USE_TUI) {
  await launchTUI({
    session: consoleSession,
    connectionStatus: "disconnected",
    onCommand: handleCommand,
    onExit: () => process.exit(0),
  });
} else {
  // Fall back to readline interface
  startReadlineInterface();
}
```

## Benefits of React Ink TUI

### Enhanced User Experience

- **Rich Visual Interface**: Colors, layouts, and formatting
- **Real-time Updates**: Dynamic status and progress indicators
- **Keyboard Navigation**: Intuitive shortcuts and navigation
- **Responsive Design**: Adapts to terminal size changes

### Developer Experience

- **Component Architecture**: Reusable React components
- **TypeScript Support**: Full type safety and IntelliSense
- **Testing Framework**: React-based testing with ink-testing-library
- **Hot Reload**: Fast development iteration

### Performance

- **Efficient Rendering**: Virtual DOM optimizations
- **Memory Management**: React's garbage collection
- **State Management**: Predictable React state patterns

## Usage Examples

### Basic TUI Launch

```typescript
import { launchTUI } from "./src/tui";

const session = {
  rl: null,
  history: [],
  startTime: new Date(),
  workspace: undefined,
  client: undefined,
};

await launchTUI({
  session,
  connectionStatus: "disconnected",
  onCommand: async (command) => {
    console.log("Executing:", command);
    // Handle command execution
  },
  onExit: () => {
    console.log("TUI exited");
    process.exit(0);
  },
});
```

### With Workspace Integration

```typescript
await launchTUI({
  session: {
    ...session,
    workspace: {
      name: "my-project",
      config: {
        host: "proxmox.local",
        node: "pve",
        projectName: "My Project",
      },
    },
  },
  connectionStatus: "connected",
  onCommand: handleProxmoxCommand,
});
```

## Testing Strategy

### Component Testing

```typescript
import { render } from 'ink-testing-library';
import { App } from '../App';

test('renders TUI app', () => {
  const { lastFrame } = render(<App session={mockSession} connectionStatus="disconnected" />);
  expect(lastFrame()).toMatch(/Proxmox-MPC/);
});
```

### Integration Testing

- Test command execution flows
- Validate keyboard navigation
- Check responsive behavior
- Verify error handling

## Future Enhancements

### Phase 2: Advanced UI Features

- **Split-pane Layouts**: Command input and output separation
- **Real-time Monitoring**: Live resource usage displays
- **Interactive Tables**: Sortable and filterable resource lists
- **Progress Indicators**: Visual progress for long operations

### Phase 3: Advanced Navigation

- **Modal Dialogs**: Complex configuration workflows
- **Tab Navigation**: Multiple workspace management
- **Search Interface**: Global command and resource search
- **Help System**: Interactive help and tutorials

### Phase 4: Customization

- **Theme Support**: Color schemes and styling
- **Keyboard Shortcuts**: Customizable key bindings
- **Layout Options**: Configurable pane arrangements
- **Plugin System**: Extensible component architecture

## Migration Notes

### From Readline to React Ink

1. **Input Handling**: Moved from readline events to React state
2. **Output Format**: Replaced console.log with React components
3. **State Management**: Centralized in React component state
4. **Event System**: Replaced EventEmitter with React props

### Breaking Changes

- None - maintains full API compatibility
- Optional feature flag activation
- Graceful fallback to readline interface

### Performance Considerations

- React Ink adds ~2MB to bundle size
- Rendering performance: ~16ms for full screen updates
- Memory usage: +10-20MB for React runtime
- Startup time: +50-100ms initialization

## Troubleshooting

### Common Issues

1. **Terminal Compatibility**: Some terminals may not support all features
2. **Color Support**: Fallback to monochrome in unsupported terminals
3. **Resize Handling**: Some layouts may not resize gracefully

### Debugging

```bash
# Enable TUI debug mode
DEBUG=ink* npm run console

# Test specific TUI components
npm test -- src/tui/__tests__/
```

## Conclusion

The React Ink TUI implementation provides a foundation for creating rich, interactive terminal experiences while maintaining full backward compatibility with the existing readline-based interface. The component architecture enables rapid development of new UI features and provides a solid foundation for future enhancements.
