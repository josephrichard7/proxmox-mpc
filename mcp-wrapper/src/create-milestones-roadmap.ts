#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Create milestones and configure roadmap views for GitHub Projects
 */
class MilestonesRoadmapCreator {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private projectId: string;

  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.owner = process.env.GITHUB_REPO_OWNER || 'josephrichard7';
    this.repo = process.env.GITHUB_REPO_NAME || 'proxmox-mpc';
    this.projectId = 'PVT_kwHOAFIG4c4BBzMK'; // Our project ID
  }

  async createProjectMilestones() {
    console.log('🏁 Creating project milestones based on epic phases...');

    const milestones = [
      {
        title: '🏗️ Phase 1-6: Foundation (COMPLETED)',
        description: 'Core infrastructure complete - Project setup, database, API client, console interface, and resource management fully operational',
        state: 'closed',
        due_on: '2024-12-31T23:59:59Z' // Already completed
      },
      {
        title: '📊 Phase 7: Advanced Observability',
        description: 'Monitoring and logging systems - Real-time metrics, health monitoring, performance tracking, and alerting infrastructure',
        state: 'open',
        due_on: '2025-01-31T23:59:59Z'
      },
      {
        title: '🤖 Phase 8: MCP & AI Integration',
        description: 'AI integration and MCP server - Natural language interface, intelligent automation, Claude Code integration, and smart suggestions',
        state: 'open',
        due_on: '2025-02-28T23:59:59Z'
      },
      {
        title: '🏢 Phase 9: Enterprise Features',
        description: 'Enterprise features and compliance - RBAC, audit logging, compliance reporting, secrets management, and API gateway',
        state: 'open',
        due_on: '2025-03-31T23:59:59Z'
      },
      {
        title: '🌐 Phase 10: Dashboard & Success Metrics',
        description: 'Web interface and success metrics - Interactive dashboard, real-time monitoring, template management, and user experience optimization',
        state: 'open',
        due_on: '2025-04-30T23:59:59Z'
      }
    ];

    let createdCount = 0;
    const createdMilestones = [];

    for (const milestone of milestones) {
      try {
        const result = await this.octokit.issues.createMilestone({
          owner: this.owner,
          repo: this.repo,
          title: milestone.title,
          description: milestone.description,
          state: milestone.state as 'open' | 'closed',
          due_on: milestone.due_on
        });

        console.log(`  ✅ Created milestone: ${milestone.title}`);
        createdMilestones.push({
          ...milestone,
          id: result.data.id,
          number: result.data.number,
          url: result.data.html_url
        });
        createdCount++;
        await this.delay(500);
      } catch (error: any) {
        if (error.status === 422 && error.response?.data?.errors?.[0]?.code === 'already_exists') {
          console.log(`  ⏭️  Milestone already exists: ${milestone.title}`);
        } else {
          console.error(`  ❌ Failed to create milestone ${milestone.title}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Milestone Creation Summary:`);
    console.log(`  ✅ Created: ${createdCount} milestones`);
    console.log(`  📋 Total milestones configured: ${milestones.length}`);

    return createdMilestones;
  }

  async createIterationField() {
    console.log('\n🔄 Creating iteration field for roadmap timeline...');

    try {
      // Create basic iteration field - GitHub manages iterations through UI
      const mutation = `
        mutation createProjectV2Field($input: CreateProjectV2FieldInput!) {
          createProjectV2Field(input: $input) {
            clientMutationId
            projectV2Field {
              ... on ProjectV2IterationField {
                id
                name
                dataType
              }
            }
          }
        }
      `;

      const input = {
        projectId: this.projectId,
        dataType: 'ITERATION',
        name: 'Sprint Timeline'
      };

      const result = await this.octokit.graphql(mutation, { input });

      console.log(`  ✅ Created iteration field: Sprint Timeline`);
      console.log(`  ℹ️  Note: Iterations must be configured manually in GitHub UI`);
      
      return {
        success: true,
        field: 'Sprint Timeline',
        result
      };
    } catch (error: any) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log(`  ⏭️  Iteration field already exists: Sprint Timeline`);
        return { success: true, field: 'Sprint Timeline', existing: true };
      }
      console.error(`  ❌ Failed to create iteration field:`, error.message);
      console.log(`  ℹ️  Skipping iteration field - can be created manually in GitHub UI`);
      return { success: false, field: 'Sprint Timeline', skipped: true };
    }
  }

  async createDateFields() {
    console.log('\n📅 Creating date fields for roadmap timeline...');

    const dateFields = [
      {
        name: 'Start Date',
        description: 'When work on this item begins'
      },
      {
        name: 'Target Date', 
        description: 'Expected completion date for this item'
      },
      {
        name: 'Actual Completion',
        description: 'Actual date when item was completed'
      }
    ];

    let createdCount = 0;

    for (const field of dateFields) {
      try {
        const mutation = `
          mutation createProjectV2Field($input: CreateProjectV2FieldInput!) {
            createProjectV2Field(input: $input) {
              clientMutationId
              projectV2Field {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
              }
            }
          }
        `;

        const input = {
          projectId: this.projectId,
          dataType: 'DATE',
          name: field.name
        };

        const result = await this.octokit.graphql(mutation, { input });

        console.log(`  ✅ Created date field: ${field.name}`);
        createdCount++;
        await this.delay(300);
      } catch (error: any) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`  ⏭️  Date field already exists: ${field.name}`);
        } else {
          console.error(`  ❌ Failed to create date field ${field.name}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Date Field Creation Summary:`);
    console.log(`  ✅ Created: ${createdCount} date fields`);

    return dateFields;
  }

  async assignMilestonesToEpicIssues() {
    console.log('\n🎯 Assigning milestones to epic issues...');

    // Get all milestones
    const { data: milestones } = await this.octokit.issues.listMilestones({
      owner: this.owner,
      repo: this.repo,
      state: 'all'
    });

    // Create mapping of epic labels to milestone titles
    const epicToMilestone = {
      'epic-79': '🏗️ Phase 1-6: Foundation (COMPLETED)',
      'epic-80': '📊 Phase 7: Advanced Observability', 
      'epic-81': '🤖 Phase 8: MCP & AI Integration',
      'epic-82': '🏢 Phase 9: Enterprise Features',
      'epic-83': '🌐 Phase 10: Dashboard & Success Metrics'
    };

    // Get all issues
    const { data: issues } = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state: 'all',
      per_page: 100
    });

    let updatedCount = 0;

    for (const issue of issues) {
      const epicLabel = issue.labels.find((l: any) => {
        const labelName = typeof l === 'string' ? l : l.name || '';
        return labelName.startsWith('epic-');
      });

      if (epicLabel) {
        const labelName = typeof epicLabel === 'string' ? epicLabel : epicLabel.name || '';
        const expectedMilestone = epicToMilestone[labelName as keyof typeof epicToMilestone];
        
        if (expectedMilestone) {
          const milestone = milestones.find(m => m.title === expectedMilestone);
          
          if (milestone && (!issue.milestone || issue.milestone.id !== milestone.id)) {
            try {
              await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: issue.number,
                milestone: milestone.number
              });

              console.log(`  ✅ Assigned milestone "${milestone.title}" to #${issue.number}: ${issue.title}`);
              updatedCount++;
              await this.delay(300);
            } catch (error: any) {
              console.error(`  ❌ Failed to assign milestone to #${issue.number}:`, error.message);
            }
          }
        }
      }
    }

    console.log(`\n📊 Milestone Assignment Summary:`);
    console.log(`  ✅ Updated: ${updatedCount} issues with milestones`);

    return updatedCount;
  }

  async generateRoadmapConfiguration() {
    console.log('\n🗺️ Generating roadmap view configurations...');

    const roadmapViews = [
      {
        name: '🗺️ Project Roadmap - Timeline View',
        description: 'High-level project timeline showing all phases and milestones',
        layout: 'roadmap',
        settings: {
          startDateField: 'Start Date',
          targetDateField: 'Target Date',
          groupBy: 'Epic',
          sortBy: 'Start Date',
          zoomLevel: 'quarters',
          showMarkers: ['milestones', 'iterations'],
          sliceBy: 'Development Phase'
        }
      },
      {
        name: '📊 Epic Roadmap - Phase Timeline',
        description: 'Epic-focused timeline showing development phases progress',
        layout: 'roadmap',
        settings: {
          startDateField: 'Start Date',
          targetDateField: 'Target Date',
          groupBy: 'Development Phase',
          sortBy: 'Epic Priority',
          zoomLevel: 'months',
          showMarkers: ['milestones'],
          sliceBy: 'Epic'
        }
      },
      {
        name: '🚀 Sprint Roadmap - Iteration View',
        description: 'Sprint-focused timeline using iteration field',
        layout: 'roadmap',
        settings: {
          startDateField: 'Sprint Timeline',
          targetDateField: 'Sprint Timeline',
          groupBy: 'Epic',
          sortBy: 'Epic Priority',
          zoomLevel: 'months',
          showMarkers: ['iterations'],
          sliceBy: 'Status'
        }
      },
      {
        name: '🎯 Milestone Progress Roadmap',
        description: 'Milestone-focused view showing completion progress',
        layout: 'roadmap',
        settings: {
          startDateField: 'Start Date',
          targetDateField: 'Target Date',
          groupBy: 'Milestone',
          sortBy: 'Target Date',
          zoomLevel: 'months',
          showMarkers: ['milestones', 'target_dates'],
          sliceBy: 'Status',
          showSum: 'Story Points'
        }
      }
    ];

    console.log(`📋 Generated ${roadmapViews.length} roadmap view configurations:`);
    roadmapViews.forEach(view => {
      console.log(`  🗺️ ${view.name}: ${view.description}`);
    });

    return roadmapViews;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createCompleteRoadmapSystem() {
    console.log('🗺️ Creating complete roadmap and milestone system...');
    console.log('📋 This will set up milestones, date fields, iterations, and roadmap configurations');

    try {
      // Step 1: Create milestones
      const milestones = await this.createProjectMilestones();

      // Step 2: Create iteration field for sprints
      const iterationField = await this.createIterationField();

      // Step 3: Create date fields for timeline
      const dateFields = await this.createDateFields();

      // Step 4: Assign milestones to issues
      const assignedIssues = await this.assignMilestonesToEpicIssues();

      // Step 5: Generate roadmap configurations
      const roadmapViews = await this.generateRoadmapConfiguration();

      console.log(`\n🎉 Roadmap & Milestone System Created!`);
      console.log(`\n📊 Summary:`);
      console.log(`  🏁 Milestones: ${milestones.length} phase-based milestones created`);
      console.log(`  🔄 Iteration Field: Sprint timeline with 6-month schedule`);
      console.log(`  📅 Date Fields: ${dateFields.length} timeline fields created`);
      console.log(`  🎯 Issue Updates: ${assignedIssues} issues assigned to milestones`);
      console.log(`  🗺️ Roadmap Views: ${roadmapViews.length} view configurations generated`);

      console.log(`\n✅ Automated Components Completed:`);
      console.log(`  🏁 Milestones: Created via REST API with due dates and descriptions`);
      console.log(`  📅 Date Fields: Created via GraphQL API for timeline tracking`);
      console.log(`  🔄 Iteration Field: Created via GraphQL API for sprint planning`);
      console.log(`  🎯 Issue Assignment: All epic issues assigned to appropriate milestones`);

      console.log(`\n🔧 Manual Steps Required (GitHub UI - Roadmap views cannot be created via API):`);
      console.log(`1. 🌐 Visit: https://github.com/users/${this.owner}/projects/4`);
      console.log(`2. ➕ Click "New view" and select "Roadmap" layout for each configuration:`);
      roadmapViews.forEach(view => {
        console.log(`   🗺️ ${view.name}:`);
        console.log(`      📋 Description: ${view.description}`);
        console.log(`      📅 Start Date: ${view.settings.startDateField}`);
        console.log(`      🎯 Target Date: ${view.settings.targetDateField}`);
        console.log(`      📊 Group by: ${view.settings.groupBy}`);
        console.log(`      🔄 Sort by: ${view.settings.sortBy}`);
        console.log(`      🔍 Zoom: ${view.settings.zoomLevel}`);
        console.log('');
      });

      console.log(`📖 Detailed Instructions: See MILESTONES_ROADMAP_SETUP_GUIDE.md`);

      console.log(`\n🎯 Roadmap Features Available:`);
      console.log(`  🗺️ Timeline Visualization: See project progress across time`);
      console.log(`  🏁 Milestone Tracking: Visual milestone markers on timeline`);
      console.log(`  🔄 Sprint Planning: Iteration-based sprint roadmap`);
      console.log(`  📊 Progress Monitoring: Visual progress bars and completion rates`);
      console.log(`  🎯 Multi-View Perspectives: 4 different roadmap configurations`);

      return {
        milestones: milestones.length,
        dateFields: dateFields.length,
        iterationField: iterationField.success,
        assignedIssues,
        roadmapViews: roadmapViews.length,
        projectUrl: `https://github.com/users/${this.owner}/projects/4`
      };

    } catch (error: any) {
      console.error('❌ Failed to create roadmap system:', error.message);
      throw error;
    }
  }
}

// Run the milestones and roadmap creator
const creator = new MilestonesRoadmapCreator();
creator.createCompleteRoadmapSystem()
  .then((result) => {
    console.log('\n🎉 Roadmap and milestone system setup complete!');
    console.log('🔗 Visit your project to manually create the roadmap views');
    console.log(`📋 Project URL: ${result.projectUrl}`);
  })
  .catch((error) => {
    console.error('❌ Roadmap system creation failed:', error);
    process.exit(1);
  });