/**
 * Infrastructure Management Routes
 * 
 * REST API endpoints for infrastructure synchronization and operations.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { logger } from '../../../observability/logger';
import fs from 'fs/promises';
import path from 'path';

// Import services
import { DatabaseClient } from '../../../database/client';
import { VMRepository } from '../../../database/repositories/vm-repository';
import { ContainerRepository } from '../../../database/repositories/container-repository';
import { NodeRepository } from '../../../database/repositories/node-repository';
import { getDatabaseSyncService, ProxmoxServerConfig } from '../services/database-sync-service';
import { getNotificationService } from '../../websocket/notification-service';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const syncSchema = z.object({
  proxmoxServer: z.string().url().optional(),
  node: z.string().optional(),
  cleanup: z.boolean().optional().default(false)
});

const createFileSchema = z.object({
  parentPath: z.string(),
  name: z.string().min(1),
  type: z.enum(['file', 'directory']),
});

const saveFileSchema = z.object({
  content: z.string(),
});

const validateSchema = z.object({
  file: z.string(),
  content: z.string(),
  type: z.enum(['terraform', 'ansible']),
});

/**
 * POST /api/infrastructure/sync
 * Synchronize infrastructure state with Proxmox server
 */
router.post('/sync',
  validateBody(syncSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { proxmoxServer, node, cleanup } = req.body;

    logger.info('Infrastructure sync request', { userId, proxmoxServer, node, cleanup });

    try {
      // Use Proxmox server from request or user profile
      const serverHost = proxmoxServer || req.user!.proxmoxServer;
      if (!serverHost) {
        return res.status(400).json({
          success: false,
          error: 'No Proxmox server configured',
          message: 'Please provide a proxmoxServer in request or configure one in your profile'
        });
      }

      // TODO: In production, store these credentials securely per user
      const proxmoxConfig: ProxmoxServerConfig = {
        host: serverHost,
        port: 8006,
        username: 'root@pam',
        tokenId: process.env.PROXMOX_TOKEN_ID || '',
        tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
        node: node || 'pve',
        rejectUnauthorized: false
      };

      if (!proxmoxConfig.tokenId || !proxmoxConfig.tokenSecret) {
        return res.status(500).json({
          success: false,
          error: 'Proxmox credentials not configured',
          message: 'Server-side Proxmox credentials are not properly configured'
        });
      }

      const syncService = getDatabaseSyncService();
      const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Send initial response
      res.json({
        success: true,
        message: 'Infrastructure sync started',
        data: {
          syncId,
          status: 'in_progress'
        }
      });

      // Perform sync asynchronously and broadcast results
      const notificationService = getNotificationService();
      
      try {
        // Main synchronization
        const syncResults = await syncService.syncFromProxmoxServer(proxmoxConfig);
        
        logger.info('Infrastructure sync completed', {
          userId,
          syncId,
          results: syncResults
        });

        // Cleanup stale entries if requested
        let cleanupResults = null;
        if (cleanup) {
          cleanupResults = await syncService.cleanupStaleEntries(proxmoxConfig);
          logger.info('Infrastructure cleanup completed', {
            userId,
            syncId,
            cleanup: cleanupResults
          });
        }

        // Broadcast completion notification
        if (notificationService) {
          const totalSynced = syncResults.nodes + syncResults.vms + syncResults.containers;
          const hasErrors = syncResults.errors.length > 0;
          
          notificationService.broadcastOperationNotification(
            'update',
            'vm', // Generic resource type for infrastructure
            0,
            'Infrastructure',
            hasErrors ? 'error' : 'success',
            userId,
            hasErrors ? `Sync completed with ${syncResults.errors.length} errors` : `Successfully synchronized ${totalSynced} resources`
          );
        }

      } catch (asyncError) {
        logger.error('Infrastructure sync failed', {
          userId,
          syncId,
          error: asyncError instanceof Error ? asyncError.message : 'Unknown error'
        });

        // Broadcast failure notification
        if (notificationService) {
          notificationService.broadcastOperationNotification(
            'update',
            'vm',
            0,
            'Infrastructure',
            'error',
            userId,
            asyncError instanceof Error ? asyncError.message : 'Unknown sync error'
          );
        }
      }

    } catch (error) {
      logger.error('Failed to start infrastructure sync', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // This should not happen since we already sent a response,
      // but keeping it for safety
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to start sync',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  })
);

/**
 * GET /api/infrastructure/status
 * Get infrastructure overview status
 */
router.get('/status',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    logger.info('Infrastructure status request', { userId });

    try {
      const dbClient = DatabaseClient.getInstance();
      const vmRepo = new VMRepository(dbClient);
      const containerRepo = new ContainerRepository(dbClient);
      const nodeRepo = new NodeRepository(dbClient);

      // Get counts from database
      const [vmTotal, vmRunning, vmStopped] = await Promise.all([
        vmRepo.count({}),
        vmRepo.count({ status: 'running' }),
        vmRepo.count({ status: 'stopped' })
      ]);

      const [containerTotal, containerRunning, containerStopped] = await Promise.all([
        containerRepo.count({}),
        containerRepo.count({ status: 'running' }),
        containerRepo.count({ status: 'stopped' })
      ]);

      const [nodeTotal, nodeOnline] = await Promise.all([
        nodeRepo.count({}),
        nodeRepo.count({ status: 'online' })
      ]);

      // Calculate storage totals from nodes
      const nodes = await nodeRepo.findMany({});
      const storage = nodes.reduce(
        (acc, node) => ({
          total: acc.total + (node.storageTotal || 0),
          used: acc.used + (node.storageUsed || 0),
          available: acc.available + ((node.storageTotal || 0) - (node.storageUsed || 0))
        }),
        { total: 0, used: 0, available: 0 }
      );

      // Calculate memory totals
      const memory = nodes.reduce(
        (acc, node) => ({
          total: acc.total + (node.memoryTotal || 0),
          used: acc.used + (node.memoryUsed || 0),
          available: acc.available + ((node.memoryTotal || 0) - (node.memoryUsed || 0))
        }),
        { total: 0, used: 0, available: 0 }
      );

      // Get resource distribution by node
      const nodeDetails = await Promise.all(
        nodes.map(async (node) => {
          const nodeVMCount = await vmRepo.count({ node: node.name });
          const nodeContainerCount = await containerRepo.count({ nodeId: node.name });
          
          return {
            name: node.name,
            status: node.status,
            vms: nodeVMCount,
            containers: nodeContainerCount,
            cpu: {
              usage: node.cpuUsage || 0
            },
            memory: {
              used: node.memoryUsed || 0,
              total: node.memoryTotal || 0,
              percentage: node.memoryTotal ? Math.round(((node.memoryUsed || 0) / node.memoryTotal) * 100) : 0
            },
            storage: {
              used: node.storageUsed || 0,
              total: node.storageTotal || 0,
              percentage: node.storageTotal ? Math.round(((node.storageUsed || 0) / node.storageTotal) * 100) : 0
            },
            uptime: node.uptime || 0,
            lastSeen: node.lastSeen
          };
        })
      );

      res.json({
        success: true,
        data: {
          summary: {
            vms: {
              total: vmTotal,
              running: vmRunning,
              stopped: vmStopped,
              percentage: vmTotal ? Math.round((vmRunning / vmTotal) * 100) : 0
            },
            containers: {
              total: containerTotal,
              running: containerRunning,
              stopped: containerStopped,
              percentage: containerTotal ? Math.round((containerRunning / containerTotal) * 100) : 0
            },
            nodes: {
              total: nodeTotal,
              online: nodeOnline,
              offline: nodeTotal - nodeOnline,
              percentage: nodeTotal ? Math.round((nodeOnline / nodeTotal) * 100) : 0
            },
            resources: {
              memory: {
                used: memory.used,
                total: memory.total,
                available: memory.available,
                percentage: memory.total ? Math.round((memory.used / memory.total) * 100) : 0
              },
              storage: {
                used: storage.used,
                total: storage.total,
                available: storage.available,
                percentage: storage.total ? Math.round((storage.used / storage.total) * 100) : 0
              }
            }
          },
          nodes: nodeDetails,
          lastUpdated: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Failed to get infrastructure status', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * Infrastructure as Code file management endpoints
 */

// Helper functions
const getWorkspacePath = (): string => {
  return process.env.WORKSPACE_PATH || './infrastructure';
};

const buildFileTree = async (dirPath: string, relativePath = ''): Promise<any[]> => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const result = [];

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      const itemRelativePath = path.join(relativePath, item.name);
      
      if (item.isDirectory()) {
        const children = await buildFileTree(itemPath, itemRelativePath);
        result.push({
          id: itemRelativePath,
          name: item.name,
          type: 'directory',
          path: itemRelativePath,
          children
        });
      } else {
        const stats = await fs.stat(itemPath);
        result.push({
          id: itemRelativePath,
          name: item.name,
          type: 'file',
          path: itemRelativePath,
          size: stats.size,
          modified: stats.mtime,
          language: getFileLanguage(item.name)
        });
      }
    }

    return result.sort((a, b) => {
      // Directories first, then files, both alphabetically
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    logger.error('Failed to build file tree', { error, dirPath });
    return [];
  }
};

const getFileLanguage = (fileName: string): string => {
  if (fileName.endsWith('.tf')) return 'hcl';
  if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'yaml';
  if (fileName.endsWith('.json')) return 'json';
  if (fileName.endsWith('.md')) return 'markdown';
  if (fileName.endsWith('.sh')) return 'shell';
  return 'plaintext';
};

/**
 * GET /api/infrastructure/files
 * Get file system structure
 */
router.get('/files',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    
    try {
      const workspacePath = getWorkspacePath();
      
      // Create workspace directory if it doesn't exist
      try {
        await fs.access(workspacePath);
      } catch {
        await fs.mkdir(workspacePath, { recursive: true });
        
        // Create basic structure
        await fs.mkdir(path.join(workspacePath, 'terraform'), { recursive: true });
        await fs.mkdir(path.join(workspacePath, 'ansible'), { recursive: true });
        await fs.mkdir(path.join(workspacePath, 'docs'), { recursive: true });
        
        // Create sample files
        await fs.writeFile(
          path.join(workspacePath, 'terraform', 'main.tf'),
          `# Proxmox Provider Configuration
terraform {
  required_providers {
    proxmox = {
      source  = "telmate/proxmox"
      version = "~> 2.9"
    }
  }
}

provider "proxmox" {
  pm_api_url = var.proxmox_api_url
  pm_user    = var.proxmox_user
  pm_password = var.proxmox_password
}
`
        );
        
        await fs.writeFile(
          path.join(workspacePath, 'terraform', 'variables.tf'),
          `variable "proxmox_api_url" {
  description = "Proxmox API URL"
  type        = string
}

variable "proxmox_user" {
  description = "Proxmox username"
  type        = string
}

variable "proxmox_password" {
  description = "Proxmox password"
  type        = string
  sensitive   = true
}
`
        );
        
        await fs.writeFile(
          path.join(workspacePath, 'ansible', 'inventory.yml'),
          `all:
  children:
    proxmox:
      hosts:
        node1:
          ansible_host: 192.168.0.10
        node2:
          ansible_host: 192.168.0.11
      vars:
        ansible_user: root
        ansible_python_interpreter: /usr/bin/python3
`
        );
      }

      const files = await buildFileTree(workspacePath);
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      logger.error('Failed to get file structure', { error, userId });
      throw error;
    }
  })
);

/**
 * GET /api/infrastructure/files/:path
 * Get file content
 */
router.get('/files/:path(*)',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const filePath = req.params.path;
    
    try {
      const fullPath = path.join(getWorkspacePath(), filePath);
      
      // Security check: ensure path is within workspace
      const workspacePath = path.resolve(getWorkspacePath());
      const resolvedPath = path.resolve(fullPath);
      
      if (!resolvedPath.startsWith(workspacePath)) {
        return res.status(403).json({ 
          success: false,
          error: 'Access denied' 
        });
      }

      const content = await fs.readFile(resolvedPath, 'utf-8');
      res.json({ 
        success: true,
        data: { content, path: filePath }
      });
    } catch (error) {
      logger.error('Failed to read file', { error, path: filePath, userId });
      res.status(404).json({ 
        success: false,
        error: 'File not found' 
      });
    }
  })
);

/**
 * PUT /api/infrastructure/files/:path
 * Save file content
 */
router.put('/files/:path(*)',
  validateBody(saveFileSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const filePath = req.params.path;
    const { content } = req.body;
    
    try {
      const fullPath = path.join(getWorkspacePath(), filePath);
      
      // Security check: ensure path is within workspace
      const workspacePath = path.resolve(getWorkspacePath());
      const resolvedPath = path.resolve(fullPath);
      
      if (!resolvedPath.startsWith(workspacePath)) {
        return res.status(403).json({ 
          success: false,
          error: 'Access denied' 
        });
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      
      // Save file
      await fs.writeFile(resolvedPath, content, 'utf-8');
      
      logger.info('File saved', { path: filePath, userId });
      res.json({ 
        success: true, 
        data: { path: filePath }
      });
    } catch (error) {
      logger.error('Failed to save file', { error, path: filePath, userId });
      throw error;
    }
  })
);

/**
 * POST /api/infrastructure/files
 * Create new file or directory
 */
router.post('/files',
  validateBody(createFileSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { parentPath, name, type } = req.body;
    
    try {
      const fullPath = path.join(getWorkspacePath(), parentPath, name);
      
      // Security check: ensure path is within workspace
      const workspacePath = path.resolve(getWorkspacePath());
      const resolvedPath = path.resolve(fullPath);
      
      if (!resolvedPath.startsWith(workspacePath)) {
        return res.status(403).json({ 
          success: false,
          error: 'Access denied' 
        });
      }

      if (type === 'directory') {
        await fs.mkdir(resolvedPath, { recursive: true });
      } else {
        // Ensure parent directory exists
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        
        // Create empty file with appropriate template
        let template = '';
        if (name.endsWith('.tf')) {
          template = '# Terraform configuration\n\n';
        } else if (name.endsWith('.yml') || name.endsWith('.yaml')) {
          template = '---\n# Ansible configuration\n\n';
        }
        
        await fs.writeFile(resolvedPath, template, 'utf-8');
      }
      
      logger.info('File created', { path: path.join(parentPath, name), type, userId });
      res.json({ 
        success: true, 
        data: { path: path.join(parentPath, name) }
      });
    } catch (error) {
      logger.error('Failed to create file', { error, body: req.body, userId });
      throw error;
    }
  })
);

/**
 * DELETE /api/infrastructure/files/:path
 * Delete file or directory
 */
router.delete('/files/:path(*)',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const filePath = req.params.path;
    
    try {
      const fullPath = path.join(getWorkspacePath(), filePath);
      
      // Security check: ensure path is within workspace
      const workspacePath = path.resolve(getWorkspacePath());
      const resolvedPath = path.resolve(fullPath);
      
      if (!resolvedPath.startsWith(workspacePath)) {
        return res.status(403).json({ 
          success: false,
          error: 'Access denied' 
        });
      }

      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        await fs.rmdir(resolvedPath, { recursive: true });
      } else {
        await fs.unlink(resolvedPath);
      }
      
      logger.info('File deleted', { path: filePath, userId });
      res.json({ 
        success: true, 
        data: { path: filePath }
      });
    } catch (error) {
      logger.error('Failed to delete file', { error, path: filePath, userId });
      throw error;
    }
  })
);

