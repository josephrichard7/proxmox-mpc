/**
 * Database Test Helper - Provides utilities for database test cleanup and setup
 */

import { dbClient } from '../../database/client';

export class DatabaseTestHelper {
  /**
   * Clean up all test data from database tables in proper order
   * This ensures proper foreign key constraint handling
   */
  static async cleanupDatabase(): Promise<void> {
    const client = dbClient.client;
    
    // Delete in correct dependency order to avoid FK constraint violations
    // First delete entities that reference other tables
    await client.stateSnapshot.deleteMany({});
    await client.task.deleteMany({});  // References Node
    await client.container.deleteMany({});  // References Node  
    await client.vM.deleteMany({});  // References Node
    // Storage has no FK constraints, can be deleted independently
    await client.storage.deleteMany({});
    // Delete nodes last since other tables reference it
    await client.node.deleteMany({});
  }

  /**
   * Reset database auto-increment counters
   */
  static async resetSequences(): Promise<void> {
    // For SQLite, we don't need to reset sequences explicitly
    // The AUTOINCREMENT will continue from the highest value
    // This is acceptable for tests
  }

  /**
   * Ensure database connection is ready for testing
   */
  static async ensureConnection(): Promise<void> {
    await dbClient.connect();
  }

  /**
   * Close database connections after tests
   */
  static async closeConnection(): Promise<void> {
    await dbClient.disconnect();
  }

  /**
   * Complete database reset - cleanup + reset sequences
   */
  static async fullReset(): Promise<void> {
    await this.cleanupDatabase();
    await this.resetSequences();
  }
}