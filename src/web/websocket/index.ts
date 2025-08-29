/**
 * WebSocket Server
 *
 * Real-time communication for the Proxmox-MPC web dashboard.
 * Provides live infrastructure updates and notifications.
 */

import { Server as SocketIOServer, Socket } from "socket.io";

import { Logger } from "../../observability/logger";
import { AuthService } from "../api/middleware/auth";

const logger = Logger.getInstance();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  role?: "admin" | "user";
}

/**
 * WebSocket authentication middleware
 */
const authenticateSocket = async (
  socket: AuthenticatedSocket,
  next: Function,
) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      logger.warn("WebSocket authentication failed - no token", {
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      return next(new Error("Authentication token required"));
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded || decoded.type !== "access") {
      logger.warn("WebSocket authentication failed - invalid token", {
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      return next(new Error("Invalid authentication token"));
    }

    // Attach user context to socket
    socket.userId = decoded.sub;
    socket.username = decoded.username;
    socket.role = decoded.role;

    logger.info("WebSocket authenticated", {
      socketId: socket.id,
      userId: decoded.sub,
      username: decoded.username,
      role: decoded.role,
    });

    next();
  } catch (error) {
    logger.error("WebSocket authentication error", {
      socketId: socket.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    next(new Error("Authentication failed"));
  }
};

/**
 * Handle WebSocket connections
 */
export const setupWebSocket = (io: SocketIOServer): void => {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on("connection", (socket: AuthenticatedSocket) => {
    logger.info("WebSocket client connected", {
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username,
      role: socket.role,
    });

    // Join user-specific room for targeted messages
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);

      // Admin users can join admin room for system-wide notifications
      if (socket.role === "admin") {
        socket.join("admin");
      }
    }

    // Handle subscription to infrastructure updates
    socket.on("subscribe:infrastructure", () => {
      socket.join("infrastructure:updates");
      logger.debug("Client subscribed to infrastructure updates", {
        socketId: socket.id,
        userId: socket.userId,
      });

      // Send current infrastructure status
      socket.emit("infrastructure:status", {
        timestamp: new Date().toISOString(),
        vms: { total: 0, running: 0, stopped: 0 },
        containers: { total: 0, running: 0, stopped: 0 },
        nodes: { total: 0, online: 0, offline: 0 },
      });
    });

    // Handle subscription to VM updates
    socket.on("subscribe:vms", (data: { vmIds?: number[] }) => {
      if (data.vmIds && data.vmIds.length > 0) {
        // Subscribe to specific VMs
        data.vmIds.forEach((vmId) => {
          socket.join(`vm:${vmId}`);
        });
        logger.debug("Client subscribed to specific VM updates", {
          socketId: socket.id,
          userId: socket.userId,
          vmIds: data.vmIds,
        });
      } else {
        // Subscribe to all VM updates
        socket.join("vms:all");
        logger.debug("Client subscribed to all VM updates", {
          socketId: socket.id,
          userId: socket.userId,
        });
      }
    });

    // Handle subscription to container updates
    socket.on("subscribe:containers", (data: { containerIds?: number[] }) => {
      if (data.containerIds && data.containerIds.length > 0) {
        data.containerIds.forEach((containerId) => {
          socket.join(`container:${containerId}`);
        });
      } else {
        socket.join("containers:all");
      }

      logger.debug("Client subscribed to container updates", {
        socketId: socket.id,
        userId: socket.userId,
        containerIds: data.containerIds,
      });
    });

    // Handle unsubscribe requests
    socket.on("unsubscribe", (data: { type: string; ids?: number[] }) => {
      const { type, ids } = data;

      if (ids && ids.length > 0) {
        ids.forEach((id) => {
          socket.leave(`${type}:${id}`);
        });
      } else {
        socket.leave(`${type}:all`);
      }

      logger.debug("Client unsubscribed", {
        socketId: socket.id,
        userId: socket.userId,
        type,
        ids,
      });
    });

    // Handle ping/pong for connection health
    socket.on("ping", (callback) => {
      if (typeof callback === "function") {
        callback({
          timestamp: new Date().toISOString(),
          serverTime: Date.now(),
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      logger.info("WebSocket client disconnected", {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
        reason,
      });
    });

    // Handle connection errors
    socket.on("error", (error) => {
      logger.error("WebSocket client error", {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
      });
    });
  });

  // Handle server-level errors
  io.on("error", (error) => {
    logger.error("WebSocket server error", { error: error.message });
  });

  logger.info("WebSocket server initialized successfully");
};

/**
 * Broadcast infrastructure updates to subscribed clients
 */
export const broadcastInfrastructureUpdate = (
  io: SocketIOServer,
  update: any,
): void => {
  io.to("infrastructure:updates").emit("infrastructure:update", {
    ...update,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Broadcast VM status updates
 */
export const broadcastVMUpdate = (
  io: SocketIOServer,
  vmId: number,
  update: any,
): void => {
  // Send to specific VM subscribers
  io.to(`vm:${vmId}`).emit("vm:update", {
    vmId,
    ...update,
    timestamp: new Date().toISOString(),
  });

  // Send to all VM subscribers
  io.to("vms:all").emit("vm:update", {
    vmId,
    ...update,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Broadcast container status updates
 */
export const broadcastContainerUpdate = (
  io: SocketIOServer,
  containerId: number,
  update: any,
): void => {
  io.to(`container:${containerId}`).emit("container:update", {
    containerId,
    ...update,
    timestamp: new Date().toISOString(),
  });

  io.to("containers:all").emit("container:update", {
    containerId,
    ...update,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send notification to specific user
 */
export const sendUserNotification = (
  io: SocketIOServer,
  userId: string,
  notification: {
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    data?: any;
  },
): void => {
  io.to(`user:${userId}`).emit("notification", {
    ...notification,
    timestamp: new Date().toISOString(),
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  });
};

/**
 * Send system-wide notification to all admin users
 */
export const sendSystemNotification = (
  io: SocketIOServer,
  notification: {
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    data?: any;
  },
): void => {
  io.to("admin").emit("system:notification", {
    ...notification,
    timestamp: new Date().toISOString(),
    id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  });
};
