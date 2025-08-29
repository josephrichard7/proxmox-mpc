/**
 * Database Synchronization Service
 * 
 * Synchronizes local database state with Proxmox VE servers.
 * Ensures data consistency and provides caching for better performance.
 */

import { ProxmoxClient } from '../../../api/proxmox-client';
import { DatabaseClient } from '../../../database/client';
import { VMRepository } from '../../../database/repositories/vm-repository';
import { ContainerRepository } from '../../../database/repositories/container-repository';
import { NodeRepository } from '../../../database/repositories/node-repository';
import { logger } from '../../../observability/logger';
import { VMInfo, ContainerInfo, NodeInfo } from '../../../types';

export interface ProxmoxServerConfig {
  host: string;
  port?: number;
  username: string;
  tokenId: string;
  tokenSecret: string;
  node: string;
  rejectUnauthorized?: boolean;
}

export class DatabaseSyncService {
  private dbClient: DatabaseClient;
  private vmRepo: VMRepository;
  private containerRepo: ContainerRepository;
  private nodeRepo: NodeRepository;

  constructor() {
    this.dbClient = DatabaseClient.getInstance();
    this.vmRepo = new VMRepository(this.dbClient);
    this.containerRepo = new ContainerRepository(this.dbClient);
    this.nodeRepo = new NodeRepository(this.dbClient);
  }

