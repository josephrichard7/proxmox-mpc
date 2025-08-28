/**
 * Application version information
 * 
 * This file is automatically updated by standard-version during releases.
 * Do not modify manually - changes will be overwritten.
 */

export const VERSION = '0.1.3';

/**
 * Get the current version of the application
 * @returns Current version string
 */
export const getVersion = (): string => VERSION;

/**
 * Version information for CLI and console display
 */
export const VERSION_INFO = {
  version: VERSION,
  name: 'proxmox-mpc',
  description: 'Interactive Infrastructure-as-Code Console for Proxmox VE'
} as const;

/**
 * Check if version is a prerelease
 * @param version Version string to check
 * @returns True if version contains prerelease identifiers
 */
export const isPrerelease = (version: string = VERSION): boolean => {
  return /-(alpha|beta|rc)\.\d+/.test(version);
};

/**
 * Parse semver version into components
 * @param version Version string to parse
 * @returns Parsed version components
 */
export const parseVersion = (version: string = VERSION) => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  const [, major, minor, patch, prerelease] = match;
  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: prerelease || null,
    isPrerelease: !!prerelease
  };
};