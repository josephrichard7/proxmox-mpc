/**
 * Repository exports and factory functions
 */

// Export base repository interfaces and types
export * from './base-repository';

// Export individual repositories
export { NodeRepository } from './node-repository';
export { VMRepository } from './vm-repository';
export { ContainerRepository } from './container-repository';
export { StorageRepository } from './storage-repository';
export { TaskRepository } from './task-repository';
export { StateSnapshotRepository } from './state-snapshot-repository';

// Export input types for convenience
export type { CreateNodeInput, UpdateNodeInput, NodeWithRelations } from './node-repository';
export type { CreateVMInput, UpdateVMInput, VMWithRelations } from './vm-repository';
export type { CreateContainerInput, UpdateContainerInput, ContainerWithRelations } from './container-repository';
export type { CreateStorageInput, UpdateStorageInput } from './storage-repository';
export type { CreateTaskInput, UpdateTaskInput, TaskWithRelations } from './task-repository';
export type { 
  CreateStateSnapshotInput, 
  UpdateStateSnapshotInput, 
  StateComparison, 
  StateHistory 
} from './state-snapshot-repository';

// Repository factory for dependency injection
export class RepositoryFactory {
  private static nodeRepository: NodeRepository;
  private static vmRepository: VMRepository;
  private static containerRepository: ContainerRepository;
  private static storageRepository: StorageRepository;
  private static taskRepository: TaskRepository;
  private static stateSnapshotRepository: StateSnapshotRepository;

  static getNodeRepository(): NodeRepository {
    if (!this.nodeRepository) {
      this.nodeRepository = new NodeRepository();
    }
    return this.nodeRepository;
  }

  static getVMRepository(): VMRepository {
    if (!this.vmRepository) {
      this.vmRepository = new VMRepository();
    }
    return this.vmRepository;
  }

  static getContainerRepository(): ContainerRepository {
    if (!this.containerRepository) {
      this.containerRepository = new ContainerRepository();
    }
    return this.containerRepository;
  }

  static getStorageRepository(): StorageRepository {
    if (!this.storageRepository) {
      this.storageRepository = new StorageRepository();
    }
    return this.storageRepository;
  }

  static getTaskRepository(): TaskRepository {
    if (!this.taskRepository) {
      this.taskRepository = new TaskRepository();
    }
    return this.taskRepository;
  }

  static getStateSnapshotRepository(): StateSnapshotRepository {
    if (!this.stateSnapshotRepository) {
      this.stateSnapshotRepository = new StateSnapshotRepository();
    }
    return this.stateSnapshotRepository;
  }

  // Get all repositories for batch operations
  static getAllRepositories() {
    return {
      nodes: this.getNodeRepository(),
      vms: this.getVMRepository(),
      containers: this.getContainerRepository(),
      storage: this.getStorageRepository(),
      tasks: this.getTaskRepository(),
      stateSnapshots: this.getStateSnapshotRepository()
    };
  }

  // Health check for all repositories
  static async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    repositories: Record<string, { status: string; timestamp: Date }>;
    timestamp: Date;
  }> {
    const repositories = this.getAllRepositories();
    const results: Record<string, { status: string; timestamp: Date }> = {};

    for (const [name, repo] of Object.entries(repositories)) {
      try {
        results[name] = await repo.health();
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          timestamp: new Date()
        };
      }
    }

    const allHealthy = Object.values(results).every(r => r.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      repositories: results,
      timestamp: new Date()
    };
  }

  // Reset all repository instances (useful for testing)
  static reset(): void {
    this.nodeRepository = undefined as any;
    this.vmRepository = undefined as any;
    this.containerRepository = undefined as any;
    this.storageRepository = undefined as any;
    this.taskRepository = undefined as any;
    this.stateSnapshotRepository = undefined as any;
  }
}

// Convenience exports for direct access
export const nodeRepository = RepositoryFactory.getNodeRepository();
export const vmRepository = RepositoryFactory.getVMRepository();
export const containerRepository = RepositoryFactory.getContainerRepository();
export const storageRepository = RepositoryFactory.getStorageRepository();
export const taskRepository = RepositoryFactory.getTaskRepository();
export const stateSnapshotRepository = RepositoryFactory.getStateSnapshotRepository();