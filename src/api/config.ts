/**
 * Configuration management for Proxmox API client
 * @deprecated Use ConfigManager from '../config' instead
 */

import { ConfigManager } from '../config';

// Re-export unified configuration functions for backward compatibility
export const loadProxmoxConfig = ConfigManager.loadFromEnvironment;
export const validateConfig = ConfigManager.getProxmoxConfigErrors; // Returns array for CLI compatibility
export const sanitizeConfig = ConfigManager.sanitizeConfig;