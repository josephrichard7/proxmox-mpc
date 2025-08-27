/**
 * Test suite for version utility
 */

import { getVersion, getDisplayVersion, clearVersionCache, getPackageInfo } from '../version';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Version Utility', () => {
  // Clear cache before each test to ensure fresh reads
  beforeEach(() => {
    clearVersionCache();
  });

  describe('getVersion', () => {
    it('should return the correct version from package.json', () => {
      const version = getVersion();
      
      // Read package.json directly to verify
      const packageJsonPath = join(__dirname, '..', '..', '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      
      expect(version).toBe(packageJson.version);
      expect(version).toMatch(/^\d+\.\d+\.\d+/); // Semver format
    });

    it('should cache the version after first read', () => {
      const version1 = getVersion();
      const version2 = getVersion();
      
      expect(version1).toBe(version2);
      expect(typeof version1).toBe('string');
    });

    it('should return the same version on multiple calls', () => {
      const versions = Array.from({ length: 5 }, () => getVersion());
      const uniqueVersions = new Set(versions);
      
      expect(uniqueVersions.size).toBe(1);
    });
  });

  describe('getDisplayVersion', () => {
    it('should return version with v prefix', () => {
      const displayVersion = getDisplayVersion();
      const version = getVersion();
      
      expect(displayVersion).toBe(`v${version}`);
      expect(displayVersion).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });

  describe('getPackageInfo', () => {
    it('should return complete package information', () => {
      const packageInfo = getPackageInfo();
      
      expect(packageInfo).toHaveProperty('name');
      expect(packageInfo).toHaveProperty('version');
      expect(packageInfo).toHaveProperty('description');
      expect(typeof packageInfo.version).toBe('string');
      expect(packageInfo.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should have consistent version with getVersion', () => {
      const packageInfo = getPackageInfo();
      const version = getVersion();
      
      expect(packageInfo.version).toBe(version);
    });

    it('should return expected package name', () => {
      const packageInfo = getPackageInfo();
      
      expect(packageInfo.name).toBe('proxmox-mpc');
    });
  });

  describe('clearVersionCache', () => {
    it('should clear the cached version', () => {
      // First call caches the version
      const version1 = getVersion();
      
      // Clear cache
      clearVersionCache();
      
      // Second call should re-read from file
      const version2 = getVersion();
      
      expect(version1).toBe(version2); // Should still be the same actual version
    });
  });

  describe('version format validation', () => {
    it('should return a valid semver version', () => {
      const version = getVersion();
      
      // Test semver format: major.minor.patch
      const semverPattern = /^(\d+)\.(\d+)\.(\d+)$/;
      expect(version).toMatch(semverPattern);
      
      // Extract version parts
      const match = version.match(semverPattern);
      if (match) {
        const [, major, minor, patch] = match;
        expect(parseInt(major, 10)).toBeGreaterThanOrEqual(0);
        expect(parseInt(minor, 10)).toBeGreaterThanOrEqual(0);
        expect(parseInt(patch, 10)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return current expected version', () => {
      const version = getVersion();
      
      // Based on package.json, should be 1.0.0
      expect(version).toBe('1.0.0');
    });
  });
});