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