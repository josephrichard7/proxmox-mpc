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