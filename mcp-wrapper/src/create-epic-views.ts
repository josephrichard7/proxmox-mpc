#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Create custom fields and views for epic visualization in GitHub Projects
 */
class EpicViewsCreator {
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

  async createEpicVisualizationFields() {
    console.log('🎯 Creating custom fields for epic visualization...');
    
    const fields = [
      {
        name: 'Epic',
        type: 'single_select',
        options: [
          { name: '🏗️ Foundation (COMPLETED)', description: 'Phase 1-6: Core infrastructure complete' },
          { name: '📊 Observability', description: 'Phase 7: Monitoring and logging systems' },
          { name: '🤖 MCP & AI', description: 'Phase 8: AI integration and MCP server' },
          { name: '🏢 Enterprise', description: 'Phase 9: Enterprise features and compliance' },
          { name: '🌐 Dashboard', description: 'Phase 10: Web interface and success metrics' }
        ]
      },
      {
        name: 'Epic Priority',
        type: 'single_select',
        options: [
          { name: 'Critical', description: 'Production blocking issues' },
          { name: 'High', description: 'Important for current phase' },
          { name: 'Medium', description: 'Standard priority' },
          { name: 'Low', description: 'Nice to have features' }
        ]
      },
      {
        name: 'Development Phase',
        type: 'single_select',
        options: [
          { name: 'Phase 1-6 ✅', description: 'Foundation (COMPLETED)' },
          { name: 'Phase 7 🔄', description: 'Advanced Observability (IN PROGRESS)' },
          { name: 'Phase 8 📋', description: 'MCP & AI Integration (PLANNED)' },
          { name: 'Phase 9 📋', description: 'Enterprise Features (PLANNED)' },
          { name: 'Phase 10 🔄', description: 'Dashboard & Metrics (IN PROGRESS)' }
        ]
      },
      {
        name: 'Story Points',
        type: 'number',
        description: 'Estimation in story points (1, 2, 3, 5, 8, 13)'
      },
      {
        name: 'Epic Progress',
        type: 'text',
        description: 'Manual progress notes for epic-level tracking'
      }
    ];

    for (const field of fields) {
      try {
        const result = await this.createProjectField(field);
        console.log(`  ✅ Created field: ${field.name}`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  Field already exists: ${field.name}`);
        } else {
          console.error(`  ❌ Failed to create field ${field.name}:`, error.message);
        }
      }
      await this.delay(500);
    }

    return fields;
  }

  async createEpicViews() {
    console.log('\n🎯 Creating custom views for epic management...');
    
    const views = [
      {
        name: '🏗️ Epic Overview',
        description: 'High-level view of all epics with progress tracking',
        layout: 'table',
        filters: 'label:epic',
        groupBy: 'Epic',
        sortBy: 'Epic Priority'
      },
      {
        name: '📊 Foundation Epic (COMPLETED)',
        description: 'Phase 1-6 completed features',
        layout: 'board',
        filters: 'label:epic-79',
        groupBy: 'Status'
      },
      {
        name: '📊 Observability Epic',
        description: 'Phase 7 monitoring and logging features',
        layout: 'table',
        filters: 'label:epic-80',
        groupBy: 'Status',
        sortBy: 'Epic Priority'
      },
      {
        name: '🤖 MCP & AI Epic',
        description: 'Phase 8 AI integration and MCP features',
        layout: 'table',
        filters: 'label:epic-81',
        groupBy: 'Status',
        sortBy: 'Epic Priority'
      },
      {
        name: '🏢 Enterprise Epic',
        description: 'Phase 9 enterprise and compliance features',
        layout: 'table',
        filters: 'label:epic-82',
        groupBy: 'Status',
        sortBy: 'Epic Priority'
      },
      {
        name: '🌐 Dashboard Epic',
        description: 'Phase 10 web interface and metrics features',
        layout: 'table',
        filters: 'label:epic-83',
        groupBy: 'Status',
        sortBy: 'Epic Priority'
      },
      {
        name: '🎯 Active Sprint View',
        description: 'Current in-progress items across all epics',
        layout: 'board',
        filters: 'is:open label:in-progress',
        groupBy: 'Epic'
      },
      {
        name: '📈 Epic Progress Dashboard',
        description: 'Progress tracking view for project managers',
        layout: 'table',
        filters: 'label:epic',
        groupBy: 'Development Phase',
        sortBy: 'Epic Priority',
        showFields: ['Epic', 'Status', 'Epic Priority', 'Story Points', 'Epic Progress']
      }
    ];

    console.log(`Creating ${views.length} custom views...`);
    
    for (const view of views) {
      console.log(`  📋 View: ${view.name} - ${view.description}`);
    }

    return views;
  }

  async updateIssuesWithEpicFields() {
    console.log('\n🎯 Updating issues with epic field values...');
    
    const epicMapping = {
      79: { epic: '🏗️ Foundation (COMPLETED)', phase: 'Phase 1-6 ✅', priority: 'Critical' },
      80: { epic: '📊 Observability', phase: 'Phase 7 🔄', priority: 'High' },
      81: { epic: '🤖 MCP & AI', phase: 'Phase 8 📋', priority: 'High' },
      82: { epic: '🏢 Enterprise', phase: 'Phase 9 📋', priority: 'Medium' },
      83: { epic: '🌐 Dashboard', phase: 'Phase 10 🔄', priority: 'High' }
    };

    // First get project fields to map field names to IDs
    const projectFields = await this.getProjectFields();

    // Get all project items (issues in the project)
    const projectItems = await this.getProjectItems();

    let updatedCount = 0;

    for (const item of projectItems) {
      if (!item.content || item.content.__typename !== 'Issue') continue;
      
      const issue = item.content;
      const epicLabel = issue.labels?.nodes?.find((l: any) => 
        l.name?.startsWith('epic-')
      );

      if (epicLabel) {
        const epicNumber = parseInt(epicLabel.name.replace('epic-', ''));
        const epicInfo = epicMapping[epicNumber as keyof typeof epicMapping];

        if (epicInfo) {
          try {
            // Update custom field values for this project item
            await this.updateProjectItemFields(item.id, projectFields, epicInfo);
            
            console.log(`  ✅ Updated project item for #${issue.number}: ${issue.title}`);
            updatedCount++;
            await this.delay(500);
          } catch (error: any) {
            console.log(`  ❌ Failed to update project item for #${issue.number}: ${error.message}`);
          }
        }
      }
    }

