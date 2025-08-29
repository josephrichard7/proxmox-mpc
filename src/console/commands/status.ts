/**
 * Enhanced Status Command
 * Shows project and server status information with rich formatting
 * Implements Issue #13 - Status Dashboard
 */

import { ProxmoxClient } from "../../api";
import { NodeInfo, StorageInfo } from "../../types";
import { errorHandler } from "../error-handler";
import { ConsoleSession } from "../repl";

import { BaseCommand, CommandMetadata } from "./base-command";

// Health status levels and constants
interface HealthStatus {
  level: "HEALTHY" | "MODERATE" | "CRITICAL" | "DEGRADED";
  color: string;
  symbol: string;
}

// Resource usage thresholds
const RESOURCE_THRESHOLDS = {
  CRITICAL: 0.85,
  MODERATE: 0.7,
  HEALTHY: 0.0,
} as const;

// Display constants
const DISPLAY_CONSTANTS = {
  DASHBOARD_WIDTH: 60,
  MOCK_LOAD_AVERAGE: "0.50, 0.40, 0.30",
  CONNECTION_INDICATORS: {
    ONLINE: "\x1b[32m●\x1b[0m Online",
    OFFLINE: "\x1b[31m●\x1b[0m Offline",
    CONNECTED: "\x1b[32m●\x1b[0m Connected",
  },
  HEALTH_SYMBOLS: {
    HEALTHY: "🟢",
    MODERATE: "🟡",
    CRITICAL: "🔴",
    DEGRADED: "🟠",
  },
} as const;

// Enhanced type definitions
interface NodeMetricRow {
  Node: string;
  Status: string;
  "CPU %": string;
  "Memory %": string;
  Uptime: string;
}

interface StorageMetricRow {
  Storage: string;
  Type: string;
  "Used %": string;
  Available: string;
}

interface PerformanceMetrics {
  responseTime?: number;
  systemHealth: HealthStatus;
  nodeMetrics: NodeMetricRow[];
  storageMetrics: StorageMetricRow[];
}

export class StatusCommand extends BaseCommand {
  getMetadata(): CommandMetadata {
    return {
      name: "status",
      description: "Show enhanced project and server status dashboard",
      usage: "/status",
      examples: [
        "/status - Display enhanced project and server status dashboard",
      ],
      requiresWorkspace: false,
      requiresConnection: false,
    };
  }

  async execute(args: string[], session: ConsoleSession): Promise<void> {
    // Enhanced dashboard header
    this.showDashboardHeader();

    // Show workspace status
    if (session.workspace) {
      console.log("📁 Workspace Information:");
      console.log(`   Project: ${session.workspace.name}`);
      console.log(`   Location: ${session.workspace.rootPath}`);
      console.log(`   Config: ${session.workspace.configPath}`);
      console.log(`   Database: ${session.workspace.databasePath}`);

      // Show server configuration
      console.log("\n🖥️  Server Configuration:");
      console.log(
        `   Host: ${session.workspace.config.host}:${session.workspace.config.port}`,
      );
      console.log(`   Username: ${session.workspace.config.username}`);
      console.log(`   Node: ${session.workspace.config.node}`);
      console.log(
        `   SSL Verification: ${session.workspace.config.rejectUnauthorized ? "Enabled" : "Disabled"}`,
      );

      // Test server connectivity with enhanced metrics
      let performanceMetrics: PerformanceMetrics | null = null;
      console.log("\n🔌 Server Connectivity:");

      try {
        const connectStart = Date.now();
        // Use existing session client if available (for tests), otherwise create new one
        const client =
          session.client || new ProxmoxClient(session.workspace.config);
        const result = await client.connect();
        const responseTime = Date.now() - connectStart;

        if (result.success) {
          this.showConnectionSuccess(result, responseTime);

          // Cache client for future use
          session.client = client;

          // Collect performance metrics
          performanceMetrics = await this.collectPerformanceMetrics(
            client,
            responseTime,
          );
        } else {
          this.showConnectionFailure(result.error);
        }
      } catch (error) {
        this.showConnectionFailure();

        errorHandler.handleConnectionError(
          "status",
          `${session.workspace.config.host}:${session.workspace.config.port}`,
          error as Error,
        );
      }

      // Show enhanced infrastructure overview
      if (performanceMetrics && session.client) {
        await this.showEnhancedInfrastructureOverview(
          performanceMetrics,
          session.client,
        );
      } else if (session.client) {
        console.log("\n⚠️  Partial system information available");
        console.log("   Some metrics unavailable");
        await this.showInfrastructureOverview(
          session.client,
          session.workspace.config.node,
        );
      }
    } else {
      errorHandler.handleError({
        code: "NO_WORKSPACE",
        message: "No workspace detected",
        severity: "medium",
        context: {
          command: "status",
          suggestions: [
            "Use /init to create a new workspace",
            "Navigate to an existing project directory",
          ],
        },
      });
    }

    // Enhanced session information
    this.showEnhancedSessionInfo(session);

    console.log("");
  }

