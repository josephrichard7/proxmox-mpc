# ADR-0002: State Management Architecture

**Status**: Accepted  
**Date**: 2025-01-21  
**Deciders**: Development Team  

## Context

Proxmox-MPC aims to provide Kubernetes/Helm-style declarative infrastructure management for Proxmox environments. This requires a robust state management system that can:

- Track current state of all Proxmox resources
- Store desired state from configuration files
- Compare actual vs desired state efficiently
- Enable reconciliation operations to maintain desired state
- Provide audit trails and rollback capabilities

## Decision

**Selected Architecture Pattern**: Repository Pattern with State Snapshots

**Core Components:**
1. **Repository Layer**: CRUD operations for each resource type
2. **State Snapshot System**: Historical tracking of all state changes
3. **Reconciliation Engine**: Compares and reconciles state differences
4. **Event Sourcing**: Audit trail of all state modifications

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Proxmox API   │    │  Configuration   │    │    Database     │
│  (Actual State) │    │ Files (Desired)  │    │ (Stored State)  │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          ▼                      ▼                       ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                State Management Engine                       │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
    │  │ Discovery   │  │ Comparison  │  │   Reconciliation    │  │
    │  │ Service     │  │ Engine      │  │     Engine          │  │
    │  └─────────────┘  └─────────────┘  └─────────────────────┘  │
    └─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    Repository Layer     │
                    │  ┌─────────────────────┐│
                    │  │ NodeRepository      ││
                    │  │ VMRepository        ││
                    │  │ ContainerRepository ││
                    │  │ StorageRepository   ││
                    │  │ TaskRepository      ││
                    │  └─────────────────────┘│
                    └─────────────────────────┘
```

## Rationale

### Repository Pattern Selection

**Benefits:**
- **Separation of Concerns**: Business logic separated from data access
- **Testability**: Easy to mock repositories for unit testing
- **Flexibility**: Can switch database implementations without changing business logic
- **Type Safety**: Strongly typed interfaces for each resource type

**Implementation:**
```typescript
interface NodeRepository {
  findAll(): Promise<Node[]>;
  findById(id: string): Promise<Node | null>;
  create(node: CreateNodeData): Promise<Node>;
  update(id: string, data: UpdateNodeData): Promise<Node>;
  delete(id: string): Promise<void>;
  findByStatus(status: NodeStatus): Promise<Node[]>;
}
```

### State Snapshot System

**Purpose**: Enable historical tracking and rollback capabilities

**Design:**
- Every resource change creates a state snapshot
- Snapshots include full resource state at point in time
- Change type tracking (created, updated, deleted, discovered)
- Configurable retention policy for storage management

**Benefits:**
- **Audit Trail**: Complete history of all changes
- **Rollback Capability**: Can restore previous states
- **Change Detection**: Identify what changed and when
- **Debugging**: Trace issues through state evolution

### Event-Driven Architecture

**State Change Events:**
- `ResourceDiscovered`: New resource found in Proxmox
- `ResourceUpdated`: Existing resource changed
- `ResourceDeleted`: Resource removed from Proxmox
- `ReconciliationStarted`: State sync operation began
- `ReconciliationCompleted`: State sync operation finished

**Benefits:**
- **Decoupling**: Components communicate through events
- **Extensibility**: Easy to add new event handlers
- **Monitoring**: Centralized event tracking
- **Integration**: Other systems can subscribe to events

## Implementation Strategy

### Phase 2.1: Database Foundation
1. **Repository Implementation**: CRUD operations for all resource types
2. **State Snapshots**: Historical tracking table and operations
3. **Migration System**: Schema versioning and updates
4. **Testing Infrastructure**: Repository and database testing

### Phase 2.2: Synchronization Engine
1. **Discovery Service**: Scan Proxmox for current resources
2. **Comparison Engine**: Detect differences between actual and stored state
3. **Sync Operations**: Update database with current Proxmox state
4. **Event System**: Track and log all state changes

### Future Phases: Reconciliation
1. **Desired State Storage**: Configuration file parsing and storage
2. **Reconciliation Engine**: Apply changes to make actual match desired
3. **Conflict Resolution**: Handle competing changes and edge cases
4. **Rollback System**: Restore previous configurations

## Data Flow Design

### Resource Discovery Flow
```
Proxmox API → Discovery Service → Repository → State Snapshot → Event
     ↓                                                ↓
Current State                                    Change Log
```

### State Comparison Flow
```
Database State ←→ Comparison Engine ←→ Proxmox State
     ↓                    ↓                   ↓
Stored Resources    Difference Set    Actual Resources
```

### Reconciliation Flow (Future)
```
Config Files → Desired State → Reconciliation Engine → Proxmox API
     ↓              ↓               ↓                      ↓
YAML/JSON    Database Storage   Change Operations    Applied Changes
```

## Alternatives Considered

### Event Sourcing Only
**Rejected because:**
- Increased complexity for simple CRUD operations
- Higher storage requirements for all events
- More difficult to query current state
- Overkill for our use case complexity

### Active Record Pattern
**Rejected because:**
- Tight coupling between business logic and data access
- Harder to test and mock
- Less flexible for complex queries
- Poor separation of concerns

### Direct Database Access
**Rejected because:**
- No abstraction layer for business logic
- Difficult to maintain and evolve
- Poor testability
- Tight coupling to specific database

### CQRS (Command Query Responsibility Segregation)
**Rejected because:**
- Unnecessary complexity for our read/write patterns
- Would require separate read and write models
- More infrastructure overhead
- Our queries and commands are not sufficiently different

## Consequences

### Positive
- **Clear Architecture**: Well-defined layers and responsibilities
- **Testability**: Easy to unit test with mocked repositories
- **Maintainability**: Separation of concerns makes changes easier
- **Audit Capability**: Complete history of all state changes
- **Rollback Support**: Can restore previous configurations
- **Performance**: Optimized queries through repository pattern

### Negative
- **Complexity**: More layers than direct database access
- **Development Time**: Additional abstraction requires more code
- **Learning Curve**: Team needs to understand repository pattern
- **Storage Overhead**: State snapshots increase database size

### Risks and Mitigation
- **Repository Bloat**: Mitigated by focused, single-responsibility repositories
- **Performance Issues**: Mitigated by proper indexing and query optimization
- **State Consistency**: Mitigated by transaction boundaries and ACID properties
- **Storage Growth**: Mitigated by configurable snapshot retention policies

## Monitoring and Observability

**Metrics to Track:**
- Repository operation performance and error rates
- State snapshot creation frequency and size
- Reconciliation operation duration and success rates
- Database query performance and resource usage

**Logging Strategy:**
- All state changes logged with structured data
- Repository operations traced for debugging
- Event flows tracked for system observability
- Error conditions captured with full context

## References

- [Repository Pattern Documentation](https://martinfowler.com/eaaCatalog/repository.html)
- [Event Sourcing Patterns](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Database Technology Selection ADR](./0001-database-technology-selection.md)
- [Phase 2.1 Implementation Plan](../phase-2.1-implementation.md)