/**
 * WebSocket Notification Service
 *
 * Service for broadcasting real-time infrastructure updates via WebSocket.
 * Integrates with API operations to provide live status updates.
 */

import { Server as SocketIOServer } from "socket.io";

import { ProxmoxClient } from "../../api/proxmox-client";
import { DatabaseClient } from "../../database/client";
import { ContainerRepository } from "../../database/repositories/container-repository";
import { NodeRepository } from "../../database/repositories/node-repository";
import { VMRepository } from "../../database/repositories/vm-repository";
import { DebuggingFinding } from "../../debugging/types";
import { Logger } from "../../observability/logger";

import {
  broadcastInfrastructureUpdate,
  broadcastVMUpdate,
  broadcastContainerUpdate,
  sendUserNotification,
  sendSystemNotification,
} from "./index";

export class WebSocketNotificationService {
  private io: SocketIOServer;
  private dbClient: DatabaseClient;
  private vmRepo: VMRepository;
  private containerRepo: ContainerRepository;
  private nodeRepo: NodeRepository;
  private logger: Logger;
  private intervalId?: NodeJS.Timeout;
  private readonly UPDATE_INTERVAL = 30000; // 30 seconds

  constructor(io: SocketIOServer) {
    this.io = io;
    this.dbClient = DatabaseClient.getInstance();
    this.vmRepo = new VMRepository(this.dbClient);
    this.containerRepo = new ContainerRepository(this.dbClient);
    this.nodeRepo = new NodeRepository(this.dbClient);
    this.logger = Logger.getInstance();
  }

  /**
   * Start the notification service
   */
  public start(): void {
    this.logger.info("Starting WebSocket notification service");

    // Start periodic infrastructure status updates
    this.intervalId = setInterval(() => {
      this.broadcastInfrastructureStatus();
    }, this.UPDATE_INTERVAL);

    // Initial broadcast
    setTimeout(() => this.broadcastInfrastructureStatus(), 2000);
  }

