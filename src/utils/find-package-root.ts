/**
 * Utility to find the project root directory
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Find the package root directory by looking for package.json
 */
export function findPackageRoot(startDir: string): string {
  let currentDir = path.resolve(startDir);
  
  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  throw new Error('Could not find package.json in directory hierarchy');
}

/**
 * Find the Prisma schema file
 */
export function findPrismaSchema(startDir: string): string {
  const packageRoot = findPackageRoot(startDir);
  const schemaPath = path.join(packageRoot, 'prisma', 'schema.prisma');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Prisma schema not found at ${schemaPath}`);
  }
  
  return schemaPath;
}