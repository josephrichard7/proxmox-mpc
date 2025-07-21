/**
 * Basic setup verification tests
 */

describe('Project Setup', () => {
  test('should import main module without errors', () => {
    expect(() => {
      require('../index');
    }).not.toThrow();
  });

  test('should have required environment variables defined in example', () => {
    const fs = require('fs');
    const envExample = fs.readFileSync('.env.example', 'utf-8');
    
    expect(envExample).toContain('PROXMOX_HOST');
    expect(envExample).toContain('PROXMOX_USERNAME');
    expect(envExample).toContain('DATABASE_URL');
  });

  test('should export types correctly', () => {
    const types = require('../types');
    expect(types).toBeDefined();
  });
});