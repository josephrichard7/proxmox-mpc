/**
 * Infrastructure Management API Tests
 *
 * Tests for infrastructure synchronization and status endpoints.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

// Mock dependencies
jest.mock("../../../../database/client");
jest.mock("../../../../database/repositories/vm-repository");
jest.mock("../../../../database/repositories/container-repository");
jest.mock("../../../../database/repositories/node-repository");
jest.mock("../services/database-sync-service");
jest.mock("../../../websocket/notification-service");

import { DatabaseClient } from "../../../../database/client";
import { ContainerRepository } from "../../../../database/repositories/container-repository";
import { NodeRepository } from "../../../../database/repositories/node-repository";
import { VMRepository } from "../../../../database/repositories/vm-repository";
import { getNotificationService } from "../../../websocket/notification-service";
import { errorHandler } from "../../middleware/error";
import infrastructureRoutes from "../../routes/infrastructure";
import { getDatabaseSyncService } from "../../services/database-sync-service";

// Test data
const mockUser = {
  id: "test-user-123",
  username: "testuser",
  email: "test@example.com",
  role: "user" as const,
  proxmoxServer: "proxmox.test.local",
  createdAt: new Date(),
};

const mockNode = {
  id: 1,
  name: "pve",
  status: "online",
  uptime: 86400,
  cpuUsage: 0.25,
  memoryUsed: 4294967296, // 4GB
  memoryTotal: 17179869184, // 16GB
  storageUsed: 107374182400, // 100GB
  storageTotal: 1073741824000, // 1TB
  lastSeen: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock implementations
const mockVMRepo = {
  count: jest.fn(),
  findMany: jest.fn(),
};

const mockContainerRepo = {
  count: jest.fn(),
  findMany: jest.fn(),
};

const mockNodeRepo = {
  count: jest.fn(),
  findMany: jest.fn(),
};

const mockSyncService = {
  syncFromProxmoxServer: jest.fn(),
  cleanupStaleEntries: jest.fn(),
};

const mockNotificationService = {
  broadcastOperationNotification: jest.fn(),
};

// Mock authentication middleware
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = mockUser;
  next();
};

// Setup Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(mockAuthMiddleware);
  app.use("/api/infrastructure", infrastructureRoutes);
  app.use(errorHandler);
  return app;
};

describe("Infrastructure Management API", () => {
  let app: express.Application;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    (DatabaseClient.getInstance as jest.Mock).mockReturnValue({});
    (VMRepository as jest.Mock).mockImplementation(() => mockVMRepo);
    (ContainerRepository as jest.Mock).mockImplementation(
      () => mockContainerRepo,
    );
    (NodeRepository as jest.Mock).mockImplementation(() => mockNodeRepo);
    (getDatabaseSyncService as jest.Mock).mockReturnValue(mockSyncService);
    (getNotificationService as jest.Mock).mockReturnValue(
      mockNotificationService,
    );

    // Set up environment variables for testing
    process.env.PROXMOX_TOKEN_ID = "test-token-id";
    process.env.PROXMOX_TOKEN_SECRET = "test-token-secret";

    app = createTestApp();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.PROXMOX_TOKEN_ID;
    delete process.env.PROXMOX_TOKEN_SECRET;
  });

  describe("GET /api/infrastructure/status", () => {
    beforeEach(() => {
      // Setup mock data for infrastructure status
      mockVMRepo.count
        .mockResolvedValueOnce(10) // total VMs
        .mockResolvedValueOnce(7) // running VMs
        .mockResolvedValueOnce(3); // stopped VMs

      mockContainerRepo.count
        .mockResolvedValueOnce(5) // total containers
        .mockResolvedValueOnce(4) // running containers
        .mockResolvedValueOnce(1); // stopped containers

      mockNodeRepo.count
        .mockResolvedValueOnce(2) // total nodes
        .mockResolvedValueOnce(2); // online nodes

      mockNodeRepo.findMany.mockResolvedValue([
        mockNode,
        { ...mockNode, id: 2, name: "pve2" },
      ]);

      // Mock node-specific VM/container counts
      mockVMRepo.count.mockResolvedValue(5); // VMs per node
      mockContainerRepo.count.mockResolvedValue(2); // Containers per node
    });

    it("should return comprehensive infrastructure status", async () => {
      const response = await request(app)
        .get("/api/infrastructure/status")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toMatchObject({
        vms: {
          total: 10,
          running: 7,
          stopped: 3,
          percentage: 70, // 7/10 * 100
        },
        containers: {
          total: 5,
          running: 4,
          stopped: 1,
          percentage: 80, // 4/5 * 100
        },
        nodes: {
          total: 2,
          online: 2,
          offline: 0,
          percentage: 100, // 2/2 * 100
        },
      });

      expect(response.body.data.summary.resources).toHaveProperty("memory");
      expect(response.body.data.summary.resources).toHaveProperty("storage");
      expect(response.body.data.nodes).toHaveLength(2);
      expect(response.body.data.lastUpdated).toBeDefined();
    });

    it("should calculate resource usage correctly", async () => {
      const response = await request(app)
        .get("/api/infrastructure/status")
        .expect(200);

      const { memory, storage } = response.body.data.summary.resources;

      // Memory: 2 nodes * 4GB used each = 8GB used, 2 nodes * 16GB total each = 32GB total
      expect(memory.used).toBe(8589934592); // 8GB in bytes
      expect(memory.total).toBe(34359738368); // 32GB in bytes
      expect(memory.percentage).toBe(25); // 8/32 * 100

      // Storage: 2 nodes * 100GB used each = 200GB used, 2 nodes * 1TB total each = 2TB total
      expect(storage.used).toBe(214748364800); // 200GB in bytes
      expect(storage.total).toBe(2147483648000); // 2TB in bytes
      expect(storage.percentage).toBe(10); // 200/2000 * 100
    });

    it("should include detailed node information", async () => {
      const response = await request(app)
        .get("/api/infrastructure/status")
        .expect(200);

      const nodeDetails = response.body.data.nodes;
      expect(nodeDetails).toHaveLength(2);

      expect(nodeDetails[0]).toMatchObject({
        name: "pve",
        status: "online",
        vms: 5,
        containers: 2,
        cpu: { usage: 0.25 },
        memory: {
          used: 4294967296,
          total: 17179869184,
          percentage: 25,
        },
        storage: {
          used: 107374182400,
          total: 1073741824000,
          percentage: 10,
        },
        uptime: 86400,
      });
    });

    it("should handle empty infrastructure gracefully", async () => {
      // Mock empty infrastructure
      mockVMRepo.count.mockResolvedValue(0);
      mockContainerRepo.count.mockResolvedValue(0);
      mockNodeRepo.count.mockResolvedValue(0);
      mockNodeRepo.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/infrastructure/status")
        .expect(200);

      expect(response.body.data.summary.vms.total).toBe(0);
      expect(response.body.data.summary.containers.total).toBe(0);
      expect(response.body.data.summary.nodes.total).toBe(0);
      expect(response.body.data.nodes).toHaveLength(0);
    });

    it("should handle database errors", async () => {
      mockVMRepo.count.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await request(app).get("/api/infrastructure/status").expect(500);
    });
  });

  describe("POST /api/infrastructure/sync", () => {
    const mockSyncResults = {
      nodes: 2,
      vms: 10,
      containers: 5,
      errors: [],
    };

    it("should start infrastructure sync successfully", async () => {
      mockSyncService.syncFromProxmoxServer.mockResolvedValue(mockSyncResults);

      const response = await request(app)
        .post("/api/infrastructure/sync")
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("in_progress");
      expect(response.body.data.syncId).toMatch(/^sync_\d+_/);

      // Give async operations time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSyncService.syncFromProxmoxServer).toHaveBeenCalled();
      expect(
        mockNotificationService.broadcastOperationNotification,
      ).toHaveBeenCalledWith(
        "update",
        "vm",
        0,
        "Infrastructure",
        "success",
        mockUser.id,
        expect.stringContaining("synchronized 17 resources"),
      );
    });

    it("should use custom Proxmox server from request", async () => {
      mockSyncService.syncFromProxmoxServer.mockResolvedValue(mockSyncResults);

      const customServer = "custom-proxmox.test.local";

      await request(app)
        .post("/api/infrastructure/sync")
        .send({ proxmoxServer: customServer })
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSyncService.syncFromProxmoxServer).toHaveBeenCalledWith(
        expect.objectContaining({
          host: customServer,
        }),
      );
    });

    it("should perform cleanup when requested", async () => {
      const mockCleanupResults = {
        deletedVMs: 2,
        deletedContainers: 1,
        errors: [],
      };

      mockSyncService.syncFromProxmoxServer.mockResolvedValue(mockSyncResults);
      mockSyncService.cleanupStaleEntries.mockResolvedValue(mockCleanupResults);

      await request(app)
        .post("/api/infrastructure/sync")
        .send({ cleanup: true })
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSyncService.cleanupStaleEntries).toHaveBeenCalled();
    });

    it("should handle sync errors and broadcast failure notification", async () => {
      const syncError = new Error("Proxmox connection failed");
      mockSyncService.syncFromProxmoxServer.mockRejectedValue(syncError);

      await request(app).post("/api/infrastructure/sync").send({}).expect(200); // Initial response is still 200

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(
        mockNotificationService.broadcastOperationNotification,
      ).toHaveBeenCalledWith(
        "update",
        "vm",
        0,
        "Infrastructure",
        "error",
        mockUser.id,
        "Proxmox connection failed",
      );
    });

    it("should handle sync with errors in results", async () => {
      const resultsWithErrors = {
        ...mockSyncResults,
        errors: ["Failed to sync VM 100", "Node pve2 unreachable"],
      };

      mockSyncService.syncFromProxmoxServer.mockResolvedValue(
        resultsWithErrors,
      );

      await request(app).post("/api/infrastructure/sync").send({}).expect(200);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(
        mockNotificationService.broadcastOperationNotification,
      ).toHaveBeenCalledWith(
        "update",
        "vm",
        0,
        "Infrastructure",
        "error",
        mockUser.id,
        "Sync completed with 2 errors",
      );
    });

    it("should return 400 when no Proxmox server is configured", async () => {
      // Create user without proxmoxServer
      const userWithoutServer = { ...mockUser, proxmoxServer: undefined };

      const appWithoutServer = express();
      appWithoutServer.use(express.json());
      appWithoutServer.use((req: any, res: any, next: any) => {
        req.user = userWithoutServer;
        next();
      });
      appWithoutServer.use("/api/infrastructure", infrastructureRoutes);
      appWithoutServer.use(errorHandler);

      await request(appWithoutServer)
        .post("/api/infrastructure/sync")
        .send({})
        .expect(400);
    });

    it("should return 500 when Proxmox credentials are missing", async () => {
      // Remove environment variables
      delete process.env.PROXMOX_TOKEN_ID;
      delete process.env.PROXMOX_TOKEN_SECRET;

      await request(app).post("/api/infrastructure/sync").send({}).expect(500);
    });

    it("should validate request body", async () => {
      await request(app)
        .post("/api/infrastructure/sync")
        .send({ proxmoxServer: "invalid-url" })
        .expect(400);
    });

    it("should use default node when not specified", async () => {
      mockSyncService.syncFromProxmoxServer.mockResolvedValue(mockSyncResults);

      await request(app).post("/api/infrastructure/sync").send({}).expect(200);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSyncService.syncFromProxmoxServer).toHaveBeenCalledWith(
        expect.objectContaining({
          node: "pve", // default node
        }),
      );
    });
  });
});
