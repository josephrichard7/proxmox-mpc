/**
 * Database client wrapper with connection management
 */

import { PrismaClient } from '@prisma/client';

export class DatabaseClient {
  private prisma: PrismaClient;
  private static instance: DatabaseClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async transaction<T>(fn: (prisma: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async cleanupAll(): Promise<void> {
    // Clean all tables in correct order for foreign keys
    await this.prisma.stateSnapshot.deleteMany();
    await this.prisma.task.deleteMany();
    await this.prisma.vM.deleteMany();
    await this.prisma.container.deleteMany();
    await this.prisma.node.deleteMany();
    await this.prisma.storage.deleteMany();
  }

  async health(): Promise<{ status: string; timestamp: Date }> {
    try {
      // Simple query to test connection
      await this.prisma.$queryRaw`SELECT 1 as test`;
      return {
        status: 'healthy',
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const dbClient = DatabaseClient.getInstance();