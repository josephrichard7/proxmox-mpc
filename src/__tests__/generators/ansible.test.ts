/**
 * Tests for Ansible Generator
 * Verifies Ansible inventory and playbook generation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { AnsibleGenerator } from '../../generators/ansible';
import { ProjectWorkspace } from '../../workspace';
import { VMInfo, ContainerInfo } from '../../types';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('js-yaml');

describe('AnsibleGenerator', () => {
  let generator: AnsibleGenerator;
  let mockWorkspace: ProjectWorkspace;
  let mockFS: jest.Mocked<typeof fs>;
  let mockYaml: jest.Mocked<typeof yaml>;

  beforeEach(() => {
    mockWorkspace = {
      name: 'test-workspace',
      rootPath: '/test/workspace',
      config: {
        host: '192.168.1.100',
        port: 8006,
        username: 'root@pam',
        tokenId: 'test-token',
        tokenSecret: 'test-secret',
        node: 'proxmox',
        rejectUnauthorized: false
      }
    } as any;

    generator = new AnsibleGenerator(mockWorkspace);
    mockFS = jest.mocked(fs);
    mockYaml = jest.mocked(yaml);
    
    // Mock fs methods
    mockFS.mkdir = jest.fn().mockResolvedValue(undefined);
    mockFS.writeFile = jest.fn().mockResolvedValue(undefined);
    
    // Mock yaml.dump
    mockYaml.dump = jest.fn().mockReturnValue('mocked-yaml-content');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateInventory', () => {
    it('should generate proper Ansible inventory with VMs and containers', async () => {
      const vms: VMInfo[] = [
        {
          vmid: 100,
          name: 'web-server',
          status: 'running',
          node: 'proxmox',
          cpus: 2,
          maxmem: 2147483648, // 2GB
          maxdisk: 21474836480, // 20GB
          netin: 0,
          netout: 0,
          diskread: 0,
          diskwrite: 0,
          cpu: 0.1,
          mem: 1000000000,
          uptime: 3600
        },
        {
          vmid: 101,
          name: 'db-server',
          status: 'stopped',
          node: 'proxmox',
          cpus: 4,
          maxmem: 4294967296, // 4GB
          maxdisk: 42949672960, // 40GB
          netin: 0,
          netout: 0,
          diskread: 0,
          diskwrite: 0,
          cpu: 0,
          mem: 0,
          uptime: 0
        }
      ];

      const containers: ContainerInfo[] = [
        {
          vmid: 200,
          name: 'proxy',
          status: 'running',
          node: 'proxmox',
          cpus: 1,
          maxmem: 1073741824, // 1GB
          maxswap: 1073741824,
          maxdisk: 8589934592, // 8GB
          netin: 0,
          netout: 0,
          diskread: 0,
          diskwrite: 0,
          cpu: 0.05,
          mem: 500000000,
          uptime: 7200
        }
      ];

      await generator.generateInventory(vms, containers);

      // Verify file write
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/ansible/inventory.yml',
        expect.stringContaining('# Ansible Inventory')
      );

      // Verify yaml.dump was called with proper inventory structure
      expect(mockYaml.dump).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.objectContaining({
            vars: expect.objectContaining({
              ansible_user: 'root',
              ansible_ssh_common_args: '-o StrictHostKeyChecking=no',
              ansible_python_interpreter: '/usr/bin/python3',
            }),
            children: expect.objectContaining({
              proxmox_nodes: expect.objectContaining({
                hosts: expect.objectContaining({
                  proxmox: expect.objectContaining({
                    ansible_host: '192.168.1.100'
                  })
                })
              }),
              vms: expect.objectContaining({
                hosts: expect.objectContaining({
                  'web-server': expect.objectContaining({
                    vmid: 100,
                    status: 'running',
                    cores: 2,
                    memory_mb: 2048
                  }),
                  'db-server': expect.objectContaining({
                    vmid: 101,
                    status: 'stopped',
                    cores: 4,
                    memory_mb: 4096
                  })
                })
              }),
              containers: expect.objectContaining({
                hosts: expect.objectContaining({
                  'proxy': expect.objectContaining({
                    vmid: 200,
                    status: 'running',
                    cores: 1,
                    memory_mb: 1024
                  })
                })
              }),
              running: expect.objectContaining({
                hosts: expect.objectContaining({
                  'web-server': expect.any(Object),
                  'proxy': expect.any(Object)
                })
              }),
              stopped: expect.objectContaining({
                hosts: expect.objectContaining({
                  'db-server': expect.any(Object)
                })
              })
            })
          })
        }),
        expect.objectContaining({
          indent: 2,
          lineWidth: -1,
          noRefs: true,
          sortKeys: false
        })
      );
    });

    it('should handle empty VMs and containers lists', async () => {
      await generator.generateInventory([], []);

      expect(mockYaml.dump).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.objectContaining({
            children: expect.objectContaining({
              vms: expect.objectContaining({
                hosts: {}
              }),
              containers: expect.objectContaining({
                hosts: {}
              }),
              running: expect.objectContaining({
                hosts: {}
              }),
              stopped: expect.objectContaining({
                hosts: {}
              })
            })
          })
        }),
        expect.any(Object)
      );
    });

    it('should handle resources without names', async () => {
      const vms: VMInfo[] = [
        {
          vmid: 100,
          name: undefined,
          status: 'running',
          node: 'proxmox',
          cpus: 1,
          maxmem: 1073741824,
          maxdisk: 10737418240,
          netin: 0,
          netout: 0,
          diskread: 0,
          diskwrite: 0,
          cpu: 0,
          mem: 0,
          uptime: 0
        } as any
      ];

      const containers: ContainerInfo[] = [
        {
          vmid: 200,
          name: undefined,
          status: 'running',
          node: 'proxmox',
          cpus: 1,
          maxmem: 1073741824,
          maxswap: 1073741824,
          maxdisk: 8589934592,
          netin: 0,
          netout: 0,
          diskread: 0,
          diskwrite: 0,
          cpu: 0,
          mem: 0,
          uptime: 0
        } as any
      ];

      await generator.generateInventory(vms, containers);

      expect(mockYaml.dump).toHaveBeenCalledWith(
        expect.objectContaining({
          all: expect.objectContaining({
            children: expect.objectContaining({
              vms: expect.objectContaining({
                hosts: expect.objectContaining({
                  'vm-100': expect.objectContaining({
                    vmid: 100
                  })
                })
              }),
              containers: expect.objectContaining({
                hosts: expect.objectContaining({
                  'ct-200': expect.objectContaining({
                    vmid: 200
                  })
                })
              })
            })
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('generatePlaybooks', () => {
    it('should generate main site playbook', async () => {
      const vms: VMInfo[] = [
        { vmid: 100, name: 'test-vm', status: 'running', node: 'proxmox', cpus: 1, maxmem: 1073741824, maxdisk: 10737418240, netin: 0, netout: 0, diskread: 0, diskwrite: 0, cpu: 0, mem: 0, uptime: 0 }
      ];
      const containers: ContainerInfo[] = [];

      await generator.generatePlaybooks(vms, containers);

      // Verify directory creation
      expect(mockFS.mkdir).toHaveBeenCalledWith('/test/workspace/ansible/playbooks', { recursive: true });

      // Verify site playbook creation
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/ansible/playbooks/site.yml',
        expect.stringContaining('# Main Site Playbook')
      );

      // Verify playbook structure was passed to yaml.dump
      expect(mockYaml.dump).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Proxmox Infrastructure Management',
            hosts: 'all',
            gather_facts: true,
            become: true,
            vars: expect.objectContaining({
              project_name: 'test-workspace',
              generated_by: 'proxmox-mpc'
            }),
            tasks: expect.arrayContaining([
              expect.objectContaining({
                name: 'Display host information'
              }),
              expect.objectContaining({
                name: 'Ensure system is up to date (VMs only)'
              }),
              expect.objectContaining({
                name: 'Install common packages'
              })
            ])
          })
        ]),
        expect.any(Object)
      );
    });

    it('should generate VM-specific playbook when VMs exist', async () => {
      const vms: VMInfo[] = [
        { vmid: 100, name: 'test-vm', status: 'running', node: 'proxmox', cpus: 1, maxmem: 1073741824, maxdisk: 10737418240, netin: 0, netout: 0, diskread: 0, diskwrite: 0, cpu: 0, mem: 0, uptime: 0 }
      ];
      const containers: ContainerInfo[] = [];

      await generator.generatePlaybooks(vms, containers);

      // Verify VM playbook creation
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/ansible/playbooks/vms.yml',
        expect.stringContaining('# VM Configuration Playbook')
      );
    });

    it('should generate container-specific playbook when containers exist', async () => {
      const vms: VMInfo[] = [];
      const containers: ContainerInfo[] = [
        { vmid: 200, name: 'test-ct', status: 'running', node: 'proxmox', cpus: 1, maxmem: 1073741824, maxswap: 1073741824, maxdisk: 8589934592, netin: 0, netout: 0, diskread: 0, diskwrite: 0, cpu: 0, mem: 0, uptime: 0 }
      ];

      await generator.generatePlaybooks(vms, containers);

      // Verify container playbook creation
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/ansible/playbooks/containers.yml',
        expect.stringContaining('# Container Configuration Playbook')
      );
    });

    it('should always generate maintenance playbook', async () => {
      await generator.generatePlaybooks([], []);

      // Verify maintenance playbook creation
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/ansible/playbooks/maintenance.yml',
        expect.stringContaining('# Infrastructure Maintenance Playbook')
      );
    });

    it('should generate all playbooks when both VMs and containers exist', async () => {
      const vms: VMInfo[] = [
        { vmid: 100, name: 'test-vm', status: 'running', node: 'proxmox', cpus: 1, maxmem: 1073741824, maxdisk: 10737418240, netin: 0, netout: 0, diskread: 0, diskwrite: 0, cpu: 0, mem: 0, uptime: 0 }
      ];
      const containers: ContainerInfo[] = [
        { vmid: 200, name: 'test-ct', status: 'running', node: 'proxmox', cpus: 1, maxmem: 1073741824, maxswap: 1073741824, maxdisk: 8589934592, netin: 0, netout: 0, diskread: 0, diskwrite: 0, cpu: 0, mem: 0, uptime: 0 }
      ];

      await generator.generatePlaybooks(vms, containers);

      // Should generate all 4 playbooks
      expect(mockFS.writeFile).toHaveBeenCalledTimes(4);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('site.yml'),
        expect.any(String)
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('vms.yml'),
        expect.any(String)
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('containers.yml'),
        expect.any(String)
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('maintenance.yml'),
        expect.any(String)
      );
    });
  });

  describe('playbook content verification', () => {
    it('should generate VM playbook with proper VM-specific tasks', async () => {
      const vms: VMInfo[] = [
        { vmid: 100, name: 'test-vm', status: 'running', node: 'proxmox', cpus: 1, maxmem: 1073741824, maxdisk: 10737418240, netin: 0, netout: 0, diskread: 0, diskwrite: 0, cpu: 0, mem: 0, uptime: 0 }
      ];

      await generator.generatePlaybooks(vms, []);

      // Find the call that generated the VM playbook
      const vmPlaybookCall = (mockYaml.dump as jest.Mock).mock.calls.find(call => 
        Array.isArray(call[0]) && call[0][0]?.name === 'VM Configuration Management'
      );

      expect(vmPlaybookCall).toBeDefined();
      expect(vmPlaybookCall[0][0]).toMatchObject({
        name: 'VM Configuration Management',
        hosts: 'vms',
        tasks: expect.arrayContaining([
          expect.objectContaining({
            name: 'Install VM-specific packages',
            apt: expect.objectContaining({
              name: expect.arrayContaining(['qemu-guest-agent', 'cloud-init', 'openssh-server'])
            })
          }),
          expect.objectContaining({
            name: 'Ensure qemu-guest-agent is running'
          })
        ])
      });
    });

    it('should generate container playbook with proper container-specific tasks', async () => {
      const containers: ContainerInfo[] = [
        { vmid: 200, name: 'test-ct', status: 'running', node: 'proxmox', cpus: 1, maxmem: 1073741824, maxswap: 1073741824, maxdisk: 8589934592, netin: 0, netout: 0, diskread: 0, diskwrite: 0, cpu: 0, mem: 0, uptime: 0 }
      ];

      await generator.generatePlaybooks([], containers);

      // Find the call that generated the container playbook
      const containerPlaybookCall = (mockYaml.dump as jest.Mock).mock.calls.find(call => 
        Array.isArray(call[0]) && call[0][0]?.name === 'Container Configuration Management'
      );

      expect(containerPlaybookCall).toBeDefined();
      expect(containerPlaybookCall[0][0]).toMatchObject({
        name: 'Container Configuration Management',
        hosts: 'containers',
        tasks: expect.arrayContaining([
          expect.objectContaining({
            name: 'Install container-specific packages',
            apt: expect.objectContaining({
              name: expect.arrayContaining(['openssh-server', 'rsyslog'])
            })
          }),
          expect.objectContaining({
            name: 'Ensure SSH is running'
          })
        ])
      });
    });
  });
});