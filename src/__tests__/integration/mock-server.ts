/**
 * Mock Proxmox Server for Integration Testing
 * Provides realistic API responses for testing without requiring a real Proxmox server
 */

import express, { Request, Response } from 'express';
import { Server } from 'http';

export interface MockVMData {
  vmid: number;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  node: string;
  cpus?: number;
  maxmem?: number;
  cpu?: number;
  mem?: number;
  uptime?: number;
  template?: boolean;
  tags?: string;
}

export interface MockContainerData {
  vmid: number;
  name: string;
  status: 'running' | 'stopped';
  node: string;
  cpus?: number;
  maxmem?: number;
  cpu?: number;
  mem?: number;
  uptime?: number;
  template?: boolean;
  tags?: string;
}

export interface MockTaskData {
  upid: string;
  type: string;
  status: 'running' | 'stopped' | 'OK';
  user: string;
  starttime: number;
  endtime?: number;
  pid: number;
  node: string;
  id?: string;
  exitstatus?: string;
}

export class MockProxmoxServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number;
  
  // Mock data stores
  private nodes: any[] = [
    {
      node: 'pve-node1',
      status: 'online',
      cpu: 0.15,
      maxcpu: 8,
      mem: 2147483648,
      maxmem: 8589934592,
      uptime: 86400,
      level: '',
      id: 'node/pve-node1'
    }
  ];
  
  private vms: Map<string, MockVMData[]> = new Map();
  private containers: Map<string, MockContainerData[]> = new Map();
  private tasks: Map<string, MockTaskData[]> = new Map();
  private storage: any[] = [
    {
      storage: 'local',
      type: 'dir',
      enabled: 1,
      shared: 0,
      content: 'iso,vztmpl,backup',
      total: 107374182400,
      used: 53687091200,
      avail: 53687091200
    },
    {
      storage: 'local-lvm',
      type: 'lvmthin',
      enabled: 1,
      shared: 0,
      content: 'images,rootdir',
      total: 53687091200,
      used: 10737418240,
      avail: 42949672960
    }
  ];
  
  private taskIdCounter = 1000;

  constructor(port: number = 8006) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
    this.initializeDefaultData();
  }

  private initializeDefaultData(): void {
    // Initialize some default VMs and containers for testing
    this.vms.set('pve-node1', [
      {
        vmid: 100,
        name: 'test-vm-1',
        status: 'stopped',
        node: 'pve-node1',
        cpus: 2,
        maxmem: 2147483648,
        cpu: 0,
        mem: 0
      },
      {
        vmid: 101,
        name: 'test-vm-2',
        status: 'running',
        node: 'pve-node1',
        cpus: 4,
        maxmem: 4294967296,
        cpu: 0.25,
        mem: 1073741824,
        uptime: 3600
      }
    ]);

    this.containers.set('pve-node1', [
      {
        vmid: 200,
        name: 'test-container-1',
        status: 'stopped',
        node: 'pve-node1',
        cpus: 1,
        maxmem: 1073741824,
        cpu: 0,
        mem: 0
      },
      {
        vmid: 201,
        name: 'test-container-2',
        status: 'running',
        node: 'pve-node1',
        cpus: 2,
        maxmem: 2147483648,
        cpu: 0.15,
        mem: 536870912,
        uptime: 7200
      }
    ]);

    this.tasks.set('pve-node1', []);
  }

  private setupRoutes(): void {
    // Version endpoint
    this.app.get('/api2/json/version', (req: Request, res: Response) => {
      res.json({
        data: {
          version: '7.4-3',
          release: 'pve',
          repoid: 'a2a0d8a2',
          keyboard: 'en-us'
        }
      });
    });

    // Nodes endpoints
    this.app.get('/api2/json/nodes', (req: Request, res: Response) => {
      res.json({ data: this.nodes });
    });

    this.app.get('/api2/json/nodes/:node/status', (req: Request, res: Response) => {
      const node = this.nodes.find(n => n.node === req.params.node);
      if (!node) {
        return res.status(404).json({ 
          errors: [{ message: `Node '${req.params.node}' not found` }] 
        });
      }
      res.json({ data: node });
    });

    // VM endpoints
    this.app.get('/api2/json/nodes/:node/qemu', (req: Request, res: Response) => {
      const nodeVMs = this.vms.get(req.params.node) || [];
      res.json({ data: nodeVMs });
    });

    this.app.get('/api2/json/nodes/:node/qemu/:vmid/status/current', (req: Request, res: Response) => {
      const nodeVMs = this.vms.get(req.params.node) || [];
      const vm = nodeVMs.find(v => v.vmid === parseInt(req.params.vmid));
      if (!vm) {
        return res.status(404).json({ 
          errors: [{ message: `VM '${req.params.vmid}' not found` }] 
        });
      }
      res.json({ data: vm });
    });

    this.app.get('/api2/json/nodes/:node/qemu/:vmid/config', (req: Request, res: Response) => {
      const nodeVMs = this.vms.get(req.params.node) || [];
      const vm = nodeVMs.find(v => v.vmid === parseInt(req.params.vmid));
      if (!vm) {
        return res.status(404).json({ 
          errors: [{ message: `VM '${req.params.vmid}' not found` }] 
        });
      }
      
      res.json({ 
        data: {
          cores: vm.cpus || 1,
          memory: vm.maxmem ? vm.maxmem / 1024 / 1024 : 512,
          name: vm.name,
          ostype: 'l26',
          boot: 'c',
          bootdisk: 'scsi0',
          'scsi0': 'local-lvm:vm-100-disk-0,size=32G'
        }
      });
    });

    // VM lifecycle operations
    this.app.post('/api2/json/nodes/:node/qemu', (req: Request, res: Response) => {
      const vmid = parseInt(req.body.vmid);
      const nodeVMs = this.vms.get(req.params.node) || [];
      
      // Check if VM ID already exists
      if (nodeVMs.find(v => v.vmid === vmid)) {
        return res.status(400).json({
          errors: [{ message: `VM with ID ${vmid} already exists` }]
        });
      }

      // Create new VM
      const newVM: MockVMData = {
        vmid,
        name: req.body.name || `vm-${vmid}`,
        status: 'stopped',
        node: req.params.node,
        cpus: req.body.cores || 1,
        maxmem: (req.body.memory || 512) * 1024 * 1024,
        cpu: 0,
        mem: 0
      };

      nodeVMs.push(newVM);
      this.vms.set(req.params.node, nodeVMs);

      const task = this.createTask(req.params.node, 'qmcreate', 'root@pam', vmid.toString());
      res.json({ data: task.upid });
    });

    this.app.post('/api2/json/nodes/:node/qemu/:vmid/status/start', (req: Request, res: Response) => {
      const nodeVMs = this.vms.get(req.params.node) || [];
      const vm = nodeVMs.find(v => v.vmid === parseInt(req.params.vmid));
      
      if (!vm) {
        return res.status(404).json({ 
          errors: [{ message: `VM '${req.params.vmid}' not found` }] 
        });
      }

      if (vm.status === 'running') {
        return res.status(400).json({
          errors: [{ message: `VM is already running` }]
        });
      }

      // Simulate start operation
      setTimeout(() => {
        vm.status = 'running';
        vm.cpu = 0.1 + Math.random() * 0.4;
        vm.mem = Math.floor(vm.maxmem! * (0.3 + Math.random() * 0.4));
        vm.uptime = Math.floor(Date.now() / 1000);
      }, 2000);

      const task = this.createTask(req.params.node, 'qmstart', 'root@pam', req.params.vmid);
      res.json({ data: task.upid });
    });

    this.app.post('/api2/json/nodes/:node/qemu/:vmid/status/stop', (req: Request, res: Response) => {
      const nodeVMs = this.vms.get(req.params.node) || [];
      const vm = nodeVMs.find(v => v.vmid === parseInt(req.params.vmid));
      
      if (!vm) {
        return res.status(404).json({ 
          errors: [{ message: `VM '${req.params.vmid}' not found` }] 
        });
      }

      if (vm.status === 'stopped') {
        return res.status(400).json({
          errors: [{ message: `VM is already stopped` }]
        });
      }

      // Simulate stop operation
      setTimeout(() => {
        vm.status = 'stopped';
        vm.cpu = 0;
        vm.mem = 0;
        delete vm.uptime;
      }, 1500);

      const task = this.createTask(req.params.node, req.body.forceStop ? 'qmstop' : 'qmshutdown', 'root@pam', req.params.vmid);
      res.json({ data: task.upid });
    });

    this.app.post('/api2/json/nodes/:node/qemu/:vmid/status/shutdown', (req: Request, res: Response) => {
      const nodeVMs = this.vms.get(req.params.node) || [];
      const vm = nodeVMs.find(v => v.vmid === parseInt(req.params.vmid));
      
      if (!vm) {
        return res.status(404).json({ 
          errors: [{ message: `VM '${req.params.vmid}' not found` }] 
        });
      }

      // Simulate shutdown operation
      setTimeout(() => {
        vm.status = 'stopped';
        vm.cpu = 0;
        vm.mem = 0;
        delete vm.uptime;
      }, 3000);

      const task = this.createTask(req.params.node, 'qmshutdown', 'root@pam', req.params.vmid);
      res.json({ data: task.upid });
    });

    this.app.delete('/api2/json/nodes/:node/qemu/:vmid', (req: Request, res: Response) => {
      const nodeVMs = this.vms.get(req.params.node) || [];
      const vmIndex = nodeVMs.findIndex(v => v.vmid === parseInt(req.params.vmid));
      
      if (vmIndex === -1) {
        return res.status(404).json({ 
          errors: [{ message: `VM '${req.params.vmid}' not found` }] 
        });
      }

      const vm = nodeVMs[vmIndex];
      if (vm.status === 'running' && !req.query.force) {
        return res.status(400).json({
          errors: [{ message: `VM is running - stop it first or use force` }]
        });
      }

      // Remove VM after delay
      setTimeout(() => {
        nodeVMs.splice(vmIndex, 1);
        this.vms.set(req.params.node, nodeVMs);
      }, 2000);

      const task = this.createTask(req.params.node, 'qmdestroy', 'root@pam', req.params.vmid);
      res.json({ data: task.upid });
    });

    // Container endpoints
    this.app.get('/api2/json/nodes/:node/lxc', (req: Request, res: Response) => {
      const nodeContainers = this.containers.get(req.params.node) || [];
      res.json({ data: nodeContainers });
    });

    this.app.get('/api2/json/nodes/:node/lxc/:vmid/status/current', (req: Request, res: Response) => {
      const nodeContainers = this.containers.get(req.params.node) || [];
      const container = nodeContainers.find(c => c.vmid === parseInt(req.params.vmid));
      if (!container) {
        return res.status(404).json({ 
          errors: [{ message: `Container '${req.params.vmid}' not found` }] 
        });
      }
      res.json({ data: container });
    });

    this.app.get('/api2/json/nodes/:node/lxc/:vmid/config', (req: Request, res: Response) => {
      const nodeContainers = this.containers.get(req.params.node) || [];
      const container = nodeContainers.find(c => c.vmid === parseInt(req.params.vmid));
      if (!container) {
        return res.status(404).json({ 
          errors: [{ message: `Container '${req.params.vmid}' not found` }] 
        });
      }
      
      res.json({ 
        data: {
          cores: container.cpus || 1,
          memory: container.maxmem ? container.maxmem / 1024 / 1024 : 512,
          hostname: container.name,
          ostype: 'ubuntu',
          rootfs: 'local-lvm:vm-200-disk-0,size=8G',
          net0: 'name=eth0,bridge=vmbr0,ip=dhcp'
        }
      });
    });

    // Container lifecycle operations  
    this.app.post('/api2/json/nodes/:node/lxc', (req: Request, res: Response) => {
      const vmid = parseInt(req.body.vmid);
      const nodeContainers = this.containers.get(req.params.node) || [];
      
      if (nodeContainers.find(c => c.vmid === vmid)) {
        return res.status(400).json({
          errors: [{ message: `Container with ID ${vmid} already exists` }]
        });
      }

      const newContainer: MockContainerData = {
        vmid,
        name: req.body.hostname || `ct-${vmid}`,
        status: 'stopped',
        node: req.params.node,
        cpus: req.body.cores || 1,
        maxmem: (req.body.memory || 512) * 1024 * 1024,
        cpu: 0,
        mem: 0
      };

      nodeContainers.push(newContainer);
      this.containers.set(req.params.node, nodeContainers);

      const task = this.createTask(req.params.node, 'pct_create', 'root@pam', vmid.toString());
      res.json({ data: task.upid });
    });

    this.app.post('/api2/json/nodes/:node/lxc/:vmid/status/start', (req: Request, res: Response) => {
      const nodeContainers = this.containers.get(req.params.node) || [];
      const container = nodeContainers.find(c => c.vmid === parseInt(req.params.vmid));
      
      if (!container) {
        return res.status(404).json({ 
          errors: [{ message: `Container '${req.params.vmid}' not found` }] 
        });
      }

      setTimeout(() => {
        container.status = 'running';
        container.cpu = 0.05 + Math.random() * 0.2;
        container.mem = Math.floor(container.maxmem! * (0.2 + Math.random() * 0.3));
        container.uptime = Math.floor(Date.now() / 1000);
      }, 1500);

      const task = this.createTask(req.params.node, 'pct_start', 'root@pam', req.params.vmid);
      res.json({ data: task.upid });
    });

    this.app.post('/api2/json/nodes/:node/lxc/:vmid/status/stop', (req: Request, res: Response) => {
      const nodeContainers = this.containers.get(req.params.node) || [];
      const container = nodeContainers.find(c => c.vmid === parseInt(req.params.vmid));
      
      if (!container) {
        return res.status(404).json({ 
          errors: [{ message: `Container '${req.params.vmid}' not found` }] 
        });
      }

      setTimeout(() => {
        container.status = 'stopped';
        container.cpu = 0;
        container.mem = 0;
        delete container.uptime;
      }, 1000);

      const task = this.createTask(req.params.node, 'pct_stop', 'root@pam', req.params.vmid);
      res.json({ data: task.upid });
    });

    this.app.delete('/api2/json/nodes/:node/lxc/:vmid', (req: Request, res: Response) => {
      const nodeContainers = this.containers.get(req.params.node) || [];
      const containerIndex = nodeContainers.findIndex(c => c.vmid === parseInt(req.params.vmid));
      
      if (containerIndex === -1) {
        return res.status(404).json({ 
          errors: [{ message: `Container '${req.params.vmid}' not found` }] 
        });
      }

      setTimeout(() => {
        nodeContainers.splice(containerIndex, 1);
        this.containers.set(req.params.node, nodeContainers);
      }, 1500);

      const task = this.createTask(req.params.node, 'pct_destroy', 'root@pam', req.params.vmid);
      res.json({ data: task.upid });
    });

    // Storage endpoints
    this.app.get('/api2/json/storage', (req: Request, res: Response) => {
      res.json({ data: this.storage });
    });

    this.app.get('/api2/json/nodes/:node/storage', (req: Request, res: Response) => {
      res.json({ data: this.storage });
    });

    // Task endpoints
    this.app.get('/api2/json/nodes/:node/tasks', (req: Request, res: Response) => {
      const nodeTasks = this.tasks.get(req.params.node) || [];
      res.json({ data: nodeTasks.slice(0, 50) }); // Limit to recent tasks
    });

    this.app.get('/api2/json/nodes/:node/tasks/:upid/status', (req: Request, res: Response) => {
      const nodeTasks = this.tasks.get(req.params.node) || [];
      const task = nodeTasks.find(t => t.upid === req.params.upid);
      
      if (!task) {
        return res.status(404).json({ 
          errors: [{ message: `Task '${req.params.upid}' not found` }] 
        });
      }

      res.json({ data: task });
    });

    this.app.get('/api2/json/nodes/:node/tasks/:upid/log', (req: Request, res: Response) => {
      const logs = [
        'task started',
        'processing...',
        'operation completed successfully',
        'TASK OK'
      ];
      res.json({ data: logs.map((log, index) => ({ n: index + 1, t: log })) });
    });

    // Error handling
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ 
        errors: [{ message: `Endpoint not found: ${req.method} ${req.path}` }] 
      });
    });
  }

  private createTask(node: string, type: string, user: string, id?: string): MockTaskData {
    const upid = `UPID:${node}:${String(this.taskIdCounter).padStart(8, '0')}:${type}:${id || ''}:${user}:`;
    const task: MockTaskData = {
      upid,
      type,
      status: 'running',
      user,
      starttime: Math.floor(Date.now() / 1000),
      pid: this.taskIdCounter,
      node,
      id
    };

    // Simulate task completion after random delay
    setTimeout(() => {
      task.status = 'OK';
      task.endtime = Math.floor(Date.now() / 1000);
      task.exitstatus = 'OK';
    }, 1000 + Math.random() * 3000);

    const nodeTasks = this.tasks.get(node) || [];
    nodeTasks.unshift(task); // Add to beginning for recency
    this.tasks.set(node, nodeTasks);

    this.taskIdCounter++;
    return task;
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Mock Proxmox server running on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    return this.port;
  }

  // Helper methods for test setup
  public addVM(node: string, vm: MockVMData): void {
    const nodeVMs = this.vms.get(node) || [];
    nodeVMs.push(vm);
    this.vms.set(node, nodeVMs);
  }

  public addContainer(node: string, container: MockContainerData): void {
    const nodeContainers = this.containers.get(node) || [];
    nodeContainers.push(container);
    this.containers.set(node, nodeContainers);
  }

  public clearData(): void {
    this.vms.clear();
    this.containers.clear();
    this.tasks.clear();
    this.initializeDefaultData();
  }

  public getVM(node: string, vmid: number): MockVMData | undefined {
    const nodeVMs = this.vms.get(node) || [];
    return nodeVMs.find(vm => vm.vmid === vmid);
  }

  public getContainer(node: string, vmid: number): MockContainerData | undefined {
    const nodeContainers = this.containers.get(node) || [];
    return nodeContainers.find(container => container.vmid === vmid);
  }
}