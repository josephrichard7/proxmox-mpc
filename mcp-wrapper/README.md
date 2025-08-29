# GitHub Projects MCP Wrapper

This MCP (Model Context Protocol) wrapper provides token-efficient access to GitHub Projects for AI assistants like Claude.

## Setup Instructions

### 1. Create GitHub Project

1. Go to your repository: https://github.com/YOUR_USERNAME/proxmox-mpc
2. Click "Projects" tab → "New project"
3. Choose "Board" template (Kanban-style)
4. Name it "Proxmox-MPC Development"
5. Note the project number (shown in URL: `/projects/1`)

### 2. Configure Project Fields

Add these custom fields to your project:
- **Status**: Todo, In Progress, In Review, Done, Blocked
- **Priority**: High, Medium, Low
- **Story Points**: 1, 2, 3, 5, 8, 13
- **Sprint**: Sprint 1, Sprint 2, etc.
- **Type**: Feature, Bug, Enhancement, Documentation

### 3. Generate GitHub Token

1. Go to: https://github.com/settings/tokens/new
2. Create token with scopes:
   - `repo` (full control)
   - `project` (read/write projects)
3. Save token securely

### 4. Install Dependencies

```bash
cd mcp-wrapper
npm init -y
npm install @modelcontextprotocol/sdk @octokit/rest @octokit/graphql
npm install -D typescript @types/node
```

### 5. Configure Environment

Create `.env` file:
```env
GITHUB_TOKEN=your_github_token_here
GITHUB_PROJECT_NUMBER=1
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=proxmox-mpc
```

### 6. Start MCP Server

```bash
npm run build
npm run start
```

## Usage with Claude

Once the MCP server is running, Claude can make efficient queries:

```typescript
// Instead of loading entire PLAN.md (10K+ tokens)
const inProgress = await mcp.get_in_progress();  // ~200 tokens

// Get specific information
const blockers = await mcp.get_blockers();       // ~150 tokens
const velocity = await mcp.get_velocity();       // ~100 tokens
const release = await mcp.get_release_status('v1.0');  // ~300 tokens
```

## Migration from PLAN.md

### Quick Migration Script

```javascript
// migrate-to-github.js
const fs = require('fs');
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

async function migrate() {
  const planContent = fs.readFileSync('../PLAN.md', 'utf-8');
  const lines = planContent.split('\n');
  
  for (const line of lines) {
    // Parse checkbox items
    if (line.includes('- [ ]') || line.includes('- [x]')) {
      const isDone = line.includes('[x]');
      const title = line.replace(/^.*\[(x| )\]\s*/, '').trim();
      
      // Extract phase/epic from heading context
      const labels = [];
      if (line.includes('Phase 1')) labels.push('phase-1');
      if (line.includes('Phase 2')) labels.push('phase-2');
      
      // Create GitHub issue
      await octokit.issues.create({
        owner: 'your-username',
        repo: 'proxmox-mpc',
        title: title,
        labels: labels,
        state: isDone ? 'closed' : 'open',
        project_id: 1  // Add to project
      });
      
      console.log(`Created: ${title} (${isDone ? 'Done' : 'Open'})`);
    }
  }
}

migrate();
```

## Token Efficiency Comparison

| Operation | PLAN.md | GitHub Projects MCP |
|-----------|---------|-------------------|
| Check progress | ~10,000 tokens | ~200 tokens |
| Find blockers | ~10,000 tokens | ~150 tokens |
| Update status | ~10,000 tokens | ~50 tokens |
| Release status | ~10,000 tokens | ~300 tokens |

**Result: 95-98% token reduction** for common operations!

## GitHub Projects Best Practices

### Issue Templates

Create `.github/ISSUE_TEMPLATE/feature.md`:
```markdown
---
name: Feature
about: New feature implementation
labels: feature
projects: proxmox-mpc/1
---

## Description
Brief description of the feature

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Technical Notes
Implementation approach
```

### Automation Rules

Set up in Project Settings → Workflows:
1. **Auto-add issues**: New issues → automatically add to project
2. **Status sync**: PR merged → move to "Done"
3. **Auto-archive**: Items in "Done" for 2 weeks → archive

### Labels for Organization

Recommended label structure:
- **Type**: `feature`, `bug`, `enhancement`, `docs`
- **Priority**: `p0-critical`, `p1-high`, `p2-medium`, `p3-low`
- **Component**: `api`, `console`, `database`, `mcp`
- **Status**: `blocked`, `needs-review`, `ready`
- **Points**: `1-point`, `2-points`, `3-points`, `5-points`

## Alternative: Linear Integration

If you prefer Linear's superior UX:

```typescript
// linear-mcp.ts
import { LinearClient } from '@linear/sdk';

const linear = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY
});

// Similar structure but using Linear's SDK
server.setRequestHandler('get_in_progress', async () => {
  const issues = await linear.issues({
    filter: {
      state: { name: { eq: "In Progress" } },
      team: { key: { eq: "PROX" } }
    }
  });
  
  return issues.nodes.map(issue => ({
    title: issue.title,
    identifier: issue.identifier,
    assignee: issue.assignee?.name
  }));
});
```

## Next Steps

1. Set up GitHub Project with recommended fields
2. Run migration script to import PLAN.md
3. Start MCP server
4. Configure Claude to use MCP endpoint
5. Enjoy 95% token savings!