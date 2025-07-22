# ADR-0001: Database Technology Selection

**Status**: Accepted  
**Date**: 2025-01-21  
**Deciders**: Development Team  

## Context

Proxmox-MPC requires persistent storage for Proxmox resource state to enable Kubernetes/Helm-style declarative infrastructure management. The system needs to:

- Store current Proxmox resource state (nodes, VMs, containers, storage)
- Track historical state changes for audit and rollback
- Support state comparison operations (actual vs desired state)
- Handle concurrent access from multiple interfaces (CLI, Web, MCP)
- Enable complex queries for resource relationships and filtering

## Decision

**Selected Technology Stack:**
- **Development Database**: SQLite
- **Production Database**: PostgreSQL
- **ORM**: Prisma with TypeScript client
- **Migration Strategy**: Code-first with Prisma migrations

## Rationale

### Database Choice: SQL (Relational) over NoSQL

**Proxmox Resource Structure is Inherently Relational:**
- Clear hierarchies: Nodes → VMs/Containers
- Shared resources: Storage ↔ Nodes (many-to-many)
- Resource dependencies: Tasks reference specific resources
- State relationships: Current state → Historical snapshots

**Query Requirements Favor SQL:**
```sql
-- Complex filtering and joins needed
SELECT v.name, v.cpu_usage, n.name as node 
FROM vms v JOIN nodes n ON v.node_id = n.id 
WHERE v.status = 'running' AND v.cpu_usage > 0.8;

-- State comparison operations
SELECT * FROM vms WHERE config_digest != last_known_digest;
```

**ACID Properties Critical:**
- State synchronization requires atomic updates
- Rollback capability if sync operations fail
- Concurrent access from multiple interfaces
- Data consistency during reconciliation operations

### SQLite (Development) vs PostgreSQL (Production)

**SQLite for Development:**
- ✅ Zero configuration (file-based)
- ✅ Perfect for homelab environments
- ✅ Isolated testing (each test gets fresh database)
- ✅ Rapid prototyping and iteration
- ✅ Easy backup/restore (single file)

**PostgreSQL for Production:**
- ✅ Concurrent access for multiple users
- ✅ Better performance with large datasets
- ✅ Advanced JSON support for flexible schemas
- ✅ Production-grade reliability and scaling
- ✅ Comprehensive backup and recovery options

### Prisma ORM Selection

**TypeScript Integration:**
- Auto-generated types match database schema exactly
- Compile-time type checking prevents runtime errors
- IntelliSense support for all database operations

**Migration Management:**
- Schema changes tracked in version control
- Automatic migration generation and rollback
- Team collaboration on schema evolution

**Developer Experience:**
- Intuitive query API with full type safety
- Built-in connection pooling and optimization
- Excellent debugging and introspection tools

## Alternatives Considered

### NoSQL Databases (MongoDB, CouchDB)
**Rejected because:**
- Proxmox has clear relational structure
- Complex queries with joins are common
- State comparison requires structured operations
- Historical tracking needs consistent schema

### Time-Series Databases (InfluxDB, TimescaleDB)
**Rejected because:**
- Primary use case is resource management, not metrics
- Need CRUD operations, not append-only writes
- State storage requires flexible schema updates

### Key-Value Stores (Redis, DynamoDB)
**Rejected because:**
- Too simple for complex resource relationships
- Poor query capabilities for state comparison
- Better suited as caching layer, not primary storage

### Graph Databases (Neo4j, ArangoDB)
**Rejected because:**
- Proxmox relationships are simple hierarchical
- SQL handles our relationship complexity perfectly
- Unnecessary overhead for our use case

## Consequences

### Positive
- **Type Safety**: Full TypeScript integration prevents many runtime errors
- **Developer Productivity**: Excellent tooling and auto-completion
- **State Management**: Perfect fit for Kubernetes-style reconciliation
- **Query Flexibility**: Complex state comparison operations possible
- **Scalability Path**: Clear upgrade path from SQLite to PostgreSQL
- **Backup/Recovery**: Standard SQL tools and procedures

### Negative
- **Learning Curve**: Team needs Prisma and SQL knowledge
- **Migration Complexity**: Schema changes require careful planning
- **Resource Overhead**: SQL databases use more memory than simple stores
- **Setup Complexity**: PostgreSQL requires more configuration than file-based options

### Risks and Mitigation
- **Schema Evolution**: Mitigated by Prisma's migration system
- **Performance**: Mitigated by connection pooling and query optimization
- **Backup Strategy**: Standard PostgreSQL backup tools available
- **Development Environment**: SQLite ensures zero-config development

## Implementation Notes

**Database Schema Design:**
- JSON columns for flexible Proxmox configuration storage
- Foreign key relationships for resource hierarchy
- State snapshots table for historical tracking
- Indexes optimized for common query patterns

**Connection Strategy:**
- SQLite file for local development (`./dev.db`)
- PostgreSQL connection string for production
- Environment-based configuration switching

**Testing Approach:**
- Unit tests with in-memory SQLite databases
- Integration tests with real schema migrations
- Performance testing with realistic data volumes

## References

- [Proxmox API Research](../proxmox-api-research.md)
- [Phase 2.1 Implementation Plan](../phase-2.1-implementation.md)
- [Prisma Documentation](https://prisma.io/docs)
- [PostgreSQL vs SQLite Comparison](https://www.postgresql.org/docs/current/)