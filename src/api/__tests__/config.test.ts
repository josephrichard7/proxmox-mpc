/**
 * Unit tests for configuration management
 */

import { loadProxmoxConfig, validateConfig, sanitizeConfig } from '../config';
import { ProxmoxConfig } from '../../types';

describe('Configuration Management', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadProxmoxConfig', () => {
    it('should load configuration from environment variables', () => {
      process.env.PROXMOX_HOST = 'test.local';
      process.env.PROXMOX_PORT = '8006';
      process.env.PROXMOX_USERNAME = 'root@pam';
      process.env.PROXMOX_TOKEN_ID = 'test-token';
      process.env.PROXMOX_TOKEN_SECRET = 'secret';
      process.env.PROXMOX_NODE = 'pve';
      process.env.NODE_ENV = 'development';

      const config = loadProxmoxConfig();

      expect(config).toEqual({
        host: 'test.local',
        port: 8006,
        username: 'root@pam',
        tokenId: 'test-token',
        tokenSecret: 'secret',
        node: 'pve',
        rejectUnauthorized: false // NODE_ENV !== 'production'
      });
    });

    it('should use default port when not specified', () => {
      process.env.PROXMOX_HOST = 'test.local';
      process.env.PROXMOX_USERNAME = 'root@pam';
      process.env.PROXMOX_TOKEN_ID = 'test-token';
      process.env.PROXMOX_TOKEN_SECRET = 'secret';
      process.env.PROXMOX_NODE = 'pve';

      const config = loadProxmoxConfig();

      expect(config.port).toBe(8006);
    });

    it('should set rejectUnauthorized true in production', () => {
      process.env.PROXMOX_HOST = 'test.local';
      process.env.PROXMOX_USERNAME = 'root@pam';
      process.env.PROXMOX_TOKEN_ID = 'test-token';
      process.env.PROXMOX_TOKEN_SECRET = 'secret';
      process.env.PROXMOX_NODE = 'pve';
      process.env.NODE_ENV = 'production';

      const config = loadProxmoxConfig();

      expect(config.rejectUnauthorized).toBe(true);
    });

    it('should throw error when required variables are missing', () => {
      // Clear all required variables
      delete process.env.PROXMOX_HOST;
      delete process.env.PROXMOX_USERNAME;
      delete process.env.PROXMOX_TOKEN_ID;
      delete process.env.PROXMOX_TOKEN_SECRET;
      delete process.env.PROXMOX_NODE;

      expect(() => loadProxmoxConfig()).toThrow(
        'Missing required environment variables:'
      );
    });
  });

  describe('validateConfig', () => {
    const validConfig: ProxmoxConfig = {
      host: 'test.local',
      port: 8006,
      username: 'root@pam',
      tokenId: 'test-token',
      tokenSecret: 'secret',
      node: 'pve'
    };

    it('should return no errors for valid configuration', () => {
      const errors = validateConfig(validConfig);
      expect(errors).toEqual([]);
    });

    it('should validate required fields', () => {
      const invalidConfig = { ...validConfig, host: '', username: '', tokenId: '' };
      const errors = validateConfig(invalidConfig);
      
      expect(errors).toContain('Host is required');
      expect(errors).toContain('Username is required');
      expect(errors).toContain('Token ID is required');
    });

    it('should validate port range', () => {
      const invalidConfig = { ...validConfig, port: 0 };
      const errors = validateConfig(invalidConfig);
      
      expect(errors).toContain('Port must be between 1 and 65535');
    });

    it('should validate port upper bound', () => {
      const invalidConfig = { ...validConfig, port: 70000 };
      const errors = validateConfig(invalidConfig);
      
      expect(errors).toContain('Port must be between 1 and 65535');
    });
  });

  describe('sanitizeConfig', () => {
    it('should remove sensitive data from config', () => {
      const config: ProxmoxConfig = {
        host: 'test.local',
        port: 8006,
        username: 'root@pam',
        tokenId: 'test-token',
        tokenSecret: 'secret-data',
        node: 'pve',
        password: 'password-data',
        rejectUnauthorized: false
      };

      const sanitized = sanitizeConfig(config);

      expect(sanitized).toEqual({
        host: 'test.local',
        port: 8006,
        username: 'root@pam',
        node: 'pve',
        rejectUnauthorized: false
      });

      expect(sanitized).not.toHaveProperty('tokenSecret');
      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).not.toHaveProperty('tokenId');
    });
  });
});