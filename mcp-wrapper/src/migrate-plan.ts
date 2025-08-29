#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Task {
  title: string;
  completed: boolean;
  phase: string;
  priority: 'high' | 'medium' | 'low';
  labels: string[];
  body?: string;
}

interface Phase {
  name: string;
  number: number;
  status: 'completed' | 'in_progress' | 'planned';
  tasks: Task[];
}

class PlanMigrator {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private projectNumber: number;
  private phases: Phase[] = [];
  private dryRun: boolean;

  constructor(dryRun = false) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    this.owner = process.env.GITHUB_REPO_OWNER || 'your-username';
    this.repo = process.env.GITHUB_REPO_NAME || 'proxmox-mpc';
    this.projectNumber = parseInt(process.env.GITHUB_PROJECT_NUMBER || '1');
    this.dryRun = dryRun;

    console.log(`🚀 Migrating to GitHub Project #${this.projectNumber}`);
    console.log(`📦 Repository: ${this.owner}/${this.repo}`);
    if (this.dryRun) {
      console.log('🧪 DRY RUN MODE - No issues will be created');
    }
  }

  async migrate() {
    console.log('\n📖 Reading PLAN.md...');
    this.parsePlanFile();
    
    console.log(`\n📊 Found ${this.phases.length} phases with ${this.getTotalTasks()} tasks`);
    
    // Create milestones for each phase
    console.log('\n🎯 Creating milestones for phases...');
    await this.createMilestones();
    
    // Create issues for tasks
    console.log('\n📝 Creating issues for tasks...');
    await this.createIssues();
    
    console.log('\n✅ Migration complete!');
    this.printSummary();
  }

  private parsePlanFile() {
    const planPath = resolve(process.cwd(), '../PLAN.md');
    const content = readFileSync(planPath, 'utf-8');
    const lines = content.split('\n');
    
    let currentPhase: Phase | null = null;
    let currentPhaseNumber = 0;
    
    for (const line of lines) {
      // Parse phase headers
      if (line.match(/^#{3,4} Phase (\d+):/)) {
        const match = line.match(/Phase (\d+): (.+?)( ✅ COMPLETED)?/);
        if (match) {
          currentPhaseNumber = parseInt(match[1]);
          currentPhase = {
            name: match[2].trim(),
            number: currentPhaseNumber,
            status: match[3] ? 'completed' : 'in_progress',
            tasks: []
          };
          this.phases.push(currentPhase);
        }
      }
      
      // Parse tasks (checkbox items)
      if (line.includes('- [ ]') || line.includes('- [x]')) {
        const isCompleted = line.includes('[x]');
        const taskMatch = line.match(/- \[[ x]\] (.+)/);
        
        if (taskMatch && currentPhase) {
          const taskText = taskMatch[1];
          
          // Extract task title and description
          const parts = taskText.split(':');
          const title = parts[0].replace(/\*\*/g, '').trim();
          const description = parts.slice(1).join(':').trim();
          
          // Determine priority based on keywords
          let priority: 'high' | 'medium' | 'low' = 'medium';
          if (title.toLowerCase().includes('critical') || 
              title.toLowerCase().includes('security')) {
            priority = 'high';
          } else if (title.toLowerCase().includes('optional') || 
                     title.toLowerCase().includes('future')) {
            priority = 'low';
          }
          
          // Generate labels
          const labels: string[] = [`phase-${currentPhaseNumber}`];
          
          // Add type labels
          if (title.toLowerCase().includes('test')) labels.push('testing');
          if (title.toLowerCase().includes('api')) labels.push('api');
          if (title.toLowerCase().includes('console')) labels.push('console');
          if (title.toLowerCase().includes('database')) labels.push('database');
          if (title.toLowerCase().includes('mcp')) labels.push('mcp');
          if (title.toLowerCase().includes('ui') || title.toLowerCase().includes('web')) labels.push('frontend');
          if (title.toLowerCase().includes('doc')) labels.push('documentation');
          
          // Add priority label
          labels.push(`priority-${priority}`);
          
          // Add status label
          if (isCompleted) {
            labels.push('completed');
          } else if (currentPhase.status === 'in_progress') {
            labels.push('in-progress');
          } else {
            labels.push('planned');
          }
          
          currentPhase.tasks.push({
            title,
            completed: isCompleted,
            phase: currentPhase.name,
            priority,
            labels,
            body: description || undefined
          });
        }
      }
    }
  }

  private getTotalTasks(): number {
    return this.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
  }

  private async createMilestones() {
    for (const phase of this.phases) {
      const milestoneTitle = `Phase ${phase.number}: ${phase.name}`;
      
      if (this.dryRun) {
        console.log(`  📍 Would create milestone: ${milestoneTitle}`);
        continue;
      }
      
      try {
        // Check if milestone already exists
        const { data: existingMilestones } = await this.octokit.issues.listMilestones({
          owner: this.owner,
          repo: this.repo,
          state: 'all'
        });
        
        const existing = existingMilestones.find(m => m.title === milestoneTitle);
        
        if (existing) {
          console.log(`  ⏭️  Milestone already exists: ${milestoneTitle}`);
        } else {
          const { data: milestone } = await this.octokit.issues.createMilestone({
            owner: this.owner,
            repo: this.repo,
            title: milestoneTitle,
            state: phase.status === 'completed' ? 'closed' : 'open',
            description: `Implementation tasks for ${phase.name}`
          });
          
          console.log(`  ✅ Created milestone: ${milestoneTitle}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Failed to create milestone: ${error.message}`);
      }
    }
  }

  private async createIssues() {
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const phase of this.phases) {
      console.log(`\n  📂 Phase ${phase.number}: ${phase.name}`);
      
      for (const task of phase.tasks) {
        if (this.dryRun) {
          console.log(`    📝 Would create: ${task.title} [${task.labels.join(', ')}]`);
          createdCount++;
          continue;
        }
        
        try {
          // Check if issue already exists (by title)
          const { data: existingIssues } = await this.octokit.issues.listForRepo({
            owner: this.owner,
            repo: this.repo,
            state: 'all',
            per_page: 100
          });
          
          const existing = existingIssues.find(issue => 
            issue.title === task.title || 
            issue.title.includes(task.title)
          );
          
          if (existing) {
            console.log(`    ⏭️  Issue exists: ${task.title} (#${existing.number})`);
            skippedCount++;
            continue;
          }
          
          // Create the issue
          const issueBody = this.generateIssueBody(task);
          
          const { data: issue } = await this.octokit.issues.create({
            owner: this.owner,
            repo: this.repo,
            title: task.title,
            body: issueBody,
            labels: task.labels,
            state: task.completed ? 'closed' : 'open'
          });
          
          console.log(`    ✅ Created: ${task.title} (#${issue.number})`);
          createdCount++;
          
          // Add to project
          // Note: This requires GraphQL API for Projects V2
          // We'll add this in a separate step if needed
          
        } catch (error: any) {
          console.error(`    ❌ Failed: ${task.title} - ${error.message}`);
          errorCount++;
        }
        
        // Rate limiting protection
        await this.sleep(500);
      }
    }
    
    console.log(`\n📊 Migration Results:`);
    console.log(`  ✅ Created: ${createdCount} issues`);
    console.log(`  ⏭️  Skipped: ${skippedCount} existing issues`);
    if (errorCount > 0) {
      console.log(`  ❌ Errors: ${errorCount} issues failed`);
    }
  }

  private generateIssueBody(task: Task): string {
    let body = `## 📋 Task Details\n\n`;
    
    if (task.body) {
      body += `${task.body}\n\n`;
    }
    
    body += `### 📍 Phase\n${task.phase}\n\n`;
    body += `### 🎯 Priority\n${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}\n\n`;
    
    body += `### ✅ Acceptance Criteria\n`;
    body += `- [ ] Implementation complete\n`;
    body += `- [ ] Tests written and passing\n`;
    body += `- [ ] Documentation updated\n\n`;
    
    body += `### 🏷️ Labels\n`;
    body += task.labels.map(label => `\`${label}\``).join(' ');
    
    return body;
  }

  private printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    
    for (const phase of this.phases) {
      const completedTasks = phase.tasks.filter(t => t.completed).length;
      const totalTasks = phase.tasks.length;
      const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      console.log(`\nPhase ${phase.number}: ${phase.name}`);
      console.log(`  Status: ${phase.status}`);
      console.log(`  Progress: ${completedTasks}/${totalTasks} tasks (${percentage}%)`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 Next Steps:');
    console.log('1. Visit your GitHub Project to organize the board');
    console.log(`   https://github.com/${this.owner}/${this.repo}/projects/${this.projectNumber}`);
    console.log('2. Set up automation rules in Project Settings');
    console.log('3. Start the MCP server with: npm run start');
    console.log('4. Configure Claude to use the MCP endpoint');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const migrator = new PlanMigrator(dryRun);

migrator.migrate().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});