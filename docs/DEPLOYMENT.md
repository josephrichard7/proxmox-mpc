# Proxmox-MPC Production Deployment Guide

This guide covers deploying Proxmox-MPC in production environments with Docker containerization, security hardening, and performance optimization.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Production Deployment](#production-deployment)
5. [SSL/TLS Setup](#ssltls-setup)
6. [Database Options](#database-options)
7. [Monitoring & Observability](#monitoring--observability)
8. [Backup & Recovery](#backup--recovery)
9. [Security Hardening](#security-hardening)
10. [Performance Tuning](#performance-tuning)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 2GB minimum (4GB+ recommended)
- **Storage**: 10GB available space (SSD recommended)
- **Network**: Access to Proxmox VE servers on port 8006

### Software Dependencies
- Docker 20.10+ and Docker Compose v2
- Git (for source deployment)
- OpenSSL (for SSL certificate generation)

### Proxmox VE Requirements
- Proxmox VE 7.0+ server with API access
- API token with appropriate permissions:
  - VM.Audit, VM.Config, VM.Monitor (for VM management)
  - Datastore.Audit (for storage information)
  - Node.Audit (for node statistics)
  - Sys.Audit (for system information)

## Quick Start

### 1. Download and Setup
```bash
# Clone the repository
git clone https://github.com/your-org/proxmox-mpc.git
cd proxmox-mpc

# Copy environment configuration
cp .env.example .env

# Generate strong secrets
openssl rand -hex 32  # Use for JWT_SECRET
openssl rand -hex 32  # Use for SESSION_SECRET
```

### 2. Configure Environment
Edit `.env` file with your settings:
```bash
# Required Configuration
NODE_ENV=production
JWT_SECRET=your-generated-jwt-secret-here
SESSION_SECRET=your-generated-session-secret-here
CORS_ORIGIN=https://your-domain.com

# Proxmox Connection (configured via web UI after startup)
# Add through Settings > Proxmox Servers
```

### 3. Deploy with Docker
```bash
# Start the application
./scripts/deploy.sh deploy

# Check deployment status
./scripts/deploy.sh health

# View logs
./scripts/deploy.sh logs
```

### 4. Initial Setup
1. Access the web interface: `https://your-domain.com`
2. Complete initial setup wizard
3. Add your Proxmox servers via Settings > Proxmox Servers
4. Configure user accounts and permissions

## Configuration

### Environment Variables

#### Core Application
```bash
NODE_ENV=production           # Application environment
PORT=3000                     # Internal application port
LOG_LEVEL=info               # Logging level (error, warn, info, debug)
```

#### Security & Authentication
```bash
JWT_SECRET=                  # JWT signing secret (required)
SESSION_SECRET=              # Session encryption secret (required)
CORS_ORIGIN=                 # Allowed CORS origins
```

#### Database Configuration
```bash
# SQLite (default - suitable for single-server deployments)
DATABASE_URL=file:/app/data/proxmox-mpc.db

# PostgreSQL (recommended for production)
DATABASE_URL=postgresql://user:pass@postgres:5432/proxmox_mpc
POSTGRES_DB=proxmox_mpc
POSTGRES_USER=proxmox
POSTGRES_PASSWORD=secure_password
```

#### Performance & Security
```bash
RATE_LIMIT_WINDOW_MS=900000  # Rate limit window (15 minutes)
RATE_LIMIT_MAX_REQUESTS=100  # Max requests per window
MAX_REQUEST_SIZE=10mb        # Maximum request body size
```

## Production Deployment

### Architecture Overview
```
[Internet] → [Nginx Reverse Proxy] → [Proxmox-MPC App] → [Database]
              ↓ SSL Termination        ↓ WebSocket Support    ↓ SQLite/PostgreSQL  
           [Static Files Cache]     [Redis Session Store]
```

### Docker Compose Services
- **proxmox-mpc**: Main application container
- **nginx**: Reverse proxy with SSL termination
- **postgres**: PostgreSQL database (optional)
- **redis**: Session storage and caching (optional)
- **prometheus**: Metrics collection (optional)
- **grafana**: Metrics visualization (optional)

### Deployment Options

#### Option 1: Simple Deployment (SQLite + Single Container)
```bash
# Minimal deployment with SQLite
docker compose up -d proxmox-mpc nginx
```

#### Option 2: Production Deployment (PostgreSQL + Redis)
```bash
# Full production stack
docker compose --profile postgres --profile redis up -d
```

#### Option 3: Enterprise Deployment (Full Monitoring)
```bash
# Complete stack with monitoring
docker compose --profile postgres --profile redis --profile monitoring up -d
```

### Scaling Considerations
- **Horizontal Scaling**: Deploy multiple app containers behind load balancer
- **Database**: Use PostgreSQL for multi-instance deployments
- **Session Store**: Use Redis for session sharing across instances
- **File Storage**: Use shared volumes or S3-compatible storage

## SSL/TLS Setup

### Option 1: Let's Encrypt (Recommended)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to Docker volume
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./docker/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./docker/ssl/key.pem
```

### Option 2: Custom SSL Certificates
```bash
# Create SSL directory
mkdir -p docker/ssl

# Copy your certificates
cp your-domain.crt docker/ssl/cert.pem
cp your-domain.key docker/ssl/key.pem

# Set proper permissions
chmod 600 docker/ssl/key.pem
chmod 644 docker/ssl/cert.pem
```

### Option 3: Self-Signed Certificates (Development Only)
```bash
# Generate self-signed certificates
./scripts/deploy.sh deploy
# Script will automatically generate self-signed certs if none exist
```

## Database Options

### SQLite (Default)
- **Best for**: Single-server deployments, development, small teams
- **Pros**: Zero configuration, built-in, lightweight
- **Cons**: Single connection, not suitable for high concurrency
- **Configuration**: `DATABASE_URL=file:/app/data/proxmox-mpc.db`

### PostgreSQL (Recommended for Production)
- **Best for**: Production deployments, high availability, multiple replicas
- **Pros**: ACID compliance, concurrent connections, robust ecosystem
- **Cons**: Requires separate database server
- **Configuration**:
  ```bash
  DATABASE_URL=postgresql://proxmox:password@postgres:5432/proxmox_mpc
  ```

### Database Migration
```bash
# Migrate from SQLite to PostgreSQL
docker compose exec proxmox-mpc npm run db:migrate

# Create database backup before migration
./scripts/deploy.sh backup
```

## Monitoring & Observability

### Built-in Monitoring
- **Health Endpoint**: `/api/health` - Service health status
- **Metrics Endpoint**: `/api/metrics` - Application metrics
- **Performance Stats**: `/api/performance` - Response time statistics

### Prometheus Integration
```bash
# Deploy with monitoring
docker compose --profile monitoring up -d

# Access Prometheus: http://localhost:9090
# Access Grafana: http://localhost:3001
```

### Log Management
- **Structured Logging**: JSON formatted logs with correlation IDs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Log Aggregation**: Stdout/stderr for Docker log drivers
- **Log Rotation**: Handled by Docker logging configuration

### Application Metrics
- Request rate, response times, error rates
- VM/Container operation success rates
- Proxmox API response times
- Database query performance
- WebSocket connection metrics

## Backup & Recovery

### Automated Backups
```bash
# Create backup
./scripts/deploy.sh backup

# Backup location
./backups/YYYYMMDD_HHMMSS/
├── database.sql (or proxmox-mpc.db)
├── data.tar.gz
└── logs.tar.gz
```

### Backup Strategy
- **Daily Backups**: Automated via cron job
- **Retention**: 30 days (configurable)
- **Contents**: Database, configuration, logs
- **Storage**: Local filesystem, S3, or network storage

### Disaster Recovery
```bash
# Restore from backup
./scripts/deploy.sh restore /path/to/backup/directory

# Restore specific components
docker compose down
./scripts/deploy.sh restore-db /path/to/database.sql
./scripts/deploy.sh restore-data /path/to/data.tar.gz
docker compose up -d
```

## Security Hardening

### Container Security
- **Non-root User**: Application runs as unprivileged user
- **Read-only Root**: Container filesystem is read-only
- **No New Privileges**: Security options prevent privilege escalation
- **Resource Limits**: CPU and memory constraints
- **Secrets Management**: Environment variables, not embedded in images

### Network Security
- **HTTPS Only**: All traffic encrypted in transit
- **HSTS Headers**: Strict Transport Security enabled
- **Rate Limiting**: API endpoint protection
- **CORS Protection**: Restricted cross-origin requests
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options

### Application Security
- **JWT Authentication**: Secure token-based authentication
- **Session Management**: Secure session handling with Redis
- **Input Validation**: All inputs validated and sanitized
- **CSRF Protection**: Cross-site request forgery prevention
- **SQL Injection**: Parameterized queries with Prisma ORM

### Proxmox Connection Security
- **API Tokens**: Token-based authentication (not passwords)
- **TLS Verification**: Certificate validation (configurable)
- **Minimal Permissions**: Principle of least privilege
- **Connection Encryption**: HTTPS-only communication

### Security Best Practices
```bash
# Regular updates
docker compose pull
docker compose up -d

# Security scanning
docker scout cves
docker compose exec proxmox-mpc npm audit

# Access logging
tail -f logs/access.log | grep -E "(401|403|404|500)"

# Monitoring suspicious activity
docker compose exec prometheus curl http://localhost:9090/api/v1/query?query=rate(http_requests_total[5m])
```

## Performance Tuning

### Application Performance
- **Node.js Optimization**: Production mode, clustering
- **Database Optimization**: Connection pooling, query optimization
- **Caching**: Redis for sessions, API response caching
- **Compression**: Gzip/Brotli for response compression

### Frontend Performance
- **Code Splitting**: Lazy loading of route components
- **Bundle Optimization**: Tree shaking, minification
- **Asset Caching**: Long-term caching with versioning
- **Performance Monitoring**: Core Web Vitals tracking

### Infrastructure Performance
- **Resource Allocation**: Appropriate CPU/memory limits
- **SSD Storage**: Fast disk I/O for database and logs
- **Network Optimization**: Keep-alive connections, HTTP/2
- **Load Balancing**: Distribute load across multiple instances

### Performance Monitoring
```bash
# Application metrics
curl http://localhost:3000/api/performance

# System resources
docker stats

# Database performance
docker compose exec postgres pg_stat_statements
```

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker compose logs proxmox-mpc

# Verify configuration
docker compose config

# Check port conflicts
netstat -tlnp | grep :3000
```

#### Database Connection Issues
```bash
# Test database connectivity
docker compose exec proxmox-mpc npm run db:ping

# Check database logs
docker compose logs postgres

# Verify database credentials
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

#### SSL Certificate Problems
```bash
# Verify certificate files
ls -la docker/ssl/
openssl x509 -in docker/ssl/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in docker/ssl/cert.pem -enddate -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443
```

#### Proxmox Connection Issues
```bash
# Test API connectivity
curl -k https://proxmox-server:8006/api2/json/version

# Check token permissions
# Via Proxmox UI: Datacenter > Permissions > API Tokens

# Verify token in application logs
docker compose logs proxmox-mpc | grep -i proxmox
```

### Debugging Commands
```bash
# Enter application container
docker compose exec proxmox-mpc sh

# View real-time logs
docker compose logs -f

# Check service health
./scripts/deploy.sh health

# Monitor resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Database operations
docker compose exec postgres psql -U proxmox -d proxmox_mpc -c "SELECT * FROM nodes;"
```

### Performance Debugging
```bash
# Application performance
curl http://localhost:3000/api/performance

# Database queries
docker compose exec postgres pg_stat_activity

# Network connectivity
docker compose exec proxmox-mpc ping proxmox-server
docker compose exec proxmox-mpc curl -I https://proxmox-server:8006

# Memory usage
docker compose exec proxmox-mpc cat /proc/meminfo
```

### Getting Help
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check the docs/ directory for detailed guides
- **Community**: Join our community forum or Discord
- **Enterprise Support**: Contact us for professional support options

## Next Steps
- Read the [API Documentation](API.md) for integration details
- Check [Architecture Guide](ARCHITECTURE.md) for system design
- Review [Security Guide](SECURITY.md) for hardening procedures
- See [Performance Guide](PERFORMANCE.md) for optimization tips