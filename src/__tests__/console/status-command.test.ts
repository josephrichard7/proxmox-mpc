/**
 * Tests for Enhanced Status Command
 * Implements Test-Driven Development for Issue #13 - Status Dashboard
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

import { ProxmoxClient } from "../../api";
import { StatusCommand } from "../../console/commands/status";
import { ConsoleSession } from "../../console/repl";

// Mock dependencies
jest.mock("../../api");
jest.mock("../../workspace");

describe("Enhanced Status Command - TDD Implementation", () => {
  let statusCommand: StatusCommand;
  let mockSession: ConsoleSession;
  let mockClient: jest.Mocked<ProxmoxClient>;
  let mockWorkspace: any;

  beforeEach(() => {
    statusCommand = new StatusCommand();

    // Create mock client
    mockClient = {
      connect: jest.fn(),
      getNodes: jest.fn(),
      getVMs: jest.fn(),
      getContainers: jest.fn(),
      getStoragePools: jest.fn(),
      getNodeStatistics: jest.fn(),
      ping: jest.fn(),
    } as any;

    // Create mock workspace
    mockWorkspace = {
      name: "test-project",
      rootPath: "/test/path",
      configPath: "/test/path/.proxmox/config.yml",
      databasePath: "/test/path/.proxmox/state.db",
      config: {
        host: "192.168.1.100",
        port: 8006,
        username: "root@pam",
        tokenId: "test-token",
        tokenSecret: "test-secret",
        node: "pve",
        rejectUnauthorized: false,
      },
    };

    // Create mock session
    mockSession = {
      workspace: mockWorkspace,
      client: mockClient,
      history: ["init", "status"],
      startTime: new Date("2024-01-01T10:00:00Z"),
      rl: {} as any,
    };

    // Mock console methods
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "table").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Rich Visual Formatting", () => {
    it("should display a formatted dashboard header with colors", async () => {
      mockClient.connect.mockResolvedValue({
        success: true,
        version: "7.4",
        details: { endpoint: "https://192.168.1.100:8006", nodes: 3 },
      });

      await statusCommand.execute([], mockSession);

      // Test for rich header formatting - PASSING TEST
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🎛️  Proxmox Infrastructure Dashboard"),
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/═{50,}/)); // Rich separator
    });

    it("should use colored status indicators for health states", async () => {
      mockClient.connect.mockResolvedValue({
        success: true,
        version: "7.4",
        details: { endpoint: "https://192.168.1.100:8006", nodes: 3 },
      });

      // Mock the getNodes call to trigger performance metrics collection
      mockClient.getNodes.mockResolvedValue([
        {
          node: "pve1",
          status: "online",
          uptime: 86400,
          cpu: 0.2,
          maxcpu: 8,
          mem: 4000000000,
          maxmem: 8000000000,
        },
      ]);

      mockClient.getStoragePools.mockResolvedValue([]);
      mockClient.getVMs.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for colored health indicators - SHOULD PASS
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("\x1b[32m●\x1b[0m"),
      ); // Green circle for healthy
    });

    it("should display infrastructure metrics in formatted tables", async () => {
      mockClient.connect.mockResolvedValue({
        success: true,
        version: "7.4",
        details: { endpoint: "https://192.168.1.100:8006", nodes: 3 },
      });

      mockClient.getNodes.mockResolvedValue([
        {
          node: "pve1",
          status: "online",
          uptime: 86400,
          cpu: 0.2,
          maxcpu: 8,
          mem: 4000000000,
          maxmem: 8000000000,
        },
        {
          node: "pve2",
          status: "online",
          uptime: 86400,
          cpu: 0.3,
          maxcpu: 8,
          mem: 5000000000,
          maxmem: 8000000000,
        },
      ]);

      mockClient.getVMs.mockResolvedValue([
        {
          vmid: 101,
          name: "web-01",
          status: "running",
          cpu: 0.1,
          cpus: 2,
          mem: 1000000000,
          maxmem: 2000000000,
          node: "pve1",
        },
        {
          vmid: 102,
          name: "db-01",
          status: "stopped",
          cpu: 0,
          cpus: 4,
          mem: 0,
          maxmem: 4000000000,
          node: "pve1",
        },
      ]);

      mockClient.getStoragePools.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for formatted table output - SHOULD PASS
      expect(console.table).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            Node: "pve1",
            Status: expect.stringContaining("●"), // Health indicator
            "CPU %": expect.stringContaining("2.5"), // Formatted percentage (0.2/8 * 100 = 2.5)
            "Memory %": expect.stringContaining("50.0"), // Formatted percentage (4GB/8GB * 100 = 50)
          }),
        ]),
      );
    });
  });

  describe("Health Indicators", () => {
    it("should calculate and display overall system health", async () => {
      mockClient.connect.mockResolvedValue({ success: true, version: "7.4" });
      mockClient.getNodes.mockResolvedValue([
        {
          node: "pve1",
          status: "online",
          uptime: 86400,
          cpu: 6.8,
          maxcpu: 8,
          mem: 7000000000,
          maxmem: 8000000000,
        }, // High usage: 85% CPU, 87.5% memory
      ]);
      mockClient.getStoragePools.mockResolvedValue([]);
      mockClient.getVMs.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for overall health calculation - SHOULD PASS
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🔴 CRITICAL"),
      );
    });

    it("should show connectivity health with response time", async () => {
      mockClient.connect.mockResolvedValue({
        success: true,
        version: "7.4",
      });
      mockClient.getNodes.mockResolvedValue([]);
      mockClient.getStoragePools.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for connectivity health with response time - SHOULD PASS
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Response Time:"),
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/\d+ms/));
    });

    it("should categorize resource usage levels", async () => {
      mockClient.connect.mockResolvedValue({ success: true, version: "7.4" });
      mockClient.getNodes.mockResolvedValue([
        {
          node: "pve1",
          status: "online",
          uptime: 86400,
          cpu: 6.0,
          maxcpu: 8,
          mem: 6000000000,
          maxmem: 8000000000,
        }, // Medium usage: 75% CPU, 75% memory
      ]);
      mockClient.getStoragePools.mockResolvedValue([]);
      mockClient.getVMs.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for resource usage categorization - SHOULD PASS
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🟡 MODERATE"),
      ); // Medium usage
    });
  });

  describe("Performance Metrics Collection", () => {
    it("should collect and display node performance statistics", async () => {
      mockClient.connect.mockResolvedValue({ success: true, version: "7.4" });
      mockClient.getNodes.mockResolvedValue([
        {
          node: "pve1",
          status: "online",
          uptime: 86400,
          cpu: 0.2,
          maxcpu: 8,
          mem: 4000000000,
          maxmem: 8000000000,
        },
      ]);
      mockClient.getStoragePools.mockResolvedValue([]);
      mockClient.getVMs.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for performance metrics collection - SHOULD PASS
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Load Average:"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("0.50, 0.40, 0.30"),
      );
    });

    it("should calculate resource efficiency percentages", async () => {
      mockClient.connect.mockResolvedValue({ success: true, version: "7.4" });
      mockClient.getNodes.mockResolvedValue([
        {
          node: "pve1",
          status: "online",
          uptime: 86400,
          cpu: 0.2,
          maxcpu: 8,
          mem: 4000000000,
          maxmem: 8000000000,
        },
      ]);
      mockClient.getVMs.mockResolvedValue([
        {
          vmid: 101,
          name: "web-01",
          status: "running",
          cpu: 0.25,
          cpus: 2,
          mem: 1500000000,
          maxmem: 2000000000,
          node: "pve1",
        },
      ]);
      mockClient.getStoragePools.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for resource efficiency calculations - SHOULD PASS
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("CPU: 12.5%"),
      ); // 0.25/2 = 12.5%
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Memory: 75.0%"),
      ); // 1.5GB/2GB = 75%
    });

    it("should show storage utilization metrics", async () => {
      mockClient.connect.mockResolvedValue({ success: true, version: "7.4" });
      mockClient.getNodes.mockResolvedValue([]);
      mockClient.getStoragePools.mockResolvedValue([
        {
          storage: "local",
          type: "dir",
          used: 50000000000,
          avail: 100000000000,
          total: 150000000000,
        },
        {
          storage: "backup",
          type: "nfs",
          used: 25000000000,
          avail: 75000000000,
          total: 100000000000,
        },
      ]);
      mockClient.getVMs.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for storage metrics display - SHOULD PASS
      expect(console.table).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            Storage: "local",
            "Used %": "33.3%",
            Available: expect.stringContaining("GB"),
          }),
        ]),
      );
    });
  });

  describe("Error Handling and User Feedback", () => {
    it("should gracefully handle partial connectivity failures", async () => {
      mockClient.connect.mockResolvedValue({ success: true, version: "7.4" });
      mockClient.getNodes.mockRejectedValue(new Error("Node API timeout"));
      mockClient.getStoragePools.mockResolvedValue([]);
      mockClient.getVMs.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for graceful error handling - Enhanced metrics with degraded system health should be displayed
      // Since getNodes fails, it returns degraded metrics which still get displayed
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("System Health: 🟠 DEGRADED"),
      );
    });

    it("should provide helpful suggestions when connection fails", async () => {
      mockClient.connect.mockResolvedValue({
        success: false,
        error: "Connection refused",
        details: { endpoint: "https://192.168.1.100:8006" },
      });

      await statusCommand.execute([], mockSession);

      // Test for helpful error suggestions - FAILING TEST
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🔧 Troubleshooting steps:"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Check server connectivity"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Verify credentials"),
      );
    });

    it("should show degraded mode when some services unavailable", async () => {
      mockClient.connect.mockResolvedValue({ success: true, version: "7.4" });
      mockClient.getNodes.mockResolvedValue([
        {
          node: "pve1",
          status: "online",
          uptime: 86400,
          cpu: 0.2,
          maxcpu: 8,
          mem: 4000000000,
          maxmem: 8000000000,
        },
      ]);
      mockClient.getStoragePools.mockRejectedValue(
        new Error("Storage API unavailable"),
      );
      mockClient.getVMs.mockResolvedValue([]);

      await statusCommand.execute([], mockSession);

      // Test for degraded mode indication - SHOULD PASS
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🟠 DEGRADED MODE"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Storage information unavailable"),
      );
    });
  });

  describe("Enhanced Session Information", () => {
    it("should display formatted session metrics with performance data", async () => {
      // Mock session with history
      mockSession.history = ["init", "status", "sync", "status"];
      mockSession.startTime = new Date(Date.now() - 3600000); // 1 hour ago

      await statusCommand.execute([], mockSession);

      // Test for enhanced session metrics - FAILING TEST
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Commands/hour:"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Most used:"),
      );
    });
  });
});
