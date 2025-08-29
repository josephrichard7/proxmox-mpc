#!/usr/bin/env node
import { graphql } from '@octokit/graphql';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function createRepositoryProject() {
  console.log('🏗️ Creating repository-level GitHub Project...');

  const owner = process.env.GITHUB_REPO_OWNER || 'josephrichard7';
  const repo = process.env.GITHUB_REPO_NAME || 'proxmox-mpc';

  try {
    const graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
    });

    // First, get the repository ID
    console.log('📦 Getting repository information...');
    const repoQuery = `
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
          name
          nameWithOwner
        }
      }
    `;

    const repoResult: any = await graphqlWithAuth(repoQuery, { 
      owner, 
      name: repo 
    });

    const repositoryId = repoResult.repository.id;
    console.log(`✅ Repository ID: ${repositoryId}`);

    // Create the project linked to the repository
    console.log('🎯 Creating project...');
    const createProjectMutation = `
      mutation($repositoryId: ID!, $title: String!) {
        createProjectV2(input: {
          ownerId: $repositoryId
          title: $title
        }) {
          projectV2 {
            id
            number
            title
            url
            shortDescription
          }
        }
      }
    `;

    const createResult: any = await graphqlWithAuth(createProjectMutation, {
      repositoryId,
      title: 'Proxmox-MPC Development'
    });

    const project = createResult.createProjectV2.projectV2;
    console.log(`✅ Created project: ${project.title} (#${project.number})`);
    console.log(`🔗 URL: ${project.url}`);

    // Update our .env file with the new project number
    const fs = require('fs');
    const envPath = '.env';
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const updatedEnv = envContent.replace(
      /GITHUB_PROJECT_NUMBER=\d+/,
      `GITHUB_PROJECT_NUMBER=${project.number}`
    );
    fs.writeFileSync(envPath, updatedEnv);

    console.log(`📝 Updated .env with project number: ${project.number}`);

    // Now add Status field with proper columns
    console.log('📋 Adding Status field with Kanban columns...');
    
    const addStatusFieldMutation = `
      mutation($projectId: ID!) {
        createProjectV2Field(input: {
          projectId: $projectId
          dataType: SINGLE_SELECT
          name: "Status"
          singleSelectOptions: [
            {name: "📋 Backlog", color: GRAY}
            {name: "🎯 Todo", color: BLUE}
            {name: "🚧 In Progress", color: YELLOW}
            {name: "👀 In Review", color: ORANGE}
            {name: "✅ Done", color: GREEN}
            {name: "🚫 Blocked", color: RED}
          ]
        }) {
          projectV2Field {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
                color
              }
            }
          }
        }
      }
    `;

    const statusFieldResult: any = await graphqlWithAuth(addStatusFieldMutation, {
      projectId: project.id
    });

    console.log('✅ Added Status field with Kanban columns');

    // Add Priority field
    console.log('🎯 Adding Priority field...');
    const addPriorityFieldMutation = `
      mutation($projectId: ID!) {
        createProjectV2Field(input: {
          projectId: $projectId
          dataType: SINGLE_SELECT
          name: "Priority"
          singleSelectOptions: [
            {name: "🔴 Critical", color: RED}
            {name: "🟠 High", color: ORANGE}
            {name: "🟡 Medium", color: YELLOW}
            {name: "🟢 Low", color: GREEN}
          ]
        }) {
          projectV2Field {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    `;

    await graphqlWithAuth(addPriorityFieldMutation, {
      projectId: project.id
    });

    console.log('✅ Added Priority field');

    // Add Story Points field
    console.log('📊 Adding Story Points field...');
    const addPointsFieldMutation = `
      mutation($projectId: ID!) {
        createProjectV2Field(input: {
          projectId: $projectId
          dataType: SINGLE_SELECT
          name: "Story Points"
          singleSelectOptions: [
            {name: "1", color: BLUE}
            {name: "2", color: BLUE}
            {name: "3", color: BLUE}
            {name: "5", color: YELLOW}
            {name: "8", color: ORANGE}
            {name: "13", color: RED}
          ]
        }) {
          projectV2Field {
            ... on ProjectV2SingleSelectField {
              id
              name
            }
          }
        }
      }
    `;

    await graphqlWithAuth(addPointsFieldMutation, {
      projectId: project.id
    });

    console.log('✅ Added Story Points field');

    return {
      projectId: project.id,
      projectNumber: project.number,
      projectUrl: project.url,
      statusField: statusFieldResult.projectV2Field
    };

  } catch (error: any) {
    console.error('❌ Failed to create project:', error.message);
    if (error.errors) {
      error.errors.forEach((err: any) => {
        console.error(`   - ${err.message}`);
      });
    }
    throw error;
  }
}

// Run the script
createRepositoryProject()
  .then((result) => {
    console.log('\n🎉 Repository project created successfully!');
    console.log(`📋 Project URL: ${result.projectUrl}`);
    console.log('📝 Next steps:');
    console.log('1. Add issues to the project');
    console.log('2. Organize them in proper columns based on completion status');
    console.log('3. Test MCP queries');
  })
  .catch((error) => {
    process.exit(1);
  });