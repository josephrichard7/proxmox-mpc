/**
 * Unified Configuration Management for Proxmox-MPC
 * 
 * Centralizes all configuration loading, validation, and management across
 * the application. Provides consistent interfaces for workspace configuration,
 * environment variables, and validation patterns.
 * 
 * @example
 * ```typescript
 * // Load workspace configuration
 * const config = await ConfigManager.loadWorkspaceConfig('/path/to/workspace/.proxmox/config.yml');
 * 
 * // Validate configuration
 * ConfigManager.validateWorkspaceConfig(config);
 * 
 * // Create default configuration
 * const defaultConfig = ConfigManager.createDefaultWorkspaceConfig('my-project');
 * 
 * // Save configuration
 * await ConfigManager.saveWorkspaceConfig('/path/to/config.yml', defaultConfig);
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import * as dotenv from 'dotenv';
import * as yaml from 'js-yaml';

import { ProxmoxConfig } from '../types';
import { getVersion } from '../utils/version';

// Load environment variables
dotenv.config();

/**
 * Base configuration interface
 */
export interface BaseConfig {
  version?: string;
  created?: string;
}

/**
 * Workspace-specific configuration that extends Proxmox config
 */
export interface WorkspaceConfig extends ProxmoxConfig, BaseConfig {
  name?: string;
  description?: string;
}

/**
 * Application configuration for global settings
 */
export interface AppConfig extends BaseConfig {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  maxConnections?: number;
  timeout?: number;
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  public readonly field: string;
  public readonly value: any;

  constructor(field: string, value: any, message: string) {
    super(`Configuration validation failed for '${field}': ${message}`);
    this.field = field;
    this.value = value;
    this.name = 'ConfigValidationError';
  }
}

/**
 * Unified configuration manager
 * 
 * Provides static methods for managing all types of configuration across
 * the Proxmox-MPC application. Handles workspace configs, environment
 * variables, validation, and file operations.
 * 
 * All methods are static and can be called directly on the class.
 */
export class ConfigManager {
  /**
   * Load Proxmox configuration from environment variables
   */
  static loadFromEnvironment(): ProxmoxConfig {
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
   * Load workspace configuration from YAML file
   */
  static async loadWorkspaceConfig(configPath: string): Promise<WorkspaceConfig> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = yaml.load(content) as WorkspaceConfig;
      
      this.validateWorkspaceConfig(config);
      return config;
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new Error(`Failed to load workspace configuration from ${configPath}: ${error}`);
    }
  }

  /**
   * Save workspace configuration to YAML file
   */
  static async saveWorkspaceConfig(configPath: string, config: WorkspaceConfig): Promise<void> {
    try {
      this.validateWorkspaceConfig(config);
      
      const yamlContent = yaml.dump(config, {
        indent: 2,
        sortKeys: true,
        lineWidth: -1
      });
      
      await fs.writeFile(configPath, yamlContent, 'utf-8');
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new Error(`Failed to save workspace configuration to ${configPath}: ${error}`);
    }
  }

  /**
   * Validate Proxmox configuration
   */
  static validateProxmoxConfig(config: ProxmoxConfig): void {
    const errors = this.getProxmoxConfigErrors(config);

    if (errors.length > 0) {
      throw new ConfigValidationError('proxmox', config, errors.join(', '));
    }
  }

  /**
   * Get validation errors for Proxmox configuration (for backward compatibility)
   */
  static getProxmoxConfigErrors(config: ProxmoxConfig): string[] {
    const errors: string[] = [];

    if (!config.host?.trim()) {
      errors.push('Host is required and cannot be empty');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    if (!config.username?.trim()) {
      errors.push('Username is required and cannot be empty');
    }

    if (!config.tokenId?.trim()) {
      errors.push('Token ID is required and cannot be empty');
    }

    if (!config.tokenSecret?.trim()) {
      errors.push('Token secret is required and cannot be empty');
    }

    if (!config.node?.trim()) {
      errors.push('Node name is required and cannot be empty');
    }

    return errors;
  }

  /**
   * Validate workspace configuration
   */
  static validateWorkspaceConfig(config: WorkspaceConfig): void {
    // Validate the Proxmox config portion
    this.validateProxmoxConfig(config);

    // Additional workspace-specific validation
    if (config.name && config.name.trim().length === 0) {
      throw new ConfigValidationError('name', config.name, 'Name cannot be empty if provided');
    }

    if (config.version && !config.version.match(/^\d+\.\d+\.\d+$/)) {
      throw new ConfigValidationError('version', config.version, 'Version must follow semver format (x.y.z)');
    }
  }

  /**
   * Create default workspace configuration
   */
  static createDefaultWorkspaceConfig(name: string): WorkspaceConfig {
    return {
      name,
      version: getVersion(),
      created: new Date().toISOString(),
      host: 'your-proxmox-server.local',
      port: 8006,
      username: 'root@pam',
      tokenId: 'your-token-id',
      tokenSecret: 'your-token-secret',
      node: 'your-node-name',
      rejectUnauthorized: true
    };
  }

  /**
   * Sanitize configuration for logging (removes sensitive data)
   */
  static sanitizeConfig<T extends ProxmoxConfig>(config: T): Partial<T> {
    const { tokenSecret, password, ...sanitized } = config as any;
    return {
      host: config.host,
      port: config.port,
      username: config.username,
      node: config.node,
      rejectUnauthorized: config.rejectUnauthorized
    } as Partial<T>;
  }

  /**
   * Merge configurations with precedence: specific > environment > defaults
   */
  static mergeConfigs<T extends Record<string, any>>(
    defaults: T,
    environment: Partial<T>,
    specific: Partial<T>
  ): T {
    return {
      ...defaults,
      ...environment,
      ...specific
    };
  }

  /**
   * Get configuration file path for workspace
   */
  static getWorkspaceConfigPath(workspacePath: string): string {
    return path.join(workspacePath, '.proxmox', 'config.yml');
  }

  /**
   * Check if workspace configuration exists
   */
  static async configExists(configPath: string): Promise<boolean> {
    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Re-export for compatibility
export { ProxmoxConfig, WorkspaceConfig as WorkspaceConfigType };

// Re-export validation functions for backward compatibility
export const loadProxmoxConfig = ConfigManager.loadFromEnvironment;
export const validateConfig = ConfigManager.getProxmoxConfigErrors; // Returns array for CLI compatibility
export const sanitizeConfig = ConfigManager.sanitizeConfig;