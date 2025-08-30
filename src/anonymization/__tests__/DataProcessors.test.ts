/**
 * Data Processors Tests
 * Test-Driven Development for specialized data type processors
 */

import {
  OperationLog,
  DiagnosticSnapshot,
  LogLevel,
} from "../../observability/types";
import { ConfigDataProcessor } from "../processors/ConfigDataProcessor";
import { DatabaseDataProcessor } from "../processors/DatabaseDataProcessor";
import { ErrorDataProcessor } from "../processors/ErrorDataProcessor";
import { LogDataProcessor } from "../processors/LogDataProcessor";
import {
  AnonymizationOptions,
  AnonymizedData,
} from "../types/anonymization-types";

describe("Data Processors", () => {
  let defaultOptions: AnonymizationOptions;

  beforeEach(() => {
    defaultOptions = {
      enablePseudonyms: true,
      preserveStructure: true,
      hashSalt: "test-salt",
    };
  });

  describe("LogDataProcessor", () => {
    let processor: LogDataProcessor;

    beforeEach(() => {
      processor = new LogDataProcessor();
    });

    test("should identify log data correctly", () => {
      const logData: OperationLog[] = [
        {
          timestamp: "2024-01-01T10:00:00Z",
          correlationId: "test-123",
          operation: "test",
          phase: "execute",
          level: "info",
          message: "User admin@example.com logged in from 192.168.1.100",
          context: {
            workspace: "/home/user/proxmox-project",
            proxmoxServer: "proxmox.example.com",
            resourcesAffected: ["vm-123"],
            userId: "admin@example.com",
          },
        },
      ];

      expect(processor.canProcess(logData)).toBe(true);
      expect(processor.canProcess("not-log-data")).toBe(false);
      expect(processor.canProcess({})).toBe(false);
    });

    test("should anonymize PII in log messages", async () => {
      const logData: OperationLog[] = [
        {
          timestamp: "2024-01-01T10:00:00Z",
          correlationId: "test-123",
          operation: "login",
          phase: "execute",
          level: "info",
          message: "User admin@example.com logged in from 192.168.1.100",
          context: {
            resourcesAffected: [],
          },
        },
      ];

      const result: AnonymizedData<OperationLog[]> = await processor.process(
        logData,
        defaultOptions,
      );

      expect(result.data[0].message).not.toContain("admin@example.com");
      expect(result.data[0].message).not.toContain("192.168.1.100");
      expect(result.metadata.isAnonymized).toBe(true);
      expect(result.metadata.rulesApplied).toContain("email");
      expect(result.metadata.rulesApplied).toContain("ip_address");
    });

    test("should anonymize PII in log context", async () => {
      const logData: OperationLog[] = [
        {
          timestamp: "2024-01-01T10:00:00Z",
          correlationId: "test-123",
          operation: "test",
          phase: "execute",
          level: "info",
          message: "Test operation",
          context: {
            workspace: "/home/admin/proxmox-project",
            proxmoxServer: "proxmox.example.com",
            resourcesAffected: [],
            userId: "admin@example.com",
            sessionId: "session-uuid-123",
          },
        },
      ];

      const result = await processor.process(logData, defaultOptions);

      expect(result.data[0].context.workspace).not.toContain("admin");
      expect(result.data[0].context.proxmoxServer).not.toBe(
        "proxmox.example.com",
      );
      expect(result.data[0].context.userId).not.toBe("admin@example.com");
      expect(result.metadata.isAnonymized).toBe(true);
    });

    test("should preserve log structure and metadata", async () => {
      const logData: OperationLog[] = [
        {
          timestamp: "2024-01-01T10:00:00Z",
          correlationId: "test-123",
          operation: "test",
          phase: "execute",
          level: "info",
          message: "User admin@example.com performed action",
          context: {
            resourcesAffected: [],
          },
          metadata: {
            requestId: "req-123",
            traceId: "trace-456",
          },
        },
      ];

      const result = await processor.process(logData, defaultOptions);

      expect(result.data[0]).toHaveProperty("timestamp");
      expect(result.data[0]).toHaveProperty("correlationId");
      expect(result.data[0]).toHaveProperty("operation");
      expect(result.data[0]).toHaveProperty("level");
      expect(result.data[0]).toHaveProperty("context");
      expect(result.data[0]).toHaveProperty("metadata");
      expect(result.data[0].timestamp).toBe("2024-01-01T10:00:00Z");
      expect(result.data[0].level).toBe("info");
    });
  });

  describe("ConfigDataProcessor", () => {
    let processor: ConfigDataProcessor;

    beforeEach(() => {
      processor = new ConfigDataProcessor();
    });

    test("should identify config data correctly", () => {
      const configData = {
        server: {
          host: "proxmox.example.com",
          username: "admin",
          tokenSecret: "secret-token-123",
        },
      };

      expect(processor.canProcess(configData)).toBe(true);
      expect(processor.canProcess("not-config")).toBe(false);
      expect(processor.canProcess([])).toBe(false);
    });

    test("should anonymize sensitive configuration values", async () => {
      const configData = {
        server: {
          host: "proxmox.example.com",
          port: 8006,
          username: "admin@pam",
          password: "super-secret-password",
          tokenId: "user@realm!token-name",
          tokenSecret: "abcd1234-5678-90ef-ghij-klmnopqrstuv",
          insecure: true,
        },
        workspace: {
          path: "/home/admin/proxmox-project",
          name: "production-datacenter",
        },
      };

      const result = await processor.process(configData, defaultOptions);

      // Sensitive values should be anonymized
      expect(result.data.server.host).not.toBe("proxmox.example.com");
      expect(result.data.server.username).not.toBe("admin@pam");
      expect(result.data.server.password).toBe("[REDACTED]");
      expect(result.data.server.tokenSecret).toBe("[REDACTED]");
      expect(result.data.workspace.path).not.toContain("admin");

      // Non-sensitive values should be preserved
      expect(result.data.server.port).toBe(8006);
      expect(result.data.server.insecure).toBe(true);

      expect(result.metadata.isAnonymized).toBe(true);
      expect(result.metadata.rulesApplied).toContain("hostname");
      expect(result.metadata.rulesApplied).toContain("username");
      expect(result.metadata.rulesApplied).toContain("password");
      expect(result.metadata.rulesApplied).toContain("token");
    });

    test("should handle nested configuration objects", async () => {
      const configData = {
        database: {
          connections: {
            primary: {
              host: "db-primary.internal",
              username: "dbuser",
              password: "dbpass123",
            },
            replica: {
              host: "db-replica.internal",
              username: "dbuser",
              password: "dbpass123",
            },
          },
        },
      };

      const result = await processor.process(configData, defaultOptions);

      expect(result.data.database.connections.primary.host).not.toBe(
        "db-primary.internal",
      );
      expect(result.data.database.connections.replica.host).not.toBe(
        "db-replica.internal",
      );
      expect(result.data.database.connections.primary.password).toBe(
        "[REDACTED]",
      );
      expect(result.data.database.connections.replica.password).toBe(
        "[REDACTED]",
      );
    });
  });

  describe("DatabaseDataProcessor", () => {
    let processor: DatabaseDataProcessor;

    beforeEach(() => {
      processor = new DatabaseDataProcessor();
    });

    test("should identify database data correctly", () => {
      const dbData = {
        nodes: [{ id: 1, hostname: "node-01", ip: "192.168.1.10" }],
        vms: [{ id: 100, name: "web-server", node: "node-01" }],
      };

      expect(processor.canProcess(dbData)).toBe(true);
      expect(processor.canProcess("not-db-data")).toBe(false);
    });

    test("should anonymize PII in database records", async () => {
      const dbData = {
        nodes: [
          {
            id: 1,
            hostname: "proxmox-node-01",
            ip: "192.168.1.10",
            status: "online",
            createdAt: "2024-01-01T10:00:00Z",
          },
        ],
        vms: [
          {
            id: 100,
            name: "web-server-prod",
            node: "proxmox-node-01",
            ip: "192.168.1.100",
            owner: "admin@company.com",
            status: "running",
          },
        ],
      };

      const result = await processor.process(dbData, defaultOptions);

      // PII should be anonymized
      expect(result.data.nodes[0].hostname).not.toBe("proxmox-node-01");
      expect(result.data.nodes[0].ip).not.toBe("192.168.1.10");
      expect(result.data.vms[0].ip).not.toBe("192.168.1.100");
      expect(result.data.vms[0].owner).not.toBe("admin@company.com");

      // Non-PII should be preserved
      expect(result.data.nodes[0].id).toBe(1);
      expect(result.data.nodes[0].status).toBe("online");
      expect(result.data.vms[0].id).toBe(100);
      expect(result.data.vms[0].status).toBe("running");

      expect(result.metadata.isAnonymized).toBe(true);
    });

    test("should maintain referential integrity", async () => {
      const dbData = {
        nodes: [{ id: 1, hostname: "node-01", ip: "192.168.1.10" }],
        vms: [
          { id: 100, name: "vm-01", node: "node-01", ip: "192.168.1.100" },
          { id: 101, name: "vm-02", node: "node-01", ip: "192.168.1.101" },
        ],
      };

      const result = await processor.process(dbData, defaultOptions);

      // The pseudonym for 'node-01' should be consistent across references
      const nodeHostnamePseudonym = result.data.nodes[0].hostname;
      expect(result.data.vms[0].node).toBe(nodeHostnamePseudonym);
      expect(result.data.vms[1].node).toBe(nodeHostnamePseudonym);
    });
  });

  describe("ErrorDataProcessor", () => {
    let processor: ErrorDataProcessor;

    beforeEach(() => {
      processor = new ErrorDataProcessor();
    });

    test("should identify error data correctly", () => {
      const errorData = new Error("Connection failed to admin@example.com");
      const errorObject = {
        name: "ConnectionError",
        message: "Failed to connect to 192.168.1.100",
        stack: "Error: ...",
      };

      expect(processor.canProcess(errorData)).toBe(true);
      expect(processor.canProcess(errorObject)).toBe(true);
      expect(processor.canProcess("not-error")).toBe(false);
    });

    test("should anonymize PII in error messages", async () => {
      const error = new Error(
        "Authentication failed for user admin@example.com at 192.168.1.100",
      );
      error.stack = `Error: Authentication failed for user admin@example.com at 192.168.1.100
        at connect (auth.js:123:45)
        at login (/home/admin/app.js:67:89)`;

      const result = await processor.process(error, defaultOptions);

      expect(result.data.message).not.toContain("admin@example.com");
      expect(result.data.message).not.toContain("192.168.1.100");
      expect(result.data.stack).not.toContain("admin@example.com");
      expect(result.data.stack).not.toContain("/home/admin/");
      expect(result.metadata.isAnonymized).toBe(true);
    });

    test("should anonymize PII in diagnostic snapshots", async () => {
      const snapshot: DiagnosticSnapshot = {
        id: "snapshot-123",
        timestamp: "2024-01-01T10:00:00Z",
        workspace: "/home/admin/proxmox-project",
        operation: "vm_create",
        error: {
          message: "Failed to create VM for admin@example.com",
          stack: "Error at /home/admin/script.js:10",
        },
        logs: [
          {
            timestamp: "2024-01-01T10:00:00Z",
            correlationId: "test-123",
            operation: "vm_create",
            phase: "execute",
            level: "error",
            message: "Connection to 192.168.1.100 failed",
            context: {
              resourcesAffected: [],
            },
          },
        ],
        metrics: [],
        healthStatus: [],
        systemInfo: {
          nodeVersion: "v18.0.0",
          platform: "linux",
          memory: {
            rss: 123456,
            heapTotal: 789012,
            heapUsed: 345678,
            external: 901234,
            arrayBuffers: 567890,
          },
          uptime: 3600,
        },
      };

      const result = await processor.process(snapshot, defaultOptions);

      expect(result.data.workspace).not.toContain("admin");
      expect(result.data.error.message).not.toContain("admin@example.com");
      expect(result.data.error.stack).not.toContain("/home/admin/");
      expect(result.data.logs[0].message).not.toContain("192.168.1.100");
      expect(result.metadata.isAnonymized).toBe(true);
    });

    test("should preserve error structure and non-PII data", async () => {
      const error = {
        name: "ValidationError",
        message: "Invalid email: admin@example.com",
        code: "INVALID_EMAIL",
        statusCode: 400,
      };

      const result = await processor.process(error, defaultOptions);

      expect(result.data.name).toBe("ValidationError");
      expect(result.data.code).toBe("INVALID_EMAIL");
      expect(result.data.statusCode).toBe(400);
      expect(result.data.message).not.toContain("admin@example.com");
    });
  });

  describe("Processor Integration", () => {
    test("should handle mixed data types consistently", async () => {
      const logProcessor = new LogDataProcessor();
      const configProcessor = new ConfigDataProcessor();

      const sharedEmail = "admin@example.com";
      const sharedIP = "192.168.1.100";

      // Process config data first
      const configData = {
        server: { host: sharedIP, username: sharedEmail },
      };
      const configResult = await configProcessor.process(
        configData,
        defaultOptions,
      );

      // Process log data with same PII
      const logData: OperationLog[] = [
        {
          timestamp: "2024-01-01T10:00:00Z",
          correlationId: "test-123",
          operation: "test",
          phase: "execute",
          level: "info" as LogLevel,
          message: `User ${sharedEmail} connected from ${sharedIP}`,
          context: { resourcesAffected: [] },
        },
      ];
      const logResult = await logProcessor.process(logData, defaultOptions);

      // Both processors should generate pseudonyms (they have separate instances)
      // This test validates that processors work independently
      expect(configResult.metadata.isAnonymized).toBe(true);
      expect(logResult.metadata.isAnonymized).toBe(true);
      expect(configResult.data.server.username).not.toBe(sharedEmail);
      expect(logResult.data[0].message).not.toContain(sharedEmail);
    });
  });
});
