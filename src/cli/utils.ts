/**
 * CLI utility functions for professional features and safety mechanisms
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';

import { ProxmoxClient } from '../api';

// ANSI color codes for terminal formatting
export const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
} as const;

// Output format types
export type OutputFormat = 'table' | 'json' | 'yaml' | 'quiet';

// Progress indicator interface
export interface ProgressIndicator {
  start(message: string): void;
  update(message: string): void;
  succeed(message: string): void;
  fail(message: string): void;
  stop(): void;
}

// Resource validation result
export interface ValidationResult {
  valid: boolean;
  resource?: any;
  error?: string;
  warnings?: string[];
}

// Batch operation result
export interface BatchResult {
  success: number;
  failed: number;
  results: Array<{
    id: string | number;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Simple spinner for progress indication
 */
export class Spinner implements ProgressIndicator {
  private interval?: NodeJS.Timeout;
  private currentFrame = 0;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private message = '';

  start(message: string): void {
    this.message = message;
    this.currentFrame = 0;
    
    // Hide cursor
    process.stdout.write('\x1B[?25l');
    
    this.interval = setInterval(() => {
      process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  update(message: string): void {
    this.message = message;
  }

  succeed(message: string): void {
    this.stop();
    console.log(`${Colors.green}✅ ${message}${Colors.reset}`);
  }

  fail(message: string): void {
    this.stop();
    console.log(`${Colors.red}❌ ${message}${Colors.reset}`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    
    // Clear line and show cursor
    process.stdout.write('\r\x1B[K\x1B[?25h');
  }
}

/**
 * Format data according to specified output format
 */
export function formatOutput(data: any, format: OutputFormat = 'table'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    
    case 'yaml':
      return formatAsYaml(data);
    
    case 'quiet':
      return '';
    
    case 'table':
    default:
      return formatAsTable(data);
  }
}

/**
 * Format data as YAML (simple implementation)
 */
function formatAsYaml(data: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (Array.isArray(data)) {
    return data.map(item => `${spaces}- ${formatAsYaml(item, indent + 1).trim()}`).join('\n');
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `${spaces}${key}:\n${formatAsYaml(value, indent + 1)}`;
        }
        return `${spaces}${key}: ${value}`;
      })
      .join('\n');
  }
  
  return String(data);
}

/**
 * Format data as aligned table
 */
function formatAsTable(data: any): string {
  if (!Array.isArray(data) || data.length === 0) {
    return String(data);
  }

  // Get all unique keys from all objects
  const keys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
  
  // Calculate column widths
  const widths = keys.map(key => {
    const headerWidth = key.length;
    const maxValueWidth = Math.max(...data.map(item => String(item[key] || '').length));
    return Math.max(headerWidth, maxValueWidth);
  });

  // Format header
  const header = keys.map((key, i) => key.padEnd(widths[i])).join('  ');
  const separator = keys.map((_, i) => '-'.repeat(widths[i])).join('  ');

  // Format rows
  const rows = data.map(item =>
    keys.map((key, i) => String(item[key] || '').padEnd(widths[i])).join('  ')
  );

  return [header, separator, ...rows].join('\n');
}

/**
 * Prompt user for confirmation with safety checks
 */
export async function promptConfirmation(
  message: string,
  options: {
    requireExplicitYes?: boolean;
    warningMessage?: string;
    destructive?: boolean;
  } = {}
): Promise<boolean> {
  const { requireExplicitYes = false, warningMessage, destructive = false } = options;

  console.log();
  if (destructive) {
    console.log(`${Colors.bgRed}${Colors.white} DESTRUCTIVE OPERATION ${Colors.reset}`);
  }
  
  if (warningMessage) {
    console.log(`${Colors.yellow}⚠️  ${warningMessage}${Colors.reset}`);
  }
  
  console.log(`${Colors.cyan}${message}${Colors.reset}`);
  
  if (requireExplicitYes) {
    console.log(`${Colors.dim}Type 'yes' to confirm:${Colors.reset}`);
  } else {
    console.log(`${Colors.dim}[y/N]:${Colors.reset}`);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('', (answer) => {
      rl.close();
      
      if (requireExplicitYes) {
        resolve(answer.trim().toLowerCase() === 'yes');
      } else {
        resolve(['y', 'yes'].includes(answer.trim().toLowerCase()));
      }
    });
  });
}

/**
 * Validate VM exists and get its current state
 */
