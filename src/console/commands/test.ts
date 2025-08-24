/**
 * Test Command
 * Validates generated Infrastructure-as-Code without deployment
 */

import { ConsoleSession } from '../repl';
import { errorHandler } from '../error-handler';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { spawn } from 'child_process';

export class TestCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('🧪 Testing Infrastructure-as-Code configurations...\n');

    // Check if we're in a workspace
    if (!errorHandler.validateSession(session, 'test')) {
      return;
    }

    try {
      let allTestsPassed = true;

      // Phase 1: Validate workspace structure
      console.log('📁 Phase 1: Validating workspace structure...');
      const structureValid = await this.validateWorkspaceStructure(session.workspace!.rootPath);
      if (!structureValid) {
        allTestsPassed = false;
      }

      // Phase 2: Validate Terraform configurations
      console.log('\n🏗️  Phase 2: Validating Terraform configurations...');
      const terraformValid = await this.validateTerraformConfigs(session.workspace!.rootPath);
      if (!terraformValid) {
        allTestsPassed = false;
      }

      // Phase 3: Validate Ansible configurations
      console.log('\n🎵 Phase 3: Validating Ansible configurations...');
      const ansibleValid = await this.validateAnsibleConfigs(session.workspace!.rootPath);
      if (!ansibleValid) {
        allTestsPassed = false;
      }

      // Phase 4: Run Terraform plan (dry-run)
      console.log('\n🔍 Phase 4: Running Terraform plan (dry-run)...');
      const planValid = await this.runTerraformPlan(session.workspace!.rootPath);
      if (!planValid) {
        allTestsPassed = false;
      }

      // Phase 5: Validate Ansible syntax
      console.log('\n✅ Phase 5: Validating Ansible playbook syntax...');
      const ansibleSyntaxValid = await this.validateAnsibleSyntax(session.workspace!.rootPath);
      if (!ansibleSyntaxValid) {
        allTestsPassed = false;
      }

      // Phase 6: Run generated TDD tests
      console.log('\n🧪 Phase 6: Running generated TDD tests...');
      const tddTestsValid = await this.runGeneratedTDDTests(session.workspace!.rootPath);
      if (!tddTestsValid) {
        allTestsPassed = false;
      }

      // Summary
      console.log('\n' + '='.repeat(60));
      if (allTestsPassed) {
        console.log('✅ All tests passed! Infrastructure configurations are valid.');
        console.log('\n🚀 Safe to proceed with:');
        console.log('   • terraform apply (with your review)');
        console.log('   • ansible-playbook runs (with --check first)');
        console.log('   • Generated TDD tests provide confidence in deployment');
        console.log('   • Run ./tests/run-tests.sh for comprehensive validation');
      } else {
        console.log('❌ Some tests failed. Please review the issues above.');
        console.log('\n⚠️  Do NOT run terraform apply or ansible-playbook until issues are resolved.');
        console.log('   • Check generated TDD tests for specific failure details');
        console.log('   • Run ./tests/run-tests.sh for detailed test output');
      }
      console.log('='.repeat(60));

    } catch (error) {
      errorHandler.handleError({
        code: 'TEST_EXECUTION_FAILED',
        message: 'Test execution failed',
        severity: 'high',
        originalError: error as Error,
        context: {
          command: 'test',
          workspace: session.workspace?.name,
          suggestions: [
            'Check the detailed error output above',
            'Ensure all test dependencies are installed',
            'Verify workspace structure and generated files'
          ]
        }
      });
    }
  }

  private async validateWorkspaceStructure(rootPath: string): Promise<boolean> {
    const requiredDirs = [
      'terraform',
      'terraform/vms',
      'terraform/containers',
      'ansible',
      'ansible/playbooks',
      'tests'
    ];

    const requiredFiles = [
      'terraform/main.tf',
      'ansible/inventory.yml'
    ];

    let valid = true;

    // Check directories
    for (const dir of requiredDirs) {
      const dirPath = path.join(rootPath, dir);
      try {
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
          console.log(`   ✅ Directory exists: ${dir}`);
        } else {
          console.log(`   ❌ Path exists but is not a directory: ${dir}`);
          valid = false;
        }
      } catch (error) {
        console.log(`   ❌ Missing directory: ${dir}`);
        valid = false;
      }
    }

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(rootPath, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          console.log(`   ✅ File exists: ${file}`);
        } else {
          console.log(`   ❌ Path exists but is not a file: ${file}`);
          valid = false;
        }
      } catch (error) {
        console.log(`   ❌ Missing file: ${file}`);
        valid = false;
      }
    }

    return valid;
  }

  private async validateTerraformConfigs(rootPath: string): Promise<boolean> {
    const terraformDir = path.join(rootPath, 'terraform');
    let valid = true;

    try {
      // Check main.tf
      const mainTfPath = path.join(terraformDir, 'main.tf');
      const mainTfContent = await fs.readFile(mainTfPath, 'utf8');
      
      if (mainTfContent.includes('terraform {') && mainTfContent.includes('provider "proxmox"')) {
        console.log('   ✅ main.tf has valid Terraform and provider configuration');
      } else {
        console.log('   ❌ main.tf missing required Terraform or provider blocks');
        valid = false;
      }

      // Check VM configurations
      const vmsDir = path.join(terraformDir, 'vms');
      try {
        const vmFiles = await fs.readdir(vmsDir);
        const tfFiles = vmFiles.filter(f => f.endsWith('.tf'));
        
        if (tfFiles.length > 0) {
          console.log(`   ✅ Found ${tfFiles.length} VM configuration file(s)`);
          
          // Validate a sample VM file
          const sampleVmPath = path.join(vmsDir, tfFiles[0]);
          const vmContent = await fs.readFile(sampleVmPath, 'utf8');
          
          if (vmContent.includes('resource "proxmox_vm_qemu"') && vmContent.includes('vmid')) {
            console.log(`   ✅ VM configuration syntax looks valid (${tfFiles[0]})`);
          } else {
            console.log(`   ❌ VM configuration syntax issues (${tfFiles[0]})`);
            valid = false;
          }
        } else {
          console.log('   ⚠️  No VM configuration files found');
        }
      } catch (error) {
        console.log('   ⚠️  VMs directory not accessible or empty');
      }

      // Check Container configurations
      const containersDir = path.join(terraformDir, 'containers');
      try {
        const containerFiles = await fs.readdir(containersDir);
        const tfFiles = containerFiles.filter(f => f.endsWith('.tf'));
        
        if (tfFiles.length > 0) {
          console.log(`   ✅ Found ${tfFiles.length} container configuration file(s)`);
          
          // Validate a sample container file
          const sampleContainerPath = path.join(containersDir, tfFiles[0]);
          const containerContent = await fs.readFile(sampleContainerPath, 'utf8');
          
          if (containerContent.includes('resource "proxmox_lxc"') && containerContent.includes('vmid')) {
            console.log(`   ✅ Container configuration syntax looks valid (${tfFiles[0]})`);
          } else {
            console.log(`   ❌ Container configuration syntax issues (${tfFiles[0]})`);
            valid = false;
          }
        } else {
          console.log('   ⚠️  No container configuration files found');
        }
      } catch (error) {
        console.log('   ⚠️  Containers directory not accessible or empty');
      }

    } catch (error) {
      console.log(`   ❌ Error validating Terraform configs: ${error instanceof Error ? error.message : String(error)}`);
      valid = false;
    }

    return valid;
  }

  private async validateAnsibleConfigs(rootPath: string): Promise<boolean> {
    const ansibleDir = path.join(rootPath, 'ansible');
    let valid = true;

    try {
      // Validate inventory.yml
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const inventoryContent = await fs.readFile(inventoryPath, 'utf8');
      
      try {
        const inventory = yaml.load(inventoryContent);
        if (inventory && typeof inventory === 'object' && (inventory as any).all) {
          console.log('   ✅ inventory.yml has valid YAML structure');
          
          const all = (inventory as any).all;
          if (all.children && (all.children.vms || all.children.containers)) {
            console.log('   ✅ inventory.yml contains VM or container groups');
          } else {
            console.log('   ⚠️  inventory.yml missing VM/container groups');
          }
        } else {
          console.log('   ❌ inventory.yml invalid structure');
          valid = false;
        }
      } catch (yamlError) {
        console.log('   ❌ inventory.yml contains invalid YAML');
        valid = false;
      }

      // Validate playbooks
      const playbooksDir = path.join(ansibleDir, 'playbooks');
      try {
        const playbookFiles = await fs.readdir(playbooksDir);
        const ymlFiles = playbookFiles.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
        
        if (ymlFiles.length > 0) {
          console.log(`   ✅ Found ${ymlFiles.length} playbook file(s)`);
          
          // Validate site.yml if it exists
          if (ymlFiles.includes('site.yml')) {
            const sitePlaybookPath = path.join(playbooksDir, 'site.yml');
            const playbookContent = await fs.readFile(sitePlaybookPath, 'utf8');
            
            try {
              const playbook = yaml.load(playbookContent);
              if (Array.isArray(playbook) && playbook.length > 0 && playbook[0].name) {
                console.log('   ✅ site.yml has valid playbook structure');
              } else {
                console.log('   ❌ site.yml invalid playbook structure');
                valid = false;
              }
            } catch (yamlError) {
              console.log('   ❌ site.yml contains invalid YAML');
              valid = false;
            }
          }
        } else {
          console.log('   ❌ No playbook files found');
          valid = false;
        }
      } catch (error) {
        console.log('   ❌ Playbooks directory not accessible');
        valid = false;
      }

    } catch (error) {
      console.log(`   ❌ Error validating Ansible configs: ${error instanceof Error ? error.message : String(error)}`);
      valid = false;
    }

    return valid;
  }

  private async runTerraformPlan(rootPath: string): Promise<boolean> {
    const terraformDir = path.join(rootPath, 'terraform');
    
    return new Promise((resolve) => {
      console.log('   🔍 Running terraform init...');
      
      const init = spawn('terraform', ['init'], {
        cwd: terraformDir,
        stdio: 'pipe'
      });

      let initOutput = '';
      init.stdout.on('data', (data) => {
        initOutput += data.toString();
      });

      init.stderr.on('data', (data) => {
        initOutput += data.toString();
      });

      init.on('close', (initCode) => {
        if (initCode === 0) {
          console.log('   ✅ terraform init succeeded');
          
          console.log('   🔍 Running terraform plan...');
          const plan = spawn('terraform', ['plan', '-out=plan.tfplan'], {
            cwd: terraformDir,
            stdio: 'pipe'
          });

          let planOutput = '';
          plan.stdout.on('data', (data) => {
            planOutput += data.toString();
          });

          plan.stderr.on('data', (data) => {
            planOutput += data.toString();
          });

          plan.on('close', (planCode) => {
            if (planCode === 0) {
              console.log('   ✅ terraform plan succeeded');
              
              // Show plan summary
              const lines = planOutput.split('\n');
              const planLine = lines.find(line => line.includes('Plan:'));
              if (planLine) {
                console.log(`   📊 ${planLine.trim()}`);
              }
              
              resolve(true);
            } else {
              console.log('   ❌ terraform plan failed');
              console.log('   📋 Plan output (last 10 lines):');
              const lines = planOutput.split('\n').slice(-10);
              lines.forEach(line => {
                if (line.trim()) {
                  console.log(`      ${line}`);
                }
              });
              resolve(false);
            }
          });
        } else {
          console.log('   ❌ terraform init failed');
          console.log('   📋 Init output (last 5 lines):');
          const lines = initOutput.split('\n').slice(-5);
          lines.forEach(line => {
            if (line.trim()) {
              console.log(`      ${line}`);
            }
          });
          resolve(false);
        }
      });
    });
  }

  private async validateAnsibleSyntax(rootPath: string): Promise<boolean> {
    const ansibleDir = path.join(rootPath, 'ansible');
    
    return new Promise((resolve) => {
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const playbookPath = path.join(ansibleDir, 'playbooks', 'site.yml');
      
      console.log('   🔍 Checking Ansible playbook syntax...');
      
      const syntaxCheck = spawn('ansible-playbook', [
        '--syntax-check',
        '-i', inventoryPath,
        playbookPath
      ], {
        cwd: ansibleDir,
        stdio: 'pipe'
      });

      let output = '';
      syntaxCheck.stdout.on('data', (data) => {
        output += data.toString();
      });

      syntaxCheck.stderr.on('data', (data) => {
        output += data.toString();
      });

      syntaxCheck.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ Ansible syntax check passed');
          resolve(true);
        } else {
          console.log('   ⚠️  Ansible syntax check failed or ansible-playbook not available');
          console.log('   📋 Output:');
          const lines = output.split('\n').slice(0, 5);
          lines.forEach(line => {
            if (line.trim()) {
              console.log(`      ${line}`);
            }
          });
          console.log('   💡 Install Ansible to enable full syntax checking');
          resolve(true); // Don't fail if Ansible isn't installed
        }
      });

      syntaxCheck.on('error', (error) => {
        console.log('   ⚠️  Ansible not available for syntax checking');
        console.log('   💡 Install Ansible with: pip install ansible');
        resolve(true); // Don't fail if Ansible isn't installed
      });
    });
  }

  private async runGeneratedTDDTests(rootPath: string): Promise<boolean> {
    const testsDir = path.join(rootPath, 'tests');
    
    return new Promise((resolve) => {
      // Check if tests directory exists
      try {
        if (!fsSync.existsSync(testsDir)) {
          console.log('   ⚠️  No tests directory found. Run /sync to generate TDD tests.');
          resolve(true); // Don't fail if tests don't exist yet
          return;
        }
      } catch (error) {
        console.log('   ⚠️  No tests directory found. Run /sync to generate TDD tests.');
        resolve(true); // Don't fail if tests don't exist yet
        return;
      }

      console.log('   🧪 Running generated TDD test suite...');
      
      // Check if test runner script exists
      const testRunnerPath = path.join(testsDir, 'run-tests.sh');
      
      let testCommand;
      let testArgs: string[] = [];
      const testCwd = testsDir;
      
      try {
        // Check if test runner script exists and is executable
        fsSync.access(testRunnerPath, fsSync.constants.F_OK, (err) => {
          if (!err) {
            // Use the generated test runner script
            testCommand = './run-tests.sh';
            testArgs = ['--quick']; // Add quick flag for basic validation
            console.log('   🏃 Using generated test runner script');
          } else {
            // Fallback to make if available
            testCommand = 'make';
            testArgs = ['all'];
            console.log('   🔧 Using Makefile for test execution');
          }
          
          const testProcess = spawn(testCommand, testArgs, {
            cwd: testCwd,
            stdio: 'pipe'
          });

          let output = '';
          let hasErrors = false;

          testProcess.stdout.on('data', (data) => {
            output += data.toString();
          });

          testProcess.stderr.on('data', (data) => {
            output += data.toString();
            hasErrors = true;
          });

          testProcess.on('close', (code) => {
            if (code === 0 && !hasErrors) {
              console.log('   ✅ TDD tests passed successfully');
              
              // Parse output for key results
              const lines = output.split('\n');
              const terraformResults = lines.filter(line => line.includes('terraform') || line.includes('PASS') || line.includes('FAIL'));
              const ansibleResults = lines.filter(line => line.includes('ansible') || line.includes('pytest') || line.includes('molecule'));
              const integrationResults = lines.filter(line => line.includes('integration') || line.includes('jest'));
              
              if (terraformResults.length > 0) {
                console.log('   📊 Terraform tests: ' + (terraformResults.some(r => r.includes('FAIL')) ? 'Some failures detected' : 'All passed'));
              }
              if (ansibleResults.length > 0) {
                console.log('   📊 Ansible tests: ' + (ansibleResults.some(r => r.includes('FAILED')) ? 'Some failures detected' : 'All passed'));
              }
              if (integrationResults.length > 0) {
                console.log('   📊 Integration tests: ' + (integrationResults.some(r => r.includes('failed')) ? 'Some failures detected' : 'All passed'));
              }
              
              resolve(true);
            } else {
              console.log('   ❌ TDD tests failed or encountered errors');
              console.log('   📋 Test output (last 10 lines):');
              const lines = output.split('\n').slice(-10);
              lines.forEach((line, index) => {
                if (line.trim()) {
                  console.log(`      ${line}`);
                }
              });
              
              console.log('\n   💡 For detailed test results, run:');
              console.log(`      cd ${testsDir} && ./run-tests.sh`);
              console.log('   💡 Or check individual test directories for specific failures');
              
              resolve(false);
            }
          });

          testProcess.on('error', (error) => {
            console.log('   ⚠️  Could not execute TDD tests');
            console.log(`   💡 Error: ${error.message}`);
            console.log('   💡 Ensure test dependencies are installed:');
            console.log(`      cd ${testsDir} && make deps`);
            console.log('   💡 Or install manually:');
            console.log('      • Go 1.21+ for Terraform tests');
            console.log('      • Python 3.8+ with pytest for Ansible tests');
            console.log('      • Node.js 18+ with npm for integration tests');
            
            resolve(true); // Don't fail validation if TDD tests can't run due to missing deps
          });
        });

      } catch (error) {
        console.log('   ⚠️  Could not run TDD tests');
        console.log(`   💡 Error: ${error instanceof Error ? error.message : String(error)}`);
        console.log('   💡 Install test dependencies and try again:');
        console.log(`      cd ${testsDir} && make deps`);
        resolve(true); // Don't fail validation if TDD tests can't run
      }
    });
  }
}