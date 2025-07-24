/**
 * Synchronization Service
 * Handles resource discovery and state synchronization between Proxmox API and database
 */

import { ProxmoxClient } from '../api/proxmox-client';
import { NodeRepository } from '../database/repositories/node-repository';
import { VMRepository } from '../database/repositories/vm-repository';
import { ContainerRepository } from '../database/repositories/container-repository';
import { StorageRepository } from '../database/repositories/storage-repository';
import { TaskRepository } from '../database/repositories/task-repository';
import { StateSnapshotRepository } from '../database/repositories/state-snapshot-repository';
import { VMInfo, ContainerInfo, StorageInfo, TaskInfo, NodeInfo } from '../types';

export interface SyncResult {
  success: boolean;
  resourceType: string;
  discovered: number;
  created: number;
  updated: number;
  errors: string[];
  duration: number;
}

export interface SyncSummary {
  totalResources: number;
  totalDiscovered: number;
  totalCreated: number;
  totalUpdated: number;
  totalErrors: number;
  results: SyncResult[];
  duration: number;
}

export class SyncService {
  constructor(
    private proxmoxClient: ProxmoxClient,
    private nodeRepo: NodeRepository,
    private vmRepo: VMRepository,
    private containerRepo: ContainerRepository,
    private storageRepo: StorageRepository,
    private taskRepo: TaskRepository,
    private stateSnapshotRepo: StateSnapshotRepository
  ) {}

  /**
   * Synchronize all resources across all cluster nodes
   */
  async syncAll(): Promise<SyncSummary> {
    const startTime = Date.now();
    const results: SyncResult[] = [];
    
    try {
      // First get list of nodes to sync
      const nodes = await this.proxmoxClient.getNodes();
      
      // Sync each resource type across all nodes
      results.push(await this.syncNodes());
      results.push(await this.syncVMs(nodes));
      results.push(await this.syncContainers(nodes));
      results.push(await this.syncStorage(nodes));
      results.push(await this.syncTasks(nodes));

      return this.generateSummary(results, Date.now() - startTime);
    } catch (error) {
      // If we can't get nodes, still return a summary with the error
      const errorResult: SyncResult = {
        success: false,
        resourceType: 'all',
        discovered: 0,
        created: 0,
        updated: 0,
        errors: [error instanceof Error ? error.message : 'Failed to sync all resources'],
        duration: Date.now() - startTime
      };
      
      return this.generateSummary([errorResult], Date.now() - startTime);
    }
  }

  /**
   * Synchronize cluster nodes
   */
  async syncNodes(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      resourceType: 'nodes',
      discovered: 0,
      created: 0,
      updated: 0,
      errors: [],
      duration: 0
    };