  private async showInfrastructureOverview(
    client: ProxmoxClient,
    _defaultNode: string,
  ): Promise<void> {
    console.log("\n🏗️  Infrastructure Overview:");

    try {
      // Get nodes
      const nodes = await client.getNodes();
      console.log(`   Nodes: ${nodes.length} total`);
      console.log(
        `   📝 Available nodes:`,
        nodes.map((n) => `${n.node} (${n.status})`).join(", "),
      );

      // Get VMs and containers from all nodes
      let totalVMs = 0;
      let totalContainers = 0;
      let runningVMs = 0;
      let runningContainers = 0;

      for (const node of nodes) {
        try {
          console.log(`   🔍 Checking node: ${node.node}`);

          // Get VMs first
          const vms = await client.getVMs(node.node);
          console.log(
            `   📊 VMs on ${node.node}:`,
            vms.length > 0
              ? vms
                  .map((vm) => `${vm.vmid}:${vm.name}(${vm.status})`)
                  .join(", ")
              : "none",
          );

          // Get containers
          const containers = await client.getContainers(node.node);
          console.log(
            `   📊 Containers on ${node.node}:`,
            containers.length > 0
              ? containers
                  .map((c) => `${c.vmid}:${c.name}(${c.status})`)
                  .join(", ")
              : "none",
          );

          totalVMs += vms.length;
          totalContainers += containers.length;
          runningVMs += vms.filter((vm) => vm.status === "running").length;
          runningContainers += containers.filter(
            (c) => c.status === "running",
          ).length;
        } catch (error) {
          errorHandler.showWarning(
            `Failed to get resources from node ${node.node}`,
            [
              `Error: ${error instanceof Error ? error.message : String(error)}`,
            ],
          );
        }
      }

      console.log(`   VMs: ${totalVMs} total (${runningVMs} running)`);
      console.log(
        `   Containers: ${totalContainers} total (${runningContainers} running)`,
      );

      // Show storage information
      try {
        const storage = await client.getStoragePools();
        console.log(`   Storage Pools: ${storage.length} total`);
      } catch (error) {
        console.log("   Storage Pools: Unable to retrieve");
      }
    } catch (error) {
      console.log("   Unable to retrieve infrastructure information");
    }
  }

  /**
   * Display the enhanced dashboard header
   */
  private showDashboardHeader(): void {
    console.log("🎛️  Proxmox Infrastructure Dashboard");
    console.log("═".repeat(DISPLAY_CONSTANTS.DASHBOARD_WIDTH));
    console.log("");
  }

  /**
   * Display successful connection information
   */
  private showConnectionSuccess(result: any, responseTime: number): void {
    console.log(
      `   Status: ${DISPLAY_CONSTANTS.CONNECTION_INDICATORS.CONNECTED}`,
    );
    console.log(`   Version: ${result.version}`);
    console.log(`   Response Time: ${responseTime}ms`);
    console.log(`   Endpoint: ${result.details?.endpoint}`);
    console.log(`   Nodes: ${result.details?.nodes}`);
  }

