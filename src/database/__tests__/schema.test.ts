/**
 * Database schema validation tests
 */

import { dbClient } from '../client';

describe('Database Schema Validation', () => {
  afterAll(async () => {
    await dbClient.disconnect();
  });

  describe('table existence', () => {
    it('should have all required tables', async () => {
      // SQLite specific query to check table existence
      const tables = await dbClient.client.$queryRaw`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name;
      ` as Array<{ name: string }>;
      
      const tableNames = tables.map(t => t.name);
      
      expect(tableNames).toContain('nodes');
      expect(tableNames).toContain('vms');
      expect(tableNames).toContain('containers');
      expect(tableNames).toContain('storage');
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('state_snapshots');
    });

    it('should have correct table structure for nodes', async () => {
      const columns = await dbClient.client.$queryRaw`
        PRAGMA table_info(nodes);
      ` as Array<{ name: string; type: string; notnull: number; pk: number }>;
      
      const columnNames = columns.map(c => c.name);
      
      // Check key columns exist
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('cpu_usage');
      expect(columnNames).toContain('memory_usage');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
      
      // Check primary key (SQLite uses pk=1 for primary key columns)
      const primaryKey = columns.find(c => c.pk > 0);
      expect(primaryKey?.name).toBe('id');
    });

    it('should have correct table structure for vms', async () => {
      const columns = await dbClient.client.$queryRaw`
        PRAGMA table_info(vms);
      ` as Array<{ name: string; type: string; notnull: number; pk: number }>;
      
      const columnNames = columns.map(c => c.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('node_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('cpu_cores');
      expect(columnNames).toContain('memory_bytes');
      
      // Check primary key (SQLite uses pk=1 for primary key columns)
      const primaryKey = columns.find(c => c.pk > 0);
      expect(primaryKey?.name).toBe('id');
    });
  });

  describe('foreign key constraints', () => {
    it('should have foreign key from vms to nodes', async () => {
      const foreignKeys = await dbClient.client.$queryRaw`
        PRAGMA foreign_key_list(vms);
      ` as Array<{ table: string; from: string; to: string }>;
      
      const nodeFK = foreignKeys.find(fk => fk.table === 'nodes');
      expect(nodeFK).toBeDefined();
      expect(nodeFK?.from).toBe('node_id');
      expect(nodeFK?.to).toBe('id');
    });

    it('should have foreign key from containers to nodes', async () => {
      const foreignKeys = await dbClient.client.$queryRaw`
        PRAGMA foreign_key_list(containers);
      ` as Array<{ table: string; from: string; to: string }>;
      
      const nodeFK = foreignKeys.find(fk => fk.table === 'nodes');
      expect(nodeFK).toBeDefined();
      expect(nodeFK?.from).toBe('node_id');
      expect(nodeFK?.to).toBe('id');
    });
  });
});