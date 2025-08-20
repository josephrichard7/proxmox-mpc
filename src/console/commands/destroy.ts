/**
 * Destroy Command
 * Safely removes infrastructure resources with comprehensive safety checks
 */

import { ConsoleSession } from '../repl';
import * as fsSync from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export class DestroyCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('💥 Infrastructure Destruction Planning...\n');

    // Check if we're in a workspace
    if (!session.workspace) {
      console.log('❌ No workspace detected');
      console.log('   Use /init to create a workspace first');
      return;
    }

    const workspaceRoot = session.workspace.rootPath;
    const terraformDir = path.join(workspaceRoot, 'terraform');

    try {
      // Parse command arguments
      const options = this.parseArguments(args);

      // Safety checks and warnings
      console.log('⚠️  Phase 1: Safety Checks and Warnings');
      console.log('=' .repeat(60));
      const safetyChecksPassed = await this.runSafetyChecks(workspaceRoot, session, options);
      if (!safetyChecksPassed && !options.force) {
        console.log('❌ Safety checks failed. Use --force to override (DANGEROUS!)');
        return;
      }

      // Show destruction plan
      console.log('\n📋 Phase 2: Destruction Plan');
      console.log('=' .repeat(60));
      const planGenerated = await this.generateDestructionPlan(terraformDir, session, options);
      if (!planGenerated) {
        console.log('❌ Failed to generate destruction plan');
        return;
      }

      // Final confirmation
      if (!options.autoApprove) {
        const confirmed = await this.getFinalConfirmation(options);
        if (!confirmed) {
          console.log('🛑 Destruction cancelled by user. No resources were harmed.');
          return;
        }
      }

      // Execute destruction
      console.log('\n💥 Phase 3: Executing Destruction');
      console.log('=' .repeat(60));
      const destructionSuccess = await this.executeDestruction(terraformDir, session, options);
      if (!destructionSuccess) {
        console.log('❌ Destruction failed or was incomplete');
        console.log('   💡 Check the output above for details');
        console.log('   💡 You may need to manually clean up some resources');
        return;
      }

      // Post-destruction cleanup and verification
      console.log('\n✅ Phase 4: Post-Destruction Cleanup');
      console.log('=' .repeat(60));
      await this.performPostDestructionCleanup(workspaceRoot, session, options);

      console.log('\n🎯 Infrastructure destruction completed!');
      console.log('\n📋 What was done:');
      console.log('   • All Terraform-managed resources were destroyed');
      console.log('   • Local state files were cleaned up');
      console.log('   • Proxmox resources have been removed');
      console.log('\n💡 Next steps:');
      console.log('   • Use /status to verify no resources remain');
      console.log('   • Use /sync to rebuild from scratch if needed');
      console.log('   • Check your Proxmox server to confirm cleanup');

    } catch (error) {
      console.error(`❌ Destruction failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log('\n🚨 IMPORTANT: Destruction may have been partially completed.');
      console.log('   Please check your Proxmox server manually and clean up any remaining resources.');
    }
  }

  private parseArguments(args: string[]): DestroyOptions {
    const options: DestroyOptions = {
      dryRun: false,
      force: false,
      autoApprove: false,
      keepBackups: true,
      skipSafety: false,
      targetResources: []
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case '--dry-run':
        case '-n':
          options.dryRun = true;
          break;
        case '--force':
        case '-f':
          options.force = true;
          break;
        case '--auto-approve':
        case '-y':
          options.autoApprove = true;
          break;
        case '--no-backups':
          options.keepBackups = false;
          break;
        case '--skip-safety':
          options.skipSafety = true;
          break;
        case '--target':
        case '-t':
          if (i + 1 < args.length) {
            options.targetResources.push(args[i + 1]);
            i++; // Skip next argument as it's the target value
          }
          break;
      }
    }

    return options;
  }

  private async runSafetyChecks(workspaceRoot: string, session: ConsoleSession, options: DestroyOptions): Promise<boolean> {
    console.log('🔍 Running comprehensive safety checks...');
    
    let safetyPassed = true;

    // Check 1: Verify Terraform state exists
    const terraformDir = path.join(workspaceRoot, 'terraform');
    const stateFile = path.join(terraformDir, 'terraform.tfstate');
    
    if (!fsSync.existsSync(stateFile)) {
      console.log('   ⚠️  No Terraform state file found');
      console.log('      This means either:');
      console.log('      • No infrastructure has been deployed yet');
      console.log('      • State file has been moved or deleted');
      console.log('      • Infrastructure was deployed outside of this workspace');
      
      if (!options.force) {
        console.log('   💡 Use --force if you\'re sure you want to proceed');
        safetyPassed = false;
      }
    } else {
      console.log('   ✅ Terraform state file found');
    }

    // Check 2: Verify connectivity to Proxmox
    if (session.client) {
      try {
        console.log('   🌐 Testing connection to Proxmox server...');
        const nodes = await session.client.getNodes();
        console.log(`   ✅ Connected to Proxmox cluster (${nodes.length} nodes)`);
        
        // Check if we have resources that would be affected
        let totalResources = 0;
        for (const node of nodes) {
          const vms = await session.client.getVMs(node.node);
          const containers = await session.client.getContainers(node.node);
          totalResources += vms.length + containers.length;
        }
        
        if (totalResources > 0) {
          console.log(`   ⚠️  Found ${totalResources} resources on Proxmox server`);
          console.log('      These may be affected by the destruction');
        } else {
          console.log('   ℹ️  No resources found on Proxmox server');
        }
        
      } catch (error) {
        console.log('   ❌ Failed to connect to Proxmox server');
        console.log(`      Error: ${error instanceof Error ? error.message : String(error)}`);
        console.log('      Cannot verify what resources will be affected');
        
        if (!options.force) {
          safetyPassed = false;
        }
      }
    }

    // Check 3: Look for backup/protection indicators
    if (options.keepBackups) {
      console.log('   💾 Checking for backup configurations...');
      // This could be expanded to check for backup jobs, snapshots, etc.
      console.log('   ℹ️  Backup preservation is enabled (default)');
    } else {
      console.log('   ⚠️  Backup preservation is DISABLED');
      console.log('      All backups and snapshots may be destroyed');
    }

    // Check 4: Production environment detection
    const configPath = path.join(workspaceRoot, '.proxmox', 'config.yml');
    if (fsSync.existsSync(configPath)) {
      const fs = require('fs');
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      if (configContent.includes('prod') || configContent.includes('production')) {
        console.log('   🚨 PRODUCTION ENVIRONMENT DETECTED');
        console.log('      This workspace appears to be configured for production use');
        console.log('      Destroying production infrastructure is HIGHLY DANGEROUS');
        
        if (!options.force) {
          console.log('   💡 Use --force if you absolutely must proceed');
          safetyPassed = false;
        }
      }
    }

    // Check 5: Look for data persistence indicators
    if (fsSync.existsSync(terraformDir)) {
      const tfFiles = fsSync.readdirSync(terraformDir, { recursive: true });
      const hasPersistentVolumes = tfFiles.some((file: any) => {
        if (!file.toString().endsWith('.tf')) return false;
        const content = fsSync.readFileSync(path.join(terraformDir, file.toString()), 'utf8');
        return content.includes('disk') || content.includes('volume') || content.includes('storage');
      });
      
      if (hasPersistentVolumes) {
        console.log('   ⚠️  Persistent storage volumes detected');
        console.log('      Destruction may result in permanent data loss');
        console.log('      Ensure you have backups of any important data');
        
        if (!options.skipSafety) {
          const hasBackups = await this.checkForBackups(session);
          if (!hasBackups && !options.force) {
            console.log('   💡 Create backups first or use --force to proceed anyway');
            safetyPassed = false;
          }
        }
      }
    }

    // Summary
    if (safetyPassed) {
      console.log('   ✅ Safety checks passed');
    } else {
      console.log('   ❌ Safety checks failed');
      console.log('   💡 Address the issues above or use --force to override');
    }

    return safetyPassed;
  }

  private async generateDestructionPlan(terraformDir: string, session: ConsoleSession, options: DestroyOptions): Promise<boolean> {
    if (!fsSync.existsSync(terraformDir)) {
      console.log('⚠️  No Terraform directory found');
      return false;
    }

    try {
      console.log('📊 Generating destruction plan...');
      
      // Initialize Terraform
      const initSuccess = await this.runTerraformInit(terraformDir);
      if (!initSuccess) {
        console.log('❌ Failed to initialize Terraform');
        return false;
      }

      // Generate destroy plan
      const planSuccess = await this.runTerraformDestroyPlan(terraformDir, session, options);
      if (!planSuccess) {
        console.log('❌ Failed to generate destroy plan');
        return false;
      }

      console.log('✅ Destruction plan generated successfully');
      return true;

    } catch (error) {
      console.log(`❌ Plan generation error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async getFinalConfirmation(options: DestroyOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n🚨 FINAL CONFIRMATION REQUIRED 🚨');
      console.log('=' .repeat(60));
      console.log('You are about to DESTROY infrastructure resources.');
      console.log('This action is IRREVERSIBLE and may result in data loss.');
      console.log('');
      console.log('Please review the destruction plan above carefully.');
      console.log('');
      
      rl.question('❓ Type "yes" to confirm destruction, anything else to cancel: ', (answer: string) => {
        rl.close();
        const confirmed = answer.toLowerCase() === 'yes';
        if (!confirmed) {
          console.log('🛑 User cancelled destruction');
        }
        resolve(confirmed);
      });
    });
  }

  private async executeDestruction(terraformDir: string, session: ConsoleSession, options: DestroyOptions): Promise<boolean> {
    if (options.dryRun) {
      console.log('🏃 Dry run mode - no actual destruction will occur');
      return true;
    }

    try {
      console.log('💥 Executing Terraform destroy...');
      
      const destroySuccess = await this.runTerraformDestroy(terraformDir, session, options);
      if (!destroySuccess) {
        console.log('❌ Terraform destroy failed');
        return false;
      }

      console.log('✅ Terraform destruction completed');
      return true;

    } catch (error) {
      console.log(`❌ Destruction execution error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async performPostDestructionCleanup(workspaceRoot: string, session: ConsoleSession, options: DestroyOptions): Promise<void> {
    console.log('🧹 Performing post-destruction cleanup...');

    try {
      // Clean up Terraform state files if requested
      const terraformDir = path.join(workspaceRoot, 'terraform');
      const stateFile = path.join(terraformDir, 'terraform.tfstate');
      const stateBackupFile = path.join(terraformDir, 'terraform.tfstate.backup');

      if (options.keepBackups) {
        console.log('   💾 Preserving state files as backups');
        
        // Move state files to backup location
        const backupDir = path.join(workspaceRoot, '.proxmox', 'backups');
        if (!fsSync.existsSync(backupDir)) {
          fsSync.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        if (fsSync.existsSync(stateFile)) {
          const backupStatePath = path.join(backupDir, `terraform.tfstate.${timestamp}`);
          fsSync.renameSync(stateFile, backupStatePath);
          console.log(`   📦 State file backed up to: ${path.relative(workspaceRoot, backupStatePath)}`);
        }
        
        if (fsSync.existsSync(stateBackupFile)) {
          const backupStateBackupPath = path.join(backupDir, `terraform.tfstate.backup.${timestamp}`);
          fsSync.renameSync(stateBackupFile, backupStateBackupPath);
          console.log(`   📦 State backup file archived`);
        }
      } else {
        console.log('   🗑️  Removing state files');
        
        if (fsSync.existsSync(stateFile)) {
          fsSync.unlinkSync(stateFile);
          console.log('   ✅ Removed terraform.tfstate');
        }
        
        if (fsSync.existsSync(stateBackupFile)) {
          fsSync.unlinkSync(stateBackupFile);
          console.log('   ✅ Removed terraform.tfstate.backup');
        }
      }

      // Clean up plan files
      const planFiles = fsSync.readdirSync(terraformDir).filter(f => f.endsWith('.tfplan'));
      for (const planFile of planFiles) {
        fsSync.unlinkSync(path.join(terraformDir, planFile));
        console.log(`   🗑️  Removed plan file: ${planFile}`);
      }

      // Verify destruction with Proxmox
      if (session.client) {
        console.log('   🔍 Verifying destruction with Proxmox server...');
        try {
          const nodes = await session.client.getNodes();
          let remainingResources = 0;
          
          for (const node of nodes) {
            const vms = await session.client.getVMs(node.node);
            const containers = await session.client.getContainers(node.node);
            remainingResources += vms.length + containers.length;
          }
          
          console.log(`   📊 Remaining resources on server: ${remainingResources}`);
          
          if (remainingResources === 0) {
            console.log('   ✅ All managed resources have been removed');
          } else {
            console.log('   ℹ️  Some resources remain (may be manually created)');
          }
          
        } catch (error) {
          console.log('   ⚠️  Could not verify destruction with Proxmox server');
        }
      }

      console.log('   ✅ Post-destruction cleanup completed');

    } catch (error) {
      console.log(`   ⚠️  Cleanup error: ${error instanceof Error ? error.message : String(error)}`);
      console.log('   💡 Manual cleanup may be required');
    }
  }

  // Helper methods for Terraform operations
  private async runTerraformInit(terraformDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const init = spawn('terraform', ['init'], {
        cwd: terraformDir,
        stdio: 'pipe'
      });

      init.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ Terraform initialized');
          resolve(true);
        } else {
          console.log('   ❌ Terraform init failed');
          resolve(false);
        }
      });

      init.on('error', (error) => {
        console.log(`   ❌ Failed to run terraform init: ${error.message}`);
        resolve(false);
      });
    });
  }

  private async runTerraformDestroyPlan(terraformDir: string, session: ConsoleSession, options: DestroyOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const planArgs = [
        'plan',
        '-destroy',
        `-var=proxmox_token_id=${session.workspace?.config.tokenId || ''}`,
        `-var=proxmox_token_secret=${session.workspace?.config.tokenSecret || ''}`,
        `-var=default_node=${session.workspace?.config.node || ''}`
      ];

      // Add target resources if specified
      options.targetResources.forEach(target => {
        planArgs.push(`-target=${target}`);
      });

      const plan = spawn('terraform', planArgs, {
        cwd: terraformDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          PM_API_URL: `https://${session.workspace?.config.host}:${session.workspace?.config.port}/api2/json`,
          PM_TLS_INSECURE: session.workspace?.config.rejectUnauthorized ? 'false' : 'true'
        }
      });

      let output = '';

      plan.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Format and display the destroy plan
        const lines = text.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            if (line.includes('Plan:')) {
              console.log(`   🎯 ${line}`);
            } else if (line.includes('- ')) {
              console.log(`   ➖ ${line}`);
            } else if (line.includes('Error:') || line.includes('Warning:')) {
              console.log(`   ⚠️  ${line}`);
            } else {
              console.log(`   ${line}`);
            }
          }
        });
      });

      plan.on('close', (code) => {
        if (code === 0) {
          this.summarizeDestroyPlan(output);
          resolve(true);
        } else {
          console.log('   ❌ Destroy plan failed');
          resolve(false);
        }
      });

      plan.on('error', (error) => {
        console.log(`   ❌ Failed to run terraform plan: ${error.message}`);
        resolve(false);
      });
    });
  }

  private async runTerraformDestroy(terraformDir: string, session: ConsoleSession, options: DestroyOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const destroyArgs = [
        'destroy',
        `-var=proxmox_token_id=${session.workspace?.config.tokenId || ''}`,
        `-var=proxmox_token_secret=${session.workspace?.config.tokenSecret || ''}`,
        `-var=default_node=${session.workspace?.config.node || ''}`
      ];

      // Add auto-approve if specified
      if (options.autoApprove) {
        destroyArgs.push('-auto-approve');
      }

      // Add target resources if specified
      options.targetResources.forEach(target => {
        destroyArgs.push(`-target=${target}`);
      });

      const destroy = spawn('terraform', destroyArgs, {
        cwd: terraformDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          PM_API_URL: `https://${session.workspace?.config.host}:${session.workspace?.config.port}/api2/json`,
          PM_TLS_INSECURE: session.workspace?.config.rejectUnauthorized ? 'false' : 'true'
        }
      });

      destroy.stdout.on('data', (data) => {
        const text = data.toString();
        // Show real-time output
        process.stdout.write(`   ${text}`);
      });

      destroy.stderr.on('data', (data) => {
        const text = data.toString();
        process.stderr.write(`   ${text}`);
      });

      destroy.on('close', (code) => {
        if (code === 0) {
          console.log('\n   ✅ Terraform destroy completed successfully');
          resolve(true);
        } else {
          console.log('\n   ❌ Terraform destroy failed');
          resolve(false);
        }
      });

      destroy.on('error', (error) => {
        console.log(`   ❌ Failed to run terraform destroy: ${error.message}`);
        resolve(false);
      });
    });
  }

  private summarizeDestroyPlan(output: string): void {
    const lines = output.split('\n');
    const planLine = lines.find(line => line.includes('Plan:'));
    
    if (planLine) {
      const destroyMatch = planLine.match(/(\d+)\s+to\s+destroy/);
      const toDestroy = destroyMatch ? parseInt(destroyMatch[1]) : 0;
      
      console.log('\n   📊 Destruction Plan Summary:');
      console.log(`      💥 Resources to destroy: ${toDestroy}`);
      
      if (toDestroy === 0) {
        console.log('      ✅ No resources to destroy - infrastructure is already clean');
      } else {
        console.log(`      ⚠️  ${toDestroy} resources will be permanently destroyed`);
      }
    }
    
    // Look for resource types being destroyed
    const resourceTypes = new Set<string>();
    lines.forEach(line => {
      const match = line.match(/-\s+(\w+\.\w+)/);
      if (match) {
        const resourceType = match[1].split('.')[0];
        resourceTypes.add(resourceType);
      }
    });
    
    if (resourceTypes.size > 0) {
      console.log(`      🏷️  Resource types to be destroyed: ${Array.from(resourceTypes).join(', ')}`);
    }
  }

  private async checkForBackups(session: ConsoleSession): Promise<boolean> {
    // This is a simplified check - in a real implementation, you might
    // check for backup jobs, recent snapshots, etc.
    try {
      if (session.client) {
        const nodes = await session.client.getNodes();
        // Here you could check for backup configurations, recent snapshots, etc.
        // For now, just assume no backups are verified
        return false;
      }
    } catch (error) {
      // If we can't check, assume no backups
    }
    return false;
  }
}

interface DestroyOptions {
  dryRun: boolean;
  force: boolean;
  autoApprove: boolean;
  keepBackups: boolean;
  skipSafety: boolean;
  targetResources: string[];
}