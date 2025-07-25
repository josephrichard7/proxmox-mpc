---
description: Database operations for Proxmox management system
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
---

# Database Operations for Proxmox-MPC

Perform database operations for the Proxmox management system with proper patterns and validation.

## Task Description
$ARGUMENTS

## Implementation Guidelines

### Database Stack
- **ORM**: Prisma with TypeScript
- **Development**: SQLite database  
- **Production**: PostgreSQL database
- **Pattern**: Repository pattern from `src/database/repositories/`

### Repository Pattern Structure
```typescript
// Follow this pattern from existing codebase
interface BaseRepository<T> {
  create(data: CreateInput): Promise<T>
  findById(id: string): Promise<T | null>
  findMany(filter?: FilterOptions): Promise<T[]>
  update(id: string, data: UpdateInput): Promise<T>
  delete(id: string): Promise<void>
}
```

### Required Steps
1. **Schema Design**: Use Prisma schema format in `prisma/schema.prisma`
2. **Repository Implementation**: Follow existing pattern in `src/database/repositories/`
3. **Type Safety**: Generate proper TypeScript types with `npx prisma generate`
4. **Migration**: Create and apply migrations with `npx prisma migrate dev`
5. **Testing**: Add comprehensive tests in `__tests__/` directories
6. **Validation**: Ensure >90% test coverage for database operations

### Current Database Schema Context
- **Nodes**: Proxmox cluster nodes with resource tracking
- **VMs**: Virtual machines with configuration and state
- **Containers**: LXC containers with configuration and state  
- **Storage**: Storage pools and disk management
- **Tasks**: Proxmox task tracking and history
- **StateSnapshots**: Historical state tracking for reconciliation

### Error Handling Requirements
- Database connection errors
- Constraint violations and duplicate keys
- Transaction rollback on failures
- Proper logging for debugging

### Testing Requirements
- Unit tests for each repository method
- Integration tests with real database
- Mock testing for error scenarios
- Performance testing for large datasets

### Commands to Run After Changes
```bash
# Generate types
npx prisma generate

# Create migration
npx prisma migrate dev --name descriptive_name

# Run tests
npm test -- --testPathPattern=database

# Check coverage
npm run test:coverage
```

## Context Files to Reference
- `@prisma/schema.prisma` - Current database schema
- `@src/database/repositories/` - Existing repository implementations
- `@src/database/client.ts` - Database client setup
- `@docs/phase-2.1-implementation.md` - Database design documentation