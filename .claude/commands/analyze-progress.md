---
description: Analyze current project progress and recommend next steps
tools: ["Read", "Grep", "Glob", "Bash"]
---

# Analyze Progress for Proxmox-MPC

Analyze the current state of the Proxmox management project and provide actionable recommendations for next steps.

## Task Description
$ARGUMENTS

## Analysis Framework

### Current Status Assessment

#### 1. Phase Completion Analysis
Review and verify completion status of all project phases:
- **Phase 1**: Foundation & Core Infrastructure
- **Phase 2.1**: Database Design 
- **Phase 2.2**: State Synchronization & Resource Discovery
- **Phase 2.3**: Resource Management (Current focus)
- **Phase 3+**: Future phases

#### 2. Technical Metrics Evaluation
```bash
# Code quality metrics to check
npm test                    # Test suite status
npm run test:coverage      # Coverage percentage
npm run typecheck          # TypeScript errors
npm run build              # Build status
git log --oneline -10      # Recent development activity
```

#### 3. Capability Assessment
Evaluate current working functionality:
- API client capabilities and endpoint coverage
- CLI commands and user interface quality
- Database schema and repository operations
- Integration between components
- Real Proxmox server validation status

#### 4. Gap Analysis
Identify missing functionality for current phase:
- Required vs implemented API endpoints
- CLI commands needed vs available
- Database operations coverage
- Testing coverage gaps
- Documentation updates needed

### Progress Validation

#### Code Quality Checks
```typescript
// Verify these aspects in analysis
interface QualityMetrics {
  testCoverage: number        // Target: >80%
  apiCoverage: number         // Current: 25%, Target for Phase 2.3: 45%
  cliCommands: string[]       // List working CLI commands
  databaseTables: string[]    // Implemented database entities
  migrationStatus: string     // Database migration health
}
```

#### Integration Testing Status
- API client + real Proxmox server connectivity
- CLI + API client integration
- Database + API client state persistence
- End-to-end workflow testing

### Recommendation Engine

#### Immediate Action Items (This Week)
Based on analysis, prioritize:
1. **Critical Blockers** - Issues preventing progress
2. **Phase 2.3 Requirements** - VM/Container lifecycle operations
3. **Technical Debt** - Code quality or testing gaps
4. **Integration Issues** - Component coordination problems

#### Strategic Next Steps (Next 2-4 weeks)
1. **Resource Management Completion** - Finish Phase 2.3
2. **CLI Enhancement Planning** - Prepare Phase 3
3. **Declarative Config Research** - Phase 4 preparation
4. **Performance and Scalability** - Address any bottlenecks

#### Risk Assessment
Identify and prioritize risks:
- **Technical Risks**: API changes, dependency issues
- **Integration Risks**: Component compatibility problems
- **Timeline Risks**: Phase completion delays
- **Quality Risks**: Test coverage or reliability issues

### Progress Reporting Format

```markdown
## Current Status: [Date]

### ✅ Completed Phases
- Phase X: [Brief summary] (Completion date)

### 🚧 Current Phase: [Phase Name]
- Progress: [X]% complete
- Remaining work: [List key items]
- Blockers: [Any blocking issues]
- ETA: [Estimated completion]

### 📊 Technical Metrics
- Test Coverage: [X]%
- API Coverage: [X]% ([Y]/[Z] endpoints)
- CLI Commands: [N] implemented
- Database Tables: [N] entities

### 🎯 Next Actions
1. [Highest priority item with timeline]
2. [Second priority item with timeline]
3. [Third priority item with timeline]

### ⚠️ Risks and Concerns
- [Risk 1]: [Mitigation strategy]
- [Risk 2]: [Mitigation strategy]

### 📈 Velocity Analysis
- Recent completion rate: [X phases/weeks]
- Projected completion: [Date estimate]
- Confidence level: [High/Medium/Low]
```

### Analysis Commands

```bash
# Project structure analysis
find src -name "*.ts" | wc -l              # Count TypeScript files
find src -name "*.test.ts" | wc -l         # Count test files
du -sh src/                                # Codebase size

# Database analysis
npx prisma db pull                         # Verify schema sync
npx prisma generate                        # Check type generation

# Dependency analysis  
npm audit                                  # Security check
npm outdated                               # Check for updates

# Git analysis
git log --since="1 week ago" --oneline     # Recent activity
git diff --stat                            # Current changes
```

### Deliverables

#### Progress Report Output
- Current phase status with concrete metrics
- Detailed gap analysis for current phase
- Prioritized action items with timelines
- Risk assessment with mitigation strategies
- Updated timeline estimates for remaining phases

#### Visual Progress Update
- Update PROGRESS-VISUAL.md with latest percentages
- Refresh phase completion indicators
- Update technical metrics dashboard
- Revise timeline projections

#### Actionable Recommendations  
- Specific next steps for immediate development
- Multi-agent task assignments for parallel work
- Integration testing priorities
- Documentation and communication updates

## Context Files to Analyze
- `@Plan.md` - Master project plan and phase definitions
- `@PROGRESS-VISUAL.md` - Current visual progress tracker
- `@CLAUDE.md` - Development guidelines and current status
- `@package.json` - Dependencies and scripts
- `@src/` - Current codebase for capability assessment
- `@docs/` - Implementation documentation and API research
- `@prisma/schema.prisma` - Database schema status
- Recent git commits - Development velocity and focus areas