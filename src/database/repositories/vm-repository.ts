/**
 * VM repository for managing Proxmox virtual machines
 */

import { VM, Node, Prisma } from '@prisma/client';
import { dbClient } from '../client';
import {
  BaseRepository,
  FindManyOptions,
  FindManyResult,
  QueryOptions,
  NotFoundError,
  ValidationError,
  Validator,
  CommonValidators
} from './base-repository';

// Input types for VM operations
export interface CreateVMInput {
  id: number;
  nodeId: string;
  name?: string;
  status: string;
  template?: boolean;
  cpuCores?: number;
  cpuUsage?: number;
  memoryBytes?: bigint;
  memoryUsage?: bigint;
  diskSize?: bigint;
  diskUsage?: bigint;
  networkIn?: bigint;
  networkOut?: bigint;
  uptime?: number;
  pid?: number;
  haManaged?: boolean;
  lockStatus?: string;
  configDigest?: string;
}

export interface UpdateVMInput {
  nodeId?: string;
  name?: string;
  status?: string;
  template?: boolean;
  cpuCores?: number;
  cpuUsage?: number;
  memoryBytes?: bigint;
  memoryUsage?: bigint;
  diskSize?: bigint;
  diskUsage?: bigint;
  networkIn?: bigint;
  networkOut?: bigint;
  uptime?: number;
  pid?: number;
  haManaged?: boolean;
  lockStatus?: string;
  configDigest?: string;
}

// Enhanced VM type with relationships
export interface VMWithRelations extends VM {
  node?: Node;
}

export class VMRepository implements BaseRepository<VM, CreateVMInput, UpdateVMInput, number> {
  private validator: Validator<CreateVMInput>;

  constructor() {
    this.validator = new Validator<CreateVMInput>()
      .addRule(CommonValidators.required('id'))
      .addRule(CommonValidators.required('nodeId'))
      .addRule(CommonValidators.required('status'))
      .addRule(CommonValidators.oneOf('status', ['running', 'stopped', 'paused', 'suspended', 'unknown']))
      .addRule({
        validate: (data) => {
          if (data.id <= 0) {
            return 'VM ID must be greater than 0';
          }
          return null;
        }
      })
      .addRule({
        validate: (data) => {
          if (data.cpuCores !== undefined && data.cpuCores <= 0) {
            return 'CPU cores must be greater than 0';
          }
          return null;
        }
      })
      .addRule(CommonValidators.range('cpuUsage', 0, 1));
  }

  async create(data: CreateVMInput): Promise<VM> {
    await this.validator.validate(data);

    // Verify parent node exists
    const nodeExists = await dbClient.client.node.findUnique({
      where: { id: data.nodeId },
      select: { id: true }
    });

    if (!nodeExists) {
      throw new ValidationError(`Node ${data.nodeId} does not exist`);
    }

    try {
      return await dbClient.client.vM.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ValidationError(`VM with ID ${data.id} already exists`);
        }
      }
      throw error;
    }
  }

  async findById(id: number, options?: QueryOptions): Promise<VM | null> {
    const include = options?.include || {};
    
    return await dbClient.client.vM.findUnique({
      where: { id },
      include
    });
  }

  async findMany(options: FindManyOptions = {}): Promise<FindManyResult<VM>> {
    const {
      page = 1,
      limit = 50,
      offset,
      include = {},
      orderBy = { createdAt: 'desc' },
      where = {}
    } = options;

    const skip = offset ?? (page - 1) * limit;

    const [data, total] = await Promise.all([
      dbClient.client.vM.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit
      }),
      dbClient.client.vM.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + data.length < total
    };
  }

  async update(id: number, data: UpdateVMInput): Promise<VM> {
    // Check if VM exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('VM', id);
    }

    // If updating nodeId, verify new node exists
    if (data.nodeId && data.nodeId !== existing.nodeId) {
      const nodeExists = await dbClient.client.node.findUnique({
        where: { id: data.nodeId },
        select: { id: true }
      });

      if (!nodeExists) {
        throw new ValidationError(`Node ${data.nodeId} does not exist`);
      }
    }

    try {
      return await dbClient.client.vM.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    // Check if VM exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('VM', id);
    }

    try {
      await dbClient.client.vM.delete({
        where: { id }
      });
    } catch (error) {
      throw error;
    }
  }

  async createMany(data: CreateVMInput[]): Promise<VM[]> {
    // Validate all items
    for (const item of data) {
      await this.validator.validate(item);
    }

    const results: VM[] = [];
    for (const item of data) {
      try {
        const created = await this.create(item);
        results.push(created);
      } catch (error) {
        // Continue with others if one fails, but log the error
        console.error(`Failed to create VM ${item.id}:`, error);
      }
    }

    return results;
  }

  async updateMany(where: Record<string, any>, data: Partial<UpdateVMInput>): Promise<number> {
    const result = await dbClient.client.vM.updateMany({
      where,
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return result.count;
  }

  async deleteMany(where: Record<string, any>): Promise<number> {
    const result = await dbClient.client.vM.deleteMany({
      where
    });

    return result.count;
  }

  async count(where: Record<string, any> = {}): Promise<number> {
    return await dbClient.client.vM.count({ where });
  }

  async exists(id: number): Promise<boolean> {
    const vm = await dbClient.client.vM.findUnique({
      where: { id },
      select: { id: true }
    });

    return vm !== null;
  }

  async health(): Promise<{ status: string; timestamp: Date }> {
    try {
      await dbClient.client.vM.count();
      return {
        status: 'healthy',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date()
      };
    }
  }

  // VM-specific query methods
  async findByStatus(status: string, options?: QueryOptions): Promise<VM[]> {
    return await dbClient.client.vM.findMany({
      where: { status },
      include: options?.include || {},
      orderBy: options?.orderBy || { createdAt: 'desc' }
    });
  }

  async findByNode(nodeId: string, options?: QueryOptions): Promise<VM[]> {
    return await dbClient.client.vM.findMany({
      where: { nodeId },
      include: options?.include || {},
      orderBy: options?.orderBy || { id: 'asc' }
    });
  }

  async findRunningVMs(options?: QueryOptions): Promise<VM[]> {
    return this.findByStatus('running', options);
  }

  async findTemplates(options?: QueryOptions): Promise<VM[]> {
    return await dbClient.client.vM.findMany({
      where: { template: true },
      include: options?.include || {},
      orderBy: options?.orderBy || { name: 'asc' }
    });
  }

  async findWithHighCpuUsage(threshold: number = 0.8, options?: QueryOptions): Promise<VM[]> {
    return await dbClient.client.vM.findMany({
      where: {
        cpuUsage: {
          gte: threshold
        },
        status: 'running'
      },
      include: options?.include || {},
      orderBy: { cpuUsage: 'desc' }
    });
  }

  async findWithRelations(id: number): Promise<VMWithRelations | null> {
    return await dbClient.client.vM.findUnique({
      where: { id },
      include: {
        node: true
      }
    });
  }

  async findVMsByIdRange(startId: number, endId: number, options?: QueryOptions): Promise<VM[]> {
    return await dbClient.client.vM.findMany({
      where: {
        id: {
          gte: startId,
          lte: endId
        }
      },
      include: options?.include || {},
      orderBy: { id: 'asc' }
    });
  }

  async getVMStatistics(): Promise<{
    totalVMs: number;
    runningVMs: number;
    stoppedVMs: number;
    templates: number;
    totalMemoryAllocated: bigint;
    totalDiskAllocated: bigint;
    avgCpuUsage: number;
  }> {
    const vms = await dbClient.client.vM.findMany({
      select: {
        status: true,
        template: true,
        cpuUsage: true,
        memoryBytes: true,
        diskSize: true
      }
    });

    const totalVMs = vms.length;
    const runningVMs = vms.filter(vm => vm.status === 'running' && !vm.template).length;
    const stoppedVMs = vms.filter(vm => vm.status === 'stopped' && !vm.template).length;
    const templates = vms.filter(vm => vm.template === true).length;
    
    const totalMemoryAllocated = vms.reduce(
      (sum, vm) => sum + (vm.memoryBytes || BigInt(0)), 
      BigInt(0)
    );
    
    const totalDiskAllocated = vms.reduce(
      (sum, vm) => sum + (vm.diskSize || BigInt(0)), 
      BigInt(0)
    );
    
    const runningVMsWithCpuUsage = vms.filter(vm => 
      vm.status === 'running' && vm.cpuUsage !== null && vm.cpuUsage !== undefined
    );
    
    const avgCpuUsage = runningVMsWithCpuUsage.length > 0
      ? runningVMsWithCpuUsage.reduce((sum, vm) => sum + (vm.cpuUsage || 0), 0) / runningVMsWithCpuUsage.length
      : 0;

    return {
      totalVMs,
      runningVMs,
      stoppedVMs,
      templates,
      totalMemoryAllocated,
      totalDiskAllocated,
      avgCpuUsage
    };
  }

  async updateVMStatus(id: number, status: string, additionalData?: Partial<UpdateVMInput>): Promise<VM> {
    return this.update(id, {
      status,
      ...additionalData
    });
  }

  async findVMsNeedingBackup(lastBackupBefore: Date): Promise<VM[]> {
    // This would typically include backup metadata, but for now we'll use updatedAt
    return await dbClient.client.vM.findMany({
      where: {
        status: 'running',
        template: false,
        updatedAt: {
          lt: lastBackupBefore
        }
      },
      include: {
        node: true
      },
      orderBy: { updatedAt: 'asc' }
    });
  }
}