  /**
   * Display connection failure information with troubleshooting
   */
  private showConnectionFailure(error?: string): void {
    console.log("   Status: ❌ Connection failed");
    if (error) {
      console.log(`   Error: ${error}`);
    }

    console.log("\n🔧 Troubleshooting steps:");
    console.log("   • Check server connectivity");
    console.log("   • Verify credentials");
    if (!error) {
      console.log("   • Ensure server is running");
    }
  }

  /**
   * Collect performance metrics for enhanced display
   */
  private async collectPerformanceMetrics(
    client: ProxmoxClient,
    responseTime: number,
  ): Promise<PerformanceMetrics> {
    let degradedMode = false;

    try {
      // Get nodes data
      const nodes = await client.getNodes();
      const nodeMetrics = nodes.map((node) => this.formatNodeMetric(node));

      // Get storage data
      let storageMetrics: StorageMetricRow[] = [];
      try {
        const storage = await client.getStoragePools();
        storageMetrics = storage.map((pool) => this.formatStorageMetric(pool));
      } catch (error) {
        degradedMode = true;
        console.log("🟠 DEGRADED MODE");
        console.log("   Storage information unavailable");
      }

      // Calculate overall system health
      const systemHealth = this.calculateSystemHealth(nodes, degradedMode);

      return {
        responseTime,
        systemHealth,
        nodeMetrics,
        storageMetrics,
      };
    } catch (error) {
      // Return degraded metrics if some APIs fail
      return {
        responseTime,
        systemHealth: { level: "DEGRADED", color: "\x1b[33m", symbol: "🟠" },
        nodeMetrics: [],
        storageMetrics: [],
      };
    }
  }

  /**
   * Calculate overall system health based on resource usage
   */
  private calculateSystemHealth(
    nodes: NodeInfo[],
    degradedMode: boolean,
  ): HealthStatus {
    if (degradedMode) {
      return this.createHealthStatus("DEGRADED");
    }

    const overallUsage = this.calculateMaxResourceUsage(nodes);

    if (overallUsage > RESOURCE_THRESHOLDS.CRITICAL) {
      return this.createHealthStatus("CRITICAL");
    } else if (overallUsage > RESOURCE_THRESHOLDS.MODERATE) {
      return this.createHealthStatus("MODERATE");
    } else {
      return this.createHealthStatus("HEALTHY");
    }
  }

  /**
   * Show enhanced infrastructure overview with formatted tables
   */
  private async showEnhancedInfrastructureOverview(
    metrics: PerformanceMetrics,
    client: ProxmoxClient,
  ): Promise<void> {
    console.log("\n🏗️  Infrastructure Overview:");

    // Display overall system health
    console.log(
      `   System Health: ${metrics.systemHealth.symbol} ${metrics.systemHealth.level}`,
    );
    console.log(`   Load Average: ${DISPLAY_CONSTANTS.MOCK_LOAD_AVERAGE}`);
    console.log("");

    // Display nodes table
    if (metrics.nodeMetrics.length > 0) {
      console.log("📊 Node Status:");
      console.table(metrics.nodeMetrics);
    }

    // Display storage table
    if (metrics.storageMetrics.length > 0) {
      console.log("💾 Storage Status:");
      console.table(metrics.storageMetrics);
    }

    // Show VMs and containers with resource efficiency
    try {
      if (metrics.nodeMetrics.length > 0) {
        // Strip ANSI color codes from node name (ESC[...m pattern)
        const ansiRegex = new RegExp(
          String.fromCharCode(27) + "\\[[0-9;]*m",
          "g",
        );
        const firstNode = metrics.nodeMetrics[0].Node.replace(ansiRegex, "");

        const vms = await client.getVMs(firstNode);
        if (vms.length > 0) {
          console.log("🖥️  Virtual Machines:");
          for (const vm of vms) {
            if (
              vm.cpu !== undefined &&
              vm.cpus !== undefined &&
              vm.mem !== undefined &&
              vm.maxmem !== undefined
            ) {
              const cpuPercent = ((vm.cpu / vm.cpus) * 100).toFixed(1);
              const memPercent = ((vm.mem / vm.maxmem) * 100).toFixed(1);
              console.log(
                `   ${vm.name} (${vm.vmid}): CPU: ${cpuPercent}%, Memory: ${memPercent}%`,
              );
            }
          }
        }
      }
    } catch (error) {
      // Ignore VM retrieval errors for now
    }
  }

