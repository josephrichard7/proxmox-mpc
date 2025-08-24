/**
 * Container repository for managing Proxmox LXC containers
 */

import { Container, Node, Prisma } from '@prisma/client';
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
import { Logger } from '../../observability/logger';

// Input types for Container operations
export interface CreateContainerInput {
  id: number;
  nodeId: string;
  name?: string;
  hostname?: string;
  status: string;
  template?: boolean;
  cpuCores?: number;
  cpuUsage?: number;
  memoryBytes?: bigint;
  memoryUsage?: bigint;
  swapBytes?: bigint;
  swapUsage?: bigint;
  diskSize?: bigint;
  diskUsage?: bigint;
  networkIn?: bigint;
  networkOut?: bigint;
  uptime?: number;
  osTemplate?: string;
  privileged?: boolean;
  protection?: boolean;
  lockStatus?: string;
  configDigest?: string;
}

export interface UpdateContainerInput {
  nodeId?: string;
  name?: string;
  hostname?: string;
  status?: string;
  template?: boolean;
  cpuCores?: number;
  cpuUsage?: number;
  memoryBytes?: bigint;
  memoryUsage?: bigint;
  swapBytes?: bigint;
  swapUsage?: bigint;
  diskSize?: bigint;
  diskUsage?: bigint;
  networkIn?: bigint;
  networkOut?: bigint;
  uptime?: number;
  osTemplate?: string;
  privileged?: boolean;
  protection?: boolean;
  lockStatus?: string;
  configDigest?: string;
}

// Enhanced Container type with relationships
export interface ContainerWithRelations extends Container {
  node?: Node;
}

export class ContainerRepository implements BaseRepository<Container, CreateContainerInput, UpdateContainerInput, number> {
  private validator: Validator<CreateContainerInput>;
  private logger = Logger.getInstance();

