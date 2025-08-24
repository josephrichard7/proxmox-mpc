/**
 * Task repository for managing Proxmox task operations
 */

import { Task, Node, Prisma } from '@prisma/client';
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

// Input types for Task operations
export interface CreateTaskInput {
  upid: string;
  nodeId: string;
  type: string;
  status: string;
  resourceType?: string;
  resourceId?: string;
  user?: string;
  startTime?: Date;
  endTime?: Date;
  exitStatus?: string;
  logEntries?: string;
}

export interface UpdateTaskInput {
  nodeId?: string;
  type?: string;
  status?: string;
  resourceType?: string;
  resourceId?: string;
  user?: string;
  startTime?: Date;
  endTime?: Date;
  exitStatus?: string;
  logEntries?: string;
}

// Enhanced Task type with relationships
export interface TaskWithRelations extends Task {
  node?: Node;
}

export class TaskRepository implements BaseRepository<Task, CreateTaskInput, UpdateTaskInput, string> {
  private validator: Validator<CreateTaskInput>;
  private logger = Logger.getInstance();

  constructor() {
    this.validator = new Validator<CreateTaskInput>()
      .addRule(CommonValidators.required('upid'))
      .addRule(CommonValidators.required('nodeId'))
      .addRule(CommonValidators.required('type'))
      .addRule(CommonValidators.required('status'))
      .addRule(CommonValidators.oneOf('status', ['running', 'stopped', 'OK', 'ERROR', 'WARNING']))
      .addRule(CommonValidators.oneOf('resourceType', ['vm', 'container', 'node', 'storage', undefined]))
      .addRule({
        validate: (data) => {
          // Basic UPID format validation
          if (!data.upid.startsWith('UPID:')) {
            return 'UPID must start with "UPID:"';
          }
          return null;
        }
      });
  }

