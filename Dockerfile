# Multi-stage Docker build for production deployment
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY web-ui/package*.json ./web-ui/
COPY web-ui/yarn.lock ./web-ui/

# Install frontend dependencies
RUN cd web-ui && npm ci --only=production

# Copy frontend source
COPY web-ui/ ./web-ui/

# Build frontend for production
RUN cd web-ui && npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-builder

WORKDIR /app

# Copy backend package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source
COPY src/ ./src/
COPY prisma/ ./prisma/
COPY tsconfig*.json ./

# Build backend
RUN npm run build

# Generate Prisma client
RUN npx prisma generate

# Stage 3: Production runtime
FROM node:18-alpine AS production

# Install security updates and tools
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    openssl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S proxmox-mpc && \
    adduser -S proxmox-mpc -u 1001 -G proxmox-mpc

WORKDIR /app

# Copy backend build and dependencies
COPY --from=backend-builder --chown=proxmox-mpc:proxmox-mpc /app/dist ./dist
COPY --from=backend-builder --chown=proxmox-mpc:proxmox-mpc /app/node_modules ./node_modules
COPY --from=backend-builder --chown=proxmox-mpc:proxmox-mpc /app/prisma ./prisma
COPY --from=backend-builder --chown=proxmox-mpc:proxmox-mpc /app/package*.json ./

# Copy frontend build
COPY --from=frontend-builder --chown=proxmox-mpc:proxmox-mpc /app/web-ui/dist ./web-ui/dist

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/temp && \
    chown -R proxmox-mpc:proxmox-mpc /app

# Copy configuration files
COPY --chown=proxmox-mpc:proxmox-mpc docker/ ./docker/

# Switch to non-root user
USER proxmox-mpc

# Environment variables for production
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL="file:./data/proxmox-mpc.db" \
    LOG_LEVEL=info \
    MAX_REQUEST_SIZE=10mb \
    RATE_LIMIT_WINDOW_MS=900000 \
    RATE_LIMIT_MAX_REQUESTS=100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Volume for persistent data
VOLUME ["/app/data", "/app/logs"]

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]