# Phase 2.1 Implementation Plan: Database Design

## Overview
Design and implement the database schema to store Proxmox resources and their state. This will be the foundation for Kubernetes/Helm-style declarative state management.

## Implementation Checklist

### 1. Database Technology Setup
- [ ] Install and configure Prisma ORM
- [ ] Set up SQLite for development (file-based)
- [ ] Configure database connection and client
- [ ] Create initial Prisma schema file
- [ ] Set up migration system

### 2. Core Database Schema Design
- [ ] **Nodes table** - Proxmox cluster nodes
- [ ] **VMs table** - QEMU virtual machines  
- [ ] **Containers table** - LXC containers
- [ ] **Storage table** - Storage configurations
- [ ] **Tasks table** - Async operation tracking
- [ ] **State snapshots table** - Historical state tracking

### 3. Entity Relationships
- [ ] Node → VMs (one-to-many)
- [ ] Node → Containers (one-to-many) 
- [ ] Node → Storage (many-to-many)
- [ ] Tasks → All resources (polymorphic)
- [ ] State snapshots → All resources

### 4. Database Operations (CRUD)
- [ ] Create database client wrapper
- [ ] Implement Node operations (CRUD)
- [ ] Implement VM operations (CRUD)
- [ ] Implement Container operations (CRUD)
- [ ] Implement Storage operations (CRUD)
- [ ] Add query helpers and filters

### 5. Migration & Seeding
- [ ] Create initial migration
- [ ] Add database seeding for development
- [ ] Create migration rollback system
- [ ] Add database reset functionality

### 6. Testing Infrastructure
- [ ] Unit tests for database operations
- [ ] Integration tests with real data
- [ ] Test data factories/fixtures
- [ ] Database cleanup between tests

## Database Schema Design

