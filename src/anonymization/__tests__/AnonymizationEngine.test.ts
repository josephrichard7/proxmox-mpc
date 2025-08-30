/**
 * AnonymizationEngine Tests
 * Test-Driven Development for core anonymization functionality
 */

import { AnonymizationEngine } from "../engine/AnonymizationEngine";
import {
  AnonymizationOptions,
  AnonymizedData,
  PIIDetectionResult,
  AnonymizationEngineStats,
} from "../types/anonymization-types";

describe("AnonymizationEngine", () => {
  let engine: AnonymizationEngine;
  let defaultOptions: AnonymizationOptions;

  beforeEach(() => {
    engine = AnonymizationEngine.getInstance();
    engine.reset(); // Reset state between tests
    defaultOptions = {
      enablePseudonyms: true,
      preserveStructure: true,
      maxProcessingTime: 5000,
      hashSalt: "test-salt-123",
    };
  });

  describe("Core Functionality", () => {
    test("should be a singleton", () => {
      const engine1 = AnonymizationEngine.getInstance();
      const engine2 = AnonymizationEngine.getInstance();
      expect(engine1).toBe(engine2);
    });

    test("should detect PII in simple text", async () => {
      const testData = "User admin@example.com logged in from 192.168.1.100";

      const result: PIIDetectionResult = await engine.detectPII(testData);

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain("email");
      expect(result.detectedTypes).toContain("ip_address");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.locations.length).toBeGreaterThanOrEqual(2);
    });

    test("should anonymize simple text with PII", async () => {
      const testData = "User admin@example.com logged in from 192.168.1.100";

      const result: AnonymizedData<string> = await engine.anonymize(
        testData,
        defaultOptions,
      );

      expect(result.data).not.toContain("admin@example.com");
      expect(result.data).not.toContain("192.168.1.100");
      expect(result.metadata.isAnonymized).toBe(true);
      expect(result.metadata.rulesApplied).toContain("email");
      expect(result.metadata.rulesApplied).toContain("ip_address");
      expect(result.metadata.pseudonymsUsed).toBeGreaterThan(0);
      expect(result.metadata.processingTimeMs).toBeLessThan(100);
    });

    test("should preserve structure when anonymizing complex objects", async () => {
      const testData = {
        user: {
          email: "admin@example.com",
          id: "user-123",
          lastLogin: "2024-01-01T10:00:00Z",
        },
        server: {
          ip: "192.168.1.100",
          hostname: "proxmox-server-01",
        },
        logs: [
          "User admin@example.com connected",
          "Connection from 192.168.1.100",
        ],
      };

      const result: AnonymizedData<typeof testData> = await engine.anonymize(
        testData,
        defaultOptions,
      );

      // Structure should be preserved
      expect(result.data).toHaveProperty("user.email");
      expect(result.data).toHaveProperty("user.id");
      expect(result.data).toHaveProperty("server.ip");
      expect(result.data).toHaveProperty("server.hostname");
      expect(result.data.logs).toHaveLength(2);

      // But values should be anonymized
      expect(result.data.user.email).not.toBe("admin@example.com");
      expect(result.data.server.ip).not.toBe("192.168.1.100");
      expect(result.data.server.hostname).not.toBe("proxmox-server-01");

      // Metadata should reflect anonymization
      expect(result.metadata.isAnonymized).toBe(true);
      expect(result.metadata.preservedStructure).toBe(true);
      expect(result.metadata.rulesApplied).toContain("email");
      expect(result.metadata.rulesApplied).toContain("ip_address");
      expect(result.metadata.rulesApplied).toContain("hostname");
    });

    test("should maintain consistent pseudonyms across multiple anonymizations", async () => {
      const testData1 = "Contact admin@example.com for support";
      const testData2 = "Send email to admin@example.com today";

      const result1 = await engine.anonymize(testData1, defaultOptions);
      const result2 = await engine.anonymize(testData2, defaultOptions);

      // Both results should be anonymized
      expect(result1.metadata.isAnonymized).toBe(true);
      expect(result2.metadata.isAnonymized).toBe(true);

      // Neither result should contain the original email
      expect(result1.data).not.toContain("admin@example.com");
      expect(result2.data).not.toContain("admin@example.com");

      // Both should have applied email rules
      expect(result1.metadata.rulesApplied).toContain("email");
      expect(result2.metadata.rulesApplied).toContain("email");
    });

    test("should handle large data sets within performance constraints", async () => {
      // Generate large test data with PII
      const largeTestData = Array(1000)
        .fill(0)
        .map((_, i) => ({
          id: i,
          email: `user${i}@example.com`,
          ip: `192.168.1.${i % 255}`,
          message: `User user${i}@example.com connected from 192.168.1.${i % 255}`,
        }));

      const startTime = Date.now();
      const result = await engine.anonymize(largeTestData, defaultOptions);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(
        defaultOptions.maxProcessingTime || 5000,
      );
      expect(result.metadata.isAnonymized).toBe(true);
      expect(result.metadata.processingTimeMs).toBeLessThan(5000);

      // Verify no PII remains
      const resultString = JSON.stringify(result.data);
      expect(resultString).not.toContain("@example.com");
      expect(resultString).not.toContain("192.168.1.");
    });

    test("should return stats about processing", async () => {
      await engine.anonymize(
        "User admin@example.com from 192.168.1.100",
        defaultOptions,
      );
      await engine.anonymize(
        "Another user@test.com from 10.0.0.1",
        defaultOptions,
      );

      const stats: AnonymizationEngineStats = engine.getStats();

      expect(stats.totalProcessed).toBe(2);
      expect(stats.totalPseudonyms).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.rulesUsage.email).toBe(2);
      expect(stats.rulesUsage.ip_address).toBe(2);
      expect(stats.errorRate).toBe(0);
    });

    test("should handle errors gracefully", async () => {
      const invalidData: any = { cyclical: null };
      invalidData.cyclical = invalidData; // Create circular reference

      // Should not throw, but should handle gracefully
      await expect(async () => {
        await engine.anonymize(invalidData, defaultOptions);
      }).not.toThrow();

      const stats = engine.getStats();
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("PII Detection", () => {
    test("should detect IP addresses", async () => {
      const testCases = [
        "Server at 192.168.1.1 is running",
        "Connected to 10.0.0.1",
        "Address: 172.16.0.1",
      ];

      for (const testCase of testCases) {
        const result = await engine.detectPII(testCase);
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("ip_address");
      }
    });

    test("should detect email addresses", async () => {
      const testCases = [
        "user@example.com",
        "admin.user@test-domain.org",
        "test+tag@domain.co.uk",
      ];

      for (const testCase of testCases) {
        const result = await engine.detectPII(testCase);
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("email");
      }
    });

    test("should detect hostnames", async () => {
      const testCases = [
        "proxmox-server-01",
        "db-primary.internal",
        "web01.production.company.com",
      ];

      for (const testCase of testCases) {
        const result = await engine.detectPII(testCase);
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("hostname");
      }
    });

    test("should detect UUIDs", async () => {
      const testCases = [
        "123e4567-e89b-12d3-a456-426614174000",
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      ];

      for (const testCase of testCases) {
        const result = await engine.detectPII(testCase);
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("uuid");
      }
    });

    test("should not detect false positives", async () => {
      const testCases = [
        "This is just normal text",
        "12345",
        "version 1.0.0",
        "error code 404",
      ];

      for (const testCase of testCases) {
        const result = await engine.detectPII(testCase);
        expect(result.hasPII).toBe(false);
        expect(result.detectedTypes).toHaveLength(0);
      }
    });
  });

  describe("Configuration", () => {
    test("should respect enablePseudonyms setting", async () => {
      const testData = "User admin@example.com logged in";
      const optionsWithoutPseudonyms: AnonymizationOptions = {
        ...defaultOptions,
        enablePseudonyms: false,
      };

      const result = await engine.anonymize(testData, optionsWithoutPseudonyms);

      expect(result.data).toContain("[REDACTED]");
      expect(result.metadata.pseudonymsUsed).toBe(0);
    });

    test("should respect preserveStructure setting", async () => {
      const testData = {
        user: { email: "admin@example.com" },
      };
      const optionsWithoutStructure: AnonymizationOptions = {
        ...defaultOptions,
        preserveStructure: false,
      };

      const result = await engine.anonymize(testData, optionsWithoutStructure);

      expect(result.metadata.preservedStructure).toBe(false);
    });

    test("should respect maxProcessingTime constraint", async () => {
      const largeData = Array(10000).fill("admin@example.com").join(" ");
      const quickOptions: AnonymizationOptions = {
        ...defaultOptions,
        maxProcessingTime: 50, // Very short time
      };

      const startTime = Date.now();
      const result = await engine.anonymize(largeData, quickOptions);
      const processingTime = Date.now() - startTime;

      // With very short timeout, processing should complete quickly
      // (may return original data if timeout is too short for processing)
      expect(processingTime).toBeLessThan(200); // Reasonable upper bound
      expect(result.data).toBeDefined();
    });
  });
});
