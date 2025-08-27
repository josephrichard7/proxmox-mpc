/**
 * Sync Command
 * Discovers existing Proxmox infrastructure and generates Infrastructure-as-Code
 */

import { ProxmoxClient } from '../../api';
import { AnsibleGenerator } from '../../generators/ansible';
import { TerraformGenerator } from '../../generators/terraform';
import { TestGenerator } from '../../generators/tests';
import { observability } from '../../observability';
import { errorHandler } from '../error-handler';
import { ConsoleSession } from '../repl';

export class SyncCommand {
  private logger = observability.logger;
  private tracer = observability.tracer;
  private metrics = observability.metrics;

  async execute(args: string[], session: ConsoleSession): Promise<void> {
    // Start tracing for the entire sync operation
    const traceId = this.tracer.startTrace('sync', {
      workspace: session.workspace?.name || 'unknown',
      command: 'sync'
    });
    
    const startTime = Date.now();
    
    this.logger.operationStart('sync', 'initialization', {
      workspace: session.workspace?.rootPath,
      proxmoxServer: session.workspace?.config.host
    });

    console.log('🔄 Synchronizing Proxmox infrastructure...\n');

    // Check if we're in a workspace
    if (!errorHandler.validateSession(session, 'sync')) {
      this.tracer.finishSpanWithError(traceId, new Error('No workspace detected'));
      return;
    }

    try {
      // Connect to Proxmox server
      const connectSpan = this.tracer.startSpan('connect', traceId, {
        server: session.workspace!.config.host,
        port: session.workspace!.config.port.toString()
      });

      const client = session.client || new ProxmoxClient(session.workspace!.config);
      const connectStartTime = Date.now();
      const connectionResult = await client.connect();
      const connectDuration = Date.now() - connectStartTime;
      
      this.metrics.recordProxmoxMetrics('connect', 'POST', connectDuration, connectionResult.success);
      
      if (!connectionResult.success) {
        console.log('❌ Failed to connect to Proxmox server');
        console.log(`   Error: ${connectionResult.error}`);
        
        this.logger.error('Proxmox connection failed', new Error(connectionResult.error || 'Connection failed'), {
          workspace: session.workspace!.rootPath,
          proxmoxServer: session.workspace!.config.host,
          resourcesAffected: []
        }, [
          'Check network connectivity to Proxmox server',
          'Verify server address and port in workspace config',
          'Check API token permissions'
        ]);
        
        this.tracer.finishSpanWithError(connectSpan, new Error(connectionResult.error || 'Connection failed'));
        this.tracer.finishSpanWithError(traceId, new Error('Sync failed due to connection error'));
        return;
      }

      console.log('✅ Connected to Proxmox server');
      session.client = client;
      
      this.logger.info('Proxmox connection established', {
        workspace: session.workspace!.rootPath,
        proxmoxServer: session.workspace!.config.host,
        resourcesAffected: [],
        duration: connectDuration
      });
      
      this.tracer.finishSpan(connectSpan, { duration: connectDuration.toString() });

      // Phase 1: Infrastructure Discovery
      await this.discoverInfrastructure(client, session, traceId);

      // Phase 2: Generate Terraform configurations
      await this.generateTerraformConfigs(client, session, traceId);

      // Phase 3: Generate Ansible configurations
      await this.generateAnsibleConfigs(client, session, traceId);

      // Phase 4: Generate TDD test suite
      await this.generateTestSuite(client, session, traceId);

      // Phase 5: Update local database
      await this.updateLocalDatabase(client, session, traceId);

      const totalDuration = Date.now() - startTime;
      
      console.log('\n✅ Infrastructure synchronization complete!');
      console.log('\n📂 Generated files:');
      console.log('   • terraform/*.tf - Infrastructure resources');
      console.log('   • ansible/inventory.yml - Server inventory');
      console.log('   • ansible/playbooks/*.yml - Configuration playbooks');
      console.log('   • tests/ - Comprehensive TDD test suite');
      console.log('     ├── terraform/ - Terratest Go tests');
      console.log('     ├── ansible/ - pytest and molecule tests');
      console.log('     └── integration/ - End-to-end workflow tests');
      
      console.log('\n🚀 Next steps:');
      console.log('   • Use /status to verify imported infrastructure'); 
      console.log('   • Use /test to validate configurations and run TDD tests');
      console.log('   • Run ./tests/run-tests.sh for comprehensive validation');
      console.log('   • Use /apply to deploy any changes after validation');

      // Record successful completion
      this.logger.operationSuccess('sync', 'completion', totalDuration, {
        workspace: session.workspace!.rootPath,
        proxmoxServer: session.workspace!.config.host,
        resourcesAffected: []
      });
      
      this.metrics.recordDuration('sync', totalDuration, {
        success: 'true',
        workspace: session.workspace!.name
      });
      
      this.tracer.finishSpan(traceId, {
        duration: totalDuration.toString(),
        success: 'true'
      });

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      
      console.error(`❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`);
      
      this.logger.operationFailure('sync', 'execution', error as Error, totalDuration, {
        workspace: session.workspace?.rootPath,
        proxmoxServer: session.workspace?.config.host,
        resourcesAffected: []
      }, [
        'Check logs with /logs --level error for detailed error information',
        'Use /debug on for verbose troubleshooting',
        'Use /report-issue to generate diagnostic report for AI assistance'
      ]);
      
      this.metrics.recordDuration('sync', totalDuration, {
        success: 'false',
        workspace: session.workspace?.name || 'unknown'
      });
      
      this.tracer.finishSpanWithError(traceId, error as Error);
    }
  }

