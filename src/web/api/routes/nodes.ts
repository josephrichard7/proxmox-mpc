/**
 * Node Management Routes
 * 
 * REST API endpoints for Proxmox node monitoring and management.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateQuery, validateParams, validationSchemas } from '../middleware/validation';
import { asyncHandler, NotFoundError } from '../middleware/error';
import { logger } from '../../../observability/logger';

// Import existing services
import { NodeRepository } from '../../../database/repositories/node-repository';
import { ProxmoxClient } from '../../../api/proxmox-client';
import { DatabaseClient } from '../../../database/client';
import { NodeInfo } from '../../../types';

const router = Router();

/**
 * GET /api/nodes
 * List all nodes with status information
 */
router.get('/',
  validateQuery(validationSchemas.listQuery),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    logger.info('Node list request', { userId });

    try {
      let nodes: any[] = [];
      
      // Get nodes from Proxmox if server is configured
      if (req.user!.proxmoxServer) {
        try {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: 'pve', // Default node name
            rejectUnauthorized: false
          });

          const proxmoxNodes = await proxmoxClient.getNodes();
          
          // Get detailed status for each node
          const nodeDetails = await Promise.allSettled(
            proxmoxNodes.map(async (node: NodeInfo) => {
              try {
                const status = await proxmoxClient.getNodeStatus(node.node);
                return {
                  name: node.node,
                  status: node.status,
                  type: node.type || 'node',
                  online: node.status === 'online',
                  uptime: status.uptime || 0,
                  cpu: status.cpu || 0,
                  memory: {
                    used: status.mem || 0,
                    total: status.maxmem || 0,
                    percentage: status.maxmem ? Math.round((status.mem / status.maxmem) * 100) : 0
                  },
                  storage: {
                    used: status.disk || 0,
                    total: status.maxdisk || 0,
                    percentage: status.maxdisk ? Math.round((status.disk / status.maxdisk) * 100) : 0
                  },
                  loadAverage: status.loadavg || [0, 0, 0],
                  kernelVersion: status.kversion || '',
                  proxmoxVersion: status.pveversion || ''
                };
              } catch (statusError) {
                logger.warn('Failed to get node status', {
                  nodeName: node.node,
                  error: statusError instanceof Error ? statusError.message : 'Unknown error'
                });
                return {
                  name: node.node,
                  status: 'unknown',
                  type: node.type || 'node',
                  online: false,
                  uptime: 0,
                  cpu: 0,
                  memory: { used: 0, total: 0, percentage: 0 },
                  storage: { used: 0, total: 0, percentage: 0 },
                  loadAverage: [0, 0, 0],
                  kernelVersion: '',
                  proxmoxVersion: '',
                  error: statusError instanceof Error ? statusError.message : 'Unknown error'
                };
              }
            })
          );

          nodes = nodeDetails.map(result => 
            result.status === 'fulfilled' ? result.value : result.reason
          );
        } catch (proxmoxError) {
          logger.error('Failed to fetch nodes from Proxmox', {
            userId,
            error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
          });
        }
      }

      // Also get nodes from database for comparison/caching
      try {
        const dbClient = DatabaseClient.getInstance();
        const nodeRepo = new NodeRepository(dbClient);
        const dbNodes = await nodeRepo.findMany({});
        
        // Merge with Proxmox data if available
        if (nodes.length === 0 && dbNodes.length > 0) {
          nodes = dbNodes.map(node => ({
            name: node.name,
            status: node.status,
            type: 'node',
            online: node.status === 'online',
            uptime: node.uptime || 0,
            cpu: node.cpuUsage || 0,
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
            loadAverage: [0, 0, 0], // Not stored in DB
            kernelVersion: '',
            proxmoxVersion: ''
          }));
        }
      } catch (dbError) {
        logger.warn('Failed to fetch nodes from database', {
          userId,
          error: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      }

      res.json({
        success: true,
        data: {
          nodes,
          summary: {
            total: nodes.length,
            online: nodes.filter(n => n.online).length,
            offline: nodes.filter(n => !n.online).length
          }
        }
      });
    } catch (error) {
      logger.error('Failed to list nodes', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

/**
 * GET /api/nodes/:name
 * Get detailed node information
 */
router.get('/:name',
  validateParams(validationSchemas.nodeParams),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.params;
    const userId = req.user!.id;

    logger.info('Node details request', { userId, nodeName: name });

    try {
      let nodeDetails = null;
      
      // Get node details from Proxmox if server is configured
      if (req.user!.proxmoxServer) {
        try {
          const proxmoxClient = new ProxmoxClient({
            host: req.user!.proxmoxServer,
            port: 8006,
            username: 'root@pam',
            tokenId: process.env.PROXMOX_TOKEN_ID || '',
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
            node: name,
            rejectUnauthorized: false
          });

          const nodeStatus = await proxmoxClient.getNodeStatus(name);
          const nodeVMs = await proxmoxClient.getVMs(name);
          const nodeContainers = await proxmoxClient.getContainers(name);
          const nodeStorage = await proxmoxClient.getNodeStorage(name);
          
          nodeDetails = {
            name: name,
            status: nodeStatus.status,
            type: nodeStatus.type || 'node',
            online: nodeStatus.status === 'online',
            uptime: nodeStatus.uptime || 0,
            bootInfo: {
              secureboot: nodeStatus.secureboot || false,
              mode: nodeStatus.mode || 'legacy'
            },
            cpu: {
              usage: nodeStatus.cpu || 0,
              cores: nodeStatus.cpuinfo?.cpus || 0,
              model: nodeStatus.cpuinfo?.model || '',
              mhz: nodeStatus.cpuinfo?.mhz || 0,
              loadAverage: nodeStatus.loadavg || [0, 0, 0]
            },
            memory: {
              used: nodeStatus.mem || 0,
              total: nodeStatus.maxmem || 0,
              percentage: nodeStatus.maxmem ? Math.round((nodeStatus.mem / nodeStatus.maxmem) * 100) : 0,
              available: nodeStatus.maxmem ? nodeStatus.maxmem - nodeStatus.mem : 0
            },
            storage: {
              used: nodeStatus.disk || 0,
              total: nodeStatus.maxdisk || 0,
              percentage: nodeStatus.maxdisk ? Math.round((nodeStatus.disk / nodeStatus.maxdisk) * 100) : 0,
              available: nodeStatus.maxdisk ? nodeStatus.maxdisk - nodeStatus.disk : 0,
              pools: nodeStorage.map(storage => ({
                name: storage.storage,
                type: storage.type,
                content: storage.content,
                enabled: storage.enabled,
                shared: storage.shared
              }))
            },
            network: {
              // Basic network info - in a real implementation you might get this from a different API call
              interfaces: [] as any[]
            },
            resources: {
              vms: {
                total: nodeVMs.length,
                running: nodeVMs.filter(vm => vm.status === 'running').length,
                stopped: nodeVMs.filter(vm => vm.status === 'stopped').length
              },
              containers: {
                total: nodeContainers.length,
                running: nodeContainers.filter(ct => ct.status === 'running').length,
                stopped: nodeContainers.filter(ct => ct.status === 'stopped').length
              }
            },
            version: {
              kernel: nodeStatus.kversion || '',
              proxmox: nodeStatus.pveversion || ''
            }
          };
        } catch (proxmoxError) {
          logger.error('Failed to fetch node details from Proxmox', {
            userId,
            nodeName: name,
            error: proxmoxError instanceof Error ? proxmoxError.message : 'Unknown error'
          });
        }
      }
      
      // Fallback to database if Proxmox is unavailable
      if (!nodeDetails) {
        try {
          const dbClient = DatabaseClient.getInstance();
          const nodeRepo = new NodeRepository(dbClient);
          const dbNode = await nodeRepo.findByName(name);
          
          if (dbNode) {
            nodeDetails = {
              name: dbNode.name,
              status: dbNode.status,
              type: 'node',
              online: dbNode.status === 'online',
              uptime: dbNode.uptime || 0,
              bootInfo: { secureboot: false, mode: 'legacy' },
              cpu: {
                usage: dbNode.cpuUsage || 0,
                cores: 0,
                model: '',
                mhz: 0,
                loadAverage: [0, 0, 0]
              },
              memory: {
                used: dbNode.memoryUsed || 0,
                total: dbNode.memoryTotal || 0,
                percentage: dbNode.memoryTotal ? Math.round(((dbNode.memoryUsed || 0) / dbNode.memoryTotal) * 100) : 0,
                available: dbNode.memoryTotal ? dbNode.memoryTotal - (dbNode.memoryUsed || 0) : 0
              },
              storage: {
                used: dbNode.storageUsed || 0,
                total: dbNode.storageTotal || 0,
                percentage: dbNode.storageTotal ? Math.round(((dbNode.storageUsed || 0) / dbNode.storageTotal) * 100) : 0,
                available: dbNode.storageTotal ? dbNode.storageTotal - (dbNode.storageUsed || 0) : 0,
                pools: []
              },
              network: { interfaces: [] },
              resources: {
                vms: { total: 0, running: 0, stopped: 0 },
                containers: { total: 0, running: 0, stopped: 0 }
              },
              version: { kernel: '', proxmox: '' }
            };
          }
        } catch (dbError) {
          logger.warn('Failed to fetch node from database', {
            userId,
            nodeName: name,
            error: dbError instanceof Error ? dbError.message : 'Unknown error'
          });
        }
      }
      
      if (!nodeDetails) {
        throw new NotFoundError('Node', name);
      }

      res.json({
        success: true,
        data: {
          node: nodeDetails
        }
      });
    } catch (error) {
      logger.error('Failed to get node details', {
        userId,
        nodeName: name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  })
);

export default router;