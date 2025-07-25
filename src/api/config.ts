/**
 * Configuration management for Proxmox API client
 */

import { ProxmoxConfig } from '../types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Load Proxmox configuration from environment variables
 */
export function loadProxmoxConfig(): ProxmoxConfig {
  const requiredEnvVars = [
    'PROXMOX_HOST',
    'PROXMOX_USERNAME', 
    'PROXMOX_TOKEN_ID',
    'PROXMOX_TOKEN_SECRET',
    'PROXMOX_NODE'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    host: process.env.PROXMOX_HOST!,
    port: parseInt(process.env.PROXMOX_PORT || '8006'),
    username: process.env.PROXMOX_USERNAME!,
    tokenId: process.env.PROXMOX_TOKEN_ID!,
    tokenSecret: process.env.PROXMOX_TOKEN_SECRET!,
    node: process.env.PROXMOX_NODE!,
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  };
}

/**
 * Validate Proxmox configuration
 */
export function validateConfig(config: ProxmoxConfig): string[] {
  const errors: string[] = [];

  if (!config.host) {
    errors.push('Host is required');
  }

  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Port must be between 1 and 65535');
  }

  if (!config.username) {
    errors.push('Username is required');
  }

  if (!config.tokenId) {
    errors.push('Token ID is required');
  }

  if (!config.tokenSecret) {
    errors.push('Token secret is required');
  }

  if (!config.node) {
    errors.push('Node name is required');
  }

  return errors;
}

/**
 * Create a safe config object for logging (without sensitive data)
 */
export function sanitizeConfig(config: ProxmoxConfig): Partial<ProxmoxConfig> {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    node: config.node,
    rejectUnauthorized: config.rejectUnauthorized,
  };
}