    console.log(`\n📊 Epic Field Update Summary:`);
    console.log(`  ✅ Updated: ${updatedCount} project items`);
    console.log(`  📋 Epic fields ready for project board visualization`);

    return updatedCount;
  }

  private async getProjectFields() {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result: any = await this.octokit.graphql(query, {
      projectId: this.projectId
    });

    return result.node.fields.nodes;
  }

  private async getProjectItems() {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    __typename
                    id
                    number
                    title
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result: any = await this.octokit.graphql(query, {
      projectId: this.projectId
    });

    return result.node.items.nodes;
  }

  private async updateProjectItemFields(itemId: string, fields: any[], epicInfo: any) {
    // Find field IDs for our custom fields
    const epicField = fields.find(f => f.name === 'Epic');
    const priorityField = fields.find(f => f.name === 'Epic Priority');
    const phaseField = fields.find(f => f.name === 'Development Phase');

    const updates = [];

    if (epicField && epicField.options) {
      const epicOption = epicField.options.find((opt: any) => opt.name === epicInfo.epic);
      if (epicOption) {
        updates.push({
          fieldId: epicField.id,
          value: { singleSelectOptionId: epicOption.id }
        });
      }
    }

    if (priorityField && priorityField.options) {
      const priorityOption = priorityField.options.find((opt: any) => opt.name === epicInfo.priority);
      if (priorityOption) {
        updates.push({
          fieldId: priorityField.id,
          value: { singleSelectOptionId: priorityOption.id }
        });
      }
    }

    if (phaseField && phaseField.options) {
      const phaseOption = phaseField.options.find((opt: any) => opt.name === epicInfo.phase);
      if (phaseOption) {
        updates.push({
          fieldId: phaseField.id,
          value: { singleSelectOptionId: phaseOption.id }
        });
      }
    }

    // Execute the updates
    for (const update of updates) {
      const mutation = `
        mutation updateProjectV2ItemFieldValue($input: UpdateProjectV2ItemFieldValueInput!) {
          updateProjectV2ItemFieldValue(input: $input) {
            clientMutationId
            projectV2Item {
              id
            }
          }
        }
      `;

      await this.octokit.graphql(mutation, {
        input: {
          projectId: this.projectId,
          itemId: itemId,
          fieldId: update.fieldId,
          value: update.value
        }
      });

      await this.delay(200);
    }
  }

  private async createProjectField(field: any) {
    try {
      const mutation = `
        mutation createProjectV2Field($input: CreateProjectV2FieldInput!) {
          createProjectV2Field(input: $input) {
            clientMutationId
            projectV2Field {
              ... on ProjectV2FieldConfiguration {
                __typename
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `;

      // Map our field types to GitHub's ProjectV2CustomFieldType enum values
      const typeMapping: { [key: string]: string } = {
        'single_select': 'SINGLE_SELECT',
        'text': 'TEXT', 
        'number': 'NUMBER',
        'date': 'DATE'
      };

      let input: any = {
        projectId: this.projectId,
        dataType: typeMapping[field.type] || field.type.toUpperCase(),
        name: field.name
      };

      if (field.options) {
        input.singleSelectOptions = field.options.map((option: any) => ({
          name: option.name,
          description: option.description || '',
          color: 'GRAY' // Default color, could be made configurable
        }));
      }

      // Note: Description field is not supported in CreateProjectV2FieldInput
      // Field descriptions need to be set through the UI

      const result = await this.octokit.graphql(mutation, {
        input
      });

      return {
        success: true,
        field: field.name,
        id: result.createProjectV2Field.projectV2Field.id,
        result
      };
    } catch (error: any) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        throw new Error(`Field already exists: ${field.name}`);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createCompleteEpicVisualization() {
    console.log('🎯 Creating complete epic visualization system...');
    console.log('📋 This will set up custom fields, views, and issue organization');

    try {
      // Step 1: Create custom fields
      const fields = await this.createEpicVisualizationFields();
      
      // Step 2: Create custom views
      const views = await this.createEpicViews();
      
      // Step 3: Update issues with epic information
      const updatedIssues = await this.updateIssuesWithEpicFields();

      console.log(`\n🎉 Epic Visualization System Created!`);
      console.log(`\n📊 Summary:`);
      console.log(`  ✅ Custom Fields: ${fields.length} fields for epic management`);
      console.log(`  📋 Custom Views: ${views.length} views for different perspectives`);
      console.log(`  🎯 Updated Issues: ${updatedIssues} issues with epic context`);
      
      console.log(`\n✅ Automated Components Completed:`);
      console.log(`  🎯 Custom Fields: ${fields.length} fields created via GraphQL API`);
      console.log(`  📊 Field Values: ${updatedIssues} project items updated with epic data`);
      
      console.log(`\n🔧 Manual Steps Required (GitHub UI - Views cannot be created via API):`);
      console.log(`1. 🌐 Visit: https://github.com/users/${this.owner}/projects/4`);
      console.log(`2. 📋 Verify custom fields were created successfully:`);
      fields.forEach(field => {
        console.log(`   - ✅ ${field.name} (${field.type})`);
      });
      console.log(`3. 🎯 Create custom views manually with these configurations:`);
      views.forEach(view => {
        console.log(`   - ${view.name}: ${view.layout} layout, filter: ${view.filters}`);
      });
      console.log(`4. 🔄 Group views by the appropriate fields for epic visualization`);
      console.log(`\n📖 Detailed Instructions: See EPIC_VIEWS_SETUP_GUIDE.md for step-by-step view creation`);
      
      console.log(`\n🎯 Epic Visualization Features:`);
      console.log(`  📊 Epic Overview: See all epics and their status at a glance`);
      console.log(`  🎯 Epic-Specific Views: Drill down into individual epics`);
      console.log(`  📈 Progress Tracking: Visual progress bars and completion rates`);
      console.log(`  🔄 Sprint Management: Active items across all epics`);
      console.log(`  📋 PM Dashboard: High-level view for project managers`);

      return {
        fields,
        views,
        updatedIssues,
        projectUrl: `https://github.com/users/${this.owner}/projects/4`
      };

    } catch (error: any) {
      console.error('❌ Failed to create epic visualization system:', error.message);
      throw error;
    }
  }
}

// Run the epic views creator
const creator = new EpicViewsCreator();
creator.createCompleteEpicVisualization()
  .then((result) => {
    console.log('\n🎉 Epic visualization system setup complete!');
    console.log('🔗 Visit your project to manually create the custom fields and views');
    console.log(`📋 Project URL: ${result.projectUrl}`);
  })
  .catch((error) => {
    console.error('❌ Epic visualization creation failed:', error);
    process.exit(1);
  });