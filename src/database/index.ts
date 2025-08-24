/**
 * Database layer for state management
 */

export { PrismaClient } from '@prisma/client';
export { DatabaseClient, dbClient } from './client';
export {
  // Repository classes
  NodeRepository,
  VMRepository,
  ContainerRepository,
  StorageRepository,
  TaskRepository,
  StateSnapshotRepository,
  RepositoryFactory,
  
  // Repository instances
  nodeRepository,
  vmRepository,
  containerRepository,
  storageRepository,
  taskRepository,
  stateSnapshotRepository,
  
  // Repository functions
  createRepositories
} from './repositories/index';

export type {
  // Base repository types
  BaseRepository,
  PaginationOptions,
  QueryOptions,
  FindManyOptions,
  FindManyResult,
  
  // Node repository types
  CreateNodeInput,
  UpdateNodeInput,
  NodeWithRelations,
  
  // VM repository types
  CreateVMInput,
  UpdateVMInput,
  VMWithRelations,
  
  // Container repository types
  CreateContainerInput,
  UpdateContainerInput,
  ContainerWithRelations,
  
  // Storage repository types
  CreateStorageInput,
  UpdateStorageInput,
  
  // Task repository types
  CreateTaskInput,
  UpdateTaskInput,
  TaskWithRelations,
  
  // State snapshot repository types
  CreateStateSnapshotInput,
  UpdateStateSnapshotInput,
  StateComparison,
  StateHistory
} from './repositories/index';