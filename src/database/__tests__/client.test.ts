/**
 * Database client tests
 */

import { dbClient } from '../client';

describe('Database Client', () => {
  afterAll(async () => {
    await dbClient.disconnect();
  });

  describe('connection', () => {
    it('should connect successfully', async () => {
      await expect(dbClient.connect()).resolves.not.toThrow();
    });

    it('should pass health check', async () => {
      const health = await dbClient.health();
      
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('client access', () => {
    it('should provide access to Prisma client', () => {
      const client = dbClient.client;
      
      expect(client).toBeDefined();
      expect(client.node).toBeDefined();
      expect(client.vM).toBeDefined();
      expect(client.container).toBeDefined();
      expect(client.storage).toBeDefined();
      expect(client.task).toBeDefined();
      expect(client.stateSnapshot).toBeDefined();
    });
  });

  describe('basic CRUD operations', () => {
    it('should be able to count records in empty tables', async () => {
      const nodeCount = await dbClient.client.node.count();
      const vmCount = await dbClient.client.vM.count();
      const containerCount = await dbClient.client.container.count();
      
      expect(nodeCount).toBe(0);
      expect(vmCount).toBe(0);
      expect(containerCount).toBe(0);
    });
  });
});