/**
 * StateSnapshot repository for managing resource state history and change tracking
 */

import { StateSnapshot, Prisma } from '@prisma/client';
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

// Input types for StateSnapshot operations
export interface CreateStateSnapshotInput {
  snapshotTime: Date;
  resourceType: string;
  resourceId: string;
  resourceData: string;
  changeType: string;
}

export interface UpdateStateSnapshotInput {
  snapshotTime?: Date;
  resourceType?: string;
  resourceId?: string;
  resourceData?: string;
  changeType?: string;
}

// State comparison result types
export interface StateComparison {
  resourceType: string;
  resourceId: string;
  hasChanged: boolean;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  previousSnapshot?: StateSnapshot;
  currentData: any;
}

export interface StateHistory {
  resourceType: string;
  resourceId: string;
  snapshots: StateSnapshot[];
  totalChanges: number;
  firstSeen: Date;
  lastSeen: Date;
}

export class StateSnapshotRepository implements BaseRepository<StateSnapshot, CreateStateSnapshotInput, UpdateStateSnapshotInput, number> {
  private validator: Validator<CreateStateSnapshotInput>;
  private logger = Logger.getInstance();

  constructor() {
    this.validator = new Validator<CreateStateSnapshotInput>()
      .addRule(CommonValidators.required('snapshotTime'))
      .addRule(CommonValidators.required('resourceType'))
      .addRule(CommonValidators.required('resourceId'))
      .addRule(CommonValidators.required('resourceData'))
      .addRule(CommonValidators.required('changeType'))
      .addRule(CommonValidators.oneOf('resourceType', ['node', 'vm', 'container', 'storage', 'task']))
      .addRule(CommonValidators.oneOf('changeType', ['created', 'updated', 'deleted', 'discovered']))
      .addRule({
        validate: (data) => {
          try {
            JSON.parse(data.resourceData);
            return null;
          } catch (error) {
            return 'resourceData must be valid JSON';
          }
        }
      });
  }

