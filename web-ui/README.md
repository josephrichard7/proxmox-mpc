# Proxmox-MPC Web Dashboard

React frontend for the Proxmox-MPC Interactive Infrastructure Console.

## Features

- **Modern React Architecture**: Built with React 18, TypeScript, and Vite
- **Professional UI**: Mantine UI components with responsive design
- **Real-time Updates**: WebSocket integration for live infrastructure monitoring
- **Authentication**: Secure JWT-based authentication with auto-refresh
- **State Management**: React Query for server state, React Context for application state
- **Type Safety**: Full TypeScript support with Zod validation

## Technology Stack

- **React 18** - Modern React with concurrent features
- **TypeScript** - Full type safety
- **Vite** - Fast development and building
- **Mantine UI v7** - Professional React components
- **React Query** - Server state management
- **React Router v6** - Client-side routing
- **Socket.io** - Real-time communication
- **Axios** - HTTP client with interceptors
- **Zod** - Schema validation
- **Vitest** - Testing framework

## Development

### Prerequisites

- Node.js 18+ 
- npm 8+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3001 in your browser
```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with HMR
npm run build        # Build for production
npm run preview      # Preview production build

# Quality
npm run lint         # ESLint checking
npm run test         # Run tests with Vitest
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
```

## Architecture

### Directory Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── layout/         # Layout components (Header, Navbar)
│   └── infrastructure/ # Infrastructure-specific components
├── pages/              # Route-based page components
├── services/           # API integration services
├── stores/             # State management (Context API)
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── test/               # Test setup and utilities
```

### State Management

- **Authentication**: React Context for user state and JWT management
- **WebSocket**: React Context for real-time communication
- **Server State**: React Query for API calls and caching
- **Form State**: Mantine Form for form management

### API Integration

The frontend communicates with the Proxmox-MPC backend API:

- **Base URL**: `/api` (proxied to backend in development)
- **Authentication**: JWT tokens with automatic refresh
- **WebSocket**: Real-time updates on `/socket.io`
- **Error Handling**: Automatic retry and user notifications

## Configuration

### Environment Variables

```bash
# Backend API URL (automatically proxied in development)
VITE_API_BASE_URL=http://localhost:3000/api

# WebSocket URL (automatically proxied in development)
VITE_WS_URL=http://localhost:3000
```

### Proxy Configuration

Development server automatically proxies API calls to the backend:

- `/api/*` → `http://localhost:3000/api/*`
- `/socket.io/*` → `http://localhost:3000/socket.io/*`

## Building for Production

```bash
# Build the application
npm run build

# The build artifacts will be stored in the dist/ directory
# These can be served by the Express backend in production
```

## Testing

### Testing Strategy

- **Unit Tests**: Component logic and utilities
- **Integration Tests**: User workflows and API integration
- **E2E Tests**: Full application workflows (planned)

### Writing Tests

```typescript
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

## Deployment

The web UI is designed to be served by the Express backend in production:

1. Build the React application: `npm run build`
2. The backend serves static files from `web-ui/dist/`
3. API calls and WebSocket connections are handled by the same server

## Contributing

1. Follow the existing code style and patterns
2. Write tests for new features
3. Update documentation as needed
4. Ensure TypeScript types are properly defined

## Integration with Backend

The frontend integrates seamlessly with the Proxmox-MPC backend:

- **Authentication**: JWT-based with automatic refresh
- **API Calls**: RESTful API for all CRUD operations
- **Real-time Updates**: WebSocket for live infrastructure monitoring
- **Error Handling**: Consistent error responses and user feedback