#!/usr/bin/env tsx

/**
 * Safe database synchronization test for Phase 1 testing
 * This script performs read-only discovery and safely synchronizes to the database
 */

import 'dotenv/config';
import { ProxmoxClient, loadProxmoxConfig } from './src/api';
import { SyncService } from './src/services/sync-service';
import { 
  NodeRepository,
  VMRepository, 
  ContainerRepository,
  StorageRepository,
  TaskRepository,
  StateSnapshotRepository
} from './src/database/repositories';

async function performSafeSync() {
  console.log('🔄 Starting Phase 1 Safe Database Synchronization...\n');
  
  try {
    // Load configuration and create client
    const config = loadProxmoxConfig();
    const client = new ProxmoxClient(config);
    
    // Test connection first
    console.log('🔌 Testing Proxmox connection...');
    const connectionResult = await client.connect();
    
    if (!connectionResult.success) {
      throw new Error(`Connection failed: ${connectionResult.error}`);
    }
    
    console.log('✅ Connection successful!');
    console.log(`   Version: ${connectionResult.version}`);
    console.log(`   Node: ${connectionResult.node}\n`);
    
    // Create repository instances
    const nodeRepo = new NodeRepository();
    const vmRepo = new VMRepository();
    const containerRepo = new ContainerRepository();
    const storageRepo = new StorageRepository();
    const taskRepo = new TaskRepository();
    const stateSnapshotRepo = new StateSnapshotRepository();
    
    // Create sync service
    const syncService = new SyncService(
      client,
      nodeRepo,
      vmRepo,
      containerRepo,
      storageRepo,
      taskRepo,
      stateSnapshotRepo
    );
    
    // Perform full synchronization
    console.log('🔍 Starting comprehensive resource synchronization...\n');
    const syncSummary = await syncService.syncAll();
    
    // Display results
    console.log('📊 Synchronization Complete!\n');
    console.log(`Total Duration: ${syncSummary.duration}ms`);
    console.log(`Total Discovered: ${syncSummary.totalDiscovered} resources`);
    console.log(`Total Created: ${syncSummary.totalCreated} new records`);
    console.log(`Total Updated: ${syncSummary.totalUpdated} existing records`);
    console.log(`Total Errors: ${syncSummary.totalErrors}\n`);
    
    // Show detailed results for each resource type
    syncSummary.results.forEach(result => {
      console.log(`${result.resourceType.toUpperCase()}:`);
      console.log(`   ✅ Discovered: ${result.discovered}`);
      console.log(`   🆕 Created: ${result.created}`);
      console.log(`   🔄 Updated: ${result.updated}`);
      console.log(`   ⚠️  Errors: ${result.errors.length}`);
      console.log(`   ⏱️  Duration: ${result.duration}ms`);
      
      if (result.errors.length > 0) {
        console.log('   Error details:');
        result.errors.forEach(error => console.log(`     • ${error}`));
      }
      console.log();
    });
    
    // Get final sync stats
    console.log('📈 Database Statistics:');
    const stats = await syncService.getSyncStats();
    console.log(`   Last Sync: ${stats.lastSync ? stats.lastSync.toISOString() : 'Never'}`);
    console.log(`   Total Resources: ${stats.totalResources}`);
    console.log('   Resource Breakdown:');
    Object.entries(stats.resourceBreakdown).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
    
    console.log('\n✅ Phase 1 database synchronization completed successfully!');
    console.log('🛡️  No write operations performed on Proxmox server - only read and local database sync.');
    
  } catch (error: any) {
    console.error('\n❌ Synchronization failed:');
    console.error(`   ${error.message}`);
    
    if (error.stack) {
      console.error('\n🐛 Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the sync test
performSafeSync().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});