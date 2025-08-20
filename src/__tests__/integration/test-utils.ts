/**
 * Integration Test Utilities
 * Common helpers and setup functions for integration tests
 */

import { MockProxmoxServer } from './mock-server';
import { ProxmoxClient } from '../../api/proxmox-client';
import { ProxmoxConfig } from '../../types';
import { spawn, ChildProcess } from 'child_process';
import { DatabaseClient } from '../../database/client';
import path from 'path';

export interface TestEnvironment {
  mockServer: MockProxmoxServer;
  client: ProxmoxClient;
  config: ProxmoxConfig;
  dbClient?: DatabaseClient;
}

export interface CLITestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

/**
 * Setup test environment with mock server and client
 */
export async function setupTestEnvironment(port: number = 8006): Promise<TestEnvironment> {
  const mockServer = new MockProxmoxServer(port);
  await mockServer.start();

  const config: ProxmoxConfig = {
    host: 'localhost',
    port: port,
    username: 'root',
    tokenId: 'test-token',
    tokenSecret: 'test-secret',
    node: 'pve-node1',
    rejectUnauthorized: false
  };

  const client = new ProxmoxClient(config);

  return {
    mockServer,
    client,
    config
  };
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(env: TestEnvironment): Promise<void> {
  await env.mockServer.stop();
  if (env.dbClient) {
    await env.dbClient.disconnect();
  }
}

/**
 * Setup test environment with database
 */
export async function setupTestEnvironmentWithDB(port: number = 8006): Promise<TestEnvironment> {
  const env = await setupTestEnvironment(port);
  
  // Setup test database
  const dbClient = DatabaseClient.getInstance();
  await dbClient.connect(); // Use in-memory SQLite for tests
  
  return {
    ...env,
    dbClient
  };
}

/**
 * Execute CLI command and return result
 */
export async function executeCLICommand(
  command: string,
  args: string[],
  options: {
    timeout?: number;
    env?: Record<string, string>;
    cwd?: string;
  } = {}
): Promise<CLITestResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const { timeout = 30000, env = {}, cwd } = options;

    // Setup environment variables
    const testEnv = {
      ...process.env,
      ...env,
      NODE_ENV: 'test'
    };

    const child: ChildProcess = spawn(command, args, {
      cwd: cwd || process.cwd(),
      env: testEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms: ${command} ${args.join(' ')}`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        duration
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Execute CLI command using tsx
 */
export async function executeCLI(
  args: string[],
  options: {
    timeout?: number;
    env?: Record<string, string>;
  } = {}
): Promise<CLITestResult> {
  const cliPath = path.join(__dirname, '../../cli.ts');
  return executeCLICommand('npx', ['tsx', cliPath, ...args], {
    ...options,
    cwd: path.join(__dirname, '../../..')
  });
}

/**
 * Wait for condition with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  options: {
    timeout?: number;
    interval?: number;
    timeoutError?: string;
  } = {}
): Promise<void> {
  const { timeout = 10000, interval = 100, timeoutError = 'Condition not met within timeout' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(timeoutError);
}

/**
 * Generate unique test IDs
 */
export function generateTestId(prefix: string = 'test'): number {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return parseInt(`${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`);
}

/**
 * Create test environment variables for CLI commands
 */
export function createTestEnvVars(config: ProxmoxConfig): Record<string, string> {
  return {
    PROXMOX_HOST: config.host,
    PROXMOX_PORT: config.port.toString(),
    PROXMOX_USERNAME: config.username,
    PROXMOX_TOKEN_ID: config.tokenId!,
    PROXMOX_TOKEN_SECRET: config.tokenSecret!,
    PROXMOX_NODE: config.node,
    PROXMOX_REJECT_UNAUTHORIZED: config.rejectUnauthorized ? 'true' : 'false',
    NODE_ENV: 'test'
  };
}

/**
 * Assert CLI command success
 */
export function assertCLISuccess(result: CLITestResult, expectedSubstring?: string): void {
  if (result.exitCode !== 0) {
    throw new Error(`CLI command failed with exit code ${result.exitCode}. stderr: ${result.stderr}`);
  }
  
  if (expectedSubstring && !result.stdout.includes(expectedSubstring)) {
    throw new Error(`Expected output to contain "${expectedSubstring}", but got: ${result.stdout}`);
  }
}

/**
 * Assert CLI command failure
 */
export function assertCLIFailure(result: CLITestResult, expectedExitCode?: number): void {
  if (result.exitCode === 0) {
    throw new Error(`Expected CLI command to fail, but it succeeded. stdout: ${result.stdout}`);
  }
  
  if (expectedExitCode !== undefined && result.exitCode !== expectedExitCode) {
    throw new Error(`Expected exit code ${expectedExitCode}, but got ${result.exitCode}`);
  }
}

/**
 * Extract JSON from CLI output
 */
export function extractJSONFromCLIOutput(output: string): any {
  try {
    // Find JSON in output (handles case where there might be other text)
    const jsonMatch = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in output');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error(`Failed to parse JSON from CLI output: ${error}. Output: ${output}`);
  }
}

/**
 * Performance test utility
 */
export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;
  private checkpoints: Map<string, number> = new Map();

  start(): void {
    this.startTime = Date.now();
    this.checkpoints.clear();
  }

  checkpoint(name: string): number {
    const timestamp = Date.now();
    this.checkpoints.set(name, timestamp);
    return timestamp;
  }

  end(): number {
    this.endTime = Date.now();
    return this.getDuration();
  }

  getDuration(): number {
    return this.endTime - this.startTime;
  }

  getCheckpointDuration(name: string): number {
    const checkpointTime = this.checkpoints.get(name);
    if (!checkpointTime) {
      throw new Error(`Checkpoint '${name}' not found`);
    }
    return checkpointTime - this.startTime;
  }

  getCheckpointInterval(fromCheckpoint: string, toCheckpoint: string): number {
    const fromTime = this.checkpoints.get(fromCheckpoint);
    const toTime = this.checkpoints.get(toCheckpoint);
    
    if (!fromTime || !toTime) {
      throw new Error(`Checkpoint not found: ${fromCheckpoint} or ${toCheckpoint}`);
    }
    
    return toTime - fromTime;
  }
}

/**
 * Batch operation test helper
 */
export async function testBatchOperation<T>(
  items: T[],
  operation: (item: T) => Promise<void>,
  options: {
    concurrency?: number;
    continueOnError?: boolean;
    timeout?: number;
  } = {}
): Promise<{
  successful: T[];
  failed: Array<{item: T, error: Error}>;
  duration: number;
}> {
  const { concurrency = 5, continueOnError = false, timeout = 60000 } = options;
  const startTime = Date.now();
  const successful: T[] = [];
  const failed: Array<{item: T, error: Error}> = [];

  // Process items in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const promises = batch.map(async item => {
      try {
        await Promise.race([
          operation(item),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), timeout)
          )
        ]);
        successful.push(item);
      } catch (error) {
        failed.push({ item, error: error as Error });
        if (!continueOnError) {
          throw error;
        }
      }
    });

    await Promise.all(promises);
  }

  return {
    successful,
    failed,
    duration: Date.now() - startTime
  };
}

/**
 * Resource validation helper
 */
export interface ResourceValidation {
  exists: boolean;
  status?: string;
  expectedStatus?: string;
  properties?: Record<string, any>;
  errors: string[];
  warnings: string[];
}

export async function validateResource(
  client: ProxmoxClient,
  type: 'vm' | 'container',
  node: string,
  vmid: number,
  expectedStatus?: string
): Promise<ResourceValidation> {
  const validation: ResourceValidation = {
    exists: false,
    errors: [],
    warnings: []
  };

  try {
    let resource: any;
    
    if (type === 'vm') {
      resource = await client.getVMStatus(node, vmid);
    } else {
      resource = await client.getContainerStatus(node, vmid);
    }

    validation.exists = true;
    validation.status = resource.status;
    validation.expectedStatus = expectedStatus;
    validation.properties = resource;

    if (expectedStatus && resource.status !== expectedStatus) {
      validation.warnings.push(`Resource status is '${resource.status}', expected '${expectedStatus}'`);
    }

  } catch (error) {
    validation.errors.push(`Resource not found or error accessing: ${error}`);
  }

  return validation;
}