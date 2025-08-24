/**
 * Node repository for managing Proxmox cluster nodes
 */

import { Node, Prisma } from '@prisma/client';
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

// Input types for Node operations
export interface CreateNodeInput {
  id: string;
  status: string;
  type?: string;
  cpuUsage?: number;
  cpuMax?: number;
  memoryUsage?: bigint;
  memoryMax?: bigint;
  diskUsage?: bigint;
  diskMax?: bigint;
  uptime?: number;
  loadAverage?: string;
  pveVersion?: string;
  kernelVersion?: string;
  subscription?: string;
  lastSeen?: Date;
}

export interface UpdateNodeInput {
  status?: string;
  type?: string;
  cpuUsage?: number;
  cpuMax?: number;
  memoryUsage?: bigint;
  memoryMax?: bigint;
  diskUsage?: bigint;
  diskMax?: bigint;
  uptime?: number;
  loadAverage?: string;
  pveVersion?: string;
  kernelVersion?: string;
  subscription?: string;
  lastSeen?: Date;
}

// Enhanced Node type with relationships
export interface NodeWithRelations extends Node {
  vms?: any[];
  containers?: any[];
  tasks?: any[];
}

export class NodeRepository implements BaseRepository<Node, CreateNodeInput, UpdateNodeInput, string> {
  private validator: Validator<CreateNodeInput>;
  private logger = Logger.getInstance();

  constructor() {
    this.validator = new Validator<CreateNodeInput>()
      .addRule(CommonValidators.required('id'))
      .addRule(CommonValidators.required('status'))
      .addRule(CommonValidators.oneOf('status', ['online', 'offline', 'unknown']))
      .addRule(CommonValidators.range('cpuUsage', 0, 1))
      .addRule({
        validate: (data) => {
          if (data.cpuMax !== undefined && data.cpuMax <= 0) {
            return 'cpuMax must be greater than 0';
          }
          return null;
        }
      });
  }

  async create(data: CreateNodeInput): Promise<Node> {
    await this.validator.validate(data);

    try {
      return await dbClient.client.node.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ValidationError(`Node with ID ${data.id} already exists`);
        }
      }
      throw error;
    }
  }

  async findById(id: string, options?: QueryOptions): Promise<Node | null> {
    const include = options?.include || {};
    
    return await dbClient.client.node.findUnique({
      where: { id },
      include
    });
  }

  async findMany(options: FindManyOptions = {}): Promise<FindManyResult<Node>> {
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
      dbClient.client.node.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit
      }),
      dbClient.client.node.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + data.length < total
    };
  }

  async update(id: string, data: UpdateNodeInput): Promise<Node> {
    // Check if node exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Node', id);
    }

    try {
      return await dbClient.client.node.update({
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

  async delete(id: string): Promise<void> {
    // Check if node exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Node', id);
    }

    try {
      await dbClient.client.node.delete({
        where: { id }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new ValidationError(
            'Cannot delete node with existing VMs or containers. Delete dependent resources first.'
          );
        }
      }
      throw error;
    }
  }

  async createMany(data: CreateNodeInput[]): Promise<Node[]> {
    // Validate all items
    for (const item of data) {
      await this.validator.validate(item);
    }

    const results: Node[] = [];
    for (const item of data) {
      try {
        const created = await this.create(item);
        results.push(created);
      } catch (error) {
        // Continue with others if one fails, but log the error
        this.logger.error(`Failed to create node ${item.id} in bulk operation`, error as Error, {
          workspace: 'database',
          resourcesAffected: [item.id]
        }, ['Continue with remaining nodes', 'Check database connectivity']);
      }
    }

    return results;
  }

  async updateMany(where: Record<string, any>, data: Partial<UpdateNodeInput>): Promise<number> {
    const result = await dbClient.client.node.updateMany({
      where,
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return result.count;
  }

  async deleteMany(where: Record<string, any>): Promise<number> {
    const result = await dbClient.client.node.deleteMany({
      where
    });

    return result.count;
  }

  async count(where: Record<string, any> = {}): Promise<number> {
    return await dbClient.client.node.count({ where });
  }

  async exists(id: string): Promise<boolean> {
    const node = await dbClient.client.node.findUnique({
      where: { id },
      select: { id: true }
    });

    return node !== null;
  }

  async health(): Promise<{ status: string; timestamp: Date }> {
    try {
      await dbClient.client.node.count();
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

  // Node-specific query methods
  async findByStatus(status: string, options?: QueryOptions): Promise<Node[]> {
    return await dbClient.client.node.findMany({
      where: { status },
      include: options?.include || {},
      orderBy: options?.orderBy || { createdAt: 'desc' }
    });
  }

  async findOnlineNodes(options?: QueryOptions): Promise<Node[]> {
    return this.findByStatus('online', options);
  }

  async findWithHighCpuUsage(threshold: number = 0.8, options?: QueryOptions): Promise<Node[]> {
    return await dbClient.client.node.findMany({
      where: {
        cpuUsage: {
          gte: threshold
        }
      },
      include: options?.include || {},
      orderBy: { cpuUsage: 'desc' }
    });
  }

  async findWithRelations(id: string): Promise<NodeWithRelations | null> {
    return await dbClient.client.node.findUnique({
      where: { id },
      include: {
        vms: {
          orderBy: { createdAt: 'desc' }
        },
        containers: {
          orderBy: { createdAt: 'desc' }
        },
        tasks: {
          orderBy: { startTime: 'desc' },
          take: 10 // Latest 10 tasks
        }
      }
    });
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.update(id, { lastSeen: new Date() });
  }

  async getResourceSummary(): Promise<{
    totalNodes: number;
    onlineNodes: number;
    totalCpu: number;
    totalMemory: bigint;
    avgCpuUsage: number;
  }> {
    const nodes = await dbClient.client.node.findMany({
      select: {
        status: true,
        cpuMax: true,
        cpuUsage: true,
        memoryMax: true
      }
    });

    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(n => n.status === 'online').length;
    const totalCpu = nodes.reduce((sum, n) => sum + (n.cpuMax || 0), 0);
    const totalMemory = nodes.reduce((sum, n) => sum + (n.memoryMax || BigInt(0)), BigInt(0));
    const avgCpuUsage = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + (n.cpuUsage || 0), 0) / nodes.length
      : 0;

    return {
      totalNodes,
      onlineNodes,
      totalCpu,
      totalMemory,
      avgCpuUsage
    };
  }
}