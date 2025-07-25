/**
 * Tests for CLI utilities
 */

import {
  formatOutput,
  filterResources,
  formatBytes,
  formatDuration,
  Spinner,
  Colors
} from '../utils';

describe('CLI Utils', () => {
  describe('formatOutput', () => {
    const testData = [
      { id: 1, name: 'test1', status: 'running' },
      { id: 2, name: 'test2', status: 'stopped' }
    ];

    it('should format as JSON', () => {
      const result = formatOutput(testData, 'json');
      expect(result).toBe(JSON.stringify(testData, null, 2));
    });

    it('should format as YAML', () => {
      const result = formatOutput(testData, 'yaml');
      expect(result).toContain('- id: 1');
      expect(result).toContain('  name: test1');
    });

    it('should return empty string for quiet format', () => {
      const result = formatOutput(testData, 'quiet');
      expect(result).toBe('');
    });

    it('should format as table by default', () => {
      const result = formatOutput(testData, 'table');
      expect(result).toContain('id');
      expect(result).toContain('name');
      expect(result).toContain('status');
    });
  });

  describe('filterResources', () => {
    const resources = [
      { name: 'web-server', status: 'running', node: 'pve1', tags: 'production,web' },
      { name: 'db-server', status: 'stopped', node: 'pve2', tags: 'production,database' },
      { name: 'test-vm', status: 'running', node: 'pve1', tags: 'development' },
    ];

    it('should filter by status', () => {
      const result = filterResources(resources, { status: 'running' });
      expect(result).toHaveLength(2);
      expect(result.every(r => r.status === 'running')).toBe(true);
    });

    it('should filter by node', () => {
      const result = filterResources(resources, { node: 'pve1' });
      expect(result).toHaveLength(2);
      expect(result.every(r => r.node === 'pve1')).toBe(true);
    });

    it('should filter by tags', () => {
      const result = filterResources(resources, { tags: 'production' });
      expect(result).toHaveLength(2);
      expect(result.every(r => r.tags.includes('production'))).toBe(true);
    });

    it('should filter by name', () => {
      const result = filterResources(resources, { name: 'server' });
      expect(result).toHaveLength(2);
      expect(result.every(r => r.name.includes('server'))).toBe(true);
    });

    it('should combine multiple filters', () => {
      const result = filterResources(resources, { 
        status: 'running', 
        node: 'pve1' 
      });
      expect(result).toHaveLength(2);
      expect(result.every(r => r.status === 'running' && r.node === 'pve1')).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(1024)).toBe('1KB');
      expect(formatBytes(1024 * 1024)).toBe('1MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1GB');
      expect(formatBytes(1536)).toBe('1.5KB');
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(3661)).toBe('1h 1m');
      expect(formatDuration(90061)).toBe('1d 1h');
    });
  });

  describe('Spinner', () => {
    let spinner: Spinner;
    let consoleLogSpy: jest.SpyInstance;
    let stdoutWriteSpy: jest.SpyInstance;

    beforeEach(() => {
      spinner = new Spinner();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    });

    afterEach(() => {
      spinner.stop();
      consoleLogSpy.mockRestore();
      stdoutWriteSpy.mockRestore();
    });

    it('should start and stop spinner', () => {
      spinner.start('Testing...');
      expect(stdoutWriteSpy).toHaveBeenCalled();
      
      spinner.stop();
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\r\x1B[K\x1B[?25h');
    });

    it('should succeed with message', () => {
      spinner.succeed('Test completed');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Test completed')
      );
    });

    it('should fail with message', () => {
      spinner.fail('Test failed');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Test failed')
      );
    });
  });

  describe('Colors', () => {
    it('should have color constants', () => {
      expect(Colors.reset).toBe('\x1b[0m');
      expect(Colors.red).toBe('\x1b[31m');
      expect(Colors.green).toBe('\x1b[32m');
      expect(Colors.yellow).toBe('\x1b[33m');
    });
  });
});