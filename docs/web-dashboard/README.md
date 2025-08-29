# Proxmox-MPC Web Dashboard

A professional web interface for managing Proxmox Virtual Environment infrastructure through an intuitive dashboard.

## 🌟 Features

### Core Functionality
- **Interactive Dashboard**: Real-time infrastructure overview with live metrics
- **VM Management**: Complete virtual machine lifecycle management
- **Container Management**: LXC container operations and monitoring
- **Node Monitoring**: Cluster health and resource usage visualization
- **Real-time Updates**: WebSocket-powered live status updates

### Advanced Features
- **Infrastructure-as-Code Editor**: Monaco Editor with Terraform/Ansible support
- **Template Management**: Create and deploy infrastructure templates
- **Batch Operations**: Multi-resource operations with progress tracking
- **Network Visualization**: Interactive topology with D3.js
- **Mobile Responsive**: Full mobile and tablet support

### Enterprise Features
- **Authentication & Security**: JWT-based authentication with role-based access
- **Performance Optimized**: Sub-3 second load times with intelligent caching
- **Accessibility Compliant**: WCAG 2.1 AA compliance with screen reader support
- **Production Ready**: Docker deployment with monitoring and logging

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- Docker and Docker Compose (for production)
- Proxmox VE server with API access

### Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   cd web-ui && npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Configure Proxmox connection
   PROXMOX_HOST=your-proxmox-server.local
   PROXMOX_TOKEN=your-api-token
   ```

3. **Start Development Servers**
   ```bash
   # Terminal 1: Backend API
   npm run web:dev
   
   # Terminal 2: React Frontend  
   cd web-ui && npm run dev
   ```

4. **Access Application**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000/api
   - Login: admin / admin123 (development)

### Production Deployment

1. **Docker Compose Deployment**
   ```bash
   # Configure environment
   cp .env.example .env.production
   # Edit .env.production with your settings
   
   # Deploy with Docker Compose
   docker-compose --env-file .env.production up -d
   ```

2. **Access Production Application**
   - Web Interface: http://localhost:80
   - Monitoring (optional): http://localhost:9090 (Prometheus), http://localhost:3001 (Grafana)

## 📱 User Interface

### Dashboard Overview
![Dashboard](screenshots/dashboard.png)

The main dashboard provides:
- **Infrastructure Summary**: VM, container, and node counts
- **Resource Usage**: CPU, memory, and storage utilization
- **Quick Actions**: Create resources, manage nodes
- **Node Status Cards**: Individual node health and performance

### VM Management
![VM Management](screenshots/vm-management.png)

Complete VM lifecycle management:
- **Table View**: Sortable, filterable VM list
- **Creation Wizard**: Step-by-step VM creation
- **Lifecycle Operations**: Start, stop, restart, delete
- **Bulk Operations**: Multi-VM operations
- **Real-time Status**: Live status updates

### Container Management
![Container Management](screenshots/container-management.png)

LXC container operations:
- **Container Templates**: Browse available templates
- **Resource Configuration**: CPU, memory, storage settings
- **Privilege Management**: Privileged/unprivileged containers
- **Template Deployment**: One-click template deployment

### Configuration Editor
![Configuration Editor](screenshots/configuration-editor.png)

Infrastructure-as-Code editing:
- **Monaco Editor**: Professional code editor with syntax highlighting
- **File Browser**: Navigate terraform and ansible files
- **Syntax Validation**: Real-time validation and error highlighting
- **Auto-completion**: Context-aware code completion

## 🔧 Configuration

### Environment Variables

#### Required Configuration
```bash
# Proxmox Server
PROXMOX_HOST=your-proxmox-server.local
PROXMOX_TOKEN=your-api-token

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/proxmoxmpc

# Security
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret
```

#### Optional Configuration
```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# Features
ENABLE_MONITORING=true
ENABLE_TEMPLATES=true
```

### Database Setup

The application supports both SQLite (development) and PostgreSQL (production):

```bash
# Development (SQLite)
npm run db:migrate

# Production (PostgreSQL)
DATABASE_URL=postgresql://... npm run db:migrate:prod
```

### Authentication

Default authentication uses local database with JWT tokens:
- Default credentials: `admin` / `admin123`
- Token expiry: 24 hours
- Refresh token: 7 days

## 🏗️ Architecture

### Backend (Express.js)
```
src/web/
├── api/           # REST API routes
├── middleware/    # Authentication, validation
├── websocket/     # Real-time updates
└── services/      # Business logic
```

### Frontend (React)
```
web-ui/src/
├── pages/         # Main application pages
├── components/    # Reusable UI components
├── services/      # API clients
├── stores/        # State management
└── utils/         # Helper functions
```

### Key Technologies
- **Backend**: Express.js, TypeScript, Prisma ORM, Socket.IO
- **Frontend**: React 18, Mantine UI, TanStack Query, TypeScript
- **Database**: PostgreSQL (production), SQLite (development)
- **Real-time**: WebSocket with Socket.IO
- **Caching**: Redis for session and API caching
- **Containerization**: Docker with multi-stage builds

## 🧪 Testing

### Test Suite Coverage
```bash
# Backend tests
npm run test:web

# Frontend tests
cd web-ui && npm run test

# Integration tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Test Categories
- **Unit Tests**: Component and utility testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Complete user workflow testing
- **Accessibility Tests**: WCAG compliance validation

### Testing Stack
- **Unit**: Jest, React Testing Library
- **Mocking**: MSW (Mock Service Worker)
- **E2E**: Playwright
- **Coverage**: 85%+ target across all test types

