/**
 * VM Management Routes
 * 
 * REST API endpoints for virtual machine management in Proxmox-MPC.
 * Provides CRUD operations and status management for VMs.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery, validateParams, validationSchemas } from '../middleware/validation';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error';
import { logger } from '../../../observability/logger';

// Import existing services
import { VMRepository } from '../../../database/repositories/vm-repository';
import { ProxmoxClient } from '../../../api/proxmox-client';
import { VMCreateConfig, VMInfo } from '../../../types';
import { DatabaseClient } from '../../../database/client';
import { getNotificationService } from '../../websocket/notification-service';

const router = Router();

/**
 * GET /api/vms
 * List all VMs with optional filtering and pagination
 */
router.get('/',
  validateQuery(validationSchemas.listQuery),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, sort, order, search, status, node, tags } = req.query;
    const userId = req.user!.id;

    logger.info('VM list request', {
      userId,
      query: { page, limit, sort, order, search, status, node, tags }
    });

    try {
      // Initialize database client
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);

      // Build filter options
      const filters: any = {};
      if (search) {
        filters.name = { contains: search };
      }
      if (status) {
        filters.status = status;
      }
      if (node) {
        filters.node = node;
      }
      if (tags) {
        const tagArray = (tags as string).split(',').map(tag => tag.trim());
        filters.tags = { hasSome: tagArray };
      }

      // Get total count for pagination
      const total = await vmRepo.count(filters);

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get VMs with pagination
      const vms = await vmRepo.findMany({
        where: filters,
        skip: offset,
        take: limit,
        orderBy: sort ? { [sort]: order } : { id: 'asc' }
      });

      res.json({
        success: true,
        data: {
          vms: vms.map(vm => ({
            id: vm.id,
            name: vm.name,
            status: vm.status,
            node: vm.node,
            memory: vm.memory,
            cores: vm.cores,
            disk: vm.disk,
            uptime: vm.uptime,
            cpuUsage: vm.cpuUsage,
            memoryUsage: vm.memoryUsage,
            tags: vm.tags,
            createdAt: vm.createdAt,
            updatedAt: vm.updatedAt
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
      logger.error('Failed to list VMs', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * GET /api/vms/:id
 * Get detailed VM information
 */
router.get('/:id',
  validateParams(validationSchemas.vmParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('VM details request', { userId, vmId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);

      const vm = await vmRepo.findById(id);
      if (!vm) {
        throw new NotFoundError('VM', id.toString());
      }

      // Get live status from Proxmox if available
      let liveStatus = null;
      try {
        if (req.user!.proxmoxServer) {
          // TODO: In production, store Proxmox credentials securely in database
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: vm.node,
            rejectUnauthorized: false
          });
          
          liveStatus = await proxmoxClient.getVMStatus(vm.node, vm.id);
        }
      } catch (proxmoxError) {
        logger.warn('Failed to get live VM status from Proxmox', {
          vmId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
      }

      res.json({
        success: true,
        data: {
          vm: {
            id: vm.id,
            name: vm.name,
            description: vm.description,
            status: vm.status,
            node: vm.node,
            memory: vm.memory,
            cores: vm.cores,
            disk: vm.disk,
            template: vm.template,
            uptime: vm.uptime,
            cpuUsage: vm.cpuUsage,
            memoryUsage: vm.memoryUsage,
            diskUsage: vm.diskUsage,
            networkIn: vm.networkIn,
            networkOut: vm.networkOut,
            tags: vm.tags,
            startOnBoot: vm.startOnBoot,
            protection: vm.protection,
            createdAt: vm.createdAt,
            updatedAt: vm.updatedAt,
            liveStatus: liveStatus || undefined
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get VM details', {
        userId,
        vmId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * POST /api/vms
 * Create a new VM
 */
router.post('/',
  validateBody(validationSchemas.createVM),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const vmData = req.body;
    const userId = req.user!.id;

    logger.info('VM creation request', {
      userId,
      vmName: vmData.name,
      node: vmData.node
    });

    try {
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);

      // Check if VM name already exists
      const existingVM = await vmRepo.findByName(vmData.name);
      if (existingVM) {
        throw new ValidationError('VM name already exists', { name: vmData.name });
      }

      // Create VM in database
      const newVM = await vmRepo.create({
        name: vmData.name,
        description: vmData.description || '',
        node: vmData.node,
        memory: vmData.memory,
        cores: vmData.cores,
        disk: vmData.disk,
        template: vmData.template || '',
        status: 'stopped',
        tags: vmData.tags || [],
        startOnBoot: vmData.startOnBoot || false,
        protection: vmData.protection || false,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIn: 0,
        networkOut: 0,
        uptime: 0
      });

      // Create VM on Proxmox server
      let vmCreationResult = null;
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: vmData.node,
            rejectUnauthorized: false
          });

          // Find next available VM ID if not specified
          const vmId = newVM.id;
          
          const vmConfig: VMCreateConfig = {
            vmid: vmId,
            name: vmData.name,
            cores: vmData.cores,
            memory: vmData.memory,
            sockets: 1,
            ostype: 'l26', // Linux kernel 2.6+
            // Basic network configuration
            net0: 'virtio,bridge=vmbr0',
            // Basic SCSI disk if disk size specified
            ...(vmData.disk && { scsi0: `local-lvm:${vmData.disk}` })
          };

          vmCreationResult = await proxmoxClient.createVM(vmData.node, vmConfig);
          
          logger.info('VM created on Proxmox server', {
            userId,
            vmId: newVM.id,
            vmName: newVM.name,
            taskId: vmCreationResult.upid
          });
          
          // Broadcast creation success via WebSocket
          const notificationService = getNotificationService();
          if (notificationService) {
            notificationService.broadcastOperationNotification(
              'create', 'vm', newVM.id, newVM.name, 'success', userId
            );
          }
        }
      } catch (proxmoxError) {
        logger.error('Failed to create VM on Proxmox server', {
          userId,
          vmName: vmData.name,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        
        // Remove from database if Proxmox creation failed
        await vmRepo.delete(newVM.id.toString());
        
        // Broadcast creation failure via WebSocket
        const notificationService = getNotificationService();
        if (notificationService) {
          notificationService.broadcastOperationNotification(
            'create', 'vm', newVM.id, newVM.name, 'error', userId,
            proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
          );
        }
        
        throw new Error(`Failed to create VM on Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      logger.info('VM created successfully', {
        userId,
        vmId: newVM.id,
        vmName: newVM.name
      });

      res.status(201).json({
        success: true,
        message: 'VM created successfully',
        data: {
          vm: {
            id: newVM.id,
            name: newVM.name,
            description: newVM.description,
            status: newVM.status,
            node: newVM.node,
            memory: newVM.memory,
            cores: newVM.cores,
            disk: newVM.disk,
            template: newVM.template,
            tags: newVM.tags,
            startOnBoot: newVM.startOnBoot,
            protection: newVM.protection,
            createdAt: newVM.createdAt,
            updatedAt: newVM.updatedAt
          }
        }
      });
    } catch (error) {
      logger.error('Failed to create VM', {
        userId,
        vmName: vmData.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * PUT /api/vms/:id
 * Update VM configuration
 */
router.put('/:id',
  validateParams(validationSchemas.vmParams),
  validateBody(validationSchemas.updateVM),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user!.id;

    logger.info('VM update request', {
      userId,
      vmId: id,
      updates: Object.keys(updateData)
    });

    try {
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);

      // Check if VM exists
      const existingVM = await vmRepo.findById(id);
      if (!existingVM) {
        throw new NotFoundError('VM', id.toString());
      }

      // Check if name change conflicts with existing VM
      if (updateData.name && updateData.name !== existingVM.name) {
        const conflictingVM = await vmRepo.findByName(updateData.name);
        if (conflictingVM && conflictingVM.id !== parseInt(id)) {
          throw new ValidationError('VM name already exists', { name: updateData.name });
        }
      }

      // Update VM in database
      const updatedVM = await vmRepo.update(id, {
        ...updateData,
        updatedAt: new Date()
      });

      // Update VM on Proxmox server if configuration changes
      try {
        if (req.user!.proxmoxServer && (updateData.memory || updateData.cores || updateData.description)) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: existingVM.node,
            rejectUnauthorized: false
          });

          // Update VM configuration on Proxmox
          const configUpdates: any = {};
          if (updateData.memory) configUpdates.memory = updateData.memory;
          if (updateData.cores) configUpdates.cores = updateData.cores;
          if (updateData.description) configUpdates.description = updateData.description;

          // Note: VM configuration updates require the VM to be stopped
          // In a production system, you might want to check VM status first
          await proxmoxClient.httpClient.put(`/nodes/${existingVM.node}/qemu/${id}/config`, configUpdates);
          
          logger.info('VM configuration updated on Proxmox server', {
            userId,
            vmId: id,
            updates: Object.keys(configUpdates)
          });
        }
      } catch (proxmoxError) {
        logger.warn('Failed to update VM configuration on Proxmox server', {
          userId,
          vmId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        // Continue with database update even if Proxmox update fails
      }

      logger.info('VM updated successfully', {
        userId,
        vmId: id,
        vmName: updatedVM.name
      });

      res.json({
        success: true,
        message: 'VM updated successfully',
        data: {
          vm: {
            id: updatedVM.id,
            name: updatedVM.name,
            description: updatedVM.description,
            status: updatedVM.status,
            node: updatedVM.node,
            memory: updatedVM.memory,
            cores: updatedVM.cores,
            disk: updatedVM.disk,
            template: updatedVM.template,
            tags: updatedVM.tags,
            startOnBoot: updatedVM.startOnBoot,
            protection: updatedVM.protection,
            createdAt: updatedVM.createdAt,
            updatedAt: updatedVM.updatedAt
          }
        }
      });
    } catch (error) {
      logger.error('Failed to update VM', {
        userId,
        vmId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * DELETE /api/vms/:id
 * Delete VM
 */
router.delete('/:id',
  validateParams(validationSchemas.vmParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('VM deletion request', { userId, vmId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);

      // Check if VM exists
      const vm = await vmRepo.findById(id);
      if (!vm) {
        throw new NotFoundError('VM', id.toString());
      }

      // Check if VM is protected
      if (vm.protection) {
        throw new ValidationError('Cannot delete protected VM', { vmId: id });
      }

      // Delete VM from Proxmox server first
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: vm.node,
            rejectUnauthorized: false
          });

          // Stop VM if it's running before deletion
          try {
            const vmStatus = await proxmoxClient.getVMStatus(vm.node, vm.id);
            if (vmStatus.status === 'running') {
              await proxmoxClient.stopVM(vm.node, vm.id, true); // Force stop
              await proxmoxClient.waitForVMStatus(vm.node, vm.id, 'stopped', 60000);
            }
          } catch (stopError) {
            logger.warn('Failed to stop VM before deletion', {
              vmId: id,
              error: stopError instanceof Error ? stopError.message : 'Unknown error'
            });
          }

          // Delete the VM
          const deleteTask = await proxmoxClient.deleteVM(vm.node, vm.id, {
            force: true,
            destroyUnreferencedDisks: true
          });
          
          logger.info('VM deletion initiated on Proxmox server', {
            userId,
            vmId: id,
            vmName: vm.name,
            taskId: deleteTask.upid
          });
        }
      } catch (proxmoxError) {
        logger.error('Failed to delete VM from Proxmox server', {
          userId,
          vmId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        throw new Error(`Failed to delete VM from Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      // Delete from database
      await vmRepo.delete(id);

      logger.info('VM deleted successfully', {
        userId,
        vmId: id,
        vmName: vm.name
      });

      res.json({
        success: true,
        message: 'VM deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete VM', {
        userId,
        vmId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * POST /api/vms/:id/start
 * Start VM
 */
router.post('/:id/start',
  validateParams(validationSchemas.vmParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('VM start request', { userId, vmId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);

      const vm = await vmRepo.findById(id);
      if (!vm) {
        throw new NotFoundError('VM', id.toString());
      }

      if (vm.status === 'running') {
        throw new ValidationError('VM is already running', { vmId: id });
      }

      // Start VM on Proxmox server
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: vm.node,
            rejectUnauthorized: false
          });

          const startTask = await proxmoxClient.startVM(vm.node, vm.id);
          
          logger.info('VM start initiated on Proxmox server', {
            userId,
            vmId: id,
            vmName: vm.name,
            taskId: startTask.upid
          });
          
          // Broadcast start success and status update via WebSocket
          const notificationService = getNotificationService();
          if (notificationService) {
            notificationService.broadcastOperationNotification(
              'start', 'vm', parseInt(id), vm.name, 'success', userId
            );
            // Trigger status update broadcast after a short delay
            setTimeout(() => {
              notificationService.broadcastVMStatusUpdate(parseInt(id), userId, req.user!.proxmoxServer);
            }, 2000);
          }
        }
      } catch (proxmoxError) {
        logger.error('Failed to start VM on Proxmox server', {
          userId,
          vmId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        throw new Error(`Failed to start VM on Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      // Update status in database
      await vmRepo.update(id, { status: 'running', updatedAt: new Date() });

      logger.info('VM started successfully', {
        userId,
        vmId: id,
        vmName: vm.name
      });

      res.json({
        success: true,
        message: 'VM started successfully'
      });
    } catch (error) {
      logger.error('Failed to start VM', {
        userId,
        vmId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * POST /api/vms/:id/stop
 * Stop VM
 */
router.post('/:id/stop',
  validateParams(validationSchemas.vmParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('VM stop request', { userId, vmId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);

      const vm = await vmRepo.findById(id);
      if (!vm) {
        throw new NotFoundError('VM', id.toString());
      }

      if (vm.status === 'stopped') {
        throw new ValidationError('VM is already stopped', { vmId: id });
      }

      // Stop VM on Proxmox server
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: vm.node,
            rejectUnauthorized: false
          });

          const stopTask = await proxmoxClient.shutdownVM(vm.node, vm.id);
          
          logger.info('VM stop initiated on Proxmox server', {
            userId,
            vmId: id,
            vmName: vm.name,
            taskId: stopTask.upid
          });
        }
      } catch (proxmoxError) {
        logger.error('Failed to stop VM on Proxmox server', {
          userId,
          vmId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        throw new Error(`Failed to stop VM on Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      // Update status in database
      await vmRepo.update(id, { 
        status: 'stopped', 
        uptime: 0,
        updatedAt: new Date() 
      });

      logger.info('VM stopped successfully', {
        userId,
        vmId: id,
        vmName: vm.name
      });

      res.json({
        success: true,
        message: 'VM stopped successfully'
      });
    } catch (error) {
      logger.error('Failed to stop VM', {
        userId,
        vmId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * POST /api/vms/:id/restart
 * Restart VM
 */
router.post('/:id/restart',
  validateParams(validationSchemas.vmParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    logger.info('VM restart request', { userId, vmId: id });

    try {
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);

      const vm = await vmRepo.findById(id);
      if (!vm) {
        throw new NotFoundError('VM', id.toString());
      }

      // Restart VM on Proxmox server
      try {
        if (req.user!.proxmoxServer) {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: vm.node,
            rejectUnauthorized: false
          });

          const rebootTask = await proxmoxClient.rebootVM(vm.node, vm.id);
          
          logger.info('VM restart initiated on Proxmox server', {
            userId,
            vmId: id,
            vmName: vm.name,
            taskId: rebootTask.upid
          });
        }
      } catch (proxmoxError) {
        logger.error('Failed to restart VM on Proxmox server', {
          userId,
          vmId: id,
          error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
        });
        throw new Error(`Failed to restart VM on Proxmox server: ${proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'}`);
      }

      // Update status in database
      await vmRepo.update(id, { 
        status: 'running', 
        uptime: 0,
        updatedAt: new Date() 
      });

      logger.info('VM restarted successfully', {
        userId,
        vmId: id,
        vmName: vm.name
      });

      res.json({
        success: true,
        message: 'VM restarted successfully'
      });
    } catch (error) {
      logger.error('Failed to restart VM', {
        userId,
        vmId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

export default router;