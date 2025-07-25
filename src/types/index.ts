/**
 * Type definitions for Proxmox-MPC
 */

export interface ProxmoxConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  tokenId?: string;
  tokenSecret?: string;
  node: string;
  rejectUnauthorized?: boolean; // false for homelab self-signed certs
}

export interface ProxmoxNode {
  id: string;
  name: string;
  status: 'online' | 'offline';
  type: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
}

export interface ProxmoxVM {
  vmid: number;
  name: string;
  status: 'running' | 'stopped' | 'suspended';
  node: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
}

export interface ProxmoxContainer {
  vmid: number;
  name: string;
  status: 'running' | 'stopped' | 'suspended';
  node: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
}

// API Response Types
export interface ProxmoxResponse<T = any> {
  data: T;
  errors?: Record<string, string>;
}

export interface ConnectionResult {
  success: boolean;
  version?: string;
  node?: string;
  error?: string;
  details?: any;
}

export interface VersionInfo {
  version: string;
  release: string;
  repoid: string;
}

export interface NodeInfo {
  node: string;
  status: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  uptime: number;
}

// VM Discovery Types
export interface VMInfo {
  vmid: number;
  name?: string;
  status: string;
  node: string;
  cpu?: number;
  cpus?: number;
  maxmem?: number;
  mem?: number;
  maxdisk?: number;
  disk?: number;
  uptime?: number;
  pid?: number;
  template?: boolean;
  tags?: string;
  ha_state?: string;
  lock?: string;
}

export interface VMConfig {
  vmid: number;
  name?: string;
  description?: string;
  cores?: number;
  sockets?: number;
  memory?: number;
  boot?: string;
  ostype?: string;
  ide0?: string;
  net0?: string;
  [key: string]: any; // For additional config fields
}

// Container Discovery Types
export interface ContainerInfo {
  vmid: number;
  name?: string;
  status: string;
  node: string;
  cpu?: number;
  cpus?: number;
  maxmem?: number;
  mem?: number;
  maxdisk?: number;
  disk?: number;
  uptime?: number;
  template?: boolean;
  tags?: string;
  ha_state?: string;
  lock?: string;
}

export interface ContainerConfig {
  vmid: number;
  hostname?: string;
  description?: string;
  cores?: number;
  memory?: number;
  swap?: number;
  ostemplate?: string;
  rootfs?: string;
  net0?: string;
  [key: string]: any; // For additional config fields
}

// Storage Discovery Types
export interface StorageInfo {
  storage: string;
  type: string;
  content?: string;
  enabled?: boolean;
  shared?: boolean;
  total?: number;
  used?: number;
  avail?: number;
  nodes?: string;
}

export interface StorageContent {
  volid: string;
  content: string;
  format?: string;
  size?: number;
  used?: number;
  ctime?: number;
  notes?: string;
}

// Task Discovery Types
export interface TaskInfo {
  upid: string;
  node: string;
  pid: number;
  type: string;
  id?: string;
  user: string;
  status: string;
  starttime: number;
  endtime?: number;
  exitstatus?: string;
}

// VM Creation Types
export interface VMCreateConfig {
  vmid: number;
  name?: string;
  cores?: number;
  sockets?: number;
  memory?: number;           // MB
  ostype?: string;          // l26, win10, etc.
  ide0?: string;            // Boot disk configuration
  net0?: string;            // Network configuration
  template?: string;        // Clone from template
  storage?: string;         // Default storage pool
  start?: boolean;          // Start after creation
  description?: string;     // VM description
  boot?: string;           // Boot order
  cdrom?: string;          // CD-ROM configuration
  cpu?: string;            // CPU type
  kvm?: boolean;           // Enable KVM
  numa?: boolean;          // Enable NUMA
  agent?: string;          // QEMU agent options
  balloon?: number;        // Memory balloon size
  bios?: string;           // BIOS type (seabios/ovmf)
  machine?: string;        // Machine type
  tablet?: boolean;        // Enable tablet device
  vga?: string;            // VGA display type
  [key: string]: any;      // Allow additional properties
}

export interface VMCreationResult {
  upid: string;
  vmid: number;
  node: string;
  task: TaskInfo;
}

export interface VMDeleteOptions {
  skipLock?: boolean;
  force?: boolean;
  destroyUnreferencedDisks?: boolean;
}

// Container Creation Types
export interface ContainerCreateConfig {
  vmid: number;
  hostname?: string;
  cores?: number;
  memory?: number;           // MB
  swap?: number;            // MB
  ostemplate: string;       // Required for container creation (e.g., 'local:vztmpl/ubuntu-20.04-standard_20.04-1_amd64.tar.gz')
  rootfs?: string;          // Root filesystem configuration (e.g., 'local-lvm:8')
  net0?: string;            // Network configuration (e.g., 'name=eth0,bridge=vmbr0,ip=dhcp')
  storage?: string;         // Default storage pool for container
  start?: boolean;          // Start after creation
  description?: string;     // Container description
  unprivileged?: boolean;   // Create as unprivileged container (default: true)
  features?: string;        // Container features (e.g., 'nesting=1')
  password?: string;        // Root password
  ssh_public_keys?: string; // SSH public keys for root user
  arch?: string;            // Architecture (amd64, i386, etc.)
  console?: boolean;        // Enable console access
  cmode?: string;           // Console mode (shell, console)
  onboot?: boolean;         // Start on boot
  protection?: boolean;     // Enable protection
  tags?: string;            // Tags for container
  [key: string]: any;       // Allow additional properties
}

export interface ContainerCreationResult {
  upid: string;
  vmid: number;
  node: string;
  task: TaskInfo;
}

export interface ContainerDeleteOptions {
  skipLock?: boolean;
  force?: boolean;
  purge?: boolean;          // Remove container from all related configurations
}