/**
 * Storage repository for managing Proxmox storage pools
 */

import { Storage, Prisma } from '@prisma/client';
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

// Input types for Storage operations
export interface CreateStorageInput {
  id: string;
  type: string;
  contentTypes?: string;
  enabled?: boolean;
  shared?: boolean;
  totalBytes?: bigint;
  usedBytes?: bigint;
  availableBytes?: bigint;
  path?: string;
  nodes?: string;
  configDigest?: string;
}

export interface UpdateStorageInput {
  type?: string;
  contentTypes?: string;
  enabled?: boolean;
  shared?: boolean;
  totalBytes?: bigint;
  usedBytes?: bigint;
  availableBytes?: bigint;
  path?: string;
  nodes?: string;
  configDigest?: string;
}

export class StorageRepository implements BaseRepository<Storage, CreateStorageInput, UpdateStorageInput, string> {
  private validator: Validator<CreateStorageInput>;
  private logger = Logger.getInstance();

  constructor() {
    this.validator = new Validator<CreateStorageInput>()
      .addRule(CommonValidators.required('id'))
      .addRule(CommonValidators.required('type'))
      .addRule(CommonValidators.oneOf('type', ['dir', 'lvm', 'lvmthin', 'zfs', 'nfs', 'cifs', 'glusterfs', 'cephfs', 'rbd']))
      .addRule({
        validate: (data) => {
          if (data.totalBytes !== undefined && data.totalBytes < 0) {
            return 'Total bytes cannot be negative';
          }
          return null;
        }
      })
      .addRule({
        validate: (data) => {
          if (data.usedBytes !== undefined && data.usedBytes < 0) {
            return 'Used bytes cannot be negative';
          }
          return null;
        }
      })
      .addRule({
        validate: (data) => {
          if (data.availableBytes !== undefined && data.availableBytes < 0) {
            return 'Available bytes cannot be negative';
          }
          return null;
        }
      });
  }