## 🔒 Security

### Security Features
- **Authentication**: JWT with refresh tokens
- **Input Validation**: Zod schema validation
- **CORS Configuration**: Restrictive cross-origin policies
- **Rate Limiting**: API rate limiting and abuse prevention
- **Security Headers**: Helmet.js security headers
- **SQL Injection Prevention**: Prisma ORM parameterized queries

### Security Best Practices
- Environment variable management
- Secrets rotation procedures
- Docker security hardening
- HTTPS enforcement in production
- Security dependency scanning

## ♿ Accessibility

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Color Contrast**: 4.5:1 minimum ratio compliance
- **Focus Management**: Logical focus flow and trapping
- **Alternative Text**: Comprehensive image descriptions
- **Motion Preferences**: Respects `prefers-reduced-motion`

### Accessibility Testing
```bash
# Automated accessibility testing
npm run test:a11y

# Manual testing checklist
npm run audit:accessibility
```

## 📊 Performance

### Performance Targets
- **Load Time**: < 3 seconds on 3G networks
- **API Response**: < 200ms average response time
- **Bundle Size**: < 500KB initial, < 2MB total
- **Lighthouse Score**: 90+ performance score

### Optimization Features
- **Code Splitting**: Route-based and component-based splitting
- **Lazy Loading**: Images and non-critical components
- **Caching Strategy**: API caching with intelligent invalidation
- **Bundle Optimization**: Tree shaking and compression
- **WebSocket Efficiency**: Selective real-time updates

### Monitoring
```bash
# Performance monitoring
npm run analyze:bundle
npm run test:performance
npm run audit:lighthouse
```

## 🚀 Deployment

### Production Deployment Options

#### 1. Docker Compose (Recommended)
```bash
# Single-command deployment
docker-compose --env-file .env.production up -d

# With monitoring stack
docker-compose --profile monitoring --env-file .env.production up -d
```

#### 2. Kubernetes Deployment
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Configure ingress and secrets
kubectl apply -f k8s/ingress.yaml
kubectl create secret generic proxmox-secrets --from-env-file=.env.production
```

#### 3. Manual Deployment
```bash
# Build application
npm run build:web

# Start production server
NODE_ENV=production npm run web:start
```

### Health Checks
- **Application**: `GET /api/health`
- **Database**: Connection pool status
- **Proxmox**: Server connectivity check
- **WebSocket**: Connection status

### Monitoring Integration
- **Prometheus**: Application metrics collection
- **Grafana**: Performance dashboards
- **Log Aggregation**: Structured JSON logging
- **Error Tracking**: Application error monitoring

## 🔧 Troubleshooting

### Common Issues

#### Authentication Failures
```bash
# Check JWT configuration
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

#### Database Connection Issues  
```bash
# Test database connectivity
npm run db:test-connection

# Check migration status
npm run db:status
```

#### Proxmox API Issues
```bash
# Test Proxmox connection
npm run cli test-connection --verbose

# Validate API token
curl -k "https://your-proxmox:8006/api2/json/version" \
  -H "Authorization: PVEAPIToken=user@realm!tokenid=secret"
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=proxmox-mpc:* npm run web:dev

# Frontend debug mode
REACT_APP_DEBUG=true npm run dev
```

### Performance Issues
```bash
# Analyze bundle size
npm run analyze:bundle

# Check API response times
curl -w "@curl-format.txt" http://localhost:3000/api/infrastructure/status
```

## 📚 API Reference

### Authentication Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/profile` - User profile
- `POST /api/auth/logout` - User logout

### Infrastructure Management
- `GET /api/infrastructure/status` - Infrastructure overview
- `POST /api/infrastructure/sync` - Synchronize with Proxmox

### VM Management
- `GET /api/vms` - List virtual machines
- `POST /api/vms` - Create virtual machine
- `GET /api/vms/:id` - Get VM details
- `PUT /api/vms/:id` - Update VM configuration
- `DELETE /api/vms/:id` - Delete virtual machine
- `POST /api/vms/:id/start` - Start virtual machine
- `POST /api/vms/:id/stop` - Stop virtual machine
- `POST /api/vms/:id/restart` - Restart virtual machine

### Container Management
- `GET /api/containers` - List containers
- `POST /api/containers` - Create container
- `DELETE /api/containers/:id` - Delete container
- `POST /api/containers/:id/start` - Start container
- `POST /api/containers/:id/stop` - Stop container

### Node Monitoring
- `GET /api/nodes` - List cluster nodes
- `GET /api/nodes/:name` - Get node details

### File Management
- `GET /api/infrastructure/files` - List IaC files
- `GET /api/infrastructure/files/:path` - Read file content
- `PUT /api/infrastructure/files/:path` - Write file content
- `DELETE /api/infrastructure/files/:path` - Delete file

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Standards
- TypeScript strict mode
- ESLint + Prettier formatting
- Jest testing (85%+ coverage)
- Semantic commit messages
- Documentation for all public APIs

### Testing Requirements
- Unit tests for all components
- Integration tests for API endpoints
- Accessibility tests for UI components
- End-to-end tests for critical workflows

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

## 🙏 Acknowledgments

- **Proxmox VE**: Virtual environment platform
- **React**: Frontend framework
- **Mantine**: UI component library
- **Express.js**: Backend framework
- **Monaco Editor**: Code editor
- **D3.js**: Data visualization

---

**Proxmox-MPC Web Dashboard** - Transforming infrastructure management into an intuitive, powerful web experience.