  /**
   * Stop the notification service
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.logger.info("Stopped WebSocket notification service");
  }

  /**
   * Broadcast VM status update
   */
  public async broadcastVMStatusUpdate(
    vmId: number,
    userId?: string,
    proxmoxServer?: string,
  ): Promise<void> {
    try {
      // Get updated VM data from database
      const vm = await this.vmRepo.findById(vmId.toString());
      if (!vm) {
        this.logger.warn("VM not found for status update", { vmId });
        return;
      }

      // Get live status from Proxmox if available
      let liveStatus = null;
      if (proxmoxServer) {
        try {
          const proxmoxClient = new ProxmoxClient({
            host: proxmoxServer,
            port: 8006,
            username: "root@pam",
            tokenId: process.env.PROXMOX_TOKEN_ID || "",
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || "",
            node: vm.node,
            rejectUnauthorized: false,
          });

          liveStatus = await proxmoxClient.getVMStatus(vm.node, vm.id);

          // Update database with live status
          if (liveStatus && liveStatus.status !== vm.status) {
            await this.vmRepo.update(vmId.toString(), {
              status: liveStatus.status,
              uptime: liveStatus.uptime || 0,
              cpuUsage: liveStatus.cpu || 0,
              memoryUsage: liveStatus.mem || 0,
              updatedAt: new Date(),
            });
          }
        } catch (error) {
          this.logger.warn("Failed to get live VM status for broadcast", {
            vmId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Broadcast update
      broadcastVMUpdate(this.io, vmId, {
        status: liveStatus?.status || vm.status,
        uptime: liveStatus?.uptime || vm.uptime,
        cpuUsage: liveStatus?.cpu || vm.cpuUsage,
        memoryUsage: liveStatus?.mem || vm.memoryUsage,
        liveData: !!liveStatus,
      });

      // Send notification to user if provided
      if (userId) {
        sendUserNotification(this.io, userId, {
          type: "info",
          title: "VM Status Updated",
          message: `VM ${vm.name} status: ${liveStatus?.status || vm.status}`,
          data: { vmId, status: liveStatus?.status || vm.status },
        });
      }
    } catch (error) {
      this.logger.error("Failed to broadcast VM status update", {
        vmId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Broadcast container status update
   */
  public async broadcastContainerStatusUpdate(
    containerId: number,
    userId?: string,
    proxmoxServer?: string,
  ): Promise<void> {
    try {
      // Get updated container data from database
      const container = await this.containerRepo.findById(
        containerId.toString(),
      );
      if (!container) {
        this.logger.warn("Container not found for status update", {
          containerId,
        });
        return;
      }

      // Get live status from Proxmox if available
      let liveStatus = null;
      if (proxmoxServer) {
        try {
          const proxmoxClient = new ProxmoxClient({
            host: proxmoxServer,
            port: 8006,
            username: "root@pam",
            tokenId: process.env.PROXMOX_TOKEN_ID || "",
            tokenSecret: process.env.PROXMOX_TOKEN_SECRET || "",
            node: container.nodeId,
            rejectUnauthorized: false,
          });

          liveStatus = await proxmoxClient.getContainerStatus(
            container.nodeId,
            container.id,
          );

          // Update database with live status
          if (liveStatus && liveStatus.status !== container.status) {
            await this.containerRepo.update(containerId.toString(), {
              status: liveStatus.status,
              uptime: liveStatus.uptime || 0,
              cpuUsage: liveStatus.cpu || 0,
              memoryUsage: liveStatus.mem || 0,
              updatedAt: new Date(),
            });
          }
        } catch (error) {
          this.logger.warn(
            "Failed to get live container status for broadcast",
            {
              containerId,
              error: error instanceof Error ? error.message : "Unknown error",
            },
          );
        }
      }

      // Broadcast update
      broadcastContainerUpdate(this.io, containerId, {
        status: liveStatus?.status || container.status,
        uptime: liveStatus?.uptime || container.uptime,
        cpuUsage: liveStatus?.cpu || container.cpuUsage,
        memoryUsage: liveStatus?.mem || container.memoryUsage,
        liveData: !!liveStatus,
      });

      // Send notification to user if provided
      if (userId) {
        sendUserNotification(this.io, userId, {
          type: "info",
          title: "Container Status Updated",
          message: `Container ${container.hostname} status: ${liveStatus?.status || container.status}`,
          data: { containerId, status: liveStatus?.status || container.status },
        });
      }
    } catch (error) {
      this.logger.error("Failed to broadcast container status update", {
        containerId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Broadcast operation notification
   */
  public broadcastOperationNotification(
    operation: "create" | "update" | "delete" | "start" | "stop" | "restart",
    resourceType: "vm" | "container",
    resourceId: number,
    resourceName: string,
    status: "success" | "error" | "pending",
    userId?: string,
    errorMessage?: string,
  ): void {
    const notification = {
      type: status === "error" ? ("error" as const) : ("success" as const),
      title: `${resourceType.toUpperCase()} ${operation}`,
      message:
        status === "error"
          ? `Failed to ${operation} ${resourceType} ${resourceName}: ${errorMessage}`
          : `Successfully ${operation}d ${resourceType} ${resourceName}`,
      data: {
        operation,
        resourceType,
        resourceId,
        resourceName,
        status,
      },
    };

    if (userId) {
      sendUserNotification(this.io, userId, notification);
    } else {
      sendSystemNotification(this.io, notification);
    }
  }

  /**
   * Broadcast infrastructure status summary
   */
  private async broadcastInfrastructureStatus(): Promise<void> {
    try {
      // Get current counts from database
      const [vmCount, vmRunning, containerCount, containerRunning, nodeCount] =
        await Promise.all([
          this.vmRepo.count({}),
          this.vmRepo.count({ status: "running" }),
          this.containerRepo.count({}),
          this.containerRepo.count({ status: "running" }),
          this.nodeRepo.count({}),
        ]);

      const infrastructureStatus = {
        vms: {
          total: vmCount,
          running: vmRunning,
          stopped: vmCount - vmRunning,
        },
        containers: {
          total: containerCount,
          running: containerRunning,
          stopped: containerCount - containerRunning,
        },
        nodes: {
          total: nodeCount,
          online: nodeCount, // Simplified - in reality you'd check node status
          offline: 0,
        },
        lastUpdated: new Date().toISOString(),
      };

      broadcastInfrastructureUpdate(this.io, infrastructureStatus);

      this.logger.debug(
        "Broadcasted infrastructure status",
        infrastructureStatus,
      );
    } catch (error) {
      this.logger.error("Failed to broadcast infrastructure status", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Broadcast task completion notification
   */
  public broadcastTaskCompletion(
    taskId: string,
    taskType: string,
    status: "success" | "error",
    resourceId?: number,
    resourceName?: string,
    userId?: string,
    errorMessage?: string,
  ): void {
    const notification = {
      type: status === "error" ? ("error" as const) : ("success" as const),
      title: `Task ${status === "error" ? "Failed" : "Completed"}`,
      message:
        status === "error"
          ? `Task ${taskType} failed: ${errorMessage}`
          : `Task ${taskType} completed successfully${resourceName ? ` for ${resourceName}` : ""}`,
      data: {
        taskId,
        taskType,
        status,
        resourceId,
        resourceName,
      },
    };

    if (userId) {
      sendUserNotification(this.io, userId, notification);
    } else {
      sendSystemNotification(this.io, notification);
    }
  }

  /**
   * Broadcast autonomous debugging finding in real-time
   */
  public broadcastDebuggingFinding(
    finding: DebuggingFinding,
    sessionId?: string,
  ): void {
    const severityIcon =
      finding.severity === "critical"
        ? "🚨"
        : finding.severity === "high"
          ? "🔴"
          : finding.severity === "medium"
            ? "🟡"
            : "🟢";

    const categoryIcon =
      finding.category === "ui"
        ? "🖥️"
        : finding.category === "backend"
          ? "🔧"
          : finding.category === "performance"
            ? "⚡"
            : finding.category === "network"
              ? "🌐"
              : finding.category === "security"
                ? "🛡️"
                : "📊";

    // Emit to specific debugging channel
    this.io.emit("debugging-finding", {
      id: finding.id,
      sessionId,
      timestamp: finding.timestamp.toISOString(),
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      description: finding.description,
      source: finding.source,
      status: finding.status,
      recommendations: finding.recommendations,
      evidence: {
        screenshots: finding.evidence.screenshots || [],
        logCount: finding.evidence.logs?.length || 0,
        networkRequestCount: finding.evidence.networkRequests?.length || 0,
        consoleErrorCount: finding.evidence.consoleErrors?.length || 0,
      },
    });

    // Send user notification for critical and high severity findings
    if (finding.severity === "critical" || finding.severity === "high") {
      const notification = {
        type:
          finding.severity === "critical"
            ? ("error" as const)
            : ("warning" as const),
        title: `${severityIcon} ${categoryIcon} ${finding.title}`,
        message: finding.description,
        data: {
          findingId: finding.id,
          sessionId,
          severity: finding.severity,
          category: finding.category,
          source: finding.source,
        },
      };

      sendSystemNotification(this.io, notification);
    }

    this.logger.info("Broadcasted debugging finding", {
      findingId: finding.id,
      sessionId,
      severity: finding.severity,
      category: finding.category,
    });
  }

  /**
   * Broadcast autonomous debugging session status update
   */
  public broadcastDebuggingSessionUpdate(
    sessionId: string,
    status: string,
    metrics?: any,
  ): void {
    this.io.emit("debugging-session-update", {
      sessionId,
      status,
      metrics,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug("Broadcasted debugging session update", {
      sessionId,
      status,
      activeAgents: metrics?.activeAgents,
    });
  }
}

// Singleton instance
let notificationService: WebSocketNotificationService | null = null;

export const getNotificationService =
  (): WebSocketNotificationService | null => {
    return notificationService;
  };

export const initializeNotificationService = (
  io: SocketIOServer,
): WebSocketNotificationService => {
  if (notificationService) {
    notificationService.stop();
  }

  notificationService = new WebSocketNotificationService(io);
  notificationService.start();

  return notificationService;
};

export const stopNotificationService = (): void => {
  if (notificationService) {
    notificationService.stop();
    notificationService = null;
  }
};
