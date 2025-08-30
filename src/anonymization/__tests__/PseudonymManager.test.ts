/**
 * PseudonymManager Tests
 * Test-Driven Development for consistent pseudonym management
 */

import { PseudonymManager } from "../engine/PseudonymManager";
import {
  PseudonymMapping,
  AnonymizationRuleType,
} from "../types/anonymization-types";

describe("PseudonymManager", () => {
  let manager: PseudonymManager;

  beforeEach(() => {
    manager = new PseudonymManager();
  });

  describe("Core Functionality", () => {
    test("should generate consistent pseudonyms for same input", () => {
      const originalValue = "admin@example.com";
      const type: AnonymizationRuleType = "email";

      const pseudonym1 = manager.getPseudonym(originalValue, type, "user_data");
      const pseudonym2 = manager.getPseudonym(originalValue, type, "user_data");

      expect(pseudonym1).toBe(pseudonym2);
      expect(pseudonym1).not.toBe(originalValue);
    });

    test("should generate different pseudonyms for different inputs", () => {
      const value1 = "admin@example.com";
      const value2 = "user@example.com";
      const type: AnonymizationRuleType = "email";

      const pseudonym1 = manager.getPseudonym(value1, type, "user_data");
      const pseudonym2 = manager.getPseudonym(value2, type, "user_data");

      expect(pseudonym1).not.toBe(pseudonym2);
      expect(pseudonym1).not.toBe(value1);
      expect(pseudonym2).not.toBe(value2);
    });

    test("should maintain format for different PII types", () => {
      const emailPseudonym = manager.getPseudonym(
        "admin@example.com",
        "email",
        "test",
      );
      const ipPseudonym = manager.getPseudonym(
        "192.168.1.100",
        "ip_address",
        "test",
      );
      const hostnamePseudonym = manager.getPseudonym(
        "server-01",
        "hostname",
        "test",
      );

      // Email should maintain email format
      expect(emailPseudonym).toMatch(
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      );

      // IP should maintain IP format
      expect(ipPseudonym).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);

      // Hostname should maintain hostname format
      expect(hostnamePseudonym).toMatch(
        /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*$/,
      );
    });

    test("should track all created mappings", () => {
      manager.getPseudonym("admin@example.com", "email", "user_data");
      manager.getPseudonym("192.168.1.100", "ip_address", "network_data");
      manager.getPseudonym("server-01", "hostname", "server_data");

      const mappings = manager.getAllMappings();

      expect(mappings).toHaveLength(3);
      expect(mappings.some((m) => m.type === "email")).toBe(true);
      expect(mappings.some((m) => m.type === "ip_address")).toBe(true);
      expect(mappings.some((m) => m.type === "hostname")).toBe(true);
    });

    test("should retrieve mapping by original value", () => {
      const originalValue = "admin@example.com";
      const pseudonym = manager.getPseudonym(originalValue, "email", "test");

      const mapping = manager.getMapping(originalValue);

      expect(mapping).toBeDefined();
      expect(mapping!.originalValue).toBe(originalValue);
      expect(mapping!.pseudonym).toBe(pseudonym);
      expect(mapping!.type).toBe("email");
      expect(mapping!.category).toBe("test");
    });

    test("should retrieve mapping by pseudonym", () => {
      const originalValue = "admin@example.com";
      const pseudonym = manager.getPseudonym(originalValue, "email", "test");

      const mapping = manager.getMappingByPseudonym(pseudonym);

      expect(mapping).toBeDefined();
      expect(mapping!.originalValue).toBe(originalValue);
      expect(mapping!.pseudonym).toBe(pseudonym);
    });

    test("should return null for non-existent mappings", () => {
      const mapping = manager.getMapping("nonexistent@example.com");
      expect(mapping).toBeNull();

      const mappingByPseudonym = manager.getMappingByPseudonym(
        "nonexistent-pseudonym",
      );
      expect(mappingByPseudonym).toBeNull();
    });

    test("should clear all mappings", () => {
      manager.getPseudonym("admin@example.com", "email", "test");
      manager.getPseudonym("192.168.1.100", "ip_address", "test");

      expect(manager.getAllMappings()).toHaveLength(2);

      manager.clearMappings();

      expect(manager.getAllMappings()).toHaveLength(0);
    });

    test("should provide statistics", () => {
      manager.getPseudonym("admin@example.com", "email", "user");
      manager.getPseudonym("user@example.com", "email", "user");
      manager.getPseudonym("192.168.1.100", "ip_address", "network");

      const stats = manager.getStats();

      expect(stats.totalMappings).toBe(3);
      expect(stats.mappingsByType.email).toBe(2);
      expect(stats.mappingsByType.ip_address).toBe(1);
      expect(stats.mappingsByCategory.user).toBe(2);
      expect(stats.mappingsByCategory.network).toBe(1);
    });
  });

  describe("Pseudonym Generation", () => {
    test("should generate valid email pseudonyms", () => {
      const emails = [
        "admin@example.com",
        "user.name@test-domain.org",
        "test+tag@subdomain.company.co.uk",
      ];

      emails.forEach((email) => {
        const pseudonym = manager.getPseudonym(email, "email", "test");

        // Should be valid email format
        expect(pseudonym).toMatch(
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        );

        // Should not be the original
        expect(pseudonym).not.toBe(email);

        // Should be consistent
        const secondPseudonym = manager.getPseudonym(email, "email", "test");
        expect(pseudonym).toBe(secondPseudonym);
      });
    });

    test("should generate valid IP address pseudonyms", () => {
      const ips = ["192.168.1.100", "10.0.0.1", "172.16.255.255"];

      ips.forEach((ip) => {
        const pseudonym = manager.getPseudonym(ip, "ip_address", "test");

        // Should be valid IP format
        expect(pseudonym).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);

        // Should be valid IP ranges
        const parts = pseudonym.split(".").map(Number);
        parts.forEach((part) => {
          expect(part).toBeGreaterThanOrEqual(0);
          expect(part).toBeLessThanOrEqual(255);
        });

        // Should not be the original
        expect(pseudonym).not.toBe(ip);

        // Should be consistent
        const secondPseudonym = manager.getPseudonym(ip, "ip_address", "test");
        expect(pseudonym).toBe(secondPseudonym);
      });
    });

    test("should generate valid hostname pseudonyms", () => {
      const hostnames = [
        "server-01",
        "db.internal.company.com",
        "web-frontend-prod",
      ];

      hostnames.forEach((hostname) => {
        const pseudonym = manager.getPseudonym(hostname, "hostname", "test");

        // Should be valid hostname format (basic check)
        expect(pseudonym).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/);

        // Should not start or end with hyphen
        expect(pseudonym).not.toMatch(/^-/);
        expect(pseudonym).not.toMatch(/-$/);

        // Should not be the original
        expect(pseudonym).not.toBe(hostname);

        // Should be consistent
        const secondPseudonym = manager.getPseudonym(
          hostname,
          "hostname",
          "test",
        );
        expect(pseudonym).toBe(secondPseudonym);
      });
    });

    test("should generate valid UUID pseudonyms", () => {
      const uuids = [
        "123e4567-e89b-12d3-a456-426614174000",
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      ];

      uuids.forEach((uuid) => {
        const pseudonym = manager.getPseudonym(uuid, "uuid", "test");

        // Should be valid UUID format
        expect(pseudonym).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );

        // Should not be the original
        expect(pseudonym).not.toBe(uuid);

        // Should be consistent
        const secondPseudonym = manager.getPseudonym(uuid, "uuid", "test");
        expect(pseudonym).toBe(secondPseudonym);
      });
    });
  });

  describe("Mapping Persistence", () => {
    test("should export mappings", () => {
      manager.getPseudonym("admin@example.com", "email", "user");
      manager.getPseudonym("192.168.1.100", "ip_address", "network");

      const exportedMappings = manager.exportMappings();

      expect(exportedMappings).toHaveLength(2);
      expect(exportedMappings[0]).toHaveProperty("originalValue");
      expect(exportedMappings[0]).toHaveProperty("pseudonym");
      expect(exportedMappings[0]).toHaveProperty("type");
      expect(exportedMappings[0]).toHaveProperty("category");
      expect(exportedMappings[0]).toHaveProperty("createdAt");
    });

    test("should import mappings", () => {
      const mappings: PseudonymMapping[] = [
        {
          originalValue: "admin@example.com",
          pseudonym: "user001@company.local",
          type: "email",
          category: "user",
          createdAt: new Date().toISOString(),
        },
        {
          originalValue: "192.168.1.100",
          pseudonym: "10.0.0.1",
          type: "ip_address",
          category: "network",
          createdAt: new Date().toISOString(),
        },
      ];

      manager.importMappings(mappings);

      expect(manager.getAllMappings()).toHaveLength(2);
      expect(manager.getPseudonym("admin@example.com", "email", "user")).toBe(
        "user001@company.local",
      );
      expect(
        manager.getPseudonym("192.168.1.100", "ip_address", "network"),
      ).toBe("10.0.0.1");
    });

    test("should handle duplicate imports gracefully", () => {
      const mappings: PseudonymMapping[] = [
        {
          originalValue: "admin@example.com",
          pseudonym: "user001@company.local",
          type: "email",
          category: "user",
          createdAt: new Date().toISOString(),
        },
      ];

      manager.importMappings(mappings);
      manager.importMappings(mappings); // Import again

      expect(manager.getAllMappings()).toHaveLength(1); // Should not duplicate
    });
  });

  describe("Error Handling", () => {
    test("should handle empty or invalid input gracefully", () => {
      expect(() => manager.getPseudonym("", "email", "test")).toThrow();
      expect(() =>
        manager.getPseudonym("invalid-email", "email", "test"),
      ).not.toThrow();
    });

    test("should handle invalid type gracefully", () => {
      const pseudonym = manager.getPseudonym(
        "test-value",
        "invalid_type" as any,
        "test",
      );
      expect(pseudonym).toBeDefined();
      expect(pseudonym).not.toBe("test-value");
    });
  });
});
