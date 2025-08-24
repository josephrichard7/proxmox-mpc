/**
 * Validate Command
 * Comprehensive validation of all configurations and infrastructure
 */

import { ConsoleSession } from '../repl';
import { errorHandler } from '../error-handler';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { spawn } from 'child_process';

export class ValidateCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('🔍 Running comprehensive validation...\n');

    // Check if we're in a workspace
    if (!errorHandler.validateSession(session, 'validate')) {
      return;
    }

    const workspaceRoot = session.workspace!.rootPath;
    let allValidationsPassed = true;

    try {
      // Parse command arguments
      const options = this.parseArguments(args);

      // Phase 1: Workspace structure validation
      console.log('📁 Phase 1: Workspace Structure Validation');
      console.log('=' .repeat(60));
      const structureValid = await this.validateWorkspaceStructure(workspaceRoot, options);
      if (!structureValid) {
        allValidationsPassed = false;
      }

      // Phase 2: Configuration file validation
      console.log('\n📄 Phase 2: Configuration File Validation');
      console.log('=' .repeat(60));
      const configValid = await this.validateConfigurationFiles(workspaceRoot, options);
      if (!configValid) {
        allValidationsPassed = false;
      }

      // Phase 3: Terraform validation
      console.log('\n🏗️  Phase 3: Terraform Validation');
      console.log('=' .repeat(60));
      const terraformValid = await this.validateTerraform(workspaceRoot, session, options);
      if (!terraformValid) {
        allValidationsPassed = false;
      }

      // Phase 4: Ansible validation
      console.log('\n🎵 Phase 4: Ansible Validation');
      console.log('=' .repeat(60));
      const ansibleValid = await this.validateAnsible(workspaceRoot, options);
      if (!ansibleValid) {
        allValidationsPassed = false;
      }

      // Phase 5: Connectivity validation
      console.log('\n🌐 Phase 5: Connectivity Validation');
      console.log('=' .repeat(60));
      const connectivityValid = await this.validateConnectivity(session, options);
      if (!connectivityValid) {
        allValidationsPassed = false;
      }

      // Phase 6: Test suite validation
      if (options.includeTDD || options.all) {
        console.log('\n🧪 Phase 6: Test Suite Validation');
        console.log('=' .repeat(60));
        const testSuiteValid = await this.validateTestSuite(workspaceRoot, options);
        if (!testSuiteValid) {
          allValidationsPassed = false;
        }
      }

      // Phase 7: Security validation
      if (options.includeSecurity || options.all) {
        console.log('\n🔒 Phase 7: Security Validation');
        console.log('=' .repeat(60));
        const securityValid = await this.validateSecurity(workspaceRoot, session, options);
        if (!securityValid) {
          allValidationsPassed = false;
        }
      }

      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('📊 VALIDATION SUMMARY');
      console.log('=' .repeat(60));
      
      if (allValidationsPassed) {
        console.log('✅ ALL VALIDATIONS PASSED');
        console.log('\n🚀 Your infrastructure is ready for deployment!');
        console.log('\n📋 Recommended next steps:');
        console.log('   • Use /plan to preview deployment changes');
        console.log('   • Use /apply to deploy infrastructure');
        console.log('   • Use /test to run comprehensive tests');
      } else {
        console.log('❌ SOME VALIDATIONS FAILED');
        console.log('\n⚠️  Please address the issues above before deployment');
        console.log('\n📋 Troubleshooting steps:');
        console.log('   • Check the detailed output above for specific issues');
        console.log('   • Run /sync to regenerate configurations');
        console.log('   • Verify your Proxmox server connectivity with /status');
        console.log('   • Use /validate --detailed for more information');
      }
      console.log('=' .repeat(60));

    } catch (error) {
      errorHandler.handleError({
        code: 'VALIDATION_FAILED',
        message: 'Validation process failed',
        severity: 'high',
        originalError: error as Error,
        context: {
          command: 'validate',
          workspace: session.workspace?.name,
          suggestions: [
            'Check the detailed error output above',
            'Ensure all required tools are installed',
            'Verify workspace structure integrity'
          ]
        }
      });
    }
  }

  private parseArguments(args: string[]): ValidateOptions {
    const options: ValidateOptions = {
      all: true,
      detailed: false,
      includeTDD: false,
      includeSecurity: false,
      fix: false,
      terraformOnly: false,
      ansibleOnly: false
    };

    for (const arg of args) {
      switch (arg) {
        case '--detailed':
        case '-d':
          options.detailed = true;
          break;
        case '--tdd':
          options.includeTDD = true;
          break;
        case '--security':
          options.includeSecurity = true;
          break;
        case '--fix':
        case '-f':
          options.fix = true;
          break;
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
      }
    }

    return options;
  }

  private async validateWorkspaceStructure(workspaceRoot: string, options: ValidateOptions): Promise<boolean> {
    console.log('🔍 Checking workspace structure...');
    
    const requiredDirectories = [
      '.proxmox',
      'terraform',
      'ansible'
    ];
    
    const optionalDirectories = [
      'tests',
      'docs'
    ];
    
    const requiredFiles = [
      '.proxmox/config.yml'
    ];

    let structureValid = true;

    // Check required directories
    for (const dir of requiredDirectories) {
      const dirPath = path.join(workspaceRoot, dir);
      if (!fsSync.existsSync(dirPath)) {
        console.log(`   ❌ Missing required directory: ${dir}`);
        structureValid = false;
        
        if (options.fix) {
          console.log(`   🔧 Creating directory: ${dir}`);
          await fs.mkdir(dirPath, { recursive: true });
        }
      } else {
        console.log(`   ✅ Found required directory: ${dir}`);
      }
    }

    // Check optional directories
    for (const dir of optionalDirectories) {
      const dirPath = path.join(workspaceRoot, dir);
      if (fsSync.existsSync(dirPath)) {
        console.log(`   ✅ Found optional directory: ${dir}`);
      } else {
        console.log(`   ℹ️  Optional directory not found: ${dir}`);
      }
    }

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(workspaceRoot, file);
      if (!fsSync.existsSync(filePath)) {
        console.log(`   ❌ Missing required file: ${file}`);
        structureValid = false;
      } else {
        console.log(`   ✅ Found required file: ${file}`);
      }
    }

    // Check Terraform structure
    const terraformDir = path.join(workspaceRoot, 'terraform');
    if (fsSync.existsSync(terraformDir)) {
      const terraformFiles = fsSync.readdirSync(terraformDir);
      const tfFiles = terraformFiles.filter(f => f.endsWith('.tf'));
      if (tfFiles.length === 0) {
        console.log('   ⚠️  No Terraform files found in terraform/ directory');
        console.log('      Run /sync to generate Terraform configurations');
      } else {
        console.log(`   ✅ Found ${tfFiles.length} Terraform configuration files`);
      }
    }

    // Check Ansible structure
    const ansibleDir = path.join(workspaceRoot, 'ansible');
    if (fsSync.existsSync(ansibleDir)) {
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const playbooksDir = path.join(ansibleDir, 'playbooks');
      
      if (!fsSync.existsSync(inventoryPath)) {
        console.log('   ⚠️  No Ansible inventory found');
        console.log('      Run /sync to generate Ansible inventory');
      } else {
        console.log('   ✅ Found Ansible inventory');
      }
      
      if (!fsSync.existsSync(playbooksDir)) {
        console.log('   ⚠️  No Ansible playbooks directory found');
        console.log('      Run /sync to generate Ansible playbooks');
      } else {
        const playbooks = fsSync.readdirSync(playbooksDir).filter(f => f.endsWith('.yml'));
        console.log(`   ✅ Found ${playbooks.length} Ansible playbooks`);
      }
    }

    return structureValid;
  }

  private async validateConfigurationFiles(workspaceRoot: string, options: ValidateOptions): Promise<boolean> {
    console.log('🔍 Validating configuration files...');
    let configValid = true;

    // Validate workspace config
    const configPath = path.join(workspaceRoot, '.proxmox', 'config.yml');
    if (fsSync.existsSync(configPath)) {
      try {
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = yaml.load(configContent) as any;
        
        // Check required config fields
        const requiredFields = ['host', 'port', 'node', 'tokenId', 'tokenSecret'];
        for (const field of requiredFields) {
          if (!config[field]) {
            console.log(`   ❌ Missing required config field: ${field}`);
            configValid = false;
          } else {
            console.log(`   ✅ Config field present: ${field}`);
          }
        }
        
        // Validate config values
        if (config.port && (config.port < 1 || config.port > 65535)) {
          console.log(`   ❌ Invalid port number: ${config.port}`);
          configValid = false;
        }
        
        if (config.host && !this.isValidHostname(config.host)) {
          console.log(`   ⚠️  Hostname format may be invalid: ${config.host}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Invalid YAML in config file: ${error instanceof Error ? error.message : String(error)}`);
        configValid = false;
      }
    } else {
      console.log('   ❌ Workspace config file not found');
      configValid = false;
    }

    // Validate Ansible inventory if present
    const inventoryPath = path.join(workspaceRoot, 'ansible', 'inventory.yml');
    if (fsSync.existsSync(inventoryPath)) {
      try {
        const inventoryContent = await fs.readFile(inventoryPath, 'utf8');
        const inventory = yaml.load(inventoryContent) as any;
        
        if (!inventory.all) {
          console.log('   ❌ Ansible inventory missing "all" group');
          configValid = false;
        } else {
          console.log('   ✅ Ansible inventory structure valid');
        }
        
      } catch (error) {
        console.log(`   ❌ Invalid YAML in Ansible inventory: ${error instanceof Error ? error.message : String(error)}`);
        configValid = false;
      }
    }

    return configValid;
  }

  private async validateTerraform(workspaceRoot: string, session: ConsoleSession, options: ValidateOptions): Promise<boolean> {
    const terraformDir = path.join(workspaceRoot, 'terraform');
    
    if (!fsSync.existsSync(terraformDir)) {
      console.log('⚠️  No Terraform directory found, skipping Terraform validation');
      return true;
    }

    console.log('🔍 Validating Terraform configurations...');

    try {
      // Check if terraform is available
      const terraformAvailable = await this.checkTerraformAvailable();
      if (!terraformAvailable) {
        console.log('   ⚠️  Terraform not available, skipping syntax validation');
        console.log('   💡 Install Terraform to enable full validation');
        return true; // Don't fail validation if terraform isn't installed
      }

      // Initialize terraform
      console.log('   📋 Initializing Terraform...');
      const initSuccess = await this.runTerraformInit(terraformDir);
      if (!initSuccess) {
        console.log('   ❌ Terraform initialization failed');
        return false;
      }

      // Validate terraform syntax
      console.log('   🔍 Validating Terraform syntax...');
      const validateSuccess = await this.runTerraformValidate(terraformDir);
      if (!validateSuccess) {
        console.log('   ❌ Terraform syntax validation failed');
        return false;
      }

      // Run terraform plan to check for configuration issues
      if (options.detailed) {
        console.log('   📊 Running Terraform plan validation...');
        const planSuccess = await this.runTerraformPlan(terraformDir, session);
        if (!planSuccess) {
          console.log('   ❌ Terraform plan validation failed');
          return false;
        }
      }

      console.log('   ✅ Terraform validation passed');
      return true;

    } catch (error) {
      console.log(`   ❌ Terraform validation error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async validateAnsible(workspaceRoot: string, options: ValidateOptions): Promise<boolean> {
    const ansibleDir = path.join(workspaceRoot, 'ansible');
    
    if (!fsSync.existsSync(ansibleDir)) {
      console.log('⚠️  No Ansible directory found, skipping Ansible validation');
      return true;
    }

    console.log('🔍 Validating Ansible configurations...');

    try {
      // Check if ansible is available
      const ansibleAvailable = await this.checkAnsibleAvailable();
      if (!ansibleAvailable) {
        console.log('   ⚠️  Ansible not available, skipping syntax validation');
        console.log('   💡 Install Ansible to enable full validation');
        return true; // Don't fail validation if ansible isn't installed
      }

      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const playbookPath = path.join(ansibleDir, 'playbooks', 'site.yml');

      // Validate inventory
      if (fsSync.existsSync(inventoryPath)) {
        console.log('   📋 Validating Ansible inventory...');
        const inventorySuccess = await this.runAnsibleInventoryValidation(ansibleDir, inventoryPath);
        if (!inventorySuccess) {
          console.log('   ❌ Ansible inventory validation failed');
          return false;
        }
      }

      // Validate playbooks
      if (fsSync.existsSync(playbookPath)) {
        console.log('   🎭 Validating Ansible playbook syntax...');
        const playbookSuccess = await this.runAnsiblePlaybookValidation(ansibleDir, playbookPath);
        if (!playbookSuccess) {
          console.log('   ❌ Ansible playbook validation failed');
          return false;
        }
      }

      console.log('   ✅ Ansible validation passed');
      return true;

    } catch (error) {
      console.log(`   ❌ Ansible validation error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async validateConnectivity(session: ConsoleSession, options: ValidateOptions): Promise<boolean> {
    console.log('🔍 Validating Proxmox connectivity...');

    try {
      if (!session.client) {
        console.log('   ⚠️  No Proxmox client available, attempting connection...');
        
        if (!session.workspace) {
          console.log('   ❌ No workspace configuration available for connection');
          return false;
        }

        const { ProxmoxClient } = await import('../../api');
        const client = new ProxmoxClient(session.workspace.config);
        const connectionResult = await client.connect();
        
        if (!connectionResult.success) {
          console.log(`   ❌ Failed to connect to Proxmox server: ${connectionResult.error}`);
          return false;
        }
        
        session.client = client;
      }

      // Test basic connectivity
      console.log('   🌐 Testing Proxmox API connectivity...');
      const nodes = await session.client.getNodes();
      console.log(`   ✅ Connected to Proxmox cluster with ${nodes.length} node(s)`);

      // Test authentication and permissions
      if (options.detailed) {
        console.log('   🔐 Testing API permissions...');
        
        for (const node of nodes) {
          try {
            const vms = await session.client.getVMs(node.node);
            const containers = await session.client.getContainers(node.node);
            console.log(`   ✅ Node ${node.node}: ${vms.length} VMs, ${containers.length} containers`);
          } catch (error) {
            console.log(`   ⚠️  Node ${node.node}: Limited access - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      console.log('   ✅ Connectivity validation passed');
      return true;

    } catch (error) {
      console.log(`   ❌ Connectivity validation failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log('   💡 Check your network connection and Proxmox server status');
      console.log('   💡 Verify your API token has the required permissions');
      return false;
    }
  }

  private async validateTestSuite(workspaceRoot: string, options: ValidateOptions): Promise<boolean> {
    const testsDir = path.join(workspaceRoot, 'tests');
    
    if (!fsSync.existsSync(testsDir)) {
      console.log('ℹ️  No test suite found, skipping test validation');
      console.log('   💡 Run /sync to generate a comprehensive test suite');
      return true;
    }

    console.log('🔍 Validating test suite...');

    try {
      // Check test structure
      const testDirectories = ['terraform', 'ansible', 'integration'];
      let foundTestTypes = 0;

      for (const testDir of testDirectories) {
        const testDirPath = path.join(testsDir, testDir);
        if (fsSync.existsSync(testDirPath)) {
          console.log(`   ✅ Found ${testDir} tests`);
          foundTestTypes++;
        } else {
          console.log(`   ℹ️  No ${testDir} tests found`);
        }
      }

      if (foundTestTypes === 0) {
        console.log('   ⚠️  No test files found in tests directory');
        return false;
      }

      // Check for test runner
      const testRunnerPath = path.join(testsDir, 'run-tests.sh');
      if (fsSync.existsSync(testRunnerPath)) {
        console.log('   ✅ Test runner script available');
      } else {
        console.log('   ℹ️  No test runner script found');
      }

      // Check for Makefile
      const makefilePath = path.join(testsDir, 'Makefile');
      if (fsSync.existsSync(makefilePath)) {
        console.log('   ✅ Makefile available for test automation');
      }

      console.log(`   ✅ Test suite validation passed (${foundTestTypes} test types found)`);
      return true;

    } catch (error) {
      console.log(`   ❌ Test suite validation error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async validateSecurity(workspaceRoot: string, session: ConsoleSession, options: ValidateOptions): Promise<boolean> {
    console.log('🔍 Running security validation...');

    let securityValid = true;

    try {
      // Check for sensitive information in configs
      console.log('   🔐 Checking for exposed credentials...');
      const configPath = path.join(workspaceRoot, '.proxmox', 'config.yml');
      
      if (fsSync.existsSync(configPath)) {
        const configContent = await fs.readFile(configPath, 'utf8');
        
        // Check if credentials are properly handled
        if (configContent.includes('password:') && !configContent.includes('tokenId:')) {
          console.log('   ⚠️  Using password authentication instead of API tokens');
          console.log('      💡 Consider using API tokens for better security');
        }
        
        // Check for insecure settings
        if (configContent.includes('rejectUnauthorized: false')) {
          console.log('   ⚠️  SSL certificate verification is disabled');
          console.log('      💡 Enable SSL verification for production use');
        }
      }

      // Check Terraform security
      const terraformDir = path.join(workspaceRoot, 'terraform');
      if (fsSync.existsSync(terraformDir)) {
        console.log('   🏗️  Checking Terraform security...');
        
        const tfFiles = fsSync.readdirSync(terraformDir, { recursive: true })
          .filter((file: any) => file.toString().endsWith('.tf'));
          
        for (const tfFile of tfFiles) {
          const tfPath = path.join(terraformDir, tfFile.toString());
          const tfContent = await fs.readFile(tfPath, 'utf8');
          
          // Check for hardcoded secrets
          if (tfContent.match(/(password|secret|key)\s*=\s*"[^"]+"/i)) {
            console.log(`   ⚠️  Potential hardcoded credentials in ${tfFile}`);
            console.log('      💡 Use variables and sensitive values instead');
            securityValid = false;
          }
        }
      }

      // Check for .env or credential files
      const sensitiveFiles = ['.env', '.secrets', 'credentials.txt', 'passwords.txt'];
      for (const file of sensitiveFiles) {
        const filePath = path.join(workspaceRoot, file);
        if (fsSync.existsSync(filePath)) {
          console.log(`   ⚠️  Sensitive file found: ${file}`);
          console.log('      💡 Ensure this file is in .gitignore and not committed');
        }
      }

      // Check API token permissions if possible
      if (session.client && options.detailed) {
        console.log('   🔑 Validating API token permissions...');
        
        try {
          // Test minimal required permissions
          await session.client.getNodes();
          console.log('   ✅ API token has basic cluster access');
          
          // Test VM/Container permissions
          const nodes = await session.client.getNodes();
          if (nodes.length > 0) {
            await session.client.getVMs(nodes[0].node);
            console.log('   ✅ API token has VM access permissions');
          }
          
        } catch (error) {
          console.log('   ⚠️  API token may have limited permissions');
          console.log(`      Details: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (securityValid) {
        console.log('   ✅ Security validation passed');
      } else {
        console.log('   ⚠️  Security validation completed with warnings');
      }
      
      return securityValid;

    } catch (error) {
      console.log(`   ❌ Security validation error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  // Helper methods for external tool checks
  private async checkTerraformAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const terraform = spawn('terraform', ['version'], { stdio: 'pipe' });
      terraform.on('close', (code) => resolve(code === 0));
      terraform.on('error', () => resolve(false));
    });
  }

  private async checkAnsibleAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const ansible = spawn('ansible', ['--version'], { stdio: 'pipe' });
      ansible.on('close', (code) => resolve(code === 0));
      ansible.on('error', () => resolve(false));
    });
  }

  private async runTerraformInit(terraformDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const init = spawn('terraform', ['init'], { cwd: terraformDir, stdio: 'pipe' });
      init.on('close', (code) => resolve(code === 0));
      init.on('error', () => resolve(false));
    });
  }

  private async runTerraformValidate(terraformDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const validate = spawn('terraform', ['validate'], { cwd: terraformDir, stdio: 'pipe' });
      validate.on('close', (code) => resolve(code === 0));
      validate.on('error', () => resolve(false));
    });
  }

  private async runTerraformPlan(terraformDir: string, session: ConsoleSession): Promise<boolean> {
    return new Promise((resolve) => {
      const planArgs = [
        'plan',
        `-var=proxmox_token_id=${session.workspace?.config.tokenId || ''}`,
        `-var=proxmox_token_secret=${session.workspace?.config.tokenSecret || ''}`,
        `-var=default_node=${session.workspace?.config.node || ''}`
      ];

      const plan = spawn('terraform', planArgs, {
        cwd: terraformDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          PM_API_URL: `https://${session.workspace?.config.host}:${session.workspace?.config.port}/api2/json`,
          PM_TLS_INSECURE: session.workspace?.config.rejectUnauthorized ? 'false' : 'true'
        }
      });
      
      plan.on('close', (code) => resolve(code === 0));
      plan.on('error', () => resolve(false));
    });
  }

  private async runAnsibleInventoryValidation(ansibleDir: string, inventoryPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const inventory = spawn('ansible-inventory', ['-i', inventoryPath, '--list'], {
        cwd: ansibleDir,
        stdio: 'pipe'
      });
      
      inventory.on('close', (code) => resolve(code === 0));
      inventory.on('error', () => resolve(false));
    });
  }

  private async runAnsiblePlaybookValidation(ansibleDir: string, playbookPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const playbook = spawn('ansible-playbook', [playbookPath, '--syntax-check'], {
        cwd: ansibleDir,
        stdio: 'pipe'
      });
      
      playbook.on('close', (code) => resolve(code === 0));
      playbook.on('error', () => resolve(false));
    });
  }

  private isValidHostname(hostname: string): boolean {
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return hostnameRegex.test(hostname) || ipRegex.test(hostname);
  }
}

interface ValidateOptions {
  all: boolean;
  detailed: boolean;
  includeTDD: boolean;
  includeSecurity: boolean;
  fix: boolean;
  terraformOnly: boolean;
  ansibleOnly: boolean;
}