    try {
      // Discover nodes from Proxmox
      const discoveredNodes = await this.proxmoxClient.getNodes();
      result.discovered = discoveredNodes.length;

      // Process each node
      for (const nodeInfo of discoveredNodes) {
        try {
          // Check if node exists in database
          const existingNode = await this.nodeRepo.findByName(nodeInfo.node);

          if (existingNode) {
            // Update existing node  
            await this.nodeRepo.update(existingNode.id, {
              status: nodeInfo.status,
              cpuUsage: nodeInfo.cpu,
              cpuMax: nodeInfo.maxcpu,
              memoryUsage: BigInt(nodeInfo.mem || 0),
              memoryMax: BigInt(nodeInfo.maxmem || 0),
              uptime: nodeInfo.uptime
            });
            result.updated++;
          } else {
            // Create new node
            await this.nodeRepo.create({
              id: nodeInfo.node,
              status: nodeInfo.status,
              cpuUsage: nodeInfo.cpu,
              cpuMax: nodeInfo.maxcpu,
              memoryUsage: BigInt(nodeInfo.mem || 0),
              memoryMax: BigInt(nodeInfo.maxmem || 0),
              uptime: nodeInfo.uptime
            });
            result.created++;
          }

          // Create state snapshot for change tracking
          await this.stateSnapshotRepo.createResourceSnapshot('node', nodeInfo.node, nodeInfo);
        } catch (error) {
          result.errors.push(`Node ${nodeInfo.node}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.success = false;
        }
      }
    } catch (error) {
      result.errors.push(`Failed to discover nodes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Synchronize VMs across all nodes
   */
  async syncVMs(nodes?: NodeInfo[]): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      resourceType: 'vms',
      discovered: 0,
      created: 0,
      updated: 0,
      errors: [],
      duration: 0
    };

    try {
      // Get nodes if not provided
      if (!nodes) {
        nodes = await this.proxmoxClient.getNodes();
      }

      // Discover VMs from each node
      for (const node of nodes) {
        try {
          const vms = await this.proxmoxClient.getVMs(node.node);
          result.discovered += vms.length;

          // Process each VM
          for (const vmInfo of vms) {
            try {
              // Get detailed VM status
              const vmStatus = await this.proxmoxClient.getVMStatus(node.node, vmInfo.vmid);
              
              // Check if VM exists in database
              const existingVM = await this.vmRepo.findById(vmInfo.vmid);

              // Find the corresponding node in database
              const dbNode = await this.nodeRepo.findById(node.node);
              if (!dbNode) {
                result.errors.push(`VM ${vmInfo.vmid}: Node ${node.node} not found in database`);
                continue;
              }

              if (existingVM) {
                // Update existing VM
                await this.vmRepo.update(existingVM.id, {
                  name: vmStatus.name || `vm-${vmInfo.vmid}`,
                  status: vmStatus.status,
                  cpuUsage: vmStatus.cpu || 0,
                  totalCpu: vmStatus.cpus || 1,
                  memoryUsage: vmStatus.mem || 0,
                  totalMemory: vmStatus.maxmem || 0,
                  diskUsage: vmStatus.disk || 0,
                  totalDisk: vmStatus.maxdisk || 0,
                  uptime: vmStatus.uptime || 0,
                  template: vmStatus.template || false,
                  tags: vmStatus.tags || null
                });
                result.updated++;
              } else {
                // Create new VM
                await this.vmRepo.create({
                  vmid: vmInfo.vmid,
                  name: vmStatus.name || `vm-${vmInfo.vmid}`,
                  status: vmStatus.status,
                  nodeId: dbNode.id,
                  cpuUsage: vmStatus.cpu || 0,
                  totalCpu: vmStatus.cpus || 1,
                  memoryUsage: vmStatus.mem || 0,
                  totalMemory: vmStatus.maxmem || 0,
                  diskUsage: vmStatus.disk || 0,
                  totalDisk: vmStatus.maxdisk || 0,
                  uptime: vmStatus.uptime || 0,
                  template: vmStatus.template || false,
                  tags: vmStatus.tags || null
                });
                result.created++;
              }

              // Create state snapshot
              await this.stateSnapshotRepo.createSnapshot('vm', vmInfo.vmid.toString(), vmStatus);
            } catch (error) {
              result.errors.push(`VM ${vmInfo.vmid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              result.success = false;
            }
          }
        } catch (error) {
          result.errors.push(`Node ${node.node} VMs: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.success = false;
        }
      }
    } catch (error) {
      result.errors.push(`Failed to sync VMs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Synchronize containers across all nodes
   */
  async syncContainers(nodes?: NodeInfo[]): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      resourceType: 'containers',
      discovered: 0,
      created: 0,
      updated: 0,
      errors: [],
      duration: 0
    };

    try {
      // Get nodes if not provided
      if (!nodes) {
        nodes = await this.proxmoxClient.getNodes();
      }

      // Discover containers from each node
      for (const node of nodes) {
        try {
          const containers = await this.proxmoxClient.getContainers(node.node);
          result.discovered += containers.length;

          // Process each container
          for (const containerInfo of containers) {
            try {
              // Get detailed container status
              const containerStatus = await this.proxmoxClient.getContainerStatus(node.node, containerInfo.vmid);
              
              // Check if container exists in database
              const existingContainer = await this.containerRepo.findById(containerInfo.vmid);

              // Find the corresponding node in database
              const dbNode = await this.nodeRepo.findById(node.node);
              if (!dbNode) {
                result.errors.push(`Container ${containerInfo.vmid}: Node ${node.node} not found in database`);
                continue;
              }

              if (existingContainer) {
                // Update existing container
                await this.containerRepo.update(existingContainer.id, {
                  name: containerStatus.name || `ct-${containerInfo.vmid}`,
                  status: containerStatus.status,
                  cpuUsage: containerStatus.cpu || 0,
                  totalCpu: containerStatus.cpus || 1,
                  memoryUsage: containerStatus.mem || 0,
                  totalMemory: containerStatus.maxmem || 0,
                  diskUsage: containerStatus.disk || 0,
                  totalDisk: containerStatus.maxdisk || 0,
                  uptime: containerStatus.uptime || 0,
                  template: containerStatus.template || false,
                  tags: containerStatus.tags || null
                });
                result.updated++;
              } else {
                // Create new container
                await this.containerRepo.create({
                  vmid: containerInfo.vmid,
                  name: containerStatus.name || `ct-${containerInfo.vmid}`,
                  status: containerStatus.status,
                  nodeId: dbNode.id,
                  cpuUsage: containerStatus.cpu || 0,
                  totalCpu: containerStatus.cpus || 1,
                  memoryUsage: containerStatus.mem || 0,
                  totalMemory: containerStatus.maxmem || 0,
                  diskUsage: containerStatus.disk || 0,
                  totalDisk: containerStatus.maxdisk || 0,
                  uptime: containerStatus.uptime || 0,
                  template: containerStatus.template || false,
                  tags: containerStatus.tags || null
                });
                result.created++;
              }

              // Create state snapshot
              await this.stateSnapshotRepo.createSnapshot('container', containerInfo.vmid.toString(), containerStatus);
            } catch (error) {
              result.errors.push(`Container ${containerInfo.vmid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              result.success = false;
            }
          }
        } catch (error) {
          result.errors.push(`Node ${node.node} containers: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.success = false;
        }
      }
    } catch (error) {
      result.errors.push(`Failed to sync containers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Synchronize storage across all nodes
   */
  async syncStorage(nodes?: NodeInfo[]): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      resourceType: 'storage',
      discovered: 0,
      created: 0,
      updated: 0,
      errors: [],
      duration: 0
    };

    try {
      // Get cluster-wide storage pools
      const storagePools = await this.proxmoxClient.getStoragePools();
      result.discovered = storagePools.length;

      // Process each storage pool
      for (const storageInfo of storagePools) {
        try {
          // Check if storage exists in database
          const existingStorage = await this.storageRepo.findById(storageInfo.storage);

          if (existingStorage) {
            // Update existing storage
            await this.storageRepo.update(existingStorage.id, {
              type: storageInfo.type,
              content: storageInfo.content || '',
              enabled: storageInfo.enabled || true,
              shared: storageInfo.shared || false,
              totalSpace: storageInfo.total || 0,
              usedSpace: storageInfo.used || 0,
              availableSpace: storageInfo.avail || 0
            });
            result.updated++;
          } else {
            // Create new storage
            await this.storageRepo.create({
              name: storageInfo.storage,
              type: storageInfo.type,
              content: storageInfo.content || '',
              enabled: storageInfo.enabled || true,
              shared: storageInfo.shared || false,
              totalSpace: storageInfo.total || 0,
              usedSpace: storageInfo.used || 0,
              availableSpace: storageInfo.avail || 0
            });
            result.created++;
          }

          // Create state snapshot
          await this.stateSnapshotRepo.createSnapshot('storage', storageInfo.storage, storageInfo);
        } catch (error) {
          result.errors.push(`Storage ${storageInfo.storage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.success = false;
        }
      }
    } catch (error) {
      result.errors.push(`Failed to sync storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Synchronize tasks across all nodes
   */
  async syncTasks(nodes?: NodeInfo[]): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      resourceType: 'tasks',
      discovered: 0,
      created: 0,
      updated: 0,
      errors: [],
      duration: 0
    };

    try {
      // Get nodes if not provided
      if (!nodes) {
        nodes = await this.proxmoxClient.getNodes();
      }

      // Discover tasks from each node
      for (const node of nodes) {
        try {
          const tasks = await this.proxmoxClient.getTasks(node.node);
          result.discovered += tasks.length;

          // Process each task
          for (const taskInfo of tasks) {
            try {
              // Check if task exists in database
              const existingTask = await this.taskRepo.findById(taskInfo.upid);

              // Find the corresponding node in database
              const dbNode = await this.nodeRepo.findById(node.node);
              if (!dbNode) {
                result.errors.push(`Task ${taskInfo.upid}: Node ${node.node} not found in database`);
                continue;
              }

              if (existingTask) {
                // Update existing task
                await this.taskRepo.update(existingTask.id, {
                  status: taskInfo.status,
                  endTime: taskInfo.endtime ? new Date(taskInfo.endtime * 1000) : null,
                  exitStatus: taskInfo.exitstatus || null
                });
                result.updated++;
              } else {
                // Create new task
                await this.taskRepo.create({
                  upid: taskInfo.upid,
                  nodeId: dbNode.id,
                  type: taskInfo.type,
                  status: taskInfo.status,
                  startTime: new Date(taskInfo.starttime * 1000),
                  endTime: taskInfo.endtime ? new Date(taskInfo.endtime * 1000) : null,
                  exitStatus: taskInfo.exitstatus || null,
                  user: taskInfo.user
                });
                result.created++;
              }

              // Create state snapshot
              await this.stateSnapshotRepo.createSnapshot('task', taskInfo.upid, taskInfo);
            } catch (error) {
              result.errors.push(`Task ${taskInfo.upid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              result.success = false;
            }
          }
        } catch (error) {
          result.errors.push(`Node ${node.node} tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.success = false;
        }
      }
    } catch (error) {
      result.errors.push(`Failed to sync tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Generate comprehensive sync summary
   */
  private generateSummary(results: SyncResult[], totalDuration: number): SyncSummary {
    return {
      totalResources: results.length,
      totalDiscovered: results.reduce((sum, r) => sum + r.discovered, 0),
      totalCreated: results.reduce((sum, r) => sum + r.created, 0),
      totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      results,
      duration: totalDuration
    };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    lastSync: Date | null;
    totalResources: number;
    resourceBreakdown: Record<string, number>;
  }> {
    try {
      // Get latest state snapshot to determine last sync time
      const latestSnapshot = await this.stateSnapshotRepo.getLatestSnapshot();
      
      // Get resource counts from database
      const [nodeCount, vmCount, containerCount, storageCount, taskCount] = await Promise.all([
        this.nodeRepo.count(),
        this.vmRepo.count(),
        this.containerRepo.count(),
        this.storageRepo.count(),
        this.taskRepo.count()
      ]);

      return {
        lastSync: latestSnapshot?.createdAt || null,
        totalResources: nodeCount + vmCount + containerCount + storageCount + taskCount,
        resourceBreakdown: {
          nodes: nodeCount,
          vms: vmCount,
          containers: containerCount,
          storage: storageCount,
          tasks: taskCount
        }
      };
    } catch (error) {
      throw new Error(`Failed to get sync stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}