  async create(data: CreateTaskInput): Promise<Task> {
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
      return await dbClient.client.task.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ValidationError(`Task with UPID ${data.upid} already exists`);
        }
      }
      throw error;
    }
  }

  async findById(upid: string, options?: QueryOptions): Promise<Task | null> {
    const include = options?.include || {};
    
    return await dbClient.client.task.findUnique({
      where: { upid },
      include
    });
  }

  async findMany(options: FindManyOptions = {}): Promise<FindManyResult<Task>> {
    const {
      page = 1,
      limit = 50,
      offset,
      include = {},
      orderBy = { startTime: 'desc' },
      where = {}
    } = options;

    const skip = offset ?? (page - 1) * limit;

    const [data, total] = await Promise.all([
      dbClient.client.task.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit
      }),
      dbClient.client.task.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + data.length < total
    };
  }

  async update(upid: string, data: UpdateTaskInput): Promise<Task> {
    // Check if task exists
    const existing = await this.findById(upid);
    if (!existing) {
      throw new NotFoundError('Task', upid);
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
      return await dbClient.client.task.update({
        where: { upid },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async delete(upid: string): Promise<void> {
    // Check if task exists
    const existing = await this.findById(upid);
    if (!existing) {
      throw new NotFoundError('Task', upid);
    }

    try {
      await dbClient.client.task.delete({
        where: { upid }
      });
    } catch (error) {
      throw error;
    }
  }

  async createMany(data: CreateTaskInput[]): Promise<Task[]> {
    // Validate all items
    for (const item of data) {
      await this.validator.validate(item);
    }

    const results: Task[] = [];
    for (const item of data) {
      try {
        const created = await this.create(item);
        results.push(created);
      } catch (error) {
        // Continue with others if one fails, but log the error
        this.logger.error(`Failed to create task ${item.upid} in bulk operation`, error as Error, {
          workspace: 'database',
          resourcesAffected: [item.upid]
        }, ['Continue with remaining tasks', 'Check database connectivity']);
      }
    }

    return results;
  }

  async updateMany(where: Record<string, any>, data: Partial<UpdateTaskInput>): Promise<number> {
    const result = await dbClient.client.task.updateMany({
      where,
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return result.count;
  }

  async deleteMany(where: Record<string, any>): Promise<number> {
    const result = await dbClient.client.task.deleteMany({
      where
    });

    return result.count;
  }

  async count(where: Record<string, any> = {}): Promise<number> {
    return await dbClient.client.task.count({ where });
  }

  async exists(upid: string): Promise<boolean> {
    const task = await dbClient.client.task.findUnique({
      where: { upid },
      select: { upid: true }
    });

    return task !== null;
  }

  async health(): Promise<{ status: string; timestamp: Date }> {
    try {
      await dbClient.client.task.count();
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

  // Task-specific query methods
  async findByStatus(status: string, options?: QueryOptions): Promise<Task[]> {
    return await dbClient.client.task.findMany({
      where: { status },
      include: options?.include || {},
      orderBy: options?.orderBy || { startTime: 'desc' }
    });
  }

  async findByNode(nodeId: string, options?: QueryOptions): Promise<Task[]> {
    return await dbClient.client.task.findMany({
      where: { nodeId },
      include: options?.include || {},
      orderBy: options?.orderBy || { startTime: 'desc' }
    });
  }

  async findByType(type: string, options?: QueryOptions): Promise<Task[]> {
    return await dbClient.client.task.findMany({
      where: { type },
      include: options?.include || {},
      orderBy: options?.orderBy || { startTime: 'desc' }
    });
  }

  async findByResource(resourceType: string, resourceId: string, options?: QueryOptions): Promise<Task[]> {
    return await dbClient.client.task.findMany({
      where: { 
        resourceType,
        resourceId 
      },
      include: options?.include || {},
      orderBy: options?.orderBy || { startTime: 'desc' }
    });
  }

  async findRunning(options?: QueryOptions): Promise<Task[]> {
    return this.findByStatus('running', options);
  }

  async findCompleted(options?: QueryOptions): Promise<Task[]> {
    return await dbClient.client.task.findMany({
      where: { 
        status: { in: ['OK', 'ERROR', 'WARNING'] }
      },
      include: options?.include || {},
      orderBy: options?.orderBy || { endTime: 'desc' }
    });
  }

  async findFailed(options?: QueryOptions): Promise<Task[]> {
    return this.findByStatus('ERROR', options);
  }

  async findByUser(user: string, options?: QueryOptions): Promise<Task[]> {
    return await dbClient.client.task.findMany({
      where: { user },
      include: options?.include || {},
      orderBy: options?.orderBy || { startTime: 'desc' }
    });
  }

  async findWithRelations(upid: string): Promise<TaskWithRelations | null> {
    return await dbClient.client.task.findUnique({
      where: { upid },
      include: {
        node: true
      }
    });
  }

  async findRecentTasks(hours: number = 24, options?: QueryOptions): Promise<Task[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await dbClient.client.task.findMany({
      where: {
        startTime: {
          gte: since
        }
      },
      include: options?.include || {},
      orderBy: { startTime: 'desc' }
    });
  }

  async findLongRunningTasks(minutes: number = 60): Promise<Task[]> {
    const threshold = new Date(Date.now() - minutes * 60 * 1000);
    
    return await dbClient.client.task.findMany({
      where: {
        status: 'running',
        startTime: {
          lte: threshold
        }
      },
      include: { node: true },
      orderBy: { startTime: 'asc' }
    });
  }

  async getTaskStatistics(): Promise<{
    totalTasks: number;
    runningTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgExecutionTime: number;
    taskTypeDistribution: Record<string, number>;
    recentTasksCount: number;
  }> {
    const tasks = await dbClient.client.task.findMany({
      select: {
        status: true,
        type: true,
        startTime: true,
        endTime: true,
        createdAt: true
      }
    });

    const totalTasks = tasks.length;
    const runningTasks = tasks.filter(t => t.status === 'running').length;
    const completedTasks = tasks.filter(t => ['OK', 'ERROR', 'WARNING'].includes(t.status)).length;
    const failedTasks = tasks.filter(t => t.status === 'ERROR').length;

    // Calculate average execution time for completed tasks
    const completedTasksWithTiming = tasks.filter(t => 
      t.startTime && t.endTime && ['OK', 'ERROR', 'WARNING'].includes(t.status)
    );
    
    const avgExecutionTime = completedTasksWithTiming.length > 0
      ? completedTasksWithTiming.reduce((sum, task) => {
          const duration = task.endTime!.getTime() - task.startTime!.getTime();
          return sum + duration;
        }, 0) / completedTasksWithTiming.length / 1000 // Convert to seconds
      : 0;

    // Task type distribution
    const taskTypeDistribution: Record<string, number> = {};
    tasks.forEach(task => {
      taskTypeDistribution[task.type] = (taskTypeDistribution[task.type] || 0) + 1;
    });

    // Recent tasks (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTasksCount = tasks.filter(t => t.createdAt >= oneDayAgo).length;

    return {
      totalTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      avgExecutionTime,
      taskTypeDistribution,
      recentTasksCount
    };
  }

  async updateTaskStatus(upid: string, status: string, exitStatus?: string, endTime?: Date): Promise<Task> {
    const updateData: UpdateTaskInput = {
      status
    };

    if (exitStatus) updateData.exitStatus = exitStatus;
    if (endTime) updateData.endTime = endTime;
    if (status !== 'running' && !endTime) updateData.endTime = new Date();

    return this.update(upid, updateData);
  }

  async addLogEntry(upid: string, logEntry: string): Promise<Task> {
    const task = await this.findById(upid);
    if (!task) {
      throw new NotFoundError('Task', upid);
    }

    let logEntries: string[] = [];
    if (task.logEntries) {
      try {
        logEntries = JSON.parse(task.logEntries);
      } catch (error) {
        // If parsing fails, start with a new array
        logEntries = [];
      }
    }

    logEntries.push(`${new Date().toISOString()}: ${logEntry}`);

    return this.update(upid, {
      logEntries: JSON.stringify(logEntries)
    });
  }

  async cleanupOldTasks(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    return this.deleteMany({
      status: { in: ['OK', 'ERROR', 'WARNING'] },
      endTime: {
        lt: cutoffDate
      }
    });
  }
}