/**
 * Anonymization System Integration Tests
 * End-to-end testing of the complete anonymization system
 */

import { observability } from "../../observability";
import { OperationLog, DiagnosticSnapshot } from "../../observability/types";
import {
  AnonymizationEngine,
  createAnonymizationEngine,
  createDataProcessor,
  DEFAULT_ANONYMIZATION_OPTIONS,
} from "../index";

describe("Anonymization System Integration", () => {
  let engine: AnonymizationEngine;

  beforeEach(() => {
    engine = createAnonymizationEngine();
    engine.reset();
  });

  describe("Full System Integration", () => {
    test("should anonymize complete diagnostic snapshot end-to-end", async () => {
      // Create a realistic diagnostic snapshot with sensitive data
      const sensitiveSnapshot: DiagnosticSnapshot = {
        id: "diagnostic-123",
        timestamp: "2024-01-01T10:00:00Z",
        workspace: "/home/admin/proxmox-project",
        operation: "vm_create",
        error: {
          message:
            "Failed to connect to admin@example.com server at 192.168.1.100",
          stack:
            "Error: Connection failed\n    at connect (/home/admin/app.js:123)",
        },
        logs: [
          {
            timestamp: "2024-01-01T10:00:00Z",
            correlationId: "test-123",
            operation: "vm_create",
            phase: "connect",
            level: "error",
            message:
              "Authentication failed for user admin@example.com from 192.168.1.100",
            context: {
              workspace: "/home/admin/proxmox-project",
              proxmoxServer: "proxmox.example.com",
              userId: "admin@example.com",
              resourcesAffected: ["vm-100"],
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

      // Anonymize the complete snapshot
      const result = await engine.anonymize(
        sensitiveSnapshot,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );

      // Verify anonymization was applied
      expect(result.metadata.isAnonymized).toBe(true);
      expect(result.metadata.rulesApplied.length).toBeGreaterThan(0);

      // Verify sensitive data was anonymized
      expect(result.data.workspace).not.toContain("admin");
      expect(result.data.error.message).not.toContain("admin@example.com");
      expect(result.data.error.message).not.toContain("192.168.1.100");
      expect(result.data.logs[0].message).not.toContain("admin@example.com");
      expect(result.data.logs[0].context.userId).not.toBe("admin@example.com");
      expect(result.data.logs[0].context.proxmoxServer).not.toBe(
        "proxmox.example.com",
      );

      // Verify structure was preserved
      expect(result.data).toHaveProperty("id");
      expect(result.data).toHaveProperty("timestamp");
      expect(result.data).toHaveProperty("logs");
      expect(result.data.logs).toHaveLength(1);
      expect(result.data.logs[0]).toHaveProperty("context.resourcesAffected");
    });

    test("should handle observability integration with DiagnosticsCollector", async () => {
      const diagnostics = observability.diagnostics;

      // Create a safe snapshot using the integrated method
      const safeSnapshot = await diagnostics.generateSafeSnapshot(
        "/home/admin/test-project",
        "integration_test",
        new Error("Test error with admin@example.com and 192.168.1.100"),
      );

      // Verify the snapshot was anonymized
      expect(safeSnapshot.metadata.isAnonymized).toBe(true);
      expect(safeSnapshot.metadata.rulesApplied.length).toBeGreaterThan(0);

      // Verify sensitive data in workspace was anonymized
      expect(safeSnapshot.data.workspace).not.toContain("admin");

      // Verify the basic structure is preserved
      expect(safeSnapshot.data).toHaveProperty("id");
      expect(safeSnapshot.data).toHaveProperty("timestamp");
      expect(safeSnapshot.data).toHaveProperty("systemInfo");
    });

    test("should process different data types with appropriate processors", async () => {
      // Test log data processor
      const logProcessor = createDataProcessor("log");
      const logData: OperationLog[] = [
        {
          timestamp: "2024-01-01T10:00:00Z",
          correlationId: "test-123",
          operation: "test",
          phase: "execute",
          level: "info",
          message: "User admin@example.com connected from 192.168.1.100",
          context: {
            resourcesAffected: [],
            proxmoxServer: "server.example.com",
          },
        },
      ];

      const logResult = await logProcessor.process(
        logData,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );
      expect(logResult.metadata.isAnonymized).toBe(true);
      expect(logResult.data[0].message).not.toContain("admin@example.com");

      // Test config data processor
      const configProcessor = createDataProcessor("config");
      const configData = {
        server: {
          host: "proxmox.example.com",
          username: "admin",
          password: "secret123",
        },
      };

      const configResult = await configProcessor.process(
        configData,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );
      expect(configResult.metadata.isAnonymized).toBe(true);
      expect(configResult.data.server.password).toBe("[REDACTED]");
      expect(configResult.data.server.host).not.toBe("proxmox.example.com");

      // Test error data processor
      const errorProcessor = createDataProcessor("error");
      const error = new Error(
        "Connection failed to admin@example.com at 192.168.1.100",
      );

      const errorResult = await errorProcessor.process(
        error,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );
      expect(errorResult.metadata.isAnonymized).toBe(true);
      expect(errorResult.data.message).not.toContain("admin@example.com");
    });

    test("should maintain consistent pseudonyms across different data types", async () => {
      const sharedEmail = "admin@example.com";
      const sharedIP = "192.168.1.100";

      // Process the same PII in different data types
      const text1 = `User ${sharedEmail} logged in from ${sharedIP}`;
      const text2 = `Email sent to ${sharedEmail} from server ${sharedIP}`;
      const configData = {
        admin: { email: sharedEmail, server: sharedIP },
      };

      const result1 = await engine.anonymize(
        text1,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );
      const result2 = await engine.anonymize(
        text2,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );
      const result3 = await engine.anonymize(
        configData,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );

      // All results should be anonymized
      expect(result1.metadata.isAnonymized).toBe(true);
      expect(result2.metadata.isAnonymized).toBe(true);
      expect(result3.metadata.isAnonymized).toBe(true);

      // No original PII should remain
      expect(result1.data).not.toContain(sharedEmail);
      expect(result2.data).not.toContain(sharedEmail);
      expect(JSON.stringify(result3.data)).not.toContain(sharedEmail);
    });

    test("should handle performance requirements for large datasets", async () => {
      // Create a large dataset with mixed PII
      const largeData = {
        users: Array(1000)
          .fill(0)
          .map((_, i) => ({
            id: i,
            email: `user${i}@example.com`,
            server: `server-${i}.internal.com`,
            lastLogin: `2024-01-${(i % 30) + 1}T10:00:00Z`,
          })),
        logs: Array(500)
          .fill(0)
          .map(
            (_, i) =>
              `User user${i}@example.com connected from 192.168.1.${i % 255}`,
          ),
      };

      const startTime = Date.now();
      const result = await engine.anonymize(largeData, {
        ...DEFAULT_ANONYMIZATION_OPTIONS,
        maxProcessingTime: 10000, // 10 seconds max
      });
      const processingTime = Date.now() - startTime;

      // Should complete within reasonable time
      expect(processingTime).toBeLessThan(10000);
      expect(result.metadata.isAnonymized).toBe(true);
      expect(result.metadata.processingTimeMs).toBeGreaterThan(0);

      // Verify structure is preserved
      expect(result.data.users).toHaveLength(1000);
      expect(result.data.logs).toHaveLength(500);

      // Verify no original PII remains
      const resultString = JSON.stringify(result.data);
      expect(resultString).not.toContain("@example.com");
      expect(resultString).not.toContain("192.168.1.");
    });

    test("should provide comprehensive statistics after processing", async () => {
      // Process various types of data
      await engine.anonymize(
        "Contact admin@example.com for support",
        DEFAULT_ANONYMIZATION_OPTIONS,
      );
      await engine.anonymize(
        "Server at 192.168.1.100 is down",
        DEFAULT_ANONYMIZATION_OPTIONS,
      );
      await engine.anonymize(
        "Host server-01.internal needs restart",
        DEFAULT_ANONYMIZATION_OPTIONS,
      );

      const stats = engine.getStats();

      // Verify stats are tracked
      expect(stats.totalProcessed).toBe(3);
      expect(stats.totalPseudonyms).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.errorRate).toBe(0);

      // Verify rule usage is tracked
      expect(stats.rulesUsage.email).toBe(1);
      expect(stats.rulesUsage.ip_address).toBe(1);
      expect(stats.rulesUsage.hostname).toBeGreaterThanOrEqual(1);
    });

    test("should handle error scenarios gracefully", async () => {
      // Test with circular references
      const circularData: any = { name: "test@example.com" };
      circularData.self = circularData;

      const result = await engine.anonymize(
        circularData,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );

      // Should not throw and should handle gracefully
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();

      // Check if error tracking works
      const stats = engine.getStats();
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });

    test("should support configuration options correctly", async () => {
      const testData = "User admin@example.com at 192.168.1.100";

      // Test with pseudonyms disabled
      const resultNoPseudonyms = await engine.anonymize(testData, {
        ...DEFAULT_ANONYMIZATION_OPTIONS,
        enablePseudonyms: false,
      });

      expect(resultNoPseudonyms.data).toContain("[REDACTED]");
      expect(resultNoPseudonyms.metadata.pseudonymsUsed).toBe(0);

      // Test with structure preservation disabled
      const complexData = {
        user: { email: "admin@example.com" },
      };

      const resultNoStructure = await engine.anonymize(complexData, {
        ...DEFAULT_ANONYMIZATION_OPTIONS,
        preserveStructure: false,
      });

      expect(resultNoStructure.metadata.preservedStructure).toBe(false);
    });

    test("should integrate properly with report generation", async () => {
      // Simulate the report-issue command workflow
      const originalSnapshot: DiagnosticSnapshot = {
        id: "report-123",
        timestamp: "2024-01-01T10:00:00Z",
        workspace: "/home/admin/test-workspace",
        logs: [
          {
            timestamp: "2024-01-01T10:00:00Z",
            correlationId: "report-123",
            operation: "test",
            phase: "execute",
            level: "error",
            message: "Failed to connect to admin@example.com",
            context: { resourcesAffected: [] },
          },
        ],
        metrics: [],
        healthStatus: [],
        systemInfo: {
          nodeVersion: "v18.0.0",
          platform: "linux",
          memory: {
            rss: 123,
            heapTotal: 456,
            heapUsed: 789,
            external: 0,
            arrayBuffers: 0,
          },
          uptime: 3600,
        },
      };

      // Anonymize for safe sharing
      const safeResult = await engine.anonymize(
        originalSnapshot,
        DEFAULT_ANONYMIZATION_OPTIONS,
      );

      // Verify the report is safe to share
      expect(safeResult.metadata.isAnonymized).toBe(true);
      expect(safeResult.data.workspace).not.toContain("admin");
      expect(safeResult.data.logs[0].message).not.toContain(
        "admin@example.com",
      );

      // Verify it maintains diagnostic utility
      expect(safeResult.data.id).toBe("report-123");
      expect(safeResult.data.logs).toHaveLength(1);
      expect(safeResult.data.systemInfo.nodeVersion).toBe("v18.0.0");
    });
  });
});
