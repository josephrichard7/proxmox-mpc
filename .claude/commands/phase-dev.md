---
description: Implement specific development phases with multi-agent coordination
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "Task"]
---

# Phase Development for Proxmox-MPC

Implement development phases using multi-agent coordination and parallel task execution.

## Task Description
$ARGUMENTS

## Phase Implementation Strategy

### Current Project Phase Status
- ✅ **Phase 1**: Foundation & Core Infrastructure (Complete)
- ✅ **Phase 2.1**: Database Design (Complete) 
- ✅ **Phase 2.2**: State Synchronization & Resource Discovery (Complete)
- 🚧 **Phase 2.3**: Resource Management (In Progress - Next Priority)
- ⏳ **Phase 3**: CLI Enhancement (Planned)
- ⏳ **Phase 4**: Declarative Configuration System (Planned)

### Multi-Agent Coordination Patterns

#### Phase 2.3: Resource Management (CURRENT)
Use 6 parallel agents for VM/Container lifecycle operations:

```
Agent 1: VM Creation API Implementation
- Implement POST /nodes/{node}/qemu endpoint
- Add VM configuration validation
- Create CLI command: vm create

Agent 2: VM Lifecycle Operations  
- Start/Stop/Restart APIs
- Status monitoring and validation
- CLI commands: vm start/stop/restart

Agent 3: Container Creation API
- Implement POST /nodes/{node}/lxc endpoint
- Container configuration validation
- CLI command: container create

Agent 4: Container Lifecycle Operations
- Container start/stop/restart operations
- Container status management
- CLI commands: container start/stop/restart

Agent 5: Management Infrastructure
- Task monitoring for all operations
- Confirmation prompts for destructive actions
- Error handling and recovery mechanisms

Agent 6: Integration Testing & Validation
- End-to-end testing of all lifecycle operations
- Real server validation when possible
- Test coverage verification (>80% target)
```

#### Phase 4.1: Declarative Configuration (FUTURE)
Use 5 parallel agents for YAML-based infrastructure as code:

```
Agent 1: YAML Configuration Parser
- Implement YAML/JSON configuration parsing
- Schema validation with proper error messages
- Multi-resource file support

Agent 2: Resource Specification Engine
- VM/Container/Storage specification schemas
- Configuration file validation and error reporting
- Template variable support

Agent 3: Apply Operation Implementation
- proxmox-cli apply -f infrastructure.yaml
- Create/update resource logic
- Dry-run mode for testing

Agent 4: Delete Operation Implementation  
- proxmox-cli delete -f infrastructure.yaml
- Safe resource removal with confirmations
- Dependency checking and validation

Agent 5: State Diffing Engine
- proxmox-cli diff -f infrastructure.yaml
- Configuration change visualization
- Plan generation for user review
```

### Implementation Guidelines

#### For Each Phase Development Session:

1. **Planning Phase** (5-10 minutes)
   - Review phase requirements from Plan.md
   - Identify parallel task opportunities
   - Create specific agent assignments
   - Set success criteria and testing requirements

2. **Parallel Implementation** (Main development time)
   - Spawn specialized agents for each component
   - Monitor progress and coordinate integration
   - Handle dependencies between parallel tasks

3. **Integration Phase** (10-15 minutes)
   - Integrate results from all agents
   - Run comprehensive testing
   - Update documentation and progress tracking
   - Commit changes with proper messages

#### Agent Specialization Guidelines

**API Implementation Agents:**
- Focus on specific Proxmox API endpoints
- Implement proper error handling and validation
- Follow existing API client patterns
- Test against real Proxmox server when possible

**CLI Development Agents:**
- Follow Commander.js patterns from existing code
- Implement consistent output formatting
- Add proper help text and examples
- Ensure verbose mode support

**Database Operation Agents:**
- Use Prisma ORM with repository pattern
- Follow existing database schema
- Implement proper migrations
- Maintain >90% test coverage

**Testing and Validation Agents:**
- Write comprehensive unit and integration tests
- Perform manual testing with real servers
- Validate against success criteria
- Generate coverage reports

### Current Phase 2.3 Priorities

#### Immediate Next Steps (This Week):
1. **VM Creation API** - Enable programmatic VM creation
2. **VM Lifecycle Control** - Start/stop/restart operations
3. **Container Creation API** - Enable container creation
4. **Safety Mechanisms** - Confirmation prompts and error handling

#### Success Criteria for Phase 2.3:
- [ ] Can create VMs programmatically via CLI
- [ ] Can start/stop/restart VMs and containers
- [ ] Can delete resources with proper confirmations
- [ ] All operations include task monitoring
- [ ] Integration tests pass with real Proxmox server
- [ ] Test coverage remains >80%
- [ ] API coverage increases to 45%

### Documentation Requirements

After each phase implementation:
- Update PROGRESS-VISUAL.md with new completion percentages
- Update CLAUDE.md with current capabilities
- Update Plan.md phase status
- Commit changes with descriptive phase completion message

### Testing Strategy for Phase Development

```bash
# Before starting phase
npm test                    # Ensure all existing tests pass
npm run typecheck          # Verify TypeScript compilation
git status                 # Ensure clean working directory

# During development
npm test -- --testPathPattern=new-feature  # Test new components
npm run test:coverage      # Monitor coverage changes

# After phase completion
npm test                   # Full test suite
npm run build             # Verify production build
npm run cli help          # Test CLI integration
```

## Context Files for Phase Development
- `@Plan.md` - Master project plan with phase definitions
- `@PROGRESS-VISUAL.md` - Current progress tracking
- `@docs/phase-*.md` - Detailed implementation plans for each phase
- `@src/` - Current codebase structure
- `@prisma/schema.prisma` - Database schema
- `@package.json` - Available scripts and dependencies