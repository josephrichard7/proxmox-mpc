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
    
    // Delete in reverse dependency order to avoid FK constraint violations
    await client.stateSnapshot.deleteMany({});
    await client.task.deleteMany({});
    await client.container.deleteMany({});
    await client.vM.deleteMany({});
    await client.storage.deleteMany({});
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