/**
 * POST /api/infrastructure/validate
 * Validate configuration files
 */
router.post('/validate',
  validateBody(validateSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { file, content, type } = req.body;
    
    try {
      // Mock validation - in real implementation, this would use terraform validate or ansible-lint
      const errors = [];
      const warnings = [];
      
      // Basic syntax checks
      if (type === 'terraform') {
        // Check for common Terraform issues
        if (!content.includes('terraform {')) {
          warnings.push({
            file,
            line: 1,
            column: 1,
            message: 'Missing terraform configuration block',
            severity: 'warning' as const
          });
        }
        
        if (content.includes('${') && !content.includes('}')) {
          errors.push({
            file,
            line: 1,
            column: 1,
            message: 'Unclosed interpolation syntax',
            severity: 'error' as const
          });
        }
      } else if (type === 'ansible') {
        // Check for common Ansible issues
        if (!content.startsWith('---')) {
          warnings.push({
            file,
            line: 1,
            column: 1,
            message: 'YAML should start with ---',
            severity: 'warning' as const
          });
        }
      }
      
      const result = {
        valid: errors.length === 0,
        errors,
        warnings
      };
      
      logger.info('Configuration validated', { file, type, valid: result.valid, userId });
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to validate configuration', { error, body: req.body, userId });
      throw error;
    }
  })
);

/**
 * POST /api/infrastructure/preview
 * Preview infrastructure changes
 */
router.post('/preview',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    
    try {
      // Mock preview - in real implementation, this would run terraform plan
      const mockPreview = {
        changes: [
          {
            action: 'create' as const,
            resource: 'proxmox_vm_qemu.web-server',
            type: 'VM',
            properties: {
              name: 'web-server',
              cores: 2,
              memory: 2048
            }
          },
          {
            action: 'update' as const,
            resource: 'proxmox_vm_qemu.database',
            type: 'VM',
            properties: {
              memory: 4096 // Changed from 2048
            }
          }
        ],
        errors: [],
        warnings: [
          'Resource proxmox_vm_qemu.web-server will be created without explicit network configuration'
        ]
      };
      
      logger.info('Infrastructure preview generated', { userId });
      res.json({
        success: true,
        data: mockPreview
      });
    } catch (error) {
      logger.error('Failed to generate preview', { error, userId });
      throw error;
    }
  })
);

export default router;