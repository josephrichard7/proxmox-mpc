/**
 * Service layer exports and factory functions
 */

import { ProxmoxClient } from '../api/proxmox-client';
import { RepositoryFactory } from '../database/repositories';
import { SyncService } from './sync-service';
import { ProxmoxConfig } from '../types';

export { SyncService } from './sync-service';
export type { 
  SyncResult, 
  SyncSummary
} from './sync-service';

/**
 * Create a fully configured SyncService with all dependencies
 */
export async function createSyncService(config: ProxmoxConfig): Promise<SyncService> {
  // Create Proxmox API client
  const proxmoxClient = new ProxmoxClient(config);
  
  // Create and return sync service
  return new SyncService(
    proxmoxClient,
    RepositoryFactory.getNodeRepository(),
    RepositoryFactory.getVMRepository(),
    RepositoryFactory.getContainerRepository(),
    RepositoryFactory.getStorageRepository(),
    RepositoryFactory.getTaskRepository(),
    RepositoryFactory.getStateSnapshotRepository()
  );
}

/**
 * Create sync service from existing client and repositories (for testing)
 */
export function createSyncServiceWithDependencies(
  proxmoxClient: ProxmoxClient,
  nodeRepo: any,
  vmRepo: any,
  containerRepo: any,
  storageRepo: any,
  taskRepo: any,
  stateSnapshotRepo: any
): SyncService {
  return new SyncService(
    proxmoxClient,
    nodeRepo,
    vmRepo,
    containerRepo,
    storageRepo,
    taskRepo,
    stateSnapshotRepo
  );
}