  async create(data: CreateStateSnapshotInput): Promise<StateSnapshot> {
    await this.validator.validate(data);

    try {
      return await dbClient.client.stateSnapshot.create({
        data: {
          ...data,
          createdAt: new Date()
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle any specific database constraints if needed
      }
      throw error;
    }
  }

  async findById(id: number, options?: QueryOptions): Promise<StateSnapshot | null> {
    return await dbClient.client.stateSnapshot.findUnique({
      where: { id }
    });
  }

  async findMany(options: FindManyOptions = {}): Promise<FindManyResult<StateSnapshot>> {
    const {
      page = 1,
      limit = 50,
      offset,
      orderBy = { snapshotTime: 'desc' },
      where = {}
    } = options;

    const skip = offset ?? (page - 1) * limit;

    const [data, total] = await Promise.all([
      dbClient.client.stateSnapshot.findMany({
        where,
        orderBy,
        skip,
        take: limit
      }),
      dbClient.client.stateSnapshot.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + data.length < total
    };
  }

  async update(id: number, data: UpdateStateSnapshotInput): Promise<StateSnapshot> {
    // Check if snapshot exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('StateSnapshot', id);
    }

    try {
      return await dbClient.client.stateSnapshot.update({
        where: { id },
        data
      });
    } catch (error) {
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    // Check if snapshot exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('StateSnapshot', id);
    }

    try {
      await dbClient.client.stateSnapshot.delete({
        where: { id }
      });
    } catch (error) {
      throw error;
    }
  }

  async createMany(data: CreateStateSnapshotInput[]): Promise<StateSnapshot[]> {
    // Validate all items
    for (const item of data) {
      await this.validator.validate(item);
    }

    const results: StateSnapshot[] = [];
    for (const item of data) {
      try {
        const created = await this.create(item);
        results.push(created);
      } catch (error) {
        // Continue with others if one fails, but log the error
        this.logger.error(`Failed to create state snapshot for ${item.resourceType}:${item.resourceId}`, error as Error, {
          workspace: 'database',
          resourcesAffected: [`${item.resourceType}:${item.resourceId}`]
        }, ['Continue with remaining snapshots', 'Check database connectivity']);
      }
    }

    return results;
  }

  async updateMany(where: Record<string, any>, data: Partial<UpdateStateSnapshotInput>): Promise<number> {
    const result = await dbClient.client.stateSnapshot.updateMany({
      where,
      data
    });

    return result.count;
  }

  async deleteMany(where: Record<string, any>): Promise<number> {
    const result = await dbClient.client.stateSnapshot.deleteMany({
      where
    });

    return result.count;
  }

  async count(where: Record<string, any> = {}): Promise<number> {
    return await dbClient.client.stateSnapshot.count({ where });
  }

  async exists(id: number): Promise<boolean> {
    const snapshot = await dbClient.client.stateSnapshot.findUnique({
      where: { id },
      select: { id: true }
    });

    return snapshot !== null;
  }

  async health(): Promise<{ status: string; timestamp: Date }> {
    try {
      await dbClient.client.stateSnapshot.count();
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

  // StateSnapshot-specific query methods
  async findByResource(resourceType: string, resourceId: string, options?: QueryOptions): Promise<StateSnapshot[]> {
    return await dbClient.client.stateSnapshot.findMany({
      where: { 
        resourceType,
        resourceId 
      },
      orderBy: options?.orderBy || { snapshotTime: 'desc' }
    });
  }

  async findByResourceType(resourceType: string, options?: QueryOptions): Promise<StateSnapshot[]> {
    return await dbClient.client.stateSnapshot.findMany({
      where: { resourceType },
      orderBy: options?.orderBy || { snapshotTime: 'desc' }
    });
  }

  async findByChangeType(changeType: string, options?: QueryOptions): Promise<StateSnapshot[]> {
    return await dbClient.client.stateSnapshot.findMany({
      where: { changeType },
      orderBy: options?.orderBy || { snapshotTime: 'desc' }
    });
  }

  async findInTimeRange(startTime: Date, endTime: Date, options?: QueryOptions): Promise<StateSnapshot[]> {
    return await dbClient.client.stateSnapshot.findMany({
      where: {
        snapshotTime: {
          gte: startTime,
          lte: endTime
        }
      },
      orderBy: options?.orderBy || { snapshotTime: 'desc' }
    });
  }

  async getLatestSnapshot(resourceType: string, resourceId: string): Promise<StateSnapshot | null> {
    return await dbClient.client.stateSnapshot.findFirst({
      where: { 
        resourceType,
        resourceId 
      },
      orderBy: { snapshotTime: 'desc' }
    });
  }

  async createResourceSnapshot(
    resourceType: string, 
    resourceId: string, 
    resourceData: any, 
    changeType: string = 'discovered'
  ): Promise<StateSnapshot> {
    return this.create({
      snapshotTime: new Date(),
      resourceType,
      resourceId,
      resourceData: JSON.stringify(resourceData),
      changeType
    });
  }

  async compareWithLatest(
    resourceType: string, 
    resourceId: string, 
    currentData: any
  ): Promise<StateComparison> {
    const previousSnapshot = await this.getLatestSnapshot(resourceType, resourceId);
    
    if (!previousSnapshot) {
      return {
        resourceType,
        resourceId,
        hasChanged: true, // No previous state, so this is a new resource
        currentData
      };
    }

    const previousData = JSON.parse(previousSnapshot.resourceData);
    const changes = this.detectChanges(previousData, currentData);

    return {
      resourceType,
      resourceId,
      hasChanged: changes.length > 0,
      changes: changes.length > 0 ? changes : undefined,
      previousSnapshot,
      currentData
    };
  }

  private detectChanges(oldData: any, newData: any): Array<{ field: string; oldValue: any; newValue: any }> {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    const oldKeys = Object.keys(oldData);
    const newKeys = Object.keys(newData);
    const allKeys = [...oldKeys, ...newKeys].filter((key, index, arr) => arr.indexOf(key) === index);

    for (const key of allKeys) {
      const oldValue = oldData[key];
      const newValue = newData[key];

      // Skip certain fields that change frequently but aren't significant
      if (['updatedAt', 'lastSeen', 'uptime'].includes(key)) {
        continue;
      }

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: key,
          oldValue,
          newValue
        });
      }
    }

    return changes;
  }

  async getResourceHistory(resourceType: string, resourceId: string): Promise<StateHistory> {
    const snapshots = await this.findByResource(resourceType, resourceId);
    
    if (snapshots.length === 0) {
      throw new NotFoundError(`StateHistory for ${resourceType}`, resourceId);
    }

    const totalChanges = snapshots.filter(s => s.changeType === 'updated').length;
    const firstSeen = snapshots[snapshots.length - 1].snapshotTime;
    const lastSeen = snapshots[0].snapshotTime;

    return {
      resourceType,
      resourceId,
      snapshots,
      totalChanges,
      firstSeen,
      lastSeen
    };
  }

  async getChangeStatistics(): Promise<{
    totalSnapshots: number;
    recentChanges: number;
    changesByType: Record<string, number>;
    changesByResource: Record<string, number>;
    mostActiveResources: Array<{ resourceType: string; resourceId: string; changeCount: number }>;
  }> {
    const snapshots = await dbClient.client.stateSnapshot.findMany({
      select: {
        changeType: true,
        resourceType: true,
        resourceId: true,
        snapshotTime: true
      }
    });

    const totalSnapshots = snapshots.length;
    
    // Recent changes (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentChanges = snapshots.filter(s => s.snapshotTime >= oneDayAgo).length;

    // Changes by type
    const changesByType: Record<string, number> = {};
    snapshots.forEach(snapshot => {
      changesByType[snapshot.changeType] = (changesByType[snapshot.changeType] || 0) + 1;
    });

    // Changes by resource type
    const changesByResource: Record<string, number> = {};
    snapshots.forEach(snapshot => {
      changesByResource[snapshot.resourceType] = (changesByResource[snapshot.resourceType] || 0) + 1;
    });

    // Most active resources
    const resourceActivity: Record<string, number> = {};
    snapshots.forEach(snapshot => {
      const key = `${snapshot.resourceType}:${snapshot.resourceId}`;
      resourceActivity[key] = (resourceActivity[key] || 0) + 1;
    });

    const mostActiveResources = Object.entries(resourceActivity)
      .map(([key, count]) => {
        const [resourceType, resourceId] = key.split(':');
        return { resourceType, resourceId, changeCount: count };
      })
      .sort((a, b) => b.changeCount - a.changeCount)
      .slice(0, 10);

    return {
      totalSnapshots,
      recentChanges,
      changesByType,
      changesByResource,
      mostActiveResources
    };
  }

  async trackResourceChange(
    resourceType: string, 
    resourceId: string, 
    currentData: any
  ): Promise<{ snapshot: StateSnapshot; hasChanged: boolean; changes?: any[] }> {
    const comparison = await this.compareWithLatest(resourceType, resourceId, currentData);
    
    const changeType = comparison.previousSnapshot 
      ? (comparison.hasChanged ? 'updated' : 'discovered')
      : 'created';

    const snapshot = await this.createResourceSnapshot(
      resourceType, 
      resourceId, 
      currentData, 
      changeType
    );

    return {
      snapshot,
      hasChanged: comparison.hasChanged,
      changes: comparison.changes
    };
  }

  async cleanupOldSnapshots(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    return this.deleteMany({
      snapshotTime: {
        lt: cutoffDate
      }
    });
  }

  async getResourceTimeline(
    resourceType: string, 
    resourceId: string, 
    startTime?: Date, 
    endTime?: Date
  ): Promise<StateSnapshot[]> {
    const where: any = { resourceType, resourceId };
    
    if (startTime || endTime) {
      where.snapshotTime = {};
      if (startTime) where.snapshotTime.gte = startTime;
      if (endTime) where.snapshotTime.lte = endTime;
    }

    return await dbClient.client.stateSnapshot.findMany({
      where,
      orderBy: { snapshotTime: 'asc' }
    });
  }

  async findResourcesWithRecentChanges(hours: number = 1): Promise<Array<{
    resourceType: string;
    resourceId: string;
    lastChange: Date;
    changeType: string;
  }>> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const recentSnapshots = await dbClient.client.stateSnapshot.findMany({
      where: {
        snapshotTime: {
          gte: since
        },
        changeType: { not: 'discovered' }
      },
      orderBy: { snapshotTime: 'desc' }
    });

    // Group by resource and get latest change for each
    const latestByResource = new Map();
    
    recentSnapshots.forEach(snapshot => {
      const key = `${snapshot.resourceType}:${snapshot.resourceId}`;
      if (!latestByResource.has(key)) {
        latestByResource.set(key, {
          resourceType: snapshot.resourceType,
          resourceId: snapshot.resourceId,
          lastChange: snapshot.snapshotTime,
          changeType: snapshot.changeType
        });
      }
    });

    return Array.from(latestByResource.values());
  }
}