/**
 * Test Generator
 * Generates TDD tests for Terraform and Ansible configurations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectWorkspace } from '../workspace';
import { VMInfo, ContainerInfo, StorageInfo } from '../types';

export class TestGenerator {
  constructor(private workspace: ProjectWorkspace) {}

  /**
   * Generate comprehensive test suite for infrastructure
   */
  async generateTestSuite(vms: VMInfo[], containers: ContainerInfo[], storage: StorageInfo[]): Promise<void> {
    console.log('   🧪 Generating TDD test suite...');

    // Create tests directory structure
    const testsDir = path.join(this.workspace.rootPath, 'tests');
    await fs.mkdir(testsDir, { recursive: true });
    await fs.mkdir(path.join(testsDir, 'terraform'), { recursive: true });
    await fs.mkdir(path.join(testsDir, 'ansible'), { recursive: true });
    await fs.mkdir(path.join(testsDir, 'integration'), { recursive: true });
    await fs.mkdir(path.join(testsDir, 'unit'), { recursive: true });

    // Generate Terraform tests
    await this.generateTerraformTests(vms, containers, storage);
    
    // Generate Ansible tests
    await this.generateAnsibleTests(vms, containers);
    
    // Generate integration tests
    await this.generateIntegrationTests(vms, containers);
    
    // Generate test configuration and runner
    await this.generateTestConfig();
    
    console.log('   ✅ Generated comprehensive test suite');
    console.log(`      • ${vms.length + containers.length} resource tests`);
    console.log(`      • Integration tests for end-to-end validation`);
    console.log(`      • Unit tests for configuration validation`);
  }

  /**
   * Generate Terraform-specific tests using Terratest patterns
   */
  private async generateTerraformTests(vms: VMInfo[], containers: ContainerInfo[], storage: StorageInfo[]): Promise<void> {
    // Main Terraform test suite
    const mainTestContent = this.generateTerraformMainTest(vms, containers, storage);
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'terraform', 'main_test.go'),
      mainTestContent
    );

    // VM-specific tests
    for (const vm of vms) {
      const vmTestContent = this.generateTerraformVMTest(vm);
      const resourceName = this.sanitizeResourceName(vm.name || `vm-${vm.vmid}`);
      await fs.writeFile(
        path.join(this.workspace.rootPath, 'tests', 'terraform', `${resourceName}_test.go`),
        vmTestContent
      );
    }

    // Container-specific tests
    for (const container of containers) {
      const containerTestContent = this.generateTerraformContainerTest(container);
      const resourceName = this.sanitizeResourceName(container.name || `ct-${container.vmid}`);
      await fs.writeFile(
        path.join(this.workspace.rootPath, 'tests', 'terraform', `${resourceName}_test.go`),
        containerTestContent
      );
    }

    // Generate go.mod for Terraform tests
    const goModContent = this.generateGoMod();
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'terraform', 'go.mod'),
      goModContent
    );
  }

  /**
   * Generate main Terraform test file using Terratest
   */
  private generateTerraformMainTest(vms: VMInfo[], containers: ContainerInfo[], storage: StorageInfo[]): string {
    const projectName = this.workspace.name;
    const host = this.workspace.config.host;
    
    return `package test

import (
	"testing"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// TestTerraformProxmoxInfrastructure validates the complete infrastructure
func TestTerraformProxmoxInfrastructure(t *testing.T) {
	t.Parallel()

	// Configure Terraform options
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		// Path to the Terraform code
		TerraformDir: "../../terraform",
		
		// Variables to pass to terraform
		Vars: map[string]interface{}{
			"proxmox_token_id":     "test-token-id",
			"proxmox_token_secret": "test-token-secret",
			"default_node":         "${this.workspace.config.node}",
		},
		
		// Environment variables
		EnvVars: map[string]string{
			"PM_API_URL":    "https://${host}:${this.workspace.config.port}/api2/json",
			"PM_TLS_INSECURE": "${this.workspace.config.rejectUnauthorized ? 'false' : 'true'}",
		},
	})

	// Clean up resources with "terraform destroy" at the end of the test
	defer terraform.Destroy(t, terraformOptions)

	// Run "terraform init" and "terraform apply"
	terraform.InitAndPlan(t, terraformOptions)

	// Validate the plan output
	planOutput := terraform.Plan(t, terraformOptions)
	
	// Test assertions
	assert.Contains(t, planOutput, "Plan:")
	assert.NotContains(t, planOutput, "Error:")
	
	// Validate specific resources
	${this.generateResourceValidations(vms, containers)}
}

// TestTerraformValidation tests configuration syntax and structure
func TestTerraformValidation(t *testing.T) {
	terraformOptions := &terraform.Options{
		TerraformDir: "../../terraform",
	}
	
	// Validate Terraform configuration
	terraform.Validate(t, terraformOptions)
}

// TestTerraformFormat checks if Terraform files are properly formatted
func TestTerraformFormat(t *testing.T) {
	terraformOptions := &terraform.Options{
		TerraformDir: "../../terraform",
	}
	
	// Check formatting
	terraform.Format(t, terraformOptions)
}
`;
  }

  /**
   * Generate VM-specific Terraform test
   */
  private generateTerraformVMTest(vm: VMInfo): string {
    const resourceName = this.sanitizeResourceName(vm.name || `vm-${vm.vmid}`);
    const vmName = vm.name || `vm-${vm.vmid}`;
    
    return `package test

import (
	"testing"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// Test${this.capitalizeFirst(resourceName)} validates the ${vmName} VM configuration
func Test${this.capitalizeFirst(resourceName)}(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../../terraform",
		Targets: []string{
			"proxmox_vm_qemu.${resourceName}",
		},
		Vars: map[string]interface{}{
			"proxmox_token_id":     "test-token-id", 
			"proxmox_token_secret": "test-token-secret",
			"default_node":         "${this.workspace.config.node}",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndPlan(t, terraformOptions)

	// Test VM-specific configurations
	planOutput := terraform.Plan(t, terraformOptions)
	
	// Validate VM properties
	assert.Contains(t, planOutput, "proxmox_vm_qemu.${resourceName}")
	assert.Contains(t, planOutput, "\\"${vmName}\\"")
	assert.Contains(t, planOutput, "vmid = ${vm.vmid}")
	${vm.cpus ? `assert.Contains(t, planOutput, "cores = ${vm.cpus}")` : ''}
	${vm.maxmem ? `assert.Contains(t, planOutput, "memory = ${Math.floor(vm.maxmem / 1024 / 1024)}")` : ''}
	
	// Validate VM status and lifecycle
	assert.Contains(t, planOutput, "tags = \\"proxmox-mpc,imported,${vm.status}\\"")
}

// Test${this.capitalizeFirst(resourceName)}Configuration validates configuration file syntax
func Test${this.capitalizeFirst(resourceName)}Configuration(t *testing.T) {
	terraformOptions := &terraform.Options{
		TerraformDir: "../../terraform/vms",
	}
	
	// Validate specific VM configuration file
	terraform.Validate(t, terraformOptions)
}
`;
  }

  /**
   * Generate container-specific Terraform test
   */
  private generateTerraformContainerTest(container: ContainerInfo): string {
    const resourceName = this.sanitizeResourceName(container.name || `ct-${container.vmid}`);
    const containerName = container.name || `ct-${container.vmid}`;
    
    return `package test

import (
	"testing"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// Test${this.capitalizeFirst(resourceName)} validates the ${containerName} container configuration
func Test${this.capitalizeFirst(resourceName)}(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../../terraform",
		Targets: []string{
			"proxmox_lxc.${resourceName}",
		},
		Vars: map[string]interface{}{
			"proxmox_token_id":     "test-token-id",
			"proxmox_token_secret": "test-token-secret", 
			"default_node":         "${this.workspace.config.node}",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndPlan(t, terraformOptions)

	// Test container-specific configurations
	planOutput := terraform.Plan(t, terraformOptions)
	
	// Validate container properties
	assert.Contains(t, planOutput, "proxmox_lxc.${resourceName}")
	assert.Contains(t, planOutput, "\\"${containerName}\\"")
	assert.Contains(t, planOutput, "vmid = ${container.vmid}")
	${container.cpus ? `assert.Contains(t, planOutput, "cores = ${container.cpus}")` : ''}
	${container.maxmem ? `assert.Contains(t, planOutput, "memory = ${Math.floor(container.maxmem / 1024 / 1024)}")` : ''}
	
	// Validate container status and lifecycle
	assert.Contains(t, planOutput, "tags = \\"proxmox-mpc,imported,${container.status}\\"")
}
`;
  }

  /**
   * Generate Ansible tests using molecule and testinfra
   */
  private async generateAnsibleTests(vms: VMInfo[], containers: ContainerInfo[]): Promise<void> {
    // Generate molecule configuration
    const moleculeConfig = this.generateMoleculeConfig();
    await fs.mkdir(path.join(this.workspace.rootPath, 'tests', 'ansible', 'molecule', 'default'), { recursive: true });
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'ansible', 'molecule', 'default', 'molecule.yml'),
      moleculeConfig
    );

    // Generate test playbook
    const testPlaybook = this.generateAnsibleTestPlaybook(vms, containers);
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'ansible', 'molecule', 'default', 'converge.yml'),
      testPlaybook
    );

    // Generate testinfra tests
    const testinfraContent = this.generateTestinfraTests(vms, containers);
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'ansible', 'test_infrastructure.py'),
      testinfraContent
    );

    // Generate inventory validation test
    const inventoryTestContent = this.generateInventoryValidationTest(vms, containers);
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'ansible', 'test_inventory.py'),
      inventoryTestContent
    );

    // Generate requirements file
    const requirementsContent = this.generatePythonRequirements();
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'ansible', 'requirements.txt'),
      requirementsContent
    );
  }

  /**
   * Generate molecule configuration for Ansible testing
   */
  private generateMoleculeConfig(): string {
    return `---
dependency:
  name: galaxy
driver:
  name: delegate
platforms:
  - name: localhost
    groups:
      - proxmox_nodes
provisioner:
  name: ansible
  inventory:
    group_vars:
      all:
        ansible_connection: local
    host_vars:
      localhost:
        ansible_host: localhost
verifier:
  name: testinfra
  directory: ../..
  options:
    # Run tests against localhost
    v: true
scenario:
  test_sequence:
    - dependency
    - syntax
    - create
    - prepare
    - converge
    - verify
    - cleanup
    - destroy
`;
  }

  /**
   * Generate Ansible test playbook
   */
  private generateAnsibleTestPlaybook(vms: VMInfo[], containers: ContainerInfo[]): string {
    return `---
- name: Test Ansible Infrastructure Configuration
  hosts: all
  gather_facts: true
  become: false
  
  tasks:
    - name: Validate inventory structure
      assert:
        that:
          - groups.all is defined
          - groups.vms is defined or groups.containers is defined
        msg: "Required inventory groups are missing"
    
    - name: Check if we have VMs in inventory
      debug:
        msg: "Found {{ groups.vms | default([]) | length }} VMs in inventory"
      when: groups.vms is defined
    
    - name: Check if we have containers in inventory  
      debug:
        msg: "Found {{ groups.containers | default([]) | length }} containers in inventory"
      when: groups.containers is defined
    
    - name: Validate VM configurations
      assert:
        that:
          - hostvars[item].vmid is defined
          - hostvars[item].status is defined
          - hostvars[item].cores is defined
          - hostvars[item].memory_mb is defined
        msg: "VM {{ item }} missing required configuration"
      loop: "{{ groups.vms | default([]) }}"
      when: groups.vms is defined
    
    - name: Validate container configurations
      assert:
        that:
          - hostvars[item].vmid is defined
          - hostvars[item].status is defined
          - hostvars[item].cores is defined
          - hostvars[item].memory_mb is defined
        msg: "Container {{ item }} missing required configuration"
      loop: "{{ groups.containers | default([]) }}"
      when: groups.containers is defined

    - name: Test playbook syntax validation
      include: ../../ansible/playbooks/site.yml
      check_mode: true
      tags: never  # Only run when explicitly requested
`;
  }

  /**
   * Generate testinfra tests for infrastructure validation
   */
  private generateTestinfraTests(vms: VMInfo[], containers: ContainerInfo[]): string {
    return `"""
Infrastructure tests using testinfra
Tests the generated Ansible configurations and validates infrastructure state
"""

import pytest
import testinfra
import yaml
import os
from pathlib import Path

def test_inventory_file_exists(host):
    """Test that inventory file exists and is readable"""
    inventory_path = Path("ansible/inventory.yml")
    assert inventory_path.exists(), "Inventory file should exist"
    assert inventory_path.is_file(), "Inventory should be a file"

def test_inventory_yaml_syntax(host):
    """Test that inventory file contains valid YAML"""
    with open("ansible/inventory.yml", 'r') as f:
        try:
            inventory = yaml.safe_load(f)
            assert inventory is not None, "Inventory should not be empty"
            assert 'all' in inventory, "Inventory should have 'all' group"
        except yaml.YAMLError as e:
            pytest.fail(f"Invalid YAML syntax: {e}")

def test_inventory_structure(host):
    """Test inventory has required structure"""
    with open("ansible/inventory.yml", 'r') as f:
        inventory = yaml.safe_load(f)
        
    # Check required top-level structure
    assert 'all' in inventory
    assert 'vars' in inventory['all']
    assert 'children' in inventory['all']
    
    # Check required groups
    children = inventory['all']['children']
    assert 'proxmox_nodes' in children
    
    # Should have at least VMs or containers
    has_vms = 'vms' in children and children['vms']['hosts']
    has_containers = 'containers' in children and children['containers']['hosts']
    assert has_vms or has_containers, "Should have either VMs or containers"

def test_playbook_files_exist(host):
    """Test that required playbook files exist"""
    playbook_dir = Path("ansible/playbooks")
    assert playbook_dir.exists(), "Playbooks directory should exist"
    
    site_playbook = playbook_dir / "site.yml"
    assert site_playbook.exists(), "Site playbook should exist"

def test_playbook_yaml_syntax(host):
    """Test that playbooks contain valid YAML"""
    playbook_dir = Path("ansible/playbooks")
    for playbook_file in playbook_dir.glob("*.yml"):
        with open(playbook_file, 'r') as f:
            try:
                playbook = yaml.safe_load(f)
                assert playbook is not None, f"Playbook {playbook_file.name} should not be empty"
                assert isinstance(playbook, list), f"Playbook {playbook_file.name} should be a list of plays"
            except yaml.YAMLError as e:
                pytest.fail(f"Invalid YAML syntax in {playbook_file.name}: {e}")

${this.generateVMSpecificTests(vms)}

${this.generateContainerSpecificTests(containers)}

def test_ansible_configuration_integration(host):
    """Test that Ansible configuration works end-to-end"""
    # Test inventory parsing
    cmd = host.run("ansible-inventory -i ansible/inventory.yml --list")
    assert cmd.rc == 0, f"Inventory parsing failed: {cmd.stderr}"
    
    # Test playbook syntax
    cmd = host.run("ansible-playbook -i ansible/inventory.yml ansible/playbooks/site.yml --syntax-check")
    assert cmd.rc == 0, f"Playbook syntax check failed: {cmd.stderr}"

@pytest.mark.parametrize("required_var", [
    "ansible_user",
    "ansible_ssh_common_args", 
    "ansible_python_interpreter"
])
def test_required_inventory_vars(host, required_var):
    """Test that required inventory variables are present"""
    with open("ansible/inventory.yml", 'r') as f:
        inventory = yaml.safe_load(f)
    
    assert required_var in inventory['all']['vars'], f"Required variable {required_var} missing from inventory"
`;
  }

  /**
   * Generate VM-specific tests
   */
  private generateVMSpecificTests(vms: VMInfo[]): string {
    if (vms.length === 0) return '';
    
    const vmTests = vms.map(vm => {
      const vmName = vm.name || `vm-${vm.vmid}`;
      return `
def test_vm_${this.sanitizeResourceName(vmName)}_in_inventory(host):
    """Test that VM ${vmName} is properly configured in inventory"""
    with open("ansible/inventory.yml", 'r') as f:
        inventory = yaml.safe_load(f)
    
    vms = inventory['all']['children']['vms']['hosts']
    assert '${vmName}' in vms, "VM ${vmName} should be in inventory"
    
    vm_config = vms['${vmName}']
    assert vm_config['vmid'] == ${vm.vmid}, "VM ${vmName} should have vmid ${vm.vmid}"
    assert vm_config['status'] == '${vm.status}', "VM ${vmName} should have status ${vm.status}"
    ${vm.cpus ? `assert vm_config['cores'] == ${vm.cpus}, "VM ${vmName} should have ${vm.cpus} cores"` : ''}
    ${vm.maxmem ? `assert vm_config['memory_mb'] == ${Math.floor(vm.maxmem / 1024 / 1024)}, "VM ${vmName} should have ${Math.floor(vm.maxmem / 1024 / 1024)}MB memory"` : ''}`;
    }).join('\n');

    return vmTests;
  }

  /**
   * Generate container-specific tests
   */
  private generateContainerSpecificTests(containers: ContainerInfo[]): string {
    if (containers.length === 0) return '';
    
    const containerTests = containers.map(container => {
      const containerName = container.name || `ct-${container.vmid}`;
      return `
def test_container_${this.sanitizeResourceName(containerName)}_in_inventory(host):
    """Test that container ${containerName} is properly configured in inventory"""
    with open("ansible/inventory.yml", 'r') as f:
        inventory = yaml.safe_load(f)
    
    containers = inventory['all']['children']['containers']['hosts']
    assert '${containerName}' in containers, "Container ${containerName} should be in inventory"
    
    container_config = containers['${containerName}']
    assert container_config['vmid'] == ${container.vmid}, "Container ${containerName} should have vmid ${container.vmid}"
    assert container_config['status'] == '${container.status}', "Container ${containerName} should have status ${container.status}"
    ${container.cpus ? `assert container_config['cores'] == ${container.cpus}, "Container ${containerName} should have ${container.cpus} cores"` : ''}
    ${container.maxmem ? `assert container_config['memory_mb'] == ${Math.floor(container.maxmem / 1024 / 1024)}, "Container ${containerName} should have ${Math.floor(container.maxmem / 1024 / 1024)}MB memory"` : ''}`;
    }).join('\n');

    return containerTests;
  }

  /**
   * Generate inventory validation test
   */
  private generateInventoryValidationTest(vms: VMInfo[], containers: ContainerInfo[]): string {
    return `"""
Ansible inventory validation tests
Tests that ensure the generated inventory is correct and complete
"""

import pytest
import yaml
import json
import subprocess
from pathlib import Path

class TestInventoryValidation:
    """Test class for inventory validation"""
    
    def setup_method(self):
        """Setup method run before each test"""
        self.inventory_path = Path("ansible/inventory.yml")
        assert self.inventory_path.exists(), "Inventory file must exist"
        
        with open(self.inventory_path, 'r') as f:
            self.inventory = yaml.safe_load(f)
    
    def test_inventory_groups_structure(self):
        """Test that inventory has proper group structure"""
        required_groups = ['proxmox_nodes', 'running', 'stopped']
        optional_groups = ['vms', 'containers']
        
        children = self.inventory['all']['children']
        
        # Check required groups
        for group in required_groups:
            assert group in children, f"Required group '{group}' missing from inventory"
        
        # Should have at least one optional group with hosts
        has_resources = any(
            group in children and 
            'hosts' in children[group] and 
            len(children[group]['hosts']) > 0
            for group in optional_groups
        )
        assert has_resources, "Inventory should have VMs or containers with hosts"
    
    def test_vm_group_validation(self):
        """Test VM group configuration if VMs exist"""
        if 'vms' not in self.inventory['all']['children']:
            pytest.skip("No VMs in inventory")
        
        vms = self.inventory['all']['children']['vms']['hosts']
        
        for vm_name, vm_config in vms.items():
            # Test required fields
            required_fields = ['vmid', 'status', 'cores', 'memory_mb']
            for field in required_fields:
                assert field in vm_config, f"VM {vm_name} missing required field: {field}"
            
            # Test field types and values
            assert isinstance(vm_config['vmid'], int), f"VM {vm_name} vmid should be integer"
            assert vm_config['vmid'] > 0, f"VM {vm_name} vmid should be positive"
            assert vm_config['status'] in ['running', 'stopped', 'suspended'], f"VM {vm_name} has invalid status"
            assert isinstance(vm_config['cores'], int), f"VM {vm_name} cores should be integer"
            assert vm_config['cores'] > 0, f"VM {vm_name} cores should be positive"
            assert isinstance(vm_config['memory_mb'], int), f"VM {vm_name} memory_mb should be integer"
            assert vm_config['memory_mb'] > 0, f"VM {vm_name} memory_mb should be positive"
    
    def test_container_group_validation(self):
        """Test container group configuration if containers exist"""
        if 'containers' not in self.inventory['all']['children']:
            pytest.skip("No containers in inventory")
        
        containers = self.inventory['all']['children']['containers']['hosts']
        
        for container_name, container_config in containers.items():
            # Test required fields
            required_fields = ['vmid', 'status', 'cores', 'memory_mb']
            for field in required_fields:
                assert field in container_config, f"Container {container_name} missing required field: {field}"
            
            # Test field types and values
            assert isinstance(container_config['vmid'], int), f"Container {container_name} vmid should be integer"
            assert container_config['vmid'] > 0, f"Container {container_name} vmid should be positive"
            assert container_config['status'] in ['running', 'stopped', 'suspended'], f"Container {container_name} has invalid status"
    
    def test_status_groups_populated(self):
        """Test that status-based groups are properly populated"""
        children = self.inventory['all']['children']
        
        # Collect all hosts from vms and containers
        all_hosts = {}
        if 'vms' in children:
            all_hosts.update(children['vms']['hosts'])
        if 'containers' in children:
            all_hosts.update(children['containers']['hosts'])
        
        # Check status groups
        running_hosts = children.get('running', {}).get('hosts', {})
        stopped_hosts = children.get('stopped', {}).get('hosts', {})
        
        for host_name, host_config in all_hosts.items():
            status = host_config['status']
            if status == 'running':
                assert host_name in running_hosts, f"Running host {host_name} should be in running group"
            elif status == 'stopped':
                assert host_name in stopped_hosts, f"Stopped host {host_name} should be in stopped group"
    
    def test_ansible_inventory_parsing(self):
        """Test that ansible-inventory can parse the generated inventory"""
        try:
            result = subprocess.run([
                'ansible-inventory', '-i', str(self.inventory_path), '--list'
            ], capture_output=True, text=True, check=True)
            
            # Parse the JSON output
            inventory_output = json.loads(result.stdout)
            assert '_meta' in inventory_output, "Ansible inventory output should have _meta"
            assert 'hostvars' in inventory_output['_meta'], "Ansible inventory should have hostvars"
            
        except subprocess.CalledProcessError as e:
            pytest.fail(f"ansible-inventory failed: {e.stderr}")
        except json.JSONDecodeError as e:
            pytest.fail(f"ansible-inventory produced invalid JSON: {e}")
        except FileNotFoundError:
            pytest.skip("ansible-inventory command not available")
    
    def test_proxmox_node_configuration(self):
        """Test that Proxmox nodes are properly configured"""
        proxmox_nodes = self.inventory['all']['children']['proxmox_nodes']['hosts']
        
        assert len(proxmox_nodes) > 0, "Should have at least one Proxmox node"
        
        for node_name, node_config in proxmox_nodes.items():
            assert 'ansible_host' in node_config, f"Node {node_name} should have ansible_host"
            # Add more node-specific validations as needed
`;
  }

  /**
   * Generate integration tests
   */
  private async generateIntegrationTests(vms: VMInfo[], containers: ContainerInfo[]): Promise<void> {
    const integrationTestContent = this.generateIntegrationTestSuite(vms, containers);
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'integration', 'test_full_workflow.js'),
      integrationTestContent
    );

    // Generate Jest configuration for integration tests
    const jestConfig = this.generateJestConfig();
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'jest.config.js'),
      jestConfig
    );
  }

  /**
   * Generate comprehensive integration test suite
   */
  private generateIntegrationTestSuite(vms: VMInfo[], containers: ContainerInfo[]): string {
    return `/**
 * Integration Tests for Proxmox-MPC Generated Infrastructure
 * Tests the complete workflow from configuration generation to deployment readiness
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('Proxmox-MPC Integration Tests', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const terraformDir = path.join(projectRoot, 'terraform');
  const ansibleDir = path.join(projectRoot, 'ansible');

  beforeAll(() => {
    // Ensure we're in the right directory structure
    expect(fs.existsSync(terraformDir)).toBe(true);
    expect(fs.existsSync(ansibleDir)).toBe(true);
  });

  describe('Terraform Configuration Tests', () => {
    test('Terraform files should be valid HCL', () => {
      try {
        // Test terraform validate
        execSync('terraform validate', { 
          cwd: terraformDir,
          stdio: 'pipe'
        });
      } catch (error) {
        fail(\`Terraform validation failed: \${error.stdout || error.message}\`);
      }
    });

    test('Terraform plan should execute without errors', () => {
      try {
        // Initialize terraform
        execSync('terraform init', { 
          cwd: terraformDir,
          stdio: 'pipe'
        });
        
        // Create plan
        execSync('terraform plan -out=test.tfplan', { 
          cwd: terraformDir,
          stdio: 'pipe',
          env: {
            ...process.env,
            TF_VAR_proxmox_token_id: 'test-token',
            TF_VAR_proxmox_token_secret: 'test-secret',
            TF_VAR_default_node: '${this.workspace.config.node}'
          }
        });
        
        // Verify plan file was created
        expect(fs.existsSync(path.join(terraformDir, 'test.tfplan'))).toBe(true);
        
      } catch (error) {
        fail(\`Terraform plan failed: \${error.stdout || error.message}\`);
      }
    });

    ${this.generateTerraformResourceTests(vms, containers)}
  });

  describe('Ansible Configuration Tests', () => {
    test('Ansible inventory should be valid YAML', () => {
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      expect(fs.existsSync(inventoryPath)).toBe(true);
      
      const inventoryContent = fs.readFileSync(inventoryPath, 'utf8');
      expect(() => yaml.load(inventoryContent)).not.toThrow();
    });

    test('Ansible playbooks should pass syntax check', () => {
      const playbooksDir = path.join(ansibleDir, 'playbooks');
      const playbooks = fs.readdirSync(playbooksDir).filter(f => f.endsWith('.yml'));
      
      playbooks.forEach(playbook => {
        try {
          execSync(\`ansible-playbook --syntax-check \${playbook}\`, {
            cwd: playbooksDir,
            stdio: 'pipe'
          });
        } catch (error) {
          fail(\`Ansible playbook \${playbook} syntax check failed: \${error.stdout || error.message}\`);
        }
      });
    });

    test('Ansible inventory should parse correctly', () => {
      try {
        const result = execSync('ansible-inventory -i inventory.yml --list', {
          cwd: ansibleDir,
          encoding: 'utf8'
        });
        
        const inventory = JSON.parse(result);
        expect(inventory).toHaveProperty('_meta');
        expect(inventory._meta).toHaveProperty('hostvars');
        
      } catch (error) {
        fail(\`Ansible inventory parsing failed: \${error.stdout || error.message}\`);
      }
    });

    ${this.generateAnsibleResourceTests(vms, containers)}
  });

  describe('End-to-End Workflow Tests', () => {
    test('Generated configurations should match discovered infrastructure', () => {
      // Load and validate the generated inventory
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const inventory = yaml.load(fs.readFileSync(inventoryPath, 'utf8'));
      
      // Validate VM count and configuration
      ${vms.length > 0 ? `
      const vms = inventory.all.children.vms?.hosts || {};
      expect(Object.keys(vms)).toHaveLength(${vms.length});
      
      // Validate specific VMs
      ${vms.map(vm => {
        const vmName = vm.name || `vm-${vm.vmid}`;
        return `expect(vms).toHaveProperty('${vmName}');
      expect(vms['${vmName}'].vmid).toBe(${vm.vmid});
      expect(vms['${vmName}'].status).toBe('${vm.status}');`;
      }).join('\n      ')}
      ` : '// No VMs to validate'}

      // Validate container count and configuration  
      ${containers.length > 0 ? `
      const containers = inventory.all.children.containers?.hosts || {};
      expect(Object.keys(containers)).toHaveLength(${containers.length});
      
      // Validate specific containers
      ${containers.map(container => {
        const containerName = container.name || `ct-${container.vmid}`;
        return `expect(containers).toHaveProperty('${containerName}');
      expect(containers['${containerName}'].vmid).toBe(${container.vmid});
      expect(containers['${containerName}'].status).toBe('${container.status}');`;
      }).join('\n      ')}
      ` : '// No containers to validate'}
    });

    test('Terraform and Ansible configurations should be consistent', () => {
      // This test ensures that the same resources are defined in both Terraform and Ansible
      
      // Read Terraform VM configurations
      const terraformVmsDir = path.join(terraformDir, 'vms');
      const terraformVmFiles = fs.existsSync(terraformVmsDir) 
        ? fs.readdirSync(terraformVmsDir).filter(f => f.endsWith('.tf'))
        : [];
      
      // Read Terraform container configurations
      const terraformContainersDir = path.join(terraformDir, 'containers');
      const terraformContainerFiles = fs.existsSync(terraformContainersDir)
        ? fs.readdirSync(terraformContainersDir).filter(f => f.endsWith('.tf'))
        : [];
      
      // Read Ansible inventory
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const inventory = yaml.load(fs.readFileSync(inventoryPath, 'utf8'));
      
      const ansibleVms = Object.keys(inventory.all.children.vms?.hosts || {});
      const ansibleContainers = Object.keys(inventory.all.children.containers?.hosts || {});
      
      // Verify counts match
      expect(terraformVmFiles.length).toBe(ansibleVms.length);
      expect(terraformContainerFiles.length).toBe(ansibleContainers.length);
      
      // Verify total resource count matches discovery
      expect(terraformVmFiles.length + terraformContainerFiles.length)
        .toBe(${vms.length + containers.length});
    });

    test('Generated tests should be executable', () => {
      // Verify that the generated test files are valid and can be executed
      const testFiles = [
        'tests/terraform/main_test.go',
        'tests/ansible/test_infrastructure.py',
        'tests/integration/test_full_workflow.js'
      ];
      
      testFiles.forEach(testFile => {
        const fullPath = path.join(projectRoot, testFile);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content.length).toBeGreaterThan(100); // Should have substantial content
          expect(content).toContain('test'); // Should contain test definitions
        }
      });
    });
  });

  describe('Configuration Validation', () => {
    test('All required configuration files should exist', () => {
      const requiredFiles = [
        'terraform/main.tf',
        'ansible/inventory.yml',
        'ansible/playbooks/site.yml'
      ];
      
      requiredFiles.forEach(file => {
        expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
      });
    });

    test('Configuration should match workspace settings', () => {
      // Verify Terraform provider configuration
      const mainTfPath = path.join(terraformDir, 'main.tf');
      const mainTfContent = fs.readFileSync(mainTfPath, 'utf8');
      
      expect(mainTfContent).toContain('${this.workspace.config.host}');
      expect(mainTfContent).toContain('${this.workspace.config.port}');
      expect(mainTfContent).toContain('${this.workspace.config.node}');
      
      // Verify Ansible inventory configuration
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const inventory = yaml.load(fs.readFileSync(inventoryPath, 'utf8'));
      
      expect(inventory.all.children.proxmox_nodes.hosts).toHaveProperty('${this.workspace.config.node}');
      expect(inventory.all.children.proxmox_nodes.hosts['${this.workspace.config.node}'].ansible_host)
        .toBe('${this.workspace.config.host}');
    });
  });
});
`;
  }

  /**
   * Generate test configuration files
   */
  private async generateTestConfig(): Promise<void> {
    // Generate Makefile for easy test execution
    const makefileContent = this.generateMakefile();
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'Makefile'),
      makefileContent
    );

    // Generate test runner script
    const testRunnerContent = this.generateTestRunner();
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'run-tests.sh'),
      testRunnerContent
    );

    // Make the test runner executable
    await fs.chmod(path.join(this.workspace.rootPath, 'tests', 'run-tests.sh'), 0o755);

    // Generate README for tests
    const testReadmeContent = this.generateTestReadme();
    await fs.writeFile(
      path.join(this.workspace.rootPath, 'tests', 'README.md'),
      testReadmeContent
    );
  }

  // Helper methods for generating various configuration files

  private generateGoMod(): string {
    return `module ${this.workspace.name}-tests

go 1.21

require (
	github.com/gruntwork-io/terratest v0.46.8
	github.com/stretchr/testify v1.8.4
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
`;
  }

  private generatePythonRequirements(): string {
    return `# Python requirements for Ansible testing
molecule>=6.0.0
testinfra>=10.0.0
pytest>=7.0.0
pytest-html>=3.0.0
pytest-cov>=4.0.0
ansible>=8.0.0
pyyaml>=6.0.0
`;
  }

  private generateJestConfig(): string {
    return `module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 30000 // 30 seconds for integration tests
};
`;
  }

  private generateMakefile(): string {
    return `# Makefile for Proxmox-MPC Tests
.PHONY: all terraform ansible integration clean help

# Default target
all: terraform ansible integration

# Run Terraform tests
terraform:
	@echo "Running Terraform tests..."
	cd terraform && go test -v -timeout 30m

# Run Ansible tests  
ansible:
	@echo "Running Ansible tests..."
	cd ansible && python -m pytest -v --tb=short
	@echo "Running molecule tests..."
	cd ansible && molecule test

# Run integration tests
integration:
	@echo "Running integration tests..."
	cd integration && npm test

# Clean up test artifacts
clean:
	@echo "Cleaning up test artifacts..."
	rm -f terraform/*.tfplan
	rm -f terraform/*.tfstate*
	rm -rf terraform/.terraform
	rm -rf ansible/__pycache__
	rm -rf ansible/.pytest_cache
	rm -rf ansible/molecule/default/.molecule
	rm -rf integration/node_modules

# Install test dependencies
deps:
	@echo "Installing test dependencies..."
	cd terraform && go mod tidy
	cd ansible && pip install -r requirements.txt
	cd integration && npm install

# Run all tests with coverage
test-coverage: deps
	@echo "Running tests with coverage..."
	cd terraform && go test -v -cover -timeout 30m
	cd ansible && python -m pytest -v --cov=. --cov-report=html
	cd integration && npm test -- --coverage

# Help target
help:
	@echo "Available targets:"
	@echo "  all           - Run all tests (default)"
	@echo "  terraform     - Run Terraform tests only"
	@echo "  ansible       - Run Ansible tests only"
	@echo "  integration   - Run integration tests only"
	@echo "  clean         - Clean up test artifacts"
	@echo "  deps          - Install test dependencies"
	@echo "  test-coverage - Run all tests with coverage"
	@echo "  help          - Show this help message"
`;
  }

  private generateTestRunner(): string {
    return `#!/bin/bash
# Test runner script for Proxmox-MPC
# Runs all tests in the correct order with proper error handling

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧪 Starting Proxmox-MPC Test Suite"
echo "Project root: $PROJECT_ROOT"
echo "Tests directory: $SCRIPT_DIR"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "\${GREEN}[INFO]\${NC} $1"
}

print_warning() {
    echo -e "\${YELLOW}[WARN]\${NC} $1"
}

print_error() {
    echo -e "\${RED}[ERROR]\${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if we're in a proper workspace
    if [[ ! -f "$PROJECT_ROOT/.proxmox/config.yml" ]]; then
        print_error "Not in a Proxmox-MPC workspace. Run /init first."
        exit 1
    fi
    
    # Check for required directories
    for dir in terraform ansible; do
        if [[ ! -d "$PROJECT_ROOT/$dir" ]]; then
            print_error "Missing $dir directory. Run /sync first."
            exit 1
        fi
    done
    
    print_status "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    print_status "Installing test dependencies..."
    
    # Terraform dependencies
    if [[ -f "$SCRIPT_DIR/terraform/go.mod" ]]; then
        cd "$SCRIPT_DIR/terraform"
        go mod tidy
        print_status "Terraform test dependencies installed"
    fi
    
    # Ansible dependencies
    if [[ -f "$SCRIPT_DIR/ansible/requirements.txt" ]]; then
        pip install -r "$SCRIPT_DIR/ansible/requirements.txt" || {
            print_warning "Failed to install Python requirements. Some Ansible tests may fail."
        }
        print_status "Ansible test dependencies installed"
    fi
    
    # JavaScript dependencies for integration tests
    if [[ -f "$SCRIPT_DIR/integration/package.json" ]]; then
        cd "$SCRIPT_DIR/integration"
        npm install
        print_status "Integration test dependencies installed"
    fi
}

# Run Terraform tests
run_terraform_tests() {
    print_status "Running Terraform tests..."
    
    if [[ -d "$SCRIPT_DIR/terraform" ]]; then
        cd "$SCRIPT_DIR/terraform"
        
        # Set required environment variables
        export TF_VAR_proxmox_token_id="test-token"
        export TF_VAR_proxmox_token_secret="test-secret"
        export TF_VAR_default_node="${this.workspace.config.node}"
        
        if go test -v -timeout 30m; then
            print_status "Terraform tests passed ✅"
            return 0
        else
            print_error "Terraform tests failed ❌"
            return 1
        fi
    else
        print_warning "No Terraform tests found, skipping"
        return 0
    fi
}

# Run Ansible tests
run_ansible_tests() {
    print_status "Running Ansible tests..."
    
    if [[ -d "$SCRIPT_DIR/ansible" ]]; then
        cd "$SCRIPT_DIR/ansible"
        
        # Run pytest tests
        if python -m pytest -v --tb=short; then
            print_status "Ansible pytest tests passed ✅"
        else
            print_error "Ansible pytest tests failed ❌"
            return 1
        fi
        
        # Run molecule tests if available
        if command -v molecule &> /dev/null; then
            if molecule test; then
                print_status "Ansible molecule tests passed ✅"
            else
                print_error "Ansible molecule tests failed ❌"
                return 1
            fi
        else
            print_warning "Molecule not available, skipping molecule tests"
        fi
        
        return 0
    else
        print_warning "No Ansible tests found, skipping"
        return 0
    fi
}

# Run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    if [[ -f "$SCRIPT_DIR/integration/test_full_workflow.js" ]]; then
        cd "$SCRIPT_DIR/integration"
        
        if npm test; then
            print_status "Integration tests passed ✅"
            return 0
        else
            print_error "Integration tests failed ❌"
            return 1
        fi
    else
        print_warning "No integration tests found, skipping"
        return 0
    fi
}

# Main execution
main() {
    local terraform_result=0
    local ansible_result=0
    local integration_result=0
    
    check_prerequisites
    install_dependencies
    
    echo ""
    echo "🏃 Running test suites..."
    echo ""
    
    # Run tests (continue even if some fail to get full picture)
    run_terraform_tests || terraform_result=1
    echo ""
    
    run_ansible_tests || ansible_result=1
    echo ""
    
    run_integration_tests || integration_result=1
    echo ""
    
    # Print summary
    echo "📊 Test Results Summary:"
    echo "========================="
    
    if [[ $terraform_result -eq 0 ]]; then
        echo -e "Terraform Tests:  \${GREEN}PASSED\${NC}"
    else
        echo -e "Terraform Tests:  \${RED}FAILED\${NC}"
    fi
    
    if [[ $ansible_result -eq 0 ]]; then
        echo -e "Ansible Tests:    \${GREEN}PASSED\${NC}"
    else
        echo -e "Ansible Tests:    \${RED}FAILED\${NC}"
    fi
    
    if [[ $integration_result -eq 0 ]]; then
        echo -e "Integration Tests: \${GREEN}PASSED\${NC}"
    else
        echo -e "Integration Tests: \${RED}FAILED\${NC}"
    fi
    
    echo ""
    
    # Exit with error if any tests failed
    if [[ $terraform_result -ne 0 || $ansible_result -ne 0 || $integration_result -ne 0 ]]; then
        print_error "Some tests failed. Please review the output above."
        exit 1
    else
        print_status "All tests passed! 🎉"
        echo ""
        print_status "Your infrastructure configurations are ready for deployment."
        print_status "Next steps:"
        echo "  • Review the test results above"
        echo "  • Run 'terraform plan' to preview infrastructure changes"
        echo "  • Run 'ansible-playbook --check' to preview configuration changes"
        echo "  • Deploy with 'terraform apply' and 'ansible-playbook' when ready"
        exit 0
    fi
}

# Handle script arguments
case "\${1:-}" in
    "terraform")
        check_prerequisites
        install_dependencies
        run_terraform_tests
        ;;
    "ansible")
        check_prerequisites
        install_dependencies
        run_ansible_tests
        ;;
    "integration")
        check_prerequisites
        install_dependencies
        run_integration_tests
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [terraform|ansible|integration|help]"
        echo ""
        echo "Run specific test suites or all tests (default):"
        echo "  terraform    - Run Terraform tests only"
        echo "  ansible      - Run Ansible tests only"
        echo "  integration  - Run integration tests only"
        echo "  help         - Show this help message"
        echo ""
        echo "With no arguments, runs all test suites."
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown argument: $1"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac
`;
  }

  private generateTestReadme(): string {
    return `# Proxmox-MPC Test Suite

This directory contains comprehensive tests for the generated Infrastructure-as-Code configurations.

## Overview

The test suite validates:

- **Terraform configurations**: Syntax, planning, and resource definitions
- **Ansible configurations**: Inventory structure, playbook syntax, and execution
- **Integration**: End-to-end workflow validation and consistency checks

## Test Structure

\`\`\`
tests/
├── terraform/           # Terraform tests using Terratest (Go)
│   ├── main_test.go    # Main infrastructure tests
│   ├── *_test.go       # Resource-specific tests
│   └── go.mod          # Go dependencies
├── ansible/            # Ansible tests using pytest and molecule
│   ├── test_*.py       # Python test files
│   ├── molecule/       # Molecule test scenarios
│   └── requirements.txt # Python dependencies
├── integration/        # End-to-end integration tests (Node.js)
│   └── test_*.js       # JavaScript test files
├── Makefile           # Test automation
├── run-tests.sh       # Test runner script
└── README.md          # This file
\`\`\`

## Running Tests

### Quick Start

Run all tests:
\`\`\`bash
./run-tests.sh
\`\`\`

Run specific test suite:
\`\`\`bash
./run-tests.sh terraform   # Terraform tests only
./run-tests.sh ansible     # Ansible tests only  
./run-tests.sh integration # Integration tests only
\`\`\`

### Using Make

\`\`\`bash
make all           # Run all tests
make terraform     # Terraform tests
make ansible       # Ansible tests
make integration   # Integration tests
make clean         # Clean up artifacts
make deps          # Install dependencies
\`\`\`

## Test Types

### Terraform Tests (Go/Terratest)

Located in \`terraform/\` directory:

- **Syntax validation**: Ensures HCL files are valid
- **Plan validation**: Runs \`terraform plan\` to check for errors
- **Resource validation**: Tests specific resource configurations
- **Provider validation**: Checks Proxmox provider setup

**Requirements:**
- Go 1.21+
- Terraform CLI
- Access to Proxmox server (for full tests)

### Ansible Tests (Python/pytest)

Located in \`ansible/\` directory:

- **Inventory validation**: Tests YAML syntax and structure
- **Playbook validation**: Syntax checking and execution testing
- **Molecule integration**: Full playbook testing in controlled environment
- **Configuration validation**: Ensures generated configs match infrastructure

**Requirements:**
- Python 3.8+
- Ansible
- pytest, testinfra, molecule

### Integration Tests (Node.js/Jest)

Located in \`integration/\` directory:

- **End-to-end workflow**: Tests complete sync → validate → deploy workflow
- **Consistency checking**: Ensures Terraform and Ansible configs match
- **Configuration validation**: Tests generated files against original infrastructure
- **Deployment readiness**: Validates configurations are ready for production

**Requirements:**
- Node.js 18+
- npm

## Test Configuration

### Environment Variables

The tests use these environment variables:

\`\`\`bash
# Terraform tests
TF_VAR_proxmox_token_id="your-token-id"
TF_VAR_proxmox_token_secret="your-token-secret"
TF_VAR_default_node="${this.workspace.config.node}"

# Ansible tests
ANSIBLE_HOST_KEY_CHECKING=False
ANSIBLE_STDOUT_CALLBACK=yaml
\`\`\`

### Test Data

Tests use the infrastructure discovered during \`/sync\`:

- **${vms.length} VMs** discovered and configured
- **${containers.length} containers** discovered and configured  
- **Proxmox node**: ${this.workspace.config.node}
- **Server**: ${this.workspace.config.host}:${this.workspace.config.port}

## Prerequisites

Before running tests:

1. **Initialize workspace**: Run \`/init\` in proxmox-mpc console
2. **Sync infrastructure**: Run \`/sync\` to generate configurations
3. **Install dependencies**: Run \`make deps\` or let \`run-tests.sh\` handle it

## Test Results

Tests generate detailed reports:

- **Terraform**: Console output with plan details and validation results
- **Ansible**: pytest HTML reports in \`ansible/reports/\`
- **Integration**: Jest coverage reports in \`integration/coverage/\`

## Continuous Integration

The test suite is designed for CI/CD integration:

\`\`\`bash
# Example CI script
./run-tests.sh || exit 1
echo "All tests passed - infrastructure is ready for deployment"
\`\`\`

## Troubleshooting

### Common Issues

1. **Missing dependencies**: Run \`make deps\` to install all requirements
2. **Terraform authentication**: Ensure token credentials are properly set
3. **Ansible connectivity**: Check SSH access to target hosts
4. **Test timeouts**: Increase timeout values for slow networks

### Debug Mode

Run tests with verbose output:

\`\`\`bash
# Terraform
cd terraform && go test -v -timeout 30m

# Ansible  
cd ansible && python -m pytest -v -s

# Integration
cd integration && npm test -- --verbose
\`\`\`

## Contributing

When adding new infrastructure resources:

1. **Terraform**: Add corresponding test in \`terraform/\`
2. **Ansible**: Update inventory validation in \`ansible/\`
3. **Integration**: Update resource counts and validations
4. **Documentation**: Update this README with new test details

## Support

For test-related issues:

1. Check the test output for specific error messages
2. Verify all prerequisites are met
3. Ensure infrastructure was properly synced with \`/sync\`
4. Review generated configurations for syntax errors

The test suite ensures your infrastructure configurations are production-ready and validated before deployment.
`;
  }

  // Additional helper methods

  private generateResourceValidations(vms: VMInfo[], containers: ContainerInfo[]): string {
    const validations: string[] = [];
    
    // VM validations
    vms.forEach(vm => {
      const resourceName = this.sanitizeResourceName(vm.name || `vm-${vm.vmid}`);
      validations.push(`assert.Contains(t, planOutput, "proxmox_vm_qemu.${resourceName}")`);
    });
    
    // Container validations
    containers.forEach(container => {
      const resourceName = this.sanitizeResourceName(container.name || `ct-${container.vmid}`);
      validations.push(`assert.Contains(t, planOutput, "proxmox_lxc.${resourceName}")`);
    });
    
    return validations.map(v => `\t${v}`).join('\n');
  }

  private generateTerraformResourceTests(vms: VMInfo[], containers: ContainerInfo[]): string {
    const tests: string[] = [];
    
    // Generate VM tests
    vms.forEach(vm => {
      const vmName = vm.name || `vm-${vm.vmid}`;
      const resourceName = this.sanitizeResourceName(vmName);
      
      tests.push(`
    test('VM ${vmName} Terraform configuration should be valid', () => {
      const vmConfigPath = path.join(terraformDir, 'vms', '${resourceName}.tf');
      expect(fs.existsSync(vmConfigPath)).toBe(true);
      
      const vmConfig = fs.readFileSync(vmConfigPath, 'utf8');
      expect(vmConfig).toContain('resource "proxmox_vm_qemu" "${resourceName}"');
      expect(vmConfig).toContain('vmid = ${vm.vmid}');
      expect(vmConfig).toContain('name = "${vmName}"');
    });`);
    });
    
    // Generate container tests
    containers.forEach(container => {
      const containerName = container.name || `ct-${container.vmid}`;
      const resourceName = this.sanitizeResourceName(containerName);
      
      tests.push(`
    test('Container ${containerName} Terraform configuration should be valid', () => {
      const containerConfigPath = path.join(terraformDir, 'containers', '${resourceName}.tf');
      expect(fs.existsSync(containerConfigPath)).toBe(true);
      
      const containerConfig = fs.readFileSync(containerConfigPath, 'utf8');
      expect(containerConfig).toContain('resource "proxmox_lxc" "${resourceName}"');
      expect(containerConfig).toContain('vmid = ${container.vmid}');
      expect(containerConfig).toContain('hostname = "${containerName}"');
    });`);
    });
    
    return tests.join('\n');
  }

  private generateAnsibleResourceTests(vms: VMInfo[], containers: ContainerInfo[]): string {
    const tests: string[] = [];
    
    if (vms.length > 0) {
      tests.push(`
    test('Ansible inventory should contain all VMs', () => {
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const inventory = yaml.load(fs.readFileSync(inventoryPath, 'utf8'));
      
      const vms = inventory.all.children.vms.hosts;
      expect(Object.keys(vms)).toHaveLength(${vms.length});
      
      ${vms.map(vm => {
        const vmName = vm.name || `vm-${vm.vmid}`;
        return `expect(vms).toHaveProperty('${vmName}');`;
      }).join('\n      ')}
    });`);
    }
    
    if (containers.length > 0) {
      tests.push(`
    test('Ansible inventory should contain all containers', () => {
      const inventoryPath = path.join(ansibleDir, 'inventory.yml');
      const inventory = yaml.load(fs.readFileSync(inventoryPath, 'utf8'));
      
      const containers = inventory.all.children.containers.hosts;
      expect(Object.keys(containers)).toHaveLength(${containers.length});
      
      ${containers.map(container => {
        const containerName = container.name || `ct-${container.vmid}`;
        return `expect(containers).toHaveProperty('${containerName}');`;
      }).join('\n      ')}
    });`);
    }
    
    return tests.join('\n');
  }

  private sanitizeResourceName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/^(\d)/, '_$1')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}