  /**
   * Show enhanced session information with performance analytics
   */
  private showEnhancedSessionInfo(session: ConsoleSession): void {
    console.log("\n⏱️  Session Information:");
    console.log(`   Started: ${session.startTime.toLocaleString()}`);
    console.log(`   Commands executed: ${session.history.length}`);
    console.log(
      `   Uptime: ${this.formatDuration(Date.now() - session.startTime.getTime())}`,
    );

    // Calculate commands per hour
    const uptimeHours =
      (Date.now() - session.startTime.getTime()) / (1000 * 60 * 60);
    const commandsPerHour =
      uptimeHours > 0 ? (session.history.length / uptimeHours).toFixed(1) : "0";
    console.log(`   Commands/hour: ${commandsPerHour}`);

    // Find most used command
    if (session.history.length > 0) {
      const commandCounts: { [key: string]: number } = {};
      session.history.forEach((cmd) => {
        commandCounts[cmd] = (commandCounts[cmd] || 0) + 1;
      });

      const mostUsed = Object.keys(commandCounts).reduce((a, b) =>
        commandCounts[a] > commandCounts[b] ? a : b,
      );

      console.log(
        `   Most used: ${mostUsed} (${commandCounts[mostUsed]} times)`,
      );
    }
  }

  /**
   * Format node metrics for table display
   */
  private formatNodeMetric(node: NodeInfo): NodeMetricRow {
    const cpuPercent = ((node.cpu / node.maxcpu) * 100).toFixed(1);
    const memPercent = ((node.mem / node.maxmem) * 100).toFixed(1);
    const uptime = this.formatDuration(node.uptime * 1000);

    return {
      Node: node.node,
      Status:
        node.status === "online"
          ? DISPLAY_CONSTANTS.CONNECTION_INDICATORS.ONLINE
          : DISPLAY_CONSTANTS.CONNECTION_INDICATORS.OFFLINE,
      "CPU %": `${cpuPercent}%`,
      "Memory %": `${memPercent}%`,
      Uptime: uptime,
    };
  }

  /**
   * Format storage metrics for table display
   */
  private formatStorageMetric(pool: StorageInfo): StorageMetricRow {
    return {
      Storage: pool.storage,
      Type: pool.type,
      "Used %": pool.total
        ? (((pool.used || 0) / pool.total) * 100).toFixed(1) + "%"
        : "N/A",
      Available: pool.avail ? this.formatBytes(pool.avail) : "N/A",
    };
  }

  /**
   * Calculate maximum resource usage across all nodes
   */
  private calculateMaxResourceUsage(nodes: NodeInfo[]): number {
    let maxCpuUsage = 0;
    let maxMemUsage = 0;

    for (const node of nodes) {
      const cpuUsage = node.cpu / node.maxcpu;
      const memUsage = node.mem / node.maxmem;

      maxCpuUsage = Math.max(maxCpuUsage, cpuUsage);
      maxMemUsage = Math.max(maxMemUsage, memUsage);
    }

    return Math.max(maxCpuUsage, maxMemUsage);
  }

  /**
   * Create health status object with consistent formatting
   */
  private createHealthStatus(
    level: "HEALTHY" | "MODERATE" | "CRITICAL" | "DEGRADED",
  ): HealthStatus {
    const colorMap = {
      HEALTHY: "\x1b[32m",
      MODERATE: "\x1b[33m",
      CRITICAL: "\x1b[31m",
      DEGRADED: "\x1b[33m",
    };

    return {
      level,
      color: colorMap[level],
      symbol: DISPLAY_CONSTANTS.HEALTH_SYMBOLS[level],
    };
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
