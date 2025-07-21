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