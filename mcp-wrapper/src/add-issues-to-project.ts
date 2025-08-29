#!/usr/bin/env node
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Add all repository issues to the GitHub Project
 */
async function addIssuesToProject() {
  const owner = process.env.GITHUB_REPO_OWNER || 'josephrichard7';
  const repo = process.env.GITHUB_REPO_NAME || 'proxmox-mpc';
  const projectNumber = process.env.GITHUB_PROJECT_NUMBER || '4';

  console.log(`🔗 Adding issues from ${owner}/${repo} to project #${projectNumber}`);

  try {
    // Get all open issues
    const issuesJson = execSync(
      `gh issue list --repo ${owner}/${repo} --limit 100 --json number,title,url`,
      { encoding: 'utf-8' }
    );

    const issues = JSON.parse(issuesJson);
    console.log(`📋 Found ${issues.length} issues to add`);

    let addedCount = 0;
    let errorCount = 0;

    for (const issue of issues) {
      try {
        execSync(
          `gh project item-add ${projectNumber} --owner ${owner} --url ${issue.url}`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
        console.log(`  ✅ Added #${issue.number}: ${issue.title}`);
        addedCount++;
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  #${issue.number} already in project`);
        } else {
          console.log(`  ❌ Failed to add #${issue.number}: ${error.message.split('\n')[0]}`);
          errorCount++;
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Added: ${addedCount} issues`);
    if (errorCount > 0) {
      console.log(`  ❌ Errors: ${errorCount} issues`);
    }

    // Get updated project info
    const projectInfo = execSync(
      `gh project view ${projectNumber} --owner ${owner} --format json`,
      { encoding: 'utf-8' }
    );
    const project = JSON.parse(projectInfo);

    console.log(`\n🎯 Project "${project.title}" now has ${issues.length} items`);
    console.log(`📋 Visit: https://github.com/users/${owner}/projects/${projectNumber}`);

  } catch (error: any) {
    console.error('❌ Failed to add issues to project:', error.message);
    process.exit(1);
  }
}

// Helper to create a delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the script
addIssuesToProject();