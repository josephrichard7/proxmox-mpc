#!/usr/bin/env node

/**
 * Proxmox-MPC Web Dashboard Server
 * 
 * Express.js server providing REST API and WebSocket functionality
 * for the Proxmox-MPC web dashboard interface.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';

import { Logger } from '../observability/logger';

const logger = Logger.getInstance();
import { errorHandler } from './api/middleware/error';
import { authMiddleware } from './api/middleware/auth';
import { validationMiddleware } from './api/middleware/validation';

// Import API routes
import authRoutes from './api/routes/auth';
import vmRoutes from './api/routes/vms';
import containerRoutes from './api/routes/containers';
import nodeRoutes from './api/routes/nodes';
import infrastructureRoutes from './api/routes/infrastructure';

// Import WebSocket handler
import { setupWebSocket } from './websocket';
import { initializeNotificationService, stopNotificationService } from './websocket/notification-service';

// Load environment variables
dotenv.config();

const PORT = process.env.WEB_PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

/**
 * Express application configuration
 */
class ProxmoxMPCWebServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: CORS_ORIGIN,
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
      message: {
        error: 'Too many requests from this IP',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP request', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      next();
    });
  }

  /**
   * Configure API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: NODE_ENV
      });
    });

    // API documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Proxmox-MPC Web API',
        version: process.env.npm_package_version || '1.0.0',
        description: 'REST API for Proxmox-MPC Interactive Infrastructure Console',
        documentation: '/api/docs',
        endpoints: {
          auth: '/api/auth',
          vms: '/api/vms',
          containers: '/api/containers',
          nodes: '/api/nodes',
          infrastructure: '/api/infrastructure'
        }
      });
    });

    // Public routes (no authentication required)
    this.app.use('/api/auth', authRoutes);

    // Protected routes (authentication required)
    this.app.use('/api/vms', authMiddleware, vmRoutes);
    this.app.use('/api/containers', authMiddleware, containerRoutes);
    this.app.use('/api/nodes', authMiddleware, nodeRoutes);
    this.app.use('/api/infrastructure', authMiddleware, infrastructureRoutes);

    // Serve static files from React build (production)
    if (NODE_ENV === 'production') {
      const buildPath = path.join(__dirname, '../../web-ui/dist');
      this.app.use(express.static(buildPath));
      
      // Serve React app for all non-API routes
      this.app.get('*', (req, res) => {
        if (!req.path.startsWith('/api/')) {
          res.sendFile(path.join(buildPath, 'index.html'));
        }
      });
    }

    // 404 handler for unknown routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  /**
   * Configure WebSocket server
   */
  private setupWebSocket(): void {
    setupWebSocket(this.io);
    
    // Initialize notification service for real-time updates
    initializeNotificationService(this.io);
    
    logger.info('WebSocket server and notification service initialized');
  }

  /**
   * Configure error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);

    // Graceful shutdown handling
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      this.server.listen(PORT, () => {
        logger.info('Proxmox-MPC Web Server started', {
          port: PORT,
          environment: NODE_ENV,
          cors: CORS_ORIGIN,
          pid: process.pid
        });
      });
    } catch (error) {
      logger.error('Failed to start web server', { error });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    // Stop notification service
    stopNotificationService();
    
    this.server.close((err: any) => {
      if (err) {
        logger.error('Error during server shutdown', { error: err });
        process.exit(1);
      }
      
      logger.info('Web server shut down gracefully');
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forceful shutdown after timeout');
      process.exit(1);
    }, 30000);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new ProxmoxMPCWebServer();
  server.start().catch((error) => {
    logger.error('Failed to start web server', { error });
    process.exit(1);
  });
}

export { ProxmoxMPCWebServer };