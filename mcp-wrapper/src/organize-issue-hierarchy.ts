#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Organize issues under epics with parent-child relationships
 */
class IssueHierarchyOrganizer {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.owner = process.env.GITHUB_REPO_OWNER || 'josephrichard7';
    this.repo = process.env.GITHUB_REPO_NAME || 'proxmox-mpc';
  }

  // Map issues to their epic parents
  private getIssueEpicMapping() {
    return {
      // Phase 1-6 Foundation (COMPLETED) - Epic #79
      79: [
        'Successfully connect to Proxmox server',
        'Complete resource discovery (kubectl get equivalent)',
        'State tracking and history',
        'Resource lifecycle management (kubectl create/delete equivalent)'
      ],
      
      // Phase 7 - Advanced Observability - Epic #80
      80: [
        'Structured Logging',
        'Operation Tracing', 
        'Performance Metrics',
        'Error Context',
        'Debug Mode',
        'Health Checks',
        'System Status',
        'Connection Monitoring',
        'Resource Monitoring',
        'Dependency Checks',
        'Issue Reporting',
        'Context Packaging',
        'Error Classification',
        'Diagnostic Snapshots',
        'Recovery Suggestions',
        'Log Aggregation',
        'Status Dashboard',
        'Anonymization'
      ],

      // Phase 8 - MCP & AI Integration - Epic #81
      81: [
        'MCP Protocol Server',
        'Resource Context',
        'Tool Integration',
        'Context Awareness', 
        'AI Model Support',
        'Session Management',
        'AI-Driven Operations',
        'Natural Language Interface',
        'Smart Suggestions',
        'Automated Troubleshooting',
        'Documentation Generation',
        'Workflow Automation',
        'Natural Language Parser',
        'Claude Code Headless Integration',
        'MCP Server Context',
        'Multi-Step Workflow Execution',
        'Progress Streaming',
        'Error Recovery',
        'Training Dataset Generation',
        'Domain-Specific Training Data',
        'Model Selection & Fine-Tuning',
        'Embedded Model Integration',
        'Evaluation Framework',
        'Fallback Strategy',
        'Accuracy Metrics',
        'Safety Metrics',
        'User Experience',
        'A/B Testing'
      ],

      // Phase 9 - Enterprise Features - Epic #82  
      82: [
        'GitHub Actions',
        'GitLab CI/CD',
        'Webhook Support',
        'API Gateway',
        'RBAC Integration',
        'Secrets Management',
        'Audit Logging',
        'Compliance Reporting'
      ],

      // Phase 10 - Advanced Dashboard & Success Metrics - Epic #83
      83: [
        'REST API',
        'WebSocket Support', 
        'Authentication',
        'API Documentation',
        'Interactive Dashboard',
        'Configuration Editor',
        'Real-time Monitoring',
        'Template Management',
        'Time to Initialize Project',
        'Import Existing Infrastructure',
        'Generate IaC from Scratch',
        'Test Validation',
        'Deploy Changes',
        'Learning Curve',
        'Error Rate',
        'Configuration Coverage',
        'Deployment Success',
        'Drift Detection'
      ]
    };
  }

  async organizeIssueHierarchy() {
    console.log('🎯 Organizing issues under epic hierarchy...');
    
    const mapping = this.getIssueEpicMapping();
    let organizedCount = 0;
    let totalIssues = 0;

    // Get all current issues
    const { data: issues } = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state: 'all',
      per_page: 100
    });

    // Create issue title to number mapping
    const issueMap = new Map();
    issues.forEach(issue => {
      issueMap.set(issue.title, issue.number);
    });

    console.log(`\n📋 Processing ${issues.length} issues across ${Object.keys(mapping).length} epics...`);

    for (const [epicNumber, childTitles] of Object.entries(mapping)) {
      const epicNum = parseInt(epicNumber);
      console.log(`\n📊 Epic #${epicNum}:`);
      
      let epicChildCount = 0;
      
      for (const childTitle of childTitles) {
        const childIssueNumber = issueMap.get(childTitle);
        
        if (childIssueNumber) {
          try {
            // Add comment linking to epic
            await this.octokit.issues.createComment({
              owner: this.owner,
              repo: this.repo,
              issue_number: childIssueNumber,
              body: `📋 **Epic**: This issue is part of Epic #${epicNum}\n\n> This issue contributes to the larger epic scope. See Epic #${epicNum} for overall progress and context.`
            });

            // Update labels to include epic reference
            const issue = issues.find(i => i.number === childIssueNumber);
            if (issue) {
              const currentLabels = issue.labels.map(l => 
                typeof l === 'string' ? l : l.name || ''
              );
              const newLabels = [...currentLabels, `epic-${epicNum}`];
              
              await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: childIssueNumber,
                labels: newLabels
              });
            }

            console.log(`  ✅ #${childIssueNumber}: ${childTitle}`);
            organizedCount++;
            epicChildCount++;
            
            await this.delay(200); // Rate limiting protection
            
          } catch (error: any) {
            console.log(`  ❌ Failed to organize #${childIssueNumber}: ${error.message}`);
          }
        } else {
          console.log(`  ❓ Issue not found: ${childTitle}`);
        }
        
        totalIssues++;
      }
      
      // Update epic with child count
      try {
        const epicIssue = issues.find(i => i.number === epicNum);
        if (epicIssue) {
          const updatedBody = epicIssue.body + `\n\n---\n\n📊 **Epic Progress**: ${epicChildCount} child issues organized under this epic.`;
          
          await this.octokit.issues.update({
            owner: this.owner,
            repo: this.repo,
            issue_number: epicNum,
            body: updatedBody
          });
          
          console.log(`  📊 Updated Epic #${epicNum} with ${epicChildCount} child issues`);
        }
      } catch (error: any) {
        console.log(`  ⚠️  Could not update epic #${epicNum}: ${error.message}`);
      }
    }

    console.log(`\n📊 Issue Hierarchy Organization Summary:`);
    console.log(`  ✅ Organized: ${organizedCount}/${totalIssues} issues`);
    console.log(`  📋 Epics Created: ${Object.keys(mapping).length}`);
    console.log(`  🔗 Project: https://github.com/users/${this.owner}/projects/4`);
    console.log(`\n🎉 Issues now organized in JIRA-style epic hierarchy!`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the hierarchy organizer
const organizer = new IssueHierarchyOrganizer();
organizer.organizeIssueHierarchy()
  .then(() => {
    console.log('\n🎉 Issue hierarchy organization complete!');
    console.log('📋 Issues are now grouped under logical epics like JIRA');
    console.log('🔗 View organized project: https://github.com/users/josephrichard7/projects/4');
  })
  .catch((error) => {
    console.error('❌ Hierarchy organization failed:', error);
    process.exit(1);
  });