  async create(data: CreateStorageInput): Promise<Storage> {
    await this.validator.validate(data);

    try {
      return await dbClient.client.storage.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ValidationError(`Storage with ID ${data.id} already exists`);
        }
      }
      throw error;
    }
  }

  async findById(id: string, options?: QueryOptions): Promise<Storage | null> {
    return await dbClient.client.storage.findUnique({
      where: { id }
    });
  }

  async findMany(options: FindManyOptions = {}): Promise<FindManyResult<Storage>> {
    const {
      page = 1,
      limit = 50,
      offset,
      orderBy = { createdAt: 'desc' },
      where = {}
    } = options;

    const skip = offset ?? (page - 1) * limit;

    const [data, total] = await Promise.all([
      dbClient.client.storage.findMany({
        where,
        orderBy,
        skip,
        take: limit
      }),
      dbClient.client.storage.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + data.length < total
    };
  }

  async update(id: string, data: UpdateStorageInput): Promise<Storage> {
    // Check if storage exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Storage', id);
    }

    try {
      return await dbClient.client.storage.update({
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
    // Check if storage exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Storage', id);
    }

    try {
      await dbClient.client.storage.delete({
        where: { id }
      });
    } catch (error) {
      throw error;
    }
  }

  async createMany(data: CreateStorageInput[]): Promise<Storage[]> {
    // Validate all items
    for (const item of data) {
      await this.validator.validate(item);
    }

    const results: Storage[] = [];
    for (const item of data) {
      try {
        const created = await this.create(item);
        results.push(created);
      } catch (error) {
        // Continue with others if one fails, but log the error
        this.logger.error(`Failed to create storage ${item.id} in bulk operation`, error as Error, {
          workspace: 'database',
          resourcesAffected: [item.id]
        }, ['Continue with remaining storages', 'Check database connectivity']);
      }
    }

    return results;
  }

  async updateMany(where: Record<string, any>, data: Partial<UpdateStorageInput>): Promise<number> {
    const result = await dbClient.client.storage.updateMany({
      where,
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return result.count;
  }

  async deleteMany(where: Record<string, any>): Promise<number> {
    const result = await dbClient.client.storage.deleteMany({
      where
    });

    return result.count;
  }

  async count(where: Record<string, any> = {}): Promise<number> {
    return await dbClient.client.storage.count({ where });
  }

  async exists(id: string): Promise<boolean> {
    const storage = await dbClient.client.storage.findUnique({
      where: { id },
      select: { id: true }
    });

    return storage !== null;
  }

  async health(): Promise<{ status: string; timestamp: Date }> {
    try {
      await dbClient.client.storage.count();
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

  // Storage-specific query methods
  async findByType(type: string, options?: QueryOptions): Promise<Storage[]> {
    return await dbClient.client.storage.findMany({
      where: { type },
      orderBy: options?.orderBy || { id: 'asc' }
    });
  }

  async findEnabled(options?: QueryOptions): Promise<Storage[]> {
    return await dbClient.client.storage.findMany({
      where: { enabled: true },
      orderBy: options?.orderBy || { id: 'asc' }
    });
  }

  async findShared(options?: QueryOptions): Promise<Storage[]> {
    return await dbClient.client.storage.findMany({
      where: { shared: true },
      orderBy: options?.orderBy || { id: 'asc' }
    });
  }

  async findByContentType(contentType: string, options?: QueryOptions): Promise<Storage[]> {
    return await dbClient.client.storage.findMany({
      where: {
        contentTypes: {
          contains: contentType
        }
      },
      orderBy: options?.orderBy || { id: 'asc' }
    });
  }

  async findLowSpace(threshold: number = 0.9, options?: QueryOptions): Promise<Storage[]> {
    // For now, we'll do a simpler implementation without raw SQL
    const allStorage = await dbClient.client.storage.findMany({
      where: {
        AND: [
          { totalBytes: { not: null } },
          { usedBytes: { not: null } }
        ]
      },
      orderBy: { usedBytes: 'desc' }
    });

    // Filter in JavaScript for now
    return allStorage.filter(storage => {
      if (storage.totalBytes && storage.usedBytes) {
        const usage = Number(storage.usedBytes) / Number(storage.totalBytes);
        return usage >= threshold;
      }
      return false;
    });
  }

  async getStorageStatistics(): Promise<{
    totalStorages: number;
    enabledStorages: number;
    sharedStorages: number;
    totalCapacity: bigint;
    totalUsed: bigint;
    totalAvailable: bigint;
    usagePercentage: number;
    storageTypeDistribution: Record<string, number>;
  }> {
    const storages = await dbClient.client.storage.findMany({
      select: {
        enabled: true,
        shared: true,
        type: true,
        totalBytes: true,
        usedBytes: true,
        availableBytes: true
      }
    });

    const totalStorages = storages.length;
    const enabledStorages = storages.filter(s => s.enabled === true).length;
    const sharedStorages = storages.filter(s => s.shared === true).length;
    
    const totalCapacity = storages.reduce(
      (sum, s) => sum + (s.totalBytes || BigInt(0)), 
      BigInt(0)
    );
    
    const totalUsed = storages.reduce(
      (sum, s) => sum + (s.usedBytes || BigInt(0)), 
      BigInt(0)
    );
    
    const totalAvailable = storages.reduce(
      (sum, s) => sum + (s.availableBytes || BigInt(0)), 
      BigInt(0)
    );

    const usagePercentage = totalCapacity > 0 
      ? Number((totalUsed * BigInt(100)) / totalCapacity)
      : 0;

    // Storage type distribution
    const storageTypeDistribution: Record<string, number> = {};
    storages.forEach(storage => {
      storageTypeDistribution[storage.type] = (storageTypeDistribution[storage.type] || 0) + 1;
    });

    return {
      totalStorages,
      enabledStorages,
      sharedStorages,
      totalCapacity,
      totalUsed,
      totalAvailable,
      usagePercentage,
      storageTypeDistribution
    };
  }

  async updateStorageUsage(id: string, usedBytes: bigint, availableBytes: bigint): Promise<Storage> {
    return this.update(id, {
      usedBytes,
      availableBytes
    });
  }

  async findStoragesForBackup(): Promise<Storage[]> {
    return await dbClient.client.storage.findMany({
      where: {
        enabled: true,
        contentTypes: {
          contains: 'backup'
        }
      },
      orderBy: { availableBytes: 'desc' }
    });
  }

  async findStoragesForImages(): Promise<Storage[]> {
    return await dbClient.client.storage.findMany({
      where: {
        enabled: true,
        contentTypes: {
          contains: 'images'
        }
      },
      orderBy: { availableBytes: 'desc' }
    });
  }

  async calculateStorageEfficiency(): Promise<Array<{
    id: string;
    type: string;
    usagePercentage: number;
    efficiency: 'excellent' | 'good' | 'fair' | 'poor';
  }>> {
    const storages = await dbClient.client.storage.findMany({
      where: {
        totalBytes: { not: null },
        usedBytes: { not: null }
      },
      select: {
        id: true,
        type: true,
        totalBytes: true,
        usedBytes: true
      }
    });

    return storages.map(storage => {
      const usagePercentage = storage.totalBytes! > 0 
        ? Number((storage.usedBytes! * BigInt(100)) / storage.totalBytes!)
        : 0;

      let efficiency: 'excellent' | 'good' | 'fair' | 'poor';
      if (usagePercentage < 50) efficiency = 'excellent';
      else if (usagePercentage < 70) efficiency = 'good';
      else if (usagePercentage < 90) efficiency = 'fair';
      else efficiency = 'poor';

      return {
        id: storage.id,
        type: storage.type,
        usagePercentage,
        efficiency
      };
    });
  }
}