### Nodes Table
```sql
CREATE TABLE nodes (
  id              TEXT PRIMARY KEY,  -- node name (e.g., 'proxmox')
  status          TEXT NOT NULL,     -- online, offline
  type            TEXT,              -- node type
  cpu_usage       REAL,              -- current CPU usage (0-1)
  cpu_max         INTEGER,           -- max CPU cores
  memory_usage    BIGINT,            -- current memory bytes
  memory_max      BIGINT,            -- max memory bytes
  uptime          INTEGER,           -- uptime in seconds
  pve_version     TEXT,              -- Proxmox VE version
  last_seen       DATETIME,          -- last successful API call
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Virtual Machines (QEMU) Table
```sql
CREATE TABLE vms (
  id              INTEGER PRIMARY KEY, -- vmid
  node_id         TEXT NOT NULL,       -- foreign key to nodes
  name            TEXT,                -- VM name
  status          TEXT NOT NULL,       -- running, stopped, suspended
  template        BOOLEAN DEFAULT FALSE,
  cpu_cores       INTEGER,             -- allocated cores
  cpu_usage       REAL,                -- current CPU usage
  memory_bytes    BIGINT,              -- allocated memory
  memory_usage    BIGINT,              -- current memory usage
  disk_size       BIGINT,              -- allocated disk space
  disk_usage      BIGINT,              -- current disk usage
  network_in      BIGINT,              -- network bytes in
  network_out     BIGINT,              -- network bytes out
  uptime          INTEGER,             -- uptime in seconds
  pid             INTEGER,             -- process ID when running
  ha_managed      BOOLEAN DEFAULT FALSE,
  lock_status     TEXT,                -- lock state
  config_digest   TEXT,                -- config hash for change detection
  last_seen       DATETIME,            -- last API sync
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
```

### LXC Containers Table
```sql
CREATE TABLE containers (
  id              INTEGER PRIMARY KEY, -- vmid (container ID)
  node_id         TEXT NOT NULL,       -- foreign key to nodes
  name            TEXT,                -- container name
  hostname        TEXT,                -- container hostname
  status          TEXT NOT NULL,       -- running, stopped, suspended
  template        BOOLEAN DEFAULT FALSE,
  cpu_cores       INTEGER,             -- allocated cores
  cpu_usage       REAL,                -- current CPU usage
  memory_bytes    BIGINT,              -- allocated memory
  memory_usage    BIGINT,              -- current memory usage
  swap_bytes      BIGINT,              -- allocated swap
  swap_usage      BIGINT,              -- current swap usage
  disk_size       BIGINT,              -- allocated disk space
  disk_usage      BIGINT,              -- current disk usage
  network_in      BIGINT,              -- network bytes in
  network_out     BIGINT,              -- network bytes out
  uptime          INTEGER,             -- uptime in seconds
  ha_managed      BOOLEAN DEFAULT FALSE,
  lock_status     TEXT,                -- lock state
  os_template     TEXT,                -- container template used
  config_digest   TEXT,                -- config hash for change detection
  last_seen       DATETIME,            -- last API sync
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
```

### Storage Table
```sql
CREATE TABLE storage (
  id              TEXT PRIMARY KEY,    -- storage ID
  type            TEXT NOT NULL,       -- dir, lvm, zfs, etc.
  content_types   TEXT,                -- JSON array of supported content types
  enabled         BOOLEAN DEFAULT TRUE,
  shared          BOOLEAN DEFAULT FALSE,
  total_bytes     BIGINT,              -- total storage space
  used_bytes      BIGINT,              -- used storage space
  available_bytes BIGINT,              -- available storage space
  path            TEXT,                -- storage path
  nodes           TEXT,                -- JSON array of accessible nodes
  config_digest   TEXT,                -- config hash
  last_seen       DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tasks Table (for async operations tracking)
```sql
CREATE TABLE tasks (
  upid            TEXT PRIMARY KEY,    -- Unique Process ID
  node_id         TEXT NOT NULL,       -- node where task runs
  type            TEXT NOT NULL,       -- task type (create, start, stop, etc.)
  status          TEXT NOT NULL,       -- running, stopped, OK, ERROR
  resource_type   TEXT,                -- vm, container, node, storage
  resource_id     TEXT,                -- ID of resource being modified
  user            TEXT,                -- user who initiated task
  start_time      DATETIME,            -- task start time
  end_time        DATETIME,            -- task completion time
  exit_status     TEXT,                -- OK, ERROR, or error message
  log_entries     TEXT,                -- JSON array of log entries
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
```

### State Snapshots Table (for historical tracking)
```sql
CREATE TABLE state_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_time   DATETIME NOT NULL,
  resource_type   TEXT NOT NULL,       -- node, vm, container, storage
  resource_id     TEXT NOT NULL,       -- resource identifier
  resource_data   TEXT NOT NULL,       -- JSON snapshot of resource state
  change_type     TEXT NOT NULL,       -- created, updated, deleted, discovered
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Technology Stack Decisions

### Database & ORM
- **Development**: SQLite (file-based, zero-config)
- **Production**: PostgreSQL (scalable, concurrent access)
- **ORM**: Prisma (type-safe, migration management)
- **Client**: @prisma/client (auto-generated TypeScript client)

### Database Features
- **Migrations**: Automatic schema versioning
- **Seeding**: Test data generation
- **Connection Pooling**: Built-in with Prisma
- **Type Safety**: Full TypeScript integration

## Implementation Strategy

### Phase 2.1.1: Basic Setup (45 minutes)
1. **Install Prisma** and configure for SQLite
2. **Create schema.prisma** with basic node/VM/container models
3. **Generate initial migration** and database client
4. **Test basic connection** and CRUD operations

### Phase 2.1.2: Schema Implementation (60 minutes)  
1. **Complete all table definitions** in Prisma schema
2. **Add relationships** and constraints
3. **Generate migration** for full schema
4. **Create database client wrapper** with error handling

### Phase 2.1.3: CRUD Operations (45 minutes)
1. **Implement repository pattern** for each resource type
2. **Add query helpers** (find by status, node, etc.)
3. **Create bulk operations** for state synchronization
4. **Add transaction support** for complex operations

### Phase 2.1.4: Testing (30 minutes)
1. **Unit tests** for all database operations
2. **Integration tests** with sample Proxmox data
3. **Test data factories** for consistent testing
4. **Performance testing** for large datasets

## Data Flow Design

### State Synchronization Flow
```
Proxmox API → Resource Discovery → Database Upsert → State Snapshot
     ↓                                    ↑
Change Detection ← State Comparison ← Current State
     ↓
Apply Changes → Update Database → Log Changes
```

### Resource Lifecycle Management
1. **Discovery**: Scan Proxmox API for all resources
2. **Persistence**: Store/update resource state in database
3. **Comparison**: Compare actual vs desired state
4. **Reconciliation**: Apply necessary changes
5. **Tracking**: Log all state changes and operations

## Configuration Management

### Database Configuration
```typescript
interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  url: string;
  maxConnections?: number;
  logLevel?: 'info' | 'debug' | 'warn' | 'error';
  enableLogging?: boolean;
}
```

### Environment Variables
```bash
# Database Configuration
DATABASE_URL="file:./dev.db"
DATABASE_PROVIDER="sqlite"
ENABLE_DB_LOGGING="true"
DB_LOG_LEVEL="info"

# For production
# DATABASE_URL="postgresql://user:pass@localhost:5432/proxmox_mpc"
# DATABASE_PROVIDER="postgresql"
```

## Success Criteria

### Functional Requirements
- [ ] All Proxmox resource types can be stored and retrieved
- [ ] Database schema supports state comparison operations
- [ ] CRUD operations work reliably with proper error handling
- [ ] Migrations can be applied and rolled back safely
- [ ] Historical state tracking captures all changes

### Technical Requirements
- [ ] TypeScript code compiles without errors
- [ ] Unit tests achieve >90% coverage for database operations
- [ ] Integration tests pass with real Proxmox data structures
- [ ] Database operations complete within performance thresholds
- [ ] Memory usage remains constant during bulk operations

### Data Integrity Requirements  
- [ ] Foreign key relationships are enforced
- [ ] State snapshots accurately represent resource state
- [ ] Concurrent access doesn't corrupt data
- [ ] Database schema matches Proxmox API response structure
- [ ] Migration system maintains data consistency

## Risk Mitigation

### Potential Issues
1. **Schema Evolution**: Proxmox API changes breaking database schema
2. **Performance**: Large datasets causing slow operations
3. **Concurrency**: Multiple processes accessing database simultaneously
4. **Data Loss**: Migration errors or corruption
5. **Type Mismatches**: Prisma types not matching API responses

### Mitigation Strategies
- **Flexible Schema**: JSON columns for extensible data storage
- **Pagination**: Cursor-based queries for large datasets
- **Connection Pooling**: Managed database connections
- **Backup Strategy**: Automated database backups before migrations
- **Validation Layer**: Runtime type checking for API responses

## Testing Strategy

### Unit Testing
- Repository pattern methods (create, read, update, delete)
- Query builders and filters
- Transaction handling
- Error scenarios and edge cases

### Integration Testing
- Full database schema creation and migration
- Real Proxmox API data insertion and retrieval
- Performance testing with realistic data volumes
- Concurrent access patterns

### Manual Testing Checklist
- [ ] Database file created successfully
- [ ] All tables created with correct schema
- [ ] Sample data can be inserted and queried
- [ ] Relationships work correctly
- [ ] Migration rollback functions properly

## Next Phase Prerequisites

Before moving to Phase 2.2 (State Synchronization):
- [ ] Database schema handles all Proxmox resource types
- [ ] CRUD operations tested and working reliably
- [ ] Migration system functional and tested
- [ ] Performance acceptable with realistic data loads
- [ ] Full test coverage for database operations