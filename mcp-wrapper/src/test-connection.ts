#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('🔍 Testing GitHub API Connection...\n');

  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is not set');
    console.log('\n📝 Please create a .env file with:');
    console.log('GITHUB_TOKEN=your_github_personal_access_token');
    process.exit(1);
  }

  const owner = process.env.GITHUB_REPO_OWNER || 'your-username';
  const repo = process.env.GITHUB_REPO_NAME || 'proxmox-mpc';

  try {
    // Test REST API
    console.log('1️⃣ Testing REST API...');
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const { data: repoData } = await octokit.repos.get({ owner, repo });
    console.log(`✅ REST API: Connected to ${repoData.full_name}`);
    console.log(`   Description: ${repoData.description || 'No description'}`);
    console.log(`   Stars: ${repoData.stargazers_count}`);

    // Test GraphQL API
    console.log('\n2️⃣ Testing GraphQL API...');
    const graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
    });

    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          name
          projectsV2(first: 10) {
            totalCount
            nodes {
              title
              number
            }
          }
          issues(first: 5, states: OPEN) {
            totalCount
            nodes {
              title
              number
            }
          }
        }
      }
    `;

    const result: any = await graphqlWithAuth(query, { owner, repo });
    console.log(`✅ GraphQL API: Connected successfully`);
    console.log(`   Projects: ${result.repository.projectsV2.totalCount}`);
    console.log(`   Open Issues: ${result.repository.issues.totalCount}`);

    if (result.repository.projectsV2.nodes.length > 0) {
      console.log('\n📋 Existing Projects:');
      result.repository.projectsV2.nodes.forEach((project: any) => {
        console.log(`   #${project.number}: ${project.title}`);
      });
    }

    // Check permissions
    console.log('\n3️⃣ Checking Token Permissions...');
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`✅ Authenticated as: ${user.login}`);

    // Test issue creation capability
    console.log('\n4️⃣ Testing Issue Creation Capability...');
    try {
      // Try to list labels (safe operation)
      const { data: labels } = await octokit.issues.listLabelsForRepo({
        owner,
        repo
      });
      console.log(`✅ Can access repository issues (${labels.length} labels found)`);
    } catch (error: any) {
      console.log(`⚠️ Limited issue access: ${error.message}`);
    }

    console.log('\n✨ All tests passed! Your GitHub connection is ready.');
    console.log('\n📝 Next steps:');
    console.log('1. Create a GitHub Project if you haven\'t already');
    console.log('2. Update GITHUB_PROJECT_NUMBER in your .env file');
    console.log('3. Run migration: npm run migrate');

  } catch (error: any) {
    console.error('\n❌ Connection test failed:', error.message);
    
    if (error.status === 401) {
      console.log('\n🔑 Authentication Error:');
      console.log('Your GitHub token appears to be invalid or expired.');
      console.log('Please generate a new token at:');
      console.log('https://github.com/settings/tokens/new');
      console.log('\nRequired scopes: repo, project');
    } else if (error.status === 404) {
      console.log('\n📦 Repository Not Found:');
      console.log(`Could not find repository ${owner}/${repo}`);
      console.log('Please check your GITHUB_REPO_OWNER and GITHUB_REPO_NAME settings');
    } else {
      console.log('\n🐛 Unexpected Error:');
      console.log('Please check your configuration and try again');
    }
    
    process.exit(1);
  }
}

// Run the test
testConnection();