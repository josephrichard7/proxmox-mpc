/**
 * Container Management Routes
 * 
 * REST API endpoints for container management in Proxmox-MPC.
 * Provides CRUD operations and status management for containers.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery, validateParams, validationSchemas } from '../middleware/validation';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error';
import { logger } from '../../../observability/logger';

// Import existing services
import { ContainerRepository } from '../../../database/repositories/container-repository';
import { ProxmoxClient } from '../../../api/proxmox-client';
import { DatabaseClient } from '../../../database/client';
import { ContainerCreateConfig, ContainerInfo } from '../../../types';
import { getNotificationService } from '../../websocket/notification-service';

const router = Router();

/**
 * GET /api/containers
 * List all containers with optional filtering and pagination
 */
router.get('/',
  validateQuery(validationSchemas.listQuery),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, sort, order, search, status, node, tags } = req.query;
    const userId = req.user!.id;

    logger.info('Container list request', {
      userId,
      query: { page, limit, sort, order, search, status, node, tags }
    });

    try {
      // Initialize database client
      const dbClient = DatabaseClient.getInstance();
      const containerRepo = new ContainerRepository(dbClient);

      // Build filter options
      const filters: any = {};
      if (search) {
        filters.hostname = { contains: search };
      }
      if (status) {
        filters.status = status;
      }
      if (node) {
        filters.nodeId = node;
      }
      if (tags) {
        const tagArray = (tags as string).split(',').map(tag => tag.trim());
        filters.tags = { hasSome: tagArray };
      }

      // Get total count for pagination
      const total = await containerRepo.count(filters);

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get containers with pagination
      const containers = await containerRepo.findMany({
        where: filters,
        skip: offset,
        take: limit,
        orderBy: sort ? { [sort]: order } : { id: 'asc' }
      });

      res.json({
        success: true,
        data: {
          containers: containers.map(container => ({
            id: container.id,
            hostname: container.hostname,
            status: container.status,
            node: container.nodeId,
            memory: container.memoryBytes ? Number(container.memoryBytes / BigInt(1024 * 1024)) : 0,
            cores: container.cpuCores,
            uptime: container.uptime,
            cpuUsage: container.cpuUsage,
            memoryUsage: container.memoryUsage,
            tags: container.tags,
            createdAt: container.createdAt,
            updatedAt: container.updatedAt
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      logger.error('Failed to list containers', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * GET /api/containers/:id
 * Get detailed container information
 */
router.get('/:id',
  validateParams(validationSchemas.containerParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('Container details request', { userId, containerId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const containerRepo = new ContainerRepository(dbClient);

      const container = await containerRepo.findById(id);
      if (!container) {
        throw new NotFoundError('Container', id.toString());
      }

      // Get live status from Proxmox if available
      let liveStatus = null;
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: container.nodeId,
            rejectUnauthorized: false
          });
          
          liveStatus = await proxmoxClient.getContainerStatus(container.nodeId, container.id);
        }
      } catch (proxmoxError) {
        logger.warn('Failed to get live container status from Proxmox', {
          containerId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
      }

      res.json({
        success: true,
        data: {
          container: {
            id: container.id,
            hostname: container.hostname,
            status: container.status,
            node: container.nodeId,
            memory: container.memoryBytes ? Number(container.memoryBytes / BigInt(1024 * 1024)) : 0,
            cores: container.cpuCores,
            template: container.template,
            uptime: container.uptime,
            cpuUsage: container.cpuUsage,
            memoryUsage: container.memoryUsage,
            diskUsage: container.diskUsage,
            networkIn: container.networkIn,
            networkOut: container.networkOut,
            tags: container.tags,
            unprivileged: container.unprivileged,
            startOnBoot: container.startOnBoot,
            protection: container.protection,
            createdAt: container.createdAt,
            updatedAt: container.updatedAt,
            liveStatus: liveStatus || undefined
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get container details', {
        userId,
        containerId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * POST /api/containers
 * Create a new container
 */
router.post('/',
  validateBody(validationSchemas.createContainer),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const containerData = req.body;
    const userId = req.user!.id;

    logger.info('Container creation request', {
      userId,
      containerName: containerData.name,
      node: containerData.node
    });

    try {
      const dbClient = DatabaseClient.getInstance();
      const containerRepo = new ContainerRepository(dbClient);

      // Check if container name already exists
      const existingContainer = await containerRepo.findByHostname(containerData.name);
      if (existingContainer) {
        throw new ValidationError('Container name already exists', { name: containerData.name });
      }

      // Create container in database first to get ID
      const newContainer = await containerRepo.create({
        hostname: containerData.name,
        nodeId: containerData.node,
        status: 'stopped',
        template: false,
        cpuCores: containerData.cores,
        memoryBytes: BigInt(containerData.memory * 1024 * 1024),
        tags: containerData.tags || [],
        unprivileged: containerData.unprivileged !== false,
        startOnBoot: containerData.startOnBoot || false,
        protection: containerData.protection || false,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIn: 0,
        networkOut: 0,
        uptime: 0
      });

      // Create container on Proxmox server
      let containerCreationResult = null;
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: containerData.node,
            rejectUnauthorized: false
          });

          const containerId = newContainer.id;
          
          const containerConfig: ContainerCreateConfig = {
            vmid: containerId,
            hostname: containerData.name,
            ostemplate: containerData.template, // Required: OS template (e.g., 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst')
            cores: containerData.cores,
            memory: containerData.memory,
            rootfs: `local-lvm:${containerData.disk || 8}`, // Default 8GB root filesystem
            unprivileged: containerData.unprivileged !== false ? 1 : 0,
            net0: 'name=eth0,bridge=vmbr0,ip=dhcp' // Basic network configuration
          };

          containerCreationResult = await proxmoxClient.createContainer(containerData.node, containerConfig);
          
          logger.info('Container created on Proxmox server', {
            userId,
            containerId: newContainer.id,
            containerName: newContainer.hostname,
            taskId: containerCreationResult.upid
          });
          
          // Broadcast creation success via WebSocket
          const notificationService = getNotificationService();
          if (notificationService) {
            notificationService.broadcastOperationNotification(
              'create', 'container', newContainer.id, newContainer.hostname, 'success', userId
            );
          }
        }
      } catch (proxmoxError) {
        logger.error('Failed to create container on Proxmox server', {
          userId,
          containerName: containerData.name,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        
        // Remove from database if Proxmox creation failed
        await containerRepo.delete(newContainer.id.toString());
        
        // Broadcast creation failure via WebSocket
        const notificationService = getNotificationService();
        if (notificationService) {
          notificationService.broadcastOperationNotification(
            'create', 'container', newContainer.id, newContainer.hostname, 'error', userId,
            proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
          );
        }
        
        throw new Error(`Failed to create container on Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      logger.info('Container created successfully', {
        userId,
        containerId: newContainer.id,
        containerName: newContainer.hostname
      });

      res.status(201).json({
        success: true,
        message: 'Container created successfully',
        data: {
          container: {
            id: newContainer.id,
            hostname: newContainer.hostname,
            status: newContainer.status,
            node: newContainer.nodeId,
            memory: Number(newContainer.memoryBytes / BigInt(1024 * 1024)),
            cores: newContainer.cpuCores,
            template: newContainer.template,
            tags: newContainer.tags,
            unprivileged: newContainer.unprivileged,
            startOnBoot: newContainer.startOnBoot,
            protection: newContainer.protection,
            createdAt: newContainer.createdAt,
            updatedAt: newContainer.updatedAt
          }
        }
      });
    } catch (error) {
      logger.error('Failed to create container', {
        userId,
        containerName: containerData.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * DELETE /api/containers/:id
 * Delete container
 */
router.delete('/:id',
  validateParams(validationSchemas.containerParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('Container deletion request', { userId, containerId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const containerRepo = new ContainerRepository(dbClient);

      // Check if container exists
      const container = await containerRepo.findById(id);
      if (!container) {
        throw new NotFoundError('Container', id.toString());
      }

      // Check if container is protected
      if (container.protection) {
        throw new ValidationError('Cannot delete protected container', { containerId: id });
      }

      // Delete container from Proxmox server first
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: container.nodeId,
            rejectUnauthorized: false
          });

          // Stop container if it's running before deletion
          try {
            const containerStatus = await proxmoxClient.getContainerStatus(container.nodeId, container.id);
            if (containerStatus.status === 'running') {
              await proxmoxClient.stopContainer(container.nodeId, container.id, true);
              await proxmoxClient.waitForContainerStatus(container.nodeId, container.id, 'stopped', 60000);
            }
          } catch (stopError) {
            logger.warn('Failed to stop container before deletion', {
              containerId: id,
              error: stopError instanceof Error ? stopError.message : 'Unknown error'
            });
          }

          // Delete the container
          const deleteTask = await proxmoxClient.deleteContainer(container.nodeId, container.id, {
            force: true,
            purge: true
          });
          
          logger.info('Container deletion initiated on Proxmox server', {
            userId,
            containerId: id,
            containerName: container.hostname,
            taskId: deleteTask.upid
          });
        }
      } catch (proxmoxError) {
        logger.error('Failed to delete container from Proxmox server', {
          userId,
          containerId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        throw new Error(`Failed to delete container from Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      // Delete from database
      await containerRepo.delete(id);

      logger.info('Container deleted successfully', {
        userId,
        containerId: id,
        containerName: container.hostname
      });

      res.json({
        success: true,
        message: 'Container deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete container', {
        userId,
        containerId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * POST /api/containers/:id/start
 * Start container
 */
router.post('/:id/start',
  validateParams(validationSchemas.containerParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('Container start request', { userId, containerId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const containerRepo = new ContainerRepository(dbClient);

      const container = await containerRepo.findById(id);
      if (!container) {
        throw new NotFoundError('Container', id.toString());
      }

      if (container.status === 'running') {
        throw new ValidationError('Container is already running', { containerId: id });
      }

      // Start container on Proxmox server
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: container.nodeId,
            rejectUnauthorized: false
          });

          const startTask = await proxmoxClient.startContainer(container.nodeId, container.id);
          
          logger.info('Container start initiated on Proxmox server', {
            userId,
            containerId: id,
            containerName: container.hostname,
            taskId: startTask.upid
          });
          
          // Broadcast start success and status update via WebSocket
          const notificationService = getNotificationService();
          if (notificationService) {
            notificationService.broadcastOperationNotification(
              'start', 'container', parseInt(id), container.hostname, 'success', userId
            );
            // Trigger status update broadcast after a short delay
            setTimeout(() => {
              notificationService.broadcastContainerStatusUpdate(parseInt(id), userId, req.user!.proxmoxServer);
            }, 2000);
          }
        }
      } catch (proxmoxError) {
        logger.error('Failed to start container on Proxmox server', {
          userId,
          containerId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        throw new Error(`Failed to start container on Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      // Update status in database
      await containerRepo.update(id, { status: 'running', updatedAt: new Date() });

      logger.info('Container started successfully', {
        userId,
        containerId: id,
        containerName: container.hostname
      });

      res.json({
        success: true,
        message: 'Container started successfully'
      });
    } catch (error) {
      logger.error('Failed to start container', {
        userId,
        containerId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * POST /api/containers/:id/stop
 * Stop container
 */
router.post('/:id/stop',
  validateParams(validationSchemas.containerParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('Container stop request', { userId, containerId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const containerRepo = new ContainerRepository(dbClient);

      const container = await containerRepo.findById(id);
      if (!container) {
        throw new NotFoundError('Container', id.toString());
      }

      if (container.status === 'stopped') {
        throw new ValidationError('Container is already stopped', { containerId: id });
      }

      // Stop container on Proxmox server
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: container.nodeId,
            rejectUnauthorized: false
          });

          const stopTask = await proxmoxClient.shutdownContainer(container.nodeId, container.id);
          
          logger.info('Container stop initiated on Proxmox server', {
            userId,
            containerId: id,
            containerName: container.hostname,
            taskId: stopTask.upid
          });
        }
      } catch (proxmoxError) {
        logger.error('Failed to stop container on Proxmox server', {
          userId,
          containerId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        throw new Error(`Failed to stop container on Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      // Update status in database
      await containerRepo.update(id, { 
        status: 'stopped', 
        uptime: 0,
        updatedAt: new Date() 
      });

      logger.info('Container stopped successfully', {
        userId,
        containerId: id,
        containerName: container.hostname
      });

      res.json({
        success: true,
        message: 'Container stopped successfully'
      });
    } catch (error) {
      logger.error('Failed to stop container', {
        userId,
        containerId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * POST /api/containers/:id/restart
 * Restart container
 */
router.post('/:id/restart',
  validateParams(validationSchemas.containerParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('Container restart request', { userId, containerId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const containerRepo = new ContainerRepository(dbClient);

      const container = await containerRepo.findById(id);
      if (!container) {
        throw new NotFoundError('Container', id.toString());
      }

      // Restart container on Proxmox server
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: container.nodeId,
            rejectUnauthorized: false
          });

          const rebootTask = await proxmoxClient.rebootContainer(container.nodeId, container.id);
          
          logger.info('Container restart initiated on Proxmox server', {
            userId,
            containerId: id,
            containerName: container.hostname,
            taskId: rebootTask.upid
          });
        }
      } catch (proxmoxError) {
        logger.error('Failed to restart container on Proxmox server', {
          userId,
          containerId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        throw new Error(`Failed to restart container on Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      // Update status in database
      await containerRepo.update(id, { 
        status: 'running', 
        uptime: 0,
        updatedAt: new Date() 
      });

      logger.info('Container restarted successfully', {
        userId,
        containerId: id,
        containerName: container.hostname
      });

      res.json({
        success: true,
        message: 'Container restarted successfully'
      });
    } catch (error) {
      logger.error('Failed to restart container', {
        userId,
        containerId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

export default router;