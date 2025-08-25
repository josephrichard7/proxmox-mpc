/**
 * Plan Command
 * Shows what changes would be made to infrastructure without applying them
 */

import { spawn } from 'child_process';
import * as fsSync from 'fs';
import * as path from 'path';

import { ConsoleSession } from '../repl';

export class PlanCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('📋 Planning infrastructure changes...\n');

    // Check if we're in a workspace
    if (!session.workspace) {
      console.log('❌ No workspace detected');
      console.log('   Use /init to create a workspace first');
      return;
    }

    const workspaceRoot = session.workspace.rootPath;
    const terraformDir = path.join(workspaceRoot, 'terraform');
    const ansibleDir = path.join(workspaceRoot, 'ansible');

    try {
      // Parse command arguments
      const options = this.parseArguments(args);

      // Terraform planning
      if (options.terraformOnly || options.all) {
        console.log('🏗️  Phase 1: Terraform Plan');
        console.log('=' .repeat(50));
        const terraformPlan = await this.generateTerraformPlan(terraformDir, session, options);
        if (!terraformPlan) {
          console.log('❌ Failed to generate Terraform plan');
          return;
        }
      }

      // Ansible planning (dry-run)
      if (options.ansibleOnly || options.all) {
        console.log('\n🎵 Phase 2: Ansible Plan (Dry Run)');
        console.log('=' .repeat(50));
        const ansiblePlan = await this.generateAnsiblePlan(ansibleDir, options);
        if (!ansiblePlan) {
          console.log('❌ Failed to generate Ansible plan');
          return;
        }
      }

      // Summary
      console.log('\n📊 Planning Summary');
      console.log('=' .repeat(50));
      console.log('✅ Planning completed successfully');
      console.log('\n🚀 Next steps:');
      console.log('   • Review the planned changes above carefully');
      console.log('   • Use /apply to deploy the changes');
      console.log('   • Use /apply --dry-run for another dry run');
      console.log('   • Use /test to run validation tests first');

    } catch (error) {
      console.error(`❌ Planning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseArguments(args: string[]): PlanOptions {
    const options: PlanOptions = {
      all: true,
      terraformOnly: false,
      ansibleOnly: false,
      detailed: false,
      json: false
    };

    for (const arg of args) {
      switch (arg) {
        case '--terraform':
        case '-t':
          options.terraformOnly = true;
          options.all = false;
          break;
        case '--ansible':
        case '-a':
          options.ansibleOnly = true;
          options.all = false;
          break;
        case '--detailed':
        case '-d':
          options.detailed = true;
          break;
        case '--json':
        case '-j':
          options.json = true;
          break;
      }
    }

    return options;
  }

  private async generateTerraformPlan(terraformDir: string, session: ConsoleSession, options: PlanOptions): Promise<boolean> {
    if (!fsSync.existsSync(terraformDir)) {
      console.log('⚠️  No Terraform configurations found');
      console.log('   Run /sync to generate Terraform configurations first');
      return false;
    }

    try {
      // Initialize Terraform if needed
      console.log('📋 Initializing Terraform...');
      const initSuccess = await this.runTerraformInit(terraformDir);
      if (!initSuccess) {
        console.log('❌ Terraform initialization failed');
        return false;
      }

      // Generate plan
      console.log('📊 Generating Terraform plan...');
      const planSuccess = await this.runTerraformPlan(terraformDir, session, options);
      if (!planSuccess) {
        console.log('❌ Terraform plan generation failed');
        return false;
      }

      console.log('✅ Terraform plan generated successfully');
      return true;

    } catch (error) {
      console.log(`❌ Terraform planning error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async generateAnsiblePlan(ansibleDir: string, options: PlanOptions): Promise<boolean> {
    if (!fsSync.existsSync(ansibleDir)) {
      console.log('⚠️  No Ansible configurations found');
      console.log('   Run /sync to generate Ansible configurations first');
      return false;
    }

    const inventoryPath = path.join(ansibleDir, 'inventory.yml');
    const playbookPath = path.join(ansibleDir, 'playbooks', 'site.yml');

    // Check if required files exist
    if (!fsSync.existsSync(inventoryPath)) {
      console.log('❌ Ansible inventory not found');
      console.log('   Run /sync to generate Ansible inventory');
      return false;
    }
    if (!fsSync.existsSync(playbookPath)) {
      console.log('❌ Ansible site playbook not found');
      console.log('   Run /sync to generate Ansible playbooks');
      return false;
    }

    try {
      console.log('📋 Running Ansible dry-run (check mode)...');
      const checkSuccess = await this.runAnsibleCheck(ansibleDir, inventoryPath, playbookPath, options);
      if (!checkSuccess) {
        console.log('❌ Ansible plan generation failed');
        return false;
      }

      console.log('✅ Ansible plan generated successfully');
      return true;

    } catch (error) {
      console.log(`❌ Ansible planning error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async runTerraformInit(terraformDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const initProcess = spawn('terraform', ['init'], {
        cwd: terraformDir,
        stdio: 'pipe'
      });

      let errorOutput = '';

      initProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      initProcess.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ Terraform initialized');
          resolve(true);
        } else {
          console.log('   ❌ Terraform init failed');
          if (errorOutput) {
            console.log('   📋 Error details:');
            errorOutput.split('\n').slice(0, 5).forEach(line => {
              if (line.trim()) console.log(`      ${line}`);
            });
          }
          resolve(false);
        }
      });

      initProcess.on('error', (error) => {
        console.log('   ❌ Failed to run terraform init');
        console.log(`   💡 Error: ${error.message}`);
        console.log('   💡 Ensure Terraform is installed and in your PATH');
        resolve(false);
      });
    });
  }

  private async runTerraformPlan(terraformDir: string, session: ConsoleSession, options: PlanOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const planArgs = [
        'plan',
        `-var=proxmox_token_id=${session.workspace?.config.tokenId || ''}`,
        `-var=proxmox_token_secret=${session.workspace?.config.tokenSecret || ''}`,
        `-var=default_node=${session.workspace?.config.node || ''}`
      ];

      // Add detailed output if requested
      if (options.detailed) {
        planArgs.push('-detailed-exitcode');
      }

      // Add JSON output if requested
      if (options.json) {
        planArgs.push('-json');
      }

      const planProcess = spawn('terraform', planArgs, {
        cwd: terraformDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          PM_API_URL: `https://${session.workspace?.config.host}:${session.workspace?.config.port}/api2/json`,
          PM_TLS_INSECURE: session.workspace?.config.rejectUnauthorized ? 'false' : 'true'
        }
      });

      let output = '';
      let errorOutput = '';

      planProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Format and display the plan output in real-time
        const lines = text.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            // Highlight important information
            if (line.includes('Plan:')) {
              console.log(`   🎯 ${line}`);
            } else if (line.includes('+ ')) {
              console.log(`   ➕ ${line}`);
            } else if (line.includes('- ')) {
              console.log(`   ➖ ${line}`);
            } else if (line.includes('~ ')) {
              console.log(`   🔄 ${line}`);
            } else if (line.includes('Error:') || line.includes('Warning:')) {
              console.log(`   ⚠️  ${line}`);
            } else {
              console.log(`   ${line}`);
            }
          }
        });
      });

      planProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      planProcess.on('close', (code) => {
        if (code === 0 || (code === 2 && options.detailed)) {
          // Code 0 = no changes, Code 2 = changes planned (when using -detailed-exitcode)
          if (code === 0) {
            console.log('\n   📊 Plan Summary: No infrastructure changes needed');
          } else if (code === 2) {
            console.log('\n   📊 Plan Summary: Infrastructure changes are planned');
          }
          
          // Parse and summarize the plan
          this.summarizeTerraformPlan(output);
          resolve(true);
        } else {
          console.log('\n   ❌ Terraform plan failed');
          if (errorOutput) {
            console.log('   📋 Error details:');
            errorOutput.split('\n').slice(0, 10).forEach(line => {
              if (line.trim()) console.log(`      ${line}`);
            });
          }
          resolve(false);
        }
      });

      planProcess.on('error', (error) => {
        console.log('   ❌ Failed to run terraform plan');
        console.log(`   💡 Error: ${error.message}`);
        resolve(false);
      });
    });
  }

  private async runAnsibleCheck(ansibleDir: string, inventoryPath: string, playbookPath: string, options: PlanOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const checkArgs = [
        '-i', inventoryPath,
        playbookPath,
        '--check',
        '--diff'
      ];

      // Add verbose output if detailed mode
      if (options.detailed) {
        checkArgs.push('-v');
      }

      const checkProcess = spawn('ansible-playbook', checkArgs, {
        cwd: ansibleDir,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      checkProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Format and display the check output in real-time
        const lines = text.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            // Highlight important information
            if (line.includes('PLAY [')) {
              console.log(`   🎭 ${line}`);
            } else if (line.includes('TASK [')) {
              console.log(`   🔧 ${line}`);
            } else if (line.includes('changed:')) {
              console.log(`   🔄 ${line}`);
            } else if (line.includes('ok:')) {
              console.log(`   ✅ ${line}`);
            } else if (line.includes('failed:') || line.includes('FAILED')) {
              console.log(`   ❌ ${line}`);
            } else if (line.includes('skipping:')) {
              console.log(`   ⏭️  ${line}`);
            } else {
              console.log(`   ${line}`);
            }
          }
        });
      });

      checkProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n   📊 Ansible Plan Summary: Configuration check completed');
          this.summarizeAnsiblePlan(output);
          resolve(true);
        } else {
          console.log('\n   ❌ Ansible check failed');
          if (errorOutput) {
            console.log('   📋 Error details:');
            errorOutput.split('\n').slice(0, 10).forEach(line => {
              if (line.trim()) console.log(`      ${line}`);
            });
          }
          resolve(false);
        }
      });

      checkProcess.on('error', (error) => {
        console.log('   ❌ Failed to run ansible-playbook check');
        console.log(`   💡 Error: ${error.message}`);
        console.log('   💡 Ensure Ansible is installed and in your PATH');
        resolve(false);
      });
    });
  }

  private summarizeTerraformPlan(output: string): void {
    const lines = output.split('\n');
    const planLine = lines.find(line => line.includes('Plan:'));
    
    if (planLine) {
      // Extract numbers from plan line (e.g., "Plan: 3 to add, 0 to change, 1 to destroy.")
      const addMatch = planLine.match(/(\d+)\s+to\s+add/);
      const changeMatch = planLine.match(/(\d+)\s+to\s+change/);
      const destroyMatch = planLine.match(/(\d+)\s+to\s+destroy/);
      
      const toAdd = addMatch ? parseInt(addMatch[1]) : 0;
      const toChange = changeMatch ? parseInt(changeMatch[1]) : 0;
      const toDestroy = destroyMatch ? parseInt(destroyMatch[1]) : 0;
      
      console.log('\n   📊 Terraform Plan Summary:');
      console.log(`      ➕ Resources to add: ${toAdd}`);
      console.log(`      🔄 Resources to change: ${toChange}`);
      console.log(`      ➖ Resources to destroy: ${toDestroy}`);
      
      if (toAdd === 0 && toChange === 0 && toDestroy === 0) {
        console.log('      ✅ No changes needed - infrastructure is up to date');
      } else {
        console.log(`      📈 Total changes planned: ${toAdd + toChange + toDestroy}`);
      }
    }
    
    // Look for resource types being modified
    const resourceTypes = new Set<string>();
    lines.forEach(line => {
      const match = line.match(/[+~-]\s+(\w+\.\w+)/);
      if (match) {
        const resourceType = match[1].split('.')[0];
        resourceTypes.add(resourceType);
      }
    });
    
    if (resourceTypes.size > 0) {
      console.log(`      🏷️  Resource types affected: ${Array.from(resourceTypes).join(', ')}`);
    }
  }

  private summarizeAnsiblePlan(output: string): void {
    const lines = output.split('\n');
    
    // Count different types of results
    let changedCount = 0;
    let okCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    lines.forEach(line => {
      if (line.includes('changed:')) changedCount++;
      if (line.includes('ok:')) okCount++;
      if (line.includes('skipping:')) skippedCount++;
      if (line.includes('failed:')) failedCount++;
    });
    
    console.log('\n   📊 Ansible Plan Summary:');
    console.log(`      🔄 Tasks that would change: ${changedCount}`);
    console.log(`      ✅ Tasks already correct: ${okCount}`);
    console.log(`      ⏭️  Tasks skipped: ${skippedCount}`);
    if (failedCount > 0) {
      console.log(`      ❌ Tasks with issues: ${failedCount}`);
    }
    
    if (changedCount === 0 && failedCount === 0) {
      console.log('      ✅ No configuration changes needed');
    } else if (changedCount > 0) {
      console.log(`      📈 Configuration changes would be applied: ${changedCount} tasks`);
    }
    
    // Look for plays that ran
    const plays = lines.filter(line => line.includes('PLAY [')).length;
    if (plays > 0) {
      console.log(`      🎭 Plays executed: ${plays}`);
    }
  }
}

interface PlanOptions {
  all: boolean;
  terraformOnly: boolean;
  ansibleOnly: boolean;
  detailed: boolean;
  json: boolean;
}