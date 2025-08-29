#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TaskStatus {
  [key: string]: 'done' | 'in_progress' | 'todo' | 'backlog';
}

/**
 * Organize the Kanban board based on PLAN.md completion status
 */
class KanbanOrganizer {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.owner = process.env.GITHUB_REPO_OWNER || 'josephrichard7';
    this.repo = process.env.GITHUB_REPO_NAME || 'proxmox-mpc';
  }

  // Based on PLAN.md analysis: Phases 1-6 are COMPLETED, Phase 7+ are IN_PROGRESS/PLANNED
  private getTaskStatuses(): TaskStatus {
    return {
      // Phase 7: Observability & Monitoring (IN_PROGRESS)
      'Structured Logging': 'in_progress',
      'Operation Tracing': 'in_progress', 
      'Performance Metrics': 'in_progress',
      'Error Context': 'in_progress',
      'Debug Mode': 'in_progress',
      'Log Aggregation': 'in_progress',
      'Health Checks': 'in_progress',
      'System Status': 'in_progress',
      'Connection Monitoring': 'in_progress',
      'Resource Monitoring': 'in_progress',
      'Dependency Checks': 'in_progress',
      'Status Dashboard': 'in_progress',
      'Issue Reporting': 'in_progress',
      'Context Packaging': 'in_progress',
      'Error Classification': 'in_progress',
      'Diagnostic Snapshots': 'in_progress',
      'Recovery Suggestions': 'in_progress',
      'Anonymization': 'in_progress',

      // Phase 8: MCP Integration (PLANNED/TODO) 
      'MCP Protocol Server': 'todo',
      'Resource Context': 'todo',
      'Tool Integration': 'todo',
      'Context Awareness': 'todo',
      'AI Model Support': 'todo',
      'Session Management': 'todo',
      'AI-Driven Operations': 'todo',
      'Natural Language Interface': 'todo',
      'Smart Suggestions': 'todo',
      'Automated Troubleshooting': 'todo',
      'Documentation Generation': 'todo',
      'Workflow Automation': 'todo',
      'Natural Language Parser': 'todo',
      'Claude Code Headless Integration': 'todo',
      'MCP Server Context': 'todo',
      'Multi-Step Workflow Execution': 'todo',
      'Progress Streaming': 'todo',
      'Error Recovery': 'todo',
      'Training Dataset Generation': 'backlog',
      'Domain-Specific Training Data': 'backlog',
      'Model Selection & Fine-Tuning': 'backlog',
      'Embedded Model Integration': 'backlog',
      'Evaluation Framework': 'backlog',
      'Fallback Strategy': 'backlog',
      'Accuracy Metrics': 'backlog',
      'Safety Metrics': 'backlog',
      'User Experience': 'todo',
      'A/B Testing': 'backlog',

      // Phase 9: Enterprise Features (PLANNED/BACKLOG)
      'GitHub Actions': 'todo',
      'GitLab CI/CD': 'backlog',
      'Webhook Support': 'todo',
      'API Gateway': 'backlog',
      'RBAC Integration': 'backlog',
      'Secrets Management': 'todo',
      'Audit Logging': 'backlog',
      'Compliance Reporting': 'backlog',

      // Phase 10: Web Dashboard & Success Metrics (MIXED STATUS)
      'REST API': 'todo',
      'WebSocket Support': 'todo',
      'Authentication': 'todo',
      'API Documentation': 'todo',
      'Interactive Dashboard': 'todo',
      'Configuration Editor': 'todo',
      'Real-time Monitoring': 'todo',
      'Template Management': 'todo',
      
      // These are from earlier phases and should be DONE
      'Successfully connect to Proxmox server': 'done',
      'Complete resource discovery (kubectl get equivalent)': 'done',
      'State tracking and history': 'done', 
      'Resource lifecycle management (kubectl create/delete equivalent)': 'done',
      
      // These are current metrics being tracked
      'Time to Initialize Project': 'in_progress',
      'Import Existing Infrastructure': 'in_progress',
      'Generate IaC from Scratch': 'in_progress',
      'Test Validation': 'in_progress',
      'Deploy Changes': 'in_progress',
      'Learning Curve': 'in_progress',
      'Error Rate': 'in_progress',
      'Configuration Coverage': 'in_progress',
      'Deployment Success': 'in_progress',
      'Drift Detection': 'in_progress'
    };
  }

  private getStatusLabel(status: string): string {
    const statusMap = {
      'done': 'completed',
      'in_progress': 'in-progress', 
      'todo': 'planned',
      'backlog': 'planned'
    };
    return statusMap[status as keyof typeof statusMap] || 'planned';
  }

  async organizeIssues() {
    console.log('🎯 Organizing Kanban board based on PLAN.md status...');
    
    const taskStatuses = this.getTaskStatuses();
    let processedCount = 0;
    let updatedCount = 0;

    try {
      // Get all issues
      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state: 'all',
        per_page: 100
      });

      console.log(`📋 Found ${issues.length} issues to organize`);

      for (const issue of issues) {
        const plannedStatus = taskStatuses[issue.title];
        if (plannedStatus) {
          const shouldBeClosed = plannedStatus === 'done';
          const shouldHaveLabel = this.getStatusLabel(plannedStatus);
          
          // Check current status
          const currentlyOpen = issue.state === 'open';
          const currentLabels = issue.labels.map(l => 
            typeof l === 'string' ? l : l.name || ''
          );
          const hasCorrectLabel = currentLabels.includes(shouldHaveLabel);

          let needsUpdate = false;
          const updates: any = {};
          const newLabels = [...currentLabels];

          // Update issue state (open/closed)
          if (shouldBeClosed && currentlyOpen) {
            updates.state = 'closed';
            needsUpdate = true;
          } else if (!shouldBeClosed && !currentlyOpen) {
            updates.state = 'open';
            needsUpdate = true;
          }

          // Remove old status labels
          const statusLabelsToRemove = ['completed', 'in-progress', 'planned', 'blocked'];
          statusLabelsToRemove.forEach(label => {
            const index = newLabels.indexOf(label);
            if (index > -1 && label !== shouldHaveLabel) {
              newLabels.splice(index, 1);
              needsUpdate = true;
            }
          });

          // Add correct status label
          if (!hasCorrectLabel) {
            newLabels.push(shouldHaveLabel);
            needsUpdate = true;
          }

          if (needsUpdate) {
            updates.labels = newLabels;

            try {
              await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: issue.number,
                ...updates
              });

              console.log(`  ✅ Updated #${issue.number}: ${issue.title} → ${this.getStatusEmoji(plannedStatus)} ${plannedStatus.toUpperCase()}`);
              updatedCount++;
            } catch (error: any) {
              console.log(`  ❌ Failed to update #${issue.number}: ${error.message}`);
            }

            // Rate limiting protection
            await this.delay(200);
          } else {
            console.log(`  ⏭️  #${issue.number}: ${issue.title} (already correct)`);
          }

          processedCount++;
        }
      }

      console.log(`\n📊 Organization Summary:`);
      console.log(`  📝 Processed: ${processedCount} issues`);
      console.log(`  ✅ Updated: ${updatedCount} issues`);
      console.log(`  ⏭️  Skipped: ${processedCount - updatedCount} already correct`);

      // Show status distribution
      await this.showStatusDistribution();

    } catch (error: any) {
      console.error('❌ Failed to organize issues:', error.message);
      throw error;
    }
  }

  private async showStatusDistribution() {
    console.log(`\n📊 Kanban Board Status Distribution:`);
    
    try {
      const statusCounts = {
        done: 0,
        'in-progress': 0,
        planned: 0,
        total: 0
      };

      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state: 'all',
        per_page: 100
      });

      issues.forEach(issue => {
        statusCounts.total++;
        if (issue.state === 'closed') {
          statusCounts.done++;
        } else {
          const labels = issue.labels.map(l => typeof l === 'string' ? l : l.name || '');
          if (labels.includes('in-progress')) {
            statusCounts['in-progress']++;
          } else {
            statusCounts.planned++;
          }
        }
      });

      console.log(`  ✅ Done: ${statusCounts.done} issues`);
      console.log(`  🚧 In Progress: ${statusCounts['in-progress']} issues`);
      console.log(`  📋 Planned: ${statusCounts.planned} issues`);
      console.log(`  📊 Total: ${statusCounts.total} issues`);

      const completionRate = Math.round((statusCounts.done / statusCounts.total) * 100);
      console.log(`  🎯 Completion Rate: ${completionRate}%`);

    } catch (error: any) {
      console.log('  ❌ Could not calculate status distribution');
    }
  }

  private getStatusEmoji(status: string): string {
    const emojiMap = {
      'done': '✅',
      'in_progress': '🚧',
      'todo': '📋', 
      'backlog': '🗂️'
    };
    return emojiMap[status as keyof typeof emojiMap] || '❓';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the organizer
const organizer = new KanbanOrganizer();
organizer.organizeIssues()
  .then(() => {
    console.log('\n🎉 Kanban board organization complete!');
    console.log('🔗 Visit: https://github.com/users/josephrichard7/projects/4');
    console.log('📋 Issues are now properly organized by completion status');
  })
  .catch((error) => {
    console.error('❌ Organization failed:', error);
    process.exit(1);
  });