  /**
   * Synchronize all resources from a Proxmox server
   */
  public async syncFromProxmoxServer(config: ProxmoxServerConfig): Promise<{
    nodes: number;
    vms: number;
    containers: number;
    errors: string[];
  }> {
    const results = {
      nodes: 0,
      vms: 0,
      containers: 0,
      errors: [] as string[]
    };

    try {
      const proxmoxClient = new ProxmoxClient({
        host: config.host,
        port: config.port || 8006,
        username: config.username,
        tokenId: config.tokenId,
        tokenSecret: config.tokenSecret,
        node: config.node,
        rejectUnauthorized: config.rejectUnauthorized || false
      });

      logger.info('Starting database synchronization', { host: config.host });

      // Test connection first
      const connectionResult = await proxmoxClient.connect();
      if (!connectionResult.success) {
        throw new Error(`Failed to connect to Proxmox: ${connectionResult.error}`);
      }

      // Sync nodes
      try {
        const nodeCount = await this.syncNodes(proxmoxClient);
        results.nodes = nodeCount;
        logger.info('Nodes synchronized', { count: nodeCount });
      } catch (error) {
        const errorMsg = `Failed to sync nodes: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        logger.error(errorMsg);
      }

      // Get all nodes for VM and container sync
      const nodes = await proxmoxClient.getNodes();
      
      // Sync VMs for each node
      for (const node of nodes) {
        try {
          const vmCount = await this.syncVMsForNode(proxmoxClient, node.node);
          results.vms += vmCount;
          logger.info('VMs synchronized for node', { node: node.node, count: vmCount });
        } catch (error) {
          const errorMsg = `Failed to sync VMs for node ${node.node}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }
      
      // Sync containers for each node
      for (const node of nodes) {
        try {
          const containerCount = await this.syncContainersForNode(proxmoxClient, node.node);
          results.containers += containerCount;
          logger.info('Containers synchronized for node', { node: node.node, count: containerCount });
        } catch (error) {
          const errorMsg = `Failed to sync containers for node ${node.node}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      logger.info('Database synchronization completed', results);
      return results;

    } catch (error) {
      const errorMsg = `Database synchronization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.errors.push(errorMsg);
      logger.error(errorMsg);
      return results;
    }
  }

  /**
   * Synchronize nodes from Proxmox
   */
  private async syncNodes(proxmoxClient: ProxmoxClient): Promise<number> {
    const nodes = await proxmoxClient.getNodes();
    let syncCount = 0;

    for (const node of nodes) {
      try {
        // Get detailed node status
        const nodeStatus = await proxmoxClient.getNodeStatus(node.node);
        
        // Check if node exists in database
        const existingNode = await this.nodeRepo.findByName(node.node);
        
        const nodeData = {
          name: node.node,
          status: node.status || 'unknown',
          uptime: nodeStatus.uptime || 0,
          cpuUsage: nodeStatus.cpu || 0,
          memoryUsed: nodeStatus.mem || 0,
          memoryTotal: nodeStatus.maxmem || 0,
          storageUsed: nodeStatus.disk || 0,
          storageTotal: nodeStatus.maxdisk || 0,
          lastSeen: new Date(),
          updatedAt: new Date()
        };

        if (existingNode) {
          await this.nodeRepo.update(existingNode.id.toString(), nodeData);
        } else {
          await this.nodeRepo.create({
            ...nodeData,
            id: node.node === 'pve' ? 1 : Math.floor(Math.random() * 1000000) // Simple ID generation
          });
        }
        
        syncCount++;
      } catch (error) {
        logger.warn('Failed to sync node', {
          nodeName: node.node,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return syncCount;
  }

  /**
   * Synchronize VMs for a specific node
   */
  private async syncVMsForNode(proxmoxClient: ProxmoxClient, nodeName: string): Promise<number> {
    const vms = await proxmoxClient.getVMs(nodeName);
    let syncCount = 0;

    for (const vm of vms) {
      try {
        // Get detailed VM information
        const vmStatus = await proxmoxClient.getVMStatus(nodeName, vm.vmid);
        const vmConfig = await proxmoxClient.getVMConfig(nodeName, vm.vmid);
        
        // Check if VM exists in database
        const existingVM = await this.vmRepo.findById(vm.vmid.toString());
        
        const vmData = {
          id: vm.vmid,
          name: vmConfig.name || `vm-${vm.vmid}`,
          description: vmConfig.description || '',
          node: nodeName,
          status: vmStatus.status || 'unknown',
          template: vm.template === 1,
          memory: vmConfig.memory || 0,
          cores: vmConfig.cores || 1,
          disk: vmConfig.bootdisk ? parseFloat(vmConfig.bootdisk.replace(/\\D/g, '')) || 0 : 0,
          uptime: vmStatus.uptime || 0,
          cpuUsage: vmStatus.cpu || 0,
          memoryUsage: vmStatus.mem || 0,
          diskUsage: 0, // Would need additional API call to get disk usage
          networkIn: vmStatus.netin || 0,
          networkOut: vmStatus.netout || 0,
          tags: vmConfig.tags ? vmConfig.tags.split(';').filter(tag => tag.length > 0) : [],
          startOnBoot: vmConfig.onboot === 1,
          protection: vmConfig.protection === 1,
          updatedAt: new Date()
        };

        if (existingVM) {
          await this.vmRepo.update(vm.vmid.toString(), vmData);
        } else {
          await this.vmRepo.create(vmData);
        }
        
        syncCount++;
      } catch (error) {
        logger.warn('Failed to sync VM', {
          vmId: vm.vmid,
          nodeName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return syncCount;
  }

  /**
   * Synchronize containers for a specific node
   */
  private async syncContainersForNode(proxmoxClient: ProxmoxClient, nodeName: string): Promise<number> {
    const containers = await proxmoxClient.getContainers(nodeName);
    let syncCount = 0;

    for (const container of containers) {
      try {
        // Get detailed container information
        const containerStatus = await proxmoxClient.getContainerStatus(nodeName, container.vmid);
        const containerConfig = await proxmoxClient.getContainerConfig(nodeName, container.vmid);
        
        // Check if container exists in database
        const existingContainer = await this.containerRepo.findById(container.vmid.toString());
        
        const containerData = {
          id: container.vmid,
          hostname: containerConfig.hostname || `ct-${container.vmid}`,
          nodeId: nodeName,
          status: containerStatus.status || 'unknown',
          template: container.template === 1,
          cpuCores: containerConfig.cores || 1,
          memoryBytes: containerConfig.memory ? BigInt(containerConfig.memory * 1024 * 1024) : BigInt(0),
          uptime: containerStatus.uptime || 0,
          cpuUsage: containerStatus.cpu || 0,
          memoryUsage: containerStatus.mem || 0,
          diskUsage: 0, // Would need additional API call to get disk usage
          networkIn: containerStatus.netin || 0,
          networkOut: containerStatus.netout || 0,
          tags: containerConfig.tags ? containerConfig.tags.split(';').filter(tag => tag.length > 0) : [],
          unprivileged: containerConfig.unprivileged !== 0,
          startOnBoot: containerConfig.onboot === 1,
          protection: containerConfig.protection === 1,
          updatedAt: new Date()
        };

        if (existingContainer) {
          await this.containerRepo.update(container.vmid.toString(), containerData);
        } else {
          await this.containerRepo.create(containerData);
        }
        
        syncCount++;
      } catch (error) {
        logger.warn('Failed to sync container', {
          containerId: container.vmid,
          nodeName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return syncCount;
  }

  /**
   * Clean up stale database entries
   * Remove resources that no longer exist on Proxmox servers
   */
  public async cleanupStaleEntries(config: ProxmoxServerConfig): Promise<{
    deletedVMs: number;
    deletedContainers: number;
    errors: string[];
  }> {
    const results = {
      deletedVMs: 0,
      deletedContainers: 0,
      errors: [] as string[]
    };

    try {
      const proxmoxClient = new ProxmoxClient({
        host: config.host,
        port: config.port || 8006,
        username: config.username,
        tokenId: config.tokenId,
        tokenSecret: config.tokenSecret,
        node: config.node,
        rejectUnauthorized: config.rejectUnauthorized || false
      });

      // Get all resources from Proxmox
      const nodes = await proxmoxClient.getNodes();
      const allProxmoxVMs = new Set<number>();
      const allProxmoxContainers = new Set<number>();

      for (const node of nodes) {
        const vms = await proxmoxClient.getVMs(node.node);
        const containers = await proxmoxClient.getContainers(node.node);
        
        vms.forEach(vm => allProxmoxVMs.add(vm.vmid));
        containers.forEach(ct => allProxmoxContainers.add(ct.vmid));
      }

      // Get all VMs from database
      const dbVMs = await this.vmRepo.findMany({});
      for (const dbVM of dbVMs) {
        if (!allProxmoxVMs.has(dbVM.id)) {
          await this.vmRepo.delete(dbVM.id.toString());
          results.deletedVMs++;
          logger.info('Deleted stale VM from database', { vmId: dbVM.id, name: dbVM.name });
        }
      }

      // Get all containers from database
      const dbContainers = await this.containerRepo.findMany({});
      for (const dbContainer of dbContainers) {
        if (!allProxmoxContainers.has(dbContainer.id)) {
          await this.containerRepo.delete(dbContainer.id.toString());
          results.deletedContainers++;
          logger.info('Deleted stale container from database', { containerId: dbContainer.id, hostname: dbContainer.hostname });
        }
      }

      return results;
      
    } catch (error) {
      const errorMsg = `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.errors.push(errorMsg);
      logger.error(errorMsg);
      return results;
    }
  }
}

// Singleton instance
let syncService: DatabaseSyncService | null = null;

export const getDatabaseSyncService = (): DatabaseSyncService => {
  if (!syncService) {
    syncService = new DatabaseSyncService();
  }
  return syncService;
};