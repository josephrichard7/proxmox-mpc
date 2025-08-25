/**
 * Apply Command
 * Deploys infrastructure changes using Terraform and Ansible internally
 */

import { spawn } from 'child_process';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import { errorHandler } from '../error-handler';
import { ConsoleSession } from '../repl';

export class ApplyCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('🚀 Applying infrastructure changes...\n');

    // Check if we're in a workspace
    if (!errorHandler.validateSession(session, 'apply')) {
      return;
    }

    const workspaceRoot = session.workspace!.rootPath;
    const terraformDir = path.join(workspaceRoot, 'terraform');
    const ansibleDir = path.join(workspaceRoot, 'ansible');

    try {
      // Parse command arguments
      const options = this.parseArguments(args);
      
      // Pre-deployment validation
      console.log('🔍 Phase 1: Pre-deployment validation...');
      const validationPassed = await this.runPreDeploymentValidation(workspaceRoot);
      if (!validationPassed && !options.force) {
        console.log('❌ Validation failed. Use --force to override (not recommended)');
        return;
      }

      // Terraform deployment
      if (options.terraformOnly || options.all) {
        console.log('\n🏗️  Phase 2: Deploying Terraform infrastructure...');
        const terraformSuccess = await this.deployTerraform(terraformDir, session, options);
        if (!terraformSuccess && !options.continueOnError) {
          console.log('❌ Terraform deployment failed. Stopping deployment.');
          return;
        }
      }

      // Ansible deployment  
      if (options.ansibleOnly || options.all) {
        console.log('\n🎵 Phase 3: Applying Ansible configuration...');
        const ansibleSuccess = await this.deployAnsible(ansibleDir, session, options);
        if (!ansibleSuccess && !options.continueOnError) {
          console.log('❌ Ansible deployment failed.');
          return;
        }
      }

      // Post-deployment verification
      console.log('\n✅ Phase 4: Post-deployment verification...');
      await this.runPostDeploymentVerification(session);

      errorHandler.showSuccess(
        'Infrastructure deployment completed successfully!',
        [
          '📊 Next steps:',
          '• Use /status to verify deployed infrastructure',
          '• Use /sync to update local state',
          '• Monitor your Proxmox server for the changes'
        ]
      );

    } catch (error) {
      errorHandler.handleError({
        code: 'APPLY_FAILED',
        message: 'Apply operation failed',
        severity: 'high',
        originalError: error as Error,
        context: {
          command: 'apply',
          operation: 'infrastructure_deployment',
          workspace: session.workspace?.name,
          suggestions: [
            'Check the detailed error output above',
            'Verify your Proxmox server connectivity',
            'Use /validate to check configurations before applying',
            'Review Terraform and Ansible logs for specific issues'
          ]
        }
      });
    }
  }

  private parseArguments(args: string[]): ApplyOptions {
    const options: ApplyOptions = {
      all: true,
      terraformOnly: false,
      ansibleOnly: false,
      dryRun: false,
      force: false,
      continueOnError: false,
      autoApprove: false
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
        case '--dry-run':
        case '-n':
          options.dryRun = true;
          break;
        case '--force':
        case '-f':
          options.force = true;
          break;
        case '--continue-on-error':
          options.continueOnError = true;
          break;
        case '--auto-approve':
        case '-y':
          options.autoApprove = true;
          break;
      }
    }

    return options;
  }

  private async runPreDeploymentValidation(workspaceRoot: string): Promise<boolean> {
    console.log('   🔍 Running pre-deployment checks...');
    
    // Check if Terraform configurations exist
    const terraformDir = path.join(workspaceRoot, 'terraform');
    if (!fsSync.existsSync(terraformDir)) {
      console.log('   ❌ No Terraform configurations found. Run /sync first.');
      return false;
    }

    // Check if Ansible configurations exist
    const ansibleDir = path.join(workspaceRoot, 'ansible');
    if (!fsSync.existsSync(ansibleDir)) {
      console.log('   ❌ No Ansible configurations found. Run /sync first.');
      return false;
    }

    // Validate Terraform syntax
    const terraformValid = await this.validateTerraformSyntax(terraformDir);
    if (!terraformValid) {
      console.log('   ❌ Terraform syntax validation failed');
      return false;
    }

    // Validate Ansible syntax
    const ansibleValid = await this.validateAnsibleSyntax(ansibleDir);
    if (!ansibleValid) {
      console.log('   ❌ Ansible syntax validation failed');
      return false;
    }

    console.log('   ✅ Pre-deployment validation passed');
    return true;
  }

  private async deployTerraform(terraformDir: string, session: ConsoleSession, options: ApplyOptions): Promise<boolean> {
    if (!fsSync.existsSync(terraformDir)) {
      console.log('   ⚠️  No Terraform directory found, skipping Terraform deployment');
      return true;
    }

    try {
      console.log('   📋 Initializing Terraform...');
      const initSuccess = await this.runTerraformInit(terraformDir);
      if (!initSuccess) {
        console.log('   ❌ Terraform initialization failed');
        return false;
      }

      console.log('   📊 Generating Terraform plan...');
      const planPath = path.join(terraformDir, 'deployment.tfplan');
      const planSuccess = await this.runTerraformPlan(terraformDir, planPath, session);
      if (!planSuccess) {
        console.log('   ❌ Terraform plan generation failed');
        return false;
      }

      if (options.dryRun) {
        console.log('   🏃 Dry run mode - stopping before apply');
        return true;
      }

      // Show plan and ask for confirmation unless auto-approved
      if (!options.autoApprove) {
        const shouldApply = await this.confirmTerraformApply(terraformDir);
        if (!shouldApply) {
          console.log('   🛑 Terraform deployment cancelled by user');
          return false;
        }
      }

      console.log('   🚀 Applying Terraform changes...');
      const applySuccess = await this.runTerraformApply(terraformDir, planPath);
      if (!applySuccess) {
        console.log('   ❌ Terraform apply failed');
        return false;
      }

      console.log('   ✅ Terraform deployment completed successfully');
      return true;

    } catch (error) {
      console.log(`   ❌ Terraform deployment error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async deployAnsible(ansibleDir: string, session: ConsoleSession, options: ApplyOptions): Promise<boolean> {
    if (!fsSync.existsSync(ansibleDir)) {
      console.log('   ⚠️  No Ansible directory found, skipping Ansible deployment');
      return true;
    }

    try {
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const playbookPath = path.join(ansibleDir, 'playbooks', 'site.yml');

      // Check if required files exist
      if (!fsSync.existsSync(inventoryPath)) {
        console.log('   ❌ Ansible inventory not found');
        return false;
      }
      if (!fsSync.existsSync(playbookPath)) {
        console.log('   ❌ Ansible site playbook not found');
        return false;
      }

      if (options.dryRun) {
        console.log('   📋 Running Ansible dry-run (check mode)...');
        const checkSuccess = await this.runAnsibleCheck(ansibleDir, inventoryPath, playbookPath);
        if (!checkSuccess) {
          console.log('   ❌ Ansible dry-run failed');
          return false;
        }
        console.log('   🏃 Dry run mode - stopping before actual execution');
        return true;
      }

      // Show what will be executed and ask for confirmation unless auto-approved
      if (!options.autoApprove) {
        const shouldApply = await this.confirmAnsibleApply(ansibleDir, inventoryPath, playbookPath);
        if (!shouldApply) {
          console.log('   🛑 Ansible deployment cancelled by user');
          return false;
        }
      }

      console.log('   🎵 Running Ansible playbook...');
      const playbookSuccess = await this.runAnsiblePlaybook(ansibleDir, inventoryPath, playbookPath);
      if (!playbookSuccess) {
        console.log('   ❌ Ansible playbook execution failed');
        return false;
      }

      console.log('   ✅ Ansible deployment completed successfully');
      return true;

    } catch (error) {
      console.log(`   ❌ Ansible deployment error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async runTerraformInit(terraformDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const initProcess = spawn('terraform', ['init'], {
        cwd: terraformDir,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      initProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      initProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      initProcess.on('close', (code) => {
        if (code === 0) {
          console.log('     ✅ Terraform initialized successfully');
          resolve(true);
        } else {
          console.log('     ❌ Terraform init failed');
          if (errorOutput) {
            console.log('     📋 Error details:');
            errorOutput.split('\n').slice(0, 5).forEach(line => {
              if (line.trim()) console.log(`        ${line}`);
            });
          }
          resolve(false);
        }
      });

      initProcess.on('error', (error) => {
        errorHandler.handleProcessError(
          'apply',
          'terraform init',
          -1,
          error.message,
          [
            'Ensure Terraform is installed and in your PATH',
            'Check Terraform installation with: terraform version'
          ]
        );
        resolve(false);
      });
    });
  }

  private async runTerraformPlan(terraformDir: string, planPath: string, session: ConsoleSession): Promise<boolean> {
    return new Promise((resolve) => {
      const planArgs = [
        'plan',
        `-out=${planPath}`,
        `-var=proxmox_token_id=${session.workspace?.config.tokenId || ''}`,
        `-var=proxmox_token_secret=${session.workspace?.config.tokenSecret || ''}`,
        `-var=default_node=${session.workspace?.config.node || ''}`
      ];

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
        // Show real-time output for plan
        process.stdout.write(`     ${text}`);
      });

      planProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      planProcess.on('close', (code) => {
        if (code === 0) {
          console.log('     ✅ Terraform plan generated successfully');
          resolve(true);
        } else {
          console.log('     ❌ Terraform plan failed');
          if (errorOutput) {
            console.log('     📋 Error details:');
            errorOutput.split('\n').slice(0, 10).forEach(line => {
              if (line.trim()) console.log(`        ${line}`);
            });
          }
          resolve(false);
        }
      });

      planProcess.on('error', (error) => {
        errorHandler.handleProcessError(
          'apply', 
          'terraform plan',
          -1,
          error.message,
          ['Check Terraform configuration and connectivity to Proxmox']
        );
        resolve(false);
      });
    });
  }

  private async runTerraformApply(terraformDir: string, planPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const applyProcess = spawn('terraform', ['apply', planPath], {
        cwd: terraformDir,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      applyProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Show real-time output for apply
        process.stdout.write(`     ${text}`);
      });

      applyProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      applyProcess.on('close', (code) => {
        if (code === 0) {
          console.log('     ✅ Terraform apply completed successfully');
          resolve(true);
        } else {
          console.log('     ❌ Terraform apply failed');
          if (errorOutput) {
            console.log('     📋 Error details:');
            errorOutput.split('\n').slice(0, 10).forEach(line => {
              if (line.trim()) console.log(`        ${line}`);
            });
          }
          resolve(false);
        }
      });

      applyProcess.on('error', (error) => {
        console.log('     ❌ Failed to run terraform apply');
        console.log(`     💡 Error: ${error.message}`);
        resolve(false);
      });
    });
  }

  private async runAnsibleCheck(ansibleDir: string, inventoryPath: string, playbookPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checkProcess = spawn('ansible-playbook', [
        '-i', inventoryPath,
        playbookPath,
        '--check',
        '--diff'
      ], {
        cwd: ansibleDir,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      checkProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Show real-time output for check
        process.stdout.write(`     ${text}`);
      });

      checkProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          console.log('     ✅ Ansible check completed successfully');
          resolve(true);
        } else {
          console.log('     ❌ Ansible check failed');
          if (errorOutput) {
            console.log('     📋 Error details:');
            errorOutput.split('\n').slice(0, 10).forEach(line => {
              if (line.trim()) console.log(`        ${line}`);
            });
          }
          resolve(false);
        }
      });

      checkProcess.on('error', (error) => {
        console.log('     ❌ Failed to run ansible-playbook check');
        console.log(`     💡 Error: ${error.message}`);
        console.log('     💡 Ensure Ansible is installed and in your PATH');
        resolve(false);
      });
    });
  }

  private async runAnsiblePlaybook(ansibleDir: string, inventoryPath: string, playbookPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const playbookProcess = spawn('ansible-playbook', [
        '-i', inventoryPath,
        playbookPath,
      ], {
        cwd: ansibleDir,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      playbookProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Show real-time output for playbook execution
        process.stdout.write(`     ${text}`);
      });

      playbookProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      playbookProcess.on('close', (code) => {
        if (code === 0) {
          console.log('     ✅ Ansible playbook executed successfully');
          resolve(true);
        } else {
          console.log('     ❌ Ansible playbook execution failed');
          if (errorOutput) {
            console.log('     📋 Error details:');
            errorOutput.split('\n').slice(0, 10).forEach(line => {
              if (line.trim()) console.log(`        ${line}`);
            });
          }
          resolve(false);
        }
      });

      playbookProcess.on('error', (error) => {
        console.log('     ❌ Failed to run ansible-playbook');
        console.log(`     💡 Error: ${error.message}`);
        resolve(false);
      });
    });
  }

  private async confirmTerraformApply(terraformDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n     📋 Terraform plan has been generated.');
      console.log('        Review the plan above carefully.');
      
      rl.question('     ❓ Do you want to apply these Terraform changes? (yes/no): ', (answer: string) => {
        rl.close();
        const confirmed = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        resolve(confirmed);
      });
    });
  }

  private async confirmAnsibleApply(ansibleDir: string, inventoryPath: string, playbookPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n     📋 Ansible playbook will be executed with:');
      console.log(`        Inventory: ${path.basename(inventoryPath)}`);
      console.log(`        Playbook: ${path.basename(playbookPath)}`);
      
      rl.question('     ❓ Do you want to run the Ansible playbook? (yes/no): ', (answer: string) => {
        rl.close();
        const confirmed = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        resolve(confirmed);
      });
    });
  }

  private async validateTerraformSyntax(terraformDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const validateProcess = spawn('terraform', ['validate'], {
        cwd: terraformDir,
        stdio: 'pipe'
      });

      validateProcess.on('close', (code) => {
        resolve(code === 0);
      });

      validateProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  private async validateAnsibleSyntax(ansibleDir: string): Promise<boolean> {
    const playbookPath = path.join(ansibleDir, 'playbooks', 'site.yml');
    if (!fsSync.existsSync(playbookPath)) {
      return true; // No playbook to validate
    }

    return new Promise((resolve) => {
      const validateProcess = spawn('ansible-playbook', [
        playbookPath,
        '--syntax-check'
      ], {
        cwd: ansibleDir,
        stdio: 'pipe'
      });

      validateProcess.on('close', (code) => {
        resolve(code === 0);
      });

      validateProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  private async runPostDeploymentVerification(session: ConsoleSession): Promise<void> {
    console.log('   🔍 Verifying deployment...');
    
    try {
      // Reconnect to Proxmox and verify resources
      if (session.client) {
        const nodes = await session.client.getNodes();
        console.log(`   📊 Verified connection to ${nodes.length} Proxmox node(s)`);
        
        let totalVMs = 0;
        let totalContainers = 0;
        
        for (const node of nodes) {
          const vms = await session.client.getVMs(node.node);
          const containers = await session.client.getContainers(node.node);
          totalVMs += vms.length;
          totalContainers += containers.length;
        }
        
        console.log(`   📊 Found ${totalVMs} VMs and ${totalContainers} containers`);
        console.log('   ✅ Post-deployment verification completed');
      }
    } catch (error) {
      console.log('   ⚠️  Could not verify deployment with Proxmox server');
      console.log(`   💡 Check server connectivity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

interface ApplyOptions {
  all: boolean;
  terraformOnly: boolean;
  ansibleOnly: boolean;
  dryRun: boolean;
  force: boolean;
  continueOnError: boolean;
  autoApprove: boolean;
}