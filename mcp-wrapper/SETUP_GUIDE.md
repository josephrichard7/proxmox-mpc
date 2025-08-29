# 🚀 GitHub Projects + MCP Setup Guide for Proxmox-MPC

This guide will help you set up GitHub Projects with MCP integration to replace PLAN.md with a token-efficient project management system.

## 📋 Prerequisites

- [ ] GitHub account with repository access
- [ ] Node.js installed (v18+)
- [ ] Access to proxmox-mpc repository

## 🔧 Step-by-Step Setup

### Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings: https://github.com/settings/tokens/new
2. Give it a descriptive name: `proxmox-mpc-project-management`
3. Set expiration (recommend 90 days minimum)
4. Select these scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `project` (Full control of projects)
   - ✅ `read:org` (Read org and team membership)
5. Click "Generate token"
6. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### Step 2: Create GitHub Project

1. Go to your repository: https://github.com/YOUR_USERNAME/proxmox-mpc
2. Click the "Projects" tab
3. Click "New project" → "New project"
4. Select "Board" template (Kanban view)
5. Name it: "Proxmox-MPC Development"
6. Set visibility to match your repo (public/private)
7. Click "Create"
8. Note the project number in the URL (e.g., `/projects/1`)

### Step 3: Configure Project Fields

In your new project, click ⚙️ Settings and add these fields:

#### Status Field (Single select)
- 📋 Backlog
- 🎯 Todo  
- 🚧 In Progress
- 👀 In Review
- ✅ Done
- 🚫 Blocked

#### Priority Field (Single select)
- 🔴 Critical
- 🟠 High
- 🟡 Medium
- 🟢 Low

#### Story Points Field (Single select)
- 1
- 2
- 3
- 5
- 8
- 13
- 21

#### Sprint Field (Single select)
- Sprint 1
- Sprint 2
- Sprint 3
- (add more as needed)

#### Type Field (Single select)
- ✨ Feature
- 🐛 Bug
- 📈 Enhancement
- 📚 Documentation
- 🧪 Test
- 🔧 Refactor

### Step 4: Configure MCP Wrapper

1. Navigate to the MCP wrapper directory:
```bash
cd mcp-wrapper
```

2. Copy the example environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your actual values:
```env
# GitHub Configuration
GITHUB_TOKEN=ghp_YOUR_ACTUAL_TOKEN_HERE
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=proxmox-mpc
GITHUB_PROJECT_NUMBER=1  # From Step 2

# MCP Server Configuration
MCP_SERVER_PORT=3100
MCP_SERVER_NAME=proxmox-pm
```

### Step 5: Test Connection

```bash
npm run test-connection
```

You should see:
```
🔍 Testing GitHub API Connection...
✅ REST API: Connected to your-username/proxmox-mpc
✅ GraphQL API: Connected successfully
✅ Authenticated as: your-username
✨ All tests passed! Your GitHub connection is ready.
```

### Step 6: Migrate PLAN.md to GitHub Issues

First, do a dry run to see what will be created:
```bash
npm run migrate -- --dry-run
```

Review the output, then run the actual migration:
```bash
npm run migrate
```

This will:
- Create milestones for each phase
- Create issues for all tasks
- Apply appropriate labels
- Set correct status (open/closed)

### Step 7: Set Up Project Automation

Go to your GitHub Project settings and add these automation rules:

1. **Item added to project** → Set status to "Todo"
2. **Pull request merged** → Set status to "Done"
3. **Issue closed** → Set status to "Done"
4. **Label "blocked" added** → Set status to "Blocked"
5. **Label "in-progress" added** → Set status to "In Progress"

### Step 8: Start MCP Server

```bash
npm run build
npm run start
```

The MCP server will be available for Claude to query efficiently.

## 📊 Token Efficiency Comparison

| Operation | PLAN.md (Before) | GitHub Projects (After) | Savings |
|-----------|-----------------|------------------------|---------|
| Check current tasks | ~10,000 tokens | ~200 tokens | 98% |
| Find blockers | ~10,000 tokens | ~150 tokens | 98.5% |
| Update task status | ~10,000 tokens | ~50 tokens | 99.5% |
| Get release progress | ~10,000 tokens | ~300 tokens | 97% |

## 🤖 Using with Claude

Once the MCP server is running, Claude can efficiently query your project:

```javascript
// Examples of what Claude can do
await mcp.get_in_progress();      // Get current sprint work
await mcp.get_blockers();         // Find blocked items
await mcp.get_velocity();         // Calculate team velocity
await mcp.get_release_status('v1.0');  // Check release progress
await mcp.update_task_status(123, 'Done');  // Update task
```

## 🎯 Recommended Workflow

1. **Daily Standup**: Use `/status` view in GitHub Projects
2. **Sprint Planning**: Drag items from Backlog to Todo
3. **During Development**: 
   - Move items to "In Progress" when starting
   - Create PRs linked to issues
   - Items auto-move to "Done" on merge
4. **AI Assistance**: Claude queries MCP for current state
5. **Reporting**: Use GitHub Projects insights tab

## 🏷️ Recommended Labels

Create these labels in your repository for better organization:

### Priority Labels
- `priority:critical` (red)
- `priority:high` (orange)
- `priority:medium` (yellow)
- `priority:low` (green)

### Phase Labels
- `phase-1` through `phase-10`

### Component Labels
- `component:api`
- `component:console`
- `component:database`
- `component:mcp`
- `component:web-ui`

### Type Labels
- `type:feature`
- `type:bug`
- `type:enhancement`
- `type:documentation`
- `type:test`

### Status Labels
- `status:blocked`
- `status:needs-review`
- `status:ready`

## 🔍 Troubleshooting

### Token Issues
- Ensure token has `repo` and `project` scopes
- Token may have expired - generate a new one
- Check token starts with `ghp_`

### Project Not Found
- Verify project number in URL matches .env
- Ensure project is created in the correct repository
- Check project visibility matches repo visibility

### Migration Errors
- Run with `--dry-run` first to preview
- Check for rate limiting (wait 1 hour if hit)
- Ensure labels exist before running migration

## 📈 Next Steps

1. ✅ Organize your project board with swimlanes
2. ✅ Set up GitHub Actions for CI/CD integration  
3. ✅ Configure notifications for important updates
4. ✅ Create saved views for different perspectives
5. ✅ Use GitHub Projects mobile app for on-the-go updates

## 🎉 Success!

You've now replaced a 10,000+ token PLAN.md file with a token-efficient GitHub Projects system that uses only 50-300 tokens per query!

Benefits achieved:
- 95-98% token reduction
- Professional PM interface
- Real-time collaboration
- Native GitHub integration
- Mobile accessibility
- AI-friendly via MCP