export async function validateVM(
  client: ProxmoxClient,
  node: string,
  vmid: number
): Promise<ValidationResult> {
  try {
    const vms = await client.getVMs(node);
    const vm = vms.find(v => v.vmid === vmid);
    
    if (!vm) {
      return {
        valid: false,
        error: `VM ${vmid} not found on node ${node}`
      };
    }

    const warnings: string[] = [];
    
    // Add status-based warnings
    if (vm.status === 'running' && vm.lock) {
      warnings.push(`VM is locked (${vm.lock})`);
    }
    
    if (vm.template) {
      warnings.push('VM is a template');
    }

    return {
      valid: true,
      resource: vm,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate VM: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Validate container exists and get its current state
 */
export async function validateContainer(
  client: ProxmoxClient,
  node: string,
  vmid: number
): Promise<ValidationResult> {
  try {
    const containers = await client.getContainers(node);
    const container = containers.find(c => c.vmid === vmid);
    
    if (!container) {
      return {
        valid: false,
        error: `Container ${vmid} not found on node ${node}`
      };
    }

    const warnings: string[] = [];
    
    // Add status-based warnings
    if (container.status === 'running' && container.lock) {
      warnings.push(`Container is locked (${container.lock})`);
    }
    
    if (container.template) {
      warnings.push('Container is a template');
    }

    return {
      valid: true,
      resource: container,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate container: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Validate node exists and is accessible
 */
export async function validateNode(
  client: ProxmoxClient,
  nodeName: string
): Promise<ValidationResult> {
  try {
    const nodes = await client.getNodes();
    const node = nodes.find(n => n.node === nodeName);
    
    if (!node) {
      return {
        valid: false,
        error: `Node ${nodeName} not found in cluster`
      };
    }

    const warnings: string[] = [];
    
    if (node.status !== 'online') {
      warnings.push(`Node status is ${node.status}`);
    }

    return {
      valid: true,
      resource: node,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate node: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Display validation warnings
 */
export function displayValidationWarnings(warnings: string[]): void {
  if (warnings.length > 0) {
    console.log(`${Colors.yellow}⚠️  Warnings:${Colors.reset}`);
    warnings.forEach(warning => {
      console.log(`   • ${warning}`);
    });
    console.log();
  }
}

/**
 * Display error message with context
 */
export function displayError(message: string, context?: string): void {
  console.error(`${Colors.red}❌ ${message}${Colors.reset}`);
  if (context) {
    console.error(`${Colors.dim}   ${context}${Colors.reset}`);
  }
}

/**
 * Display success message
 */
export function displaySuccess(message: string): void {
  console.log(`${Colors.green}✅ ${message}${Colors.reset}`);
}

/**
 * Display info message
 */
export function displayInfo(message: string, emoji = '💡'): void {
  console.log(`${Colors.cyan}${emoji} ${message}${Colors.reset}`);
}

/**
 * Process batch operations with progress tracking
 */
export async function processBatchOperation<T>(
  items: T[],
  operation: (item: T) => Promise<void>,
  options: {
    itemName: (item: T) => string;
    operationName: string;
    continueOnError?: boolean;
  }
): Promise<BatchResult> {
  const { itemName, operationName, continueOnError = false } = options;
  const results: BatchResult['results'] = [];
  let success = 0;
  let failed = 0;

  console.log(`${Colors.cyan}🔄 Starting batch ${operationName} for ${items.length} items...${Colors.reset}\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = itemName(item);
    
    console.log(`[${i + 1}/${items.length}] ${operationName} ${name}...`);
    
    try {
      await operation(item);
      console.log(`${Colors.green}  ✅ Success${Colors.reset}`);
      results.push({ id: name, success: true });
      success++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`${Colors.red}  ❌ Failed: ${errorMsg}${Colors.reset}`);
      results.push({ id: name, success: false, error: errorMsg });
      failed++;
      
      if (!continueOnError) {
        console.log(`${Colors.red}Stopping batch operation due to error${Colors.reset}`);
        break;
      }
    }
  }

  console.log(`\n${Colors.cyan}📊 Batch ${operationName} completed:${Colors.reset}`);
  console.log(`   Success: ${Colors.green}${success}${Colors.reset}`);
  console.log(`   Failed: ${Colors.red}${failed}${Colors.reset}`);

  return { success, failed, results };
}

/**
 * Filter resources based on criteria
 */
export function filterResources<T extends Record<string, any>>(
  resources: T[],
  filters: {
    status?: string;
    node?: string;
    tags?: string;
    name?: string;
  }
): T[] {
  let filtered = resources;

  if (filters.status) {
    filtered = filtered.filter(r => r.status === filters.status);
  }

  if (filters.node) {
    filtered = filtered.filter(r => r.node === filters.node);
  }

  if (filters.tags) {
    const searchTags = filters.tags.toLowerCase();
    filtered = filtered.filter(r => 
      r.tags && r.tags.toLowerCase().includes(searchTags)
    );
  }

  if (filters.name) {
    const searchName = filters.name.toLowerCase();
    filtered = filtered.filter(r => 
      r.name && r.name.toLowerCase().includes(searchName)
    );
  }

  return filtered;
}

/**
 * Display dry-run message
 */
export function displayDryRun(operation: string, target: string): void {
  console.log(`${Colors.yellow}🔍 DRY RUN: Would ${operation} ${target}${Colors.reset}`);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${Math.round(value * 10) / 10}${units[unitIndex]}`;
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }
  
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Create a progress bar for operations
 */
export function createProgressBar(total: number, width = 40): (current: number) => string {
  return (current: number) => {
    const percentage = Math.min(current / total, 1);
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = Math.floor(percentage * 100);
    
    return `[${bar}] ${percent}% (${current}/${total})`;
  };
}