  private async discoverInfrastructure(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    const spanId = this.tracer.startSpan('discovery', parentTraceId, {
      phase: 'infrastructure-discovery'
    });
    
    console.log('🔍 Phase 1: Discovering infrastructure...');

    try {
      // Get all nodes
      const nodes = await client.getNodes();
      console.log(`   📍 Found ${nodes.length} node(s): ${nodes.map(n => n.node).join(', ')}`);

      let totalVMs = 0;
      let totalContainers = 0;

      // Discover resources on each node
      for (const node of nodes) {
        console.log(`\n   🖥️  Scanning node: ${node.node}`);
        
        // Get VMs
        try {
          const vms = await client.getVMs(node.node);
          if (vms.length > 0) {
            console.log(`   📦 VMs found: ${vms.map(vm => `${vm.vmid}:${vm.name}(${vm.status})`).join(', ')}`);
            totalVMs += vms.length;
          }
        } catch (error) {
          console.log(`   📦 VMs: Unable to retrieve from node ${node.node}`);
        }

        // Get containers
        try {
          const containers = await client.getContainers(node.node);
          if (containers.length > 0) {
            console.log(`   📦 Containers found: ${containers.map(c => `${c.vmid}:${c.name}(${c.status})`).join(', ')}`);
            totalContainers += containers.length;
          }
        } catch (error) {
          console.log(`   📦 Containers: Unable to retrieve from node ${node.node}`);
        }

        // Get storage
        try {
          const storage = await client.getStoragePools();
          console.log(`   💾 Storage pools: ${storage.length} found`);
        } catch (error) {
          console.log(`   💾 Storage pools: Unable to retrieve`);
        }
      }

      console.log(`\n   📊 Discovery summary: ${totalVMs} VMs, ${totalContainers} containers across ${nodes.length} node(s)`);
      
      this.logger.info('Infrastructure discovery completed', {
        workspace: session.workspace?.rootPath,
        resourcesAffected: [`${totalVMs} VMs`, `${totalContainers} containers`]
      });
      
      this.tracer.finishSpan(spanId, {
        totalVMs: totalVMs.toString(),
        totalContainers: totalContainers.toString(),
        nodes: nodes.length.toString()
      });

    } catch (error) {
      this.logger.error('Infrastructure discovery failed', error as Error, {
        workspace: session.workspace?.rootPath,
        resourcesAffected: []
      });
      
      this.tracer.finishSpanWithError(spanId, error as Error);
      throw new Error(`Infrastructure discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateTerraformConfigs(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    console.log('\n🏗️  Phase 2: Generating Terraform configurations...');

    try {
      const generator = new TerraformGenerator(session.workspace!);
      
      // Initialize generator with template detection
      console.log('🔍 Detecting Proxmox templates and configurations...');
      await generator.initialize();
      
      // Get all nodes for resource discovery
      const nodes = await client.getNodes();
      
      for (const node of nodes) {
        // Generate VM configurations
        try {
          const vms = await client.getVMs(node.node);
          for (const vm of vms) {
            await generator.generateVMResource(vm);
            console.log(`   📝 Generated terraform/vms/${vm.name || vm.vmid}.tf`);
          }
        } catch (error) {
          console.log(`   ⚠️  Could not generate VM configurations for node ${node.node}`);
        }

        // Generate container configurations
        try {
          const containers = await client.getContainers(node.node);
          for (const container of containers) {
            await generator.generateContainerResource(container);
            console.log(`   📝 Generated terraform/containers/${container.name || container.vmid}.tf`);
          }
        } catch (error) {
          console.log(`   ⚠️  Could not generate container configurations for node ${node.node}`);
        }
      }

      // Generate provider and variables configuration
      await generator.generateProviderConfig();
      console.log(`   📝 Generated terraform/main.tf`);

    } catch (error) {
      throw new Error(`Terraform generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateAnsibleConfigs(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    console.log('\n🎵 Phase 3: Generating Ansible configurations...');

    try {
      const generator = new AnsibleGenerator(session.workspace!);
      
      // Generate dynamic inventory
      const nodes = await client.getNodes();
      const allVMs = [];
      const allContainers = [];

      for (const node of nodes) {
        try {
          const vms = await client.getVMs(node.node);
          allVMs.push(...vms);
        } catch (error) {
          console.log(`   ⚠️  Could not retrieve VMs for node ${node.node}`);
        }
        
        try {
          const containers = await client.getContainers(node.node);
          allContainers.push(...containers);
        } catch (error) {
          console.log(`   ⚠️  Could not retrieve containers for node ${node.node}`);
        }
      }

      await generator.generateInventory(allVMs, allContainers);
      console.log(`   📝 Generated ansible/inventory.yml`);

      // Generate basic playbooks
      await generator.generatePlaybooks(allVMs, allContainers);
      console.log(`   📝 Generated ansible/playbooks/site.yml`);

    } catch (error) {
      throw new Error(`Ansible generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateTestSuite(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    console.log('\n🧪 Phase 4: Generating TDD test suite...');

    try {
      const testGenerator = new TestGenerator(session.workspace!);
      
      // Collect all infrastructure data for test generation
      const nodes = await client.getNodes();
      const allVMs: any[] = [];
      const allContainers: any[] = [];
      let allStorage: any[] = [];
      
      // Gather all resources from all nodes
      for (const node of nodes) {
        try {
          const vms = await client.getVMs(node.node);
          allVMs.push(...vms);
          
          const containers = await client.getContainers(node.node);
          allContainers.push(...containers);
        } catch (error) {
          console.log(`   ⚠️  Could not get resources from node ${node.node}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Get storage information
      try {
        allStorage = await client.getStoragePools();
      } catch (error) {
        console.log(`   ⚠️  Could not get storage information: ${error instanceof Error ? error.message : String(error)}`);
        allStorage = [];
      }
      
      // Generate comprehensive test suite
      await testGenerator.generateTestSuite(allVMs, allContainers, allStorage);
      
      console.log('   ✅ Generated comprehensive TDD test suite');
      console.log(`   📊 Test coverage: ${allVMs.length + allContainers.length} resources, ${nodes.length} nodes`);
      console.log('   🏗️  Terraform tests: Syntax validation, planning, resource verification');
      console.log('   🎵 Ansible tests: Inventory validation, playbook syntax, molecule integration');
      console.log('   🔗 Integration tests: End-to-end workflow and consistency validation');

    } catch (error) {
      throw new Error(`Test generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateLocalDatabase(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    const spanId = this.tracer.startSpan('database-sync', parentTraceId, {
      phase: 'database-synchronization'
    });

    console.log('\n💽 Phase 5: Updating local database...');

    try {
      // Get workspace-specific database client
      const dbClient = await session.workspace!.getDatabaseClient();
      
      // Initialize repositories with workspace database
      const { 
        NodeRepository,
        VMRepository,
        ContainerRepository,
        StorageRepository,
        StateSnapshotRepository
      } = await import('../../database/repositories');

      const nodeRepo = new NodeRepository();
      const vmRepo = new VMRepository();
      const containerRepo = new ContainerRepository();
      const storageRepo = new StorageRepository();
      const stateSnapshotRepo = new StateSnapshotRepository();

      // Start database transaction for consistency
      console.log('   🔄 Starting database transaction...');

      await dbClient.$transaction(async (tx: any) => {
        const syncStats = {
          nodes: { created: 0, updated: 0, errors: 0 },
          vms: { created: 0, updated: 0, errors: 0 },
          containers: { created: 0, updated: 0, errors: 0 },
          storage: { created: 0, updated: 0, errors: 0 }
        };

        // Phase 5.1: Sync Nodes
        console.log('   📍 Synchronizing nodes...');
        const nodes = await client.getNodes();
        
        for (const nodeData of nodes) {
          try {
            const existingNode = await nodeRepo.findById(nodeData.node);
            
            const nodeInput = {
              id: nodeData.node,
              status: nodeData.status || 'unknown',
              cpuUsage: nodeData.cpu || 0,
              cpuMax: nodeData.maxcpu || 0,
              memoryUsage: BigInt(nodeData.mem || 0),
              memoryMax: BigInt(nodeData.maxmem || 0),
              diskUsage: BigInt(0), // Node API doesn't provide disk info
              diskMax: BigInt(0), // Node API doesn't provide disk info
              uptime: nodeData.uptime || 0,
              loadAverage: '0.0', // Node API doesn't provide load average
              kernelVersion: '', // Node API doesn't provide kernel version
              pveVersion: '' // Node API doesn't provide PVE version
            };

            if (existingNode) {
              await nodeRepo.update(nodeData.node, nodeInput);
              syncStats.nodes.updated++;
            } else {
              await nodeRepo.create(nodeInput);
              syncStats.nodes.created++;
            }

            // Create state snapshot for node
            await stateSnapshotRepo.create({
              snapshotTime: new Date(),
              resourceType: 'node',
              resourceId: nodeData.node,
              resourceData: JSON.stringify(nodeData),
              changeType: existingNode ? 'updated' : 'discovered'
            });

          } catch (error) {
            syncStats.nodes.errors++;
            this.logger.error(`Node sync failed for ${nodeData.node}`, error as Error, {
              workspace: session.workspace?.rootPath,
              resourcesAffected: [nodeData.node]
            });
          }
        }

        // Phase 5.2: Sync VMs
        console.log('   📦 Synchronizing VMs...');
        let totalVMs = 0;
        
        for (const node of nodes) {
          try {
            const vms = await client.getVMs(node.node);
            totalVMs += vms.length;
            
            for (const vmData of vms) {
              try {
                const existingVM = await vmRepo.findById(vmData.vmid);
                
                const vmInput = {
                  id: vmData.vmid,
                  nodeId: node.node,
                  name: vmData.name || `vm-${vmData.vmid}`,
                  status: vmData.status || 'unknown',
                  template: vmData.template === true,
                  cpuCores: vmData.cpus || 1,
                  cpuUsage: vmData.cpu || 0,
                  memoryBytes: BigInt(vmData.maxmem || 0),
                  memoryUsage: BigInt(vmData.mem || 0),
                  diskSize: BigInt(vmData.maxdisk || 0),
                  diskUsage: BigInt(vmData.disk || 0),
                  networkIn: BigInt(0), // VM API doesn't provide network in
                  networkOut: BigInt(0), // VM API doesn't provide network out
                  uptime: vmData.uptime || 0,
                  pid: vmData.pid || 0,
                  haManaged: vmData.ha_state ? true : false,
                  lockStatus: vmData.lock || undefined,
                  configDigest: undefined // VM API doesn't provide digest
                };

                if (existingVM) {
                  await vmRepo.update(vmData.vmid, vmInput);
                  syncStats.vms.updated++;
                } else {
                  await vmRepo.create(vmInput);
                  syncStats.vms.created++;
                }

                // Create state snapshot for VM
                await stateSnapshotRepo.create({
                  snapshotTime: new Date(),
                  resourceType: 'vm',
                  resourceId: vmData.vmid.toString(),
                  resourceData: JSON.stringify(vmData),
                  changeType: existingVM ? 'updated' : 'discovered'
                });

              } catch (error) {
                syncStats.vms.errors++;
                this.logger.error(`VM sync failed for ${vmData.vmid}`, error as Error, {
                  workspace: session.workspace?.rootPath,
                  resourcesAffected: [`vm-${vmData.vmid}`]
                });
              }
            }
          } catch (error) {
            this.logger.error(`VM discovery failed for node ${node.node}`, error as Error, {
              workspace: session.workspace?.rootPath,
              resourcesAffected: [node.node]
            });
          }
        }

        // Phase 5.3: Sync Containers
        console.log('   📦 Synchronizing containers...');
        let totalContainers = 0;
        
        for (const node of nodes) {
          try {
            const containers = await client.getContainers(node.node);
            totalContainers += containers.length;
            
            for (const containerData of containers) {
              try {
                const existingContainer = await containerRepo.findById(containerData.vmid);
                
                const containerInput = {
                  id: containerData.vmid,
                  nodeId: node.node,
                  name: containerData.name || `ct-${containerData.vmid}`,
                  status: containerData.status || 'unknown',
                  template: containerData.template === true,
                  cpuCores: containerData.cpus || 1,
                  cpuUsage: containerData.cpu || 0,
                  memoryBytes: BigInt(containerData.maxmem || 0),
                  memoryUsage: BigInt(containerData.mem || 0),
                  diskSize: BigInt(containerData.maxdisk || 0),
                  diskUsage: BigInt(containerData.disk || 0),
                  networkIn: BigInt(0), // Container API doesn't provide network in
                  networkOut: BigInt(0), // Container API doesn't provide network out
                  uptime: containerData.uptime || 0,
                  osType: 'unknown', // Container API doesn't provide ostype in list
                  tags: containerData.tags || undefined,
                  lockStatus: containerData.lock || undefined,
                  configDigest: undefined // Container API doesn't provide digest
                };

                if (existingContainer) {
                  await containerRepo.update(containerData.vmid, containerInput);
                  syncStats.containers.updated++;
                } else {
                  await containerRepo.create(containerInput);
                  syncStats.containers.created++;
                }

                // Create state snapshot for container
                await stateSnapshotRepo.create({
                  snapshotTime: new Date(),
                  resourceType: 'container',
                  resourceId: containerData.vmid.toString(),
                  resourceData: JSON.stringify(containerData),
                  changeType: existingContainer ? 'updated' : 'discovered'
                });

              } catch (error) {
                syncStats.containers.errors++;
                this.logger.error(`Container sync failed for ${containerData.vmid}`, error as Error, {
                  workspace: session.workspace?.rootPath,
                  resourcesAffected: [`container-${containerData.vmid}`]
                });
              }
            }
          } catch (error) {
            this.logger.error(`Container discovery failed for node ${node.node}`, error as Error, {
              workspace: session.workspace?.rootPath,
              resourcesAffected: [node.node]
            });
          }
        }

        // Phase 5.4: Sync Storage
        console.log('   💾 Synchronizing storage pools...');
        try {
          const storagePools = await client.getStoragePools();
          
          for (const storageData of storagePools) {
            try {
              const existingStorage = await storageRepo.findById(storageData.storage);
              
              const storageInput = {
                id: storageData.storage,
                type: storageData.type || 'unknown',
                enabled: storageData.enabled === true,
                shared: storageData.shared === true,
                content: storageData.content || '',
                totalBytes: BigInt(storageData.total || 0),
                usedBytes: BigInt(storageData.used || 0),
                availableBytes: BigInt(storageData.avail || 0)
              };

              if (existingStorage) {
                await storageRepo.update(storageData.storage, storageInput);
                syncStats.storage.updated++;
              } else {
                await storageRepo.create(storageInput);
                syncStats.storage.created++;
              }

              // Create state snapshot for storage
              await stateSnapshotRepo.create({
                snapshotTime: new Date(),
                resourceType: 'storage',
                resourceId: storageData.storage,
                resourceData: JSON.stringify(storageData),
                changeType: existingStorage ? 'updated' : 'discovered'
              });

            } catch (error) {
              syncStats.storage.errors++;
              this.logger.error(`Storage sync failed for ${storageData.storage}`, error as Error, {
                workspace: session.workspace?.rootPath,
                resourcesAffected: [storageData.storage]
              });
            }
          }
        } catch (error) {
          this.logger.error('Storage discovery failed', error as Error, {
            workspace: session.workspace?.rootPath,
            resourcesAffected: []
          });
        }

        // Display sync results
        console.log('   ✅ Database synchronization completed');
        console.log(`   📊 Sync Statistics:`);
        console.log(`      • Nodes: ${syncStats.nodes.created} created, ${syncStats.nodes.updated} updated, ${syncStats.nodes.errors} errors`);
        console.log(`      • VMs: ${syncStats.vms.created} created, ${syncStats.vms.updated} updated, ${syncStats.vms.errors} errors`);
        console.log(`      • Containers: ${syncStats.containers.created} created, ${syncStats.containers.updated} updated, ${syncStats.containers.errors} errors`);
        console.log(`      • Storage: ${syncStats.storage.created} created, ${syncStats.storage.updated} updated, ${syncStats.storage.errors} errors`);

        const totalResources = totalVMs + totalContainers + nodes.length;
        console.log(`   📈 Total resources synchronized: ${totalResources}`);

        // Log successful database sync
        this.logger.info('Database synchronization completed', {
          workspace: session.workspace?.rootPath,
          resourcesAffected: [`${totalResources} resources`],
          syncStats: syncStats
        });

      }, {
        timeout: 60000 // 60 second timeout for database transaction
      });

      // Close workspace database connection
      await dbClient.$disconnect();

      this.tracer.finishSpan(spanId, {
        success: 'true'
      });

    } catch (error) {
      this.logger.error('Database synchronization failed', error as Error, {
        workspace: session.workspace?.rootPath,
        resourcesAffected: []
      }, [
        'Check database connectivity and permissions',
        'Verify workspace database schema is up to date',
        'Use /logs --level error for detailed error information'
      ]);

      this.tracer.finishSpanWithError(spanId, error as Error);
      throw new Error(`Database update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}