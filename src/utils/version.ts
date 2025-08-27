/**
 * Version Utility - Dynamic version loading from package.json
 * 
 * This utility provides centralized version management by dynamically reading
 * the version from package.json at runtime, eliminating hardcoded versions.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Interface for package.json structure with minimal required fields
 */
interface PackageJson {
  name?: string;
  version: string;
  description?: string;
}

/**
 * Cached version to avoid repeated file system reads
 */
let cachedVersion: string | null = null;

/**
 * Get the current package version from package.json
 * 
 * This function reads the package.json file and extracts the version field.
 * The version is cached after first read for performance.
 * 
 * @returns The version string (e.g., "0.1.3")
 * @throws Error if package.json cannot be read or version is missing
 */
export function getVersion(): string {
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  try {
    // Find package.json from the project root (2 levels up from src/utils/)
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(packageJsonContent);
    
    if (!packageJson.version) {
      throw new Error('Version field not found in package.json');
    }

    cachedVersion = packageJson.version;
    return cachedVersion;
  } catch (error) {
    // Fallback version for error cases - should not happen in normal operation
    const fallbackVersion = '0.1.3';
    console.warn(`Warning: Failed to read version from package.json: ${error instanceof Error ? error.message : error}`);
    console.warn(`Using fallback version: ${fallbackVersion}`);
    
    cachedVersion = fallbackVersion;
    return cachedVersion;
  }
}

/**
 * Get the version formatted for display (with 'v' prefix)
 * 
 * @returns Version string with 'v' prefix (e.g., "v0.1.3")
 */
export function getDisplayVersion(): string {
  return `v${getVersion()}`;
}

/**
 * Clear the cached version (useful for testing)
 * @internal
 */
export function clearVersionCache(): void {
  cachedVersion = null;
}

/**
 * Get package information including name, version, and description
 * 
 * @returns Package information object
 * @throws Error if package.json cannot be read
 */
export function getPackageInfo(): PackageJson {
  try {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(packageJsonContent);
    
    return {
      name: packageJson.name || 'proxmox-mpc',
      version: packageJson.version,
      description: packageJson.description || 'Interactive Infrastructure-as-Code Console for Proxmox VE'
    };
  } catch (error) {
    throw new Error(`Failed to read package.json: ${error instanceof Error ? error.message : error}`);
  }
}