  constructor() {
    this.validator = new Validator<CreateContainerInput>()
      .addRule(CommonValidators.required('id'))
      .addRule(CommonValidators.required('nodeId'))
      .addRule(CommonValidators.required('status'))
      .addRule(CommonValidators.oneOf('status', ['running', 'stopped', 'paused', 'suspended', 'unknown']))
      .addRule({
        validate: (data) => {
          if (data.id <= 0) {
            return 'Container ID must be greater than 0';
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

  async create(data: CreateContainerInput): Promise<Container> {
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
      return await dbClient.client.container.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ValidationError(`Container with ID ${data.id} already exists`);
        }
      }
      throw error;
    }
  }

  async findById(id: number, options?: QueryOptions): Promise<Container | null> {
    const include = options?.include || {};
    
    return await dbClient.client.container.findUnique({
      where: { id },
      include
    });
  }

  async findMany(options: FindManyOptions = {}): Promise<FindManyResult<Container>> {
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
      dbClient.client.container.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit
      }),
      dbClient.client.container.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + data.length < total
    };
  }

  async update(id: number, data: UpdateContainerInput): Promise<Container> {
    // Check if container exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Container', id);
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
      return await dbClient.client.container.update({
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
    // Check if container exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Container', id);
    }

    try {
      await dbClient.client.container.delete({
        where: { id }
      });
    } catch (error) {
      throw error;
    }
  }

  async createMany(data: CreateContainerInput[]): Promise<Container[]> {
    // Validate all items
    for (const item of data) {
      await this.validator.validate(item);
    }

    const results: Container[] = [];
    for (const item of data) {
      try {
        const created = await this.create(item);
        results.push(created);
      } catch (error) {
        // Continue with others if one fails, but log the error
        this.logger.error(`Failed to create container ${item.id} in bulk operation`, error as Error, {
          workspace: 'database',
          resourcesAffected: [item.id.toString()]
        }, ['Continue with remaining containers', 'Check database connectivity']);
      }
    }

    return results;
  }

  async updateMany(where: Record<string, any>, data: Partial<UpdateContainerInput>): Promise<number> {
    const result = await dbClient.client.container.updateMany({
      where,
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return result.count;
  }

  async deleteMany(where: Record<string, any>): Promise<number> {
    const result = await dbClient.client.container.deleteMany({
      where
    });

    return result.count;
  }

  async count(where: Record<string, any> = {}): Promise<number> {
    return await dbClient.client.container.count({ where });
  }

  async exists(id: number): Promise<boolean> {
    const container = await dbClient.client.container.findUnique({
      where: { id },
      select: { id: true }
    });

    return container !== null;
  }

  async health(): Promise<{ status: string; timestamp: Date }> {
    try {
      await dbClient.client.container.count();
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

  // Container-specific query methods
  async findByStatus(status: string, options?: QueryOptions): Promise<Container[]> {
    return await dbClient.client.container.findMany({
      where: { status },
      include: options?.include || {},
      orderBy: options?.orderBy || { createdAt: 'desc' }
    });
  }

  async findByNode(nodeId: string, options?: QueryOptions): Promise<Container[]> {
    return await dbClient.client.container.findMany({
      where: { nodeId },
      include: options?.include || {},
      orderBy: options?.orderBy || { id: 'asc' }
    });
  }

  async findRunningContainers(options?: QueryOptions): Promise<Container[]> {
    return this.findByStatus('running', options);
  }

  async findTemplates(options?: QueryOptions): Promise<Container[]> {
    return await dbClient.client.container.findMany({
      where: { template: true },
      include: options?.include || {},
      orderBy: options?.orderBy || { name: 'asc' }
    });
  }

  async findByOSTemplate(osTemplate: string, options?: QueryOptions): Promise<Container[]> {
    return await dbClient.client.container.findMany({
      where: { osTemplate },
      include: options?.include || {},
      orderBy: options?.orderBy || { createdAt: 'desc' }
    });
  }

  // Note: privileged field would need to be added to schema to implement this
  // async findPrivileged(options?: QueryOptions): Promise<Container[]> { ... }

  async findWithHighCpuUsage(threshold: number = 0.8, options?: QueryOptions): Promise<Container[]> {
    return await dbClient.client.container.findMany({
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

  async findWithRelations(id: number): Promise<ContainerWithRelations | null> {
    return await dbClient.client.container.findUnique({
      where: { id },
      include: {
        node: true
      }
    });
  }

  async findContainersByIdRange(startId: number, endId: number, options?: QueryOptions): Promise<Container[]> {
    return await dbClient.client.container.findMany({
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

  async getContainerStatistics(): Promise<{
    totalContainers: number;
    runningContainers: number;
    stoppedContainers: number;
    templates: number;
    totalMemoryAllocated: bigint;
    totalSwapAllocated: bigint;
    totalDiskAllocated: bigint;
    avgCpuUsage: number;
    osTemplateDistribution: Record<string, number>;
  }> {
    const containers = await dbClient.client.container.findMany({
      select: {
        status: true,
        template: true,
        cpuUsage: true,
        memoryBytes: true,
        swapBytes: true,
        diskSize: true,
        osTemplate: true
      }
    });

    const totalContainers = containers.length;
    const runningContainers = containers.filter(ct => ct.status === 'running' && !ct.template).length;
    const stoppedContainers = containers.filter(ct => ct.status === 'stopped' && !ct.template).length;
    const templates = containers.filter(ct => ct.template === true).length;
    
    const totalMemoryAllocated = containers.reduce(
      (sum, ct) => sum + (ct.memoryBytes || BigInt(0)), 
      BigInt(0)
    );
    
    const totalSwapAllocated = containers.reduce(
      (sum, ct) => sum + (ct.swapBytes || BigInt(0)), 
      BigInt(0)
    );
    
    const totalDiskAllocated = containers.reduce(
      (sum, ct) => sum + (ct.diskSize || BigInt(0)), 
      BigInt(0)
    );
    
    const runningContainersWithCpuUsage = containers.filter(ct => 
      ct.status === 'running' && ct.cpuUsage !== null && ct.cpuUsage !== undefined
    );
    
    const avgCpuUsage = runningContainersWithCpuUsage.length > 0
      ? runningContainersWithCpuUsage.reduce((sum, ct) => sum + (ct.cpuUsage || 0), 0) / runningContainersWithCpuUsage.length
      : 0;

    // OS Template distribution
    const osTemplateDistribution: Record<string, number> = {};
    containers.forEach(ct => {
      if (ct.osTemplate) {
        osTemplateDistribution[ct.osTemplate] = (osTemplateDistribution[ct.osTemplate] || 0) + 1;
      }
    });

    return {
      totalContainers,
      runningContainers,
      stoppedContainers,
      templates,
      totalMemoryAllocated,
      totalSwapAllocated,
      totalDiskAllocated,
      avgCpuUsage,
      osTemplateDistribution
    };
  }

  async updateContainerStatus(id: number, status: string, additionalData?: Partial<UpdateContainerInput>): Promise<Container> {
    return this.update(id, {
      status,
      ...additionalData
    });
  }

  async findContainersNeedingUpdate(lastUpdateBefore: Date): Promise<Container[]> {
    return await dbClient.client.container.findMany({
      where: {
        status: 'running',
        template: false,
        updatedAt: {
          lt: lastUpdateBefore
        }
      },
      include: {
        node: true
      },
      orderBy: { updatedAt: 'asc' }
    });
  }

  async findContainersByHostname(hostname: string, options?: QueryOptions): Promise<Container[]> {
    return await dbClient.client.container.findMany({
      where: { hostname },
      include: options?.include || {},
      orderBy: options?.orderBy || { createdAt: 'desc' }
    });
  }
}