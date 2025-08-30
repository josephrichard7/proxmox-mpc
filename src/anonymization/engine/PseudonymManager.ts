/**
 * PseudonymManager
 * Manages consistent pseudonym generation and mapping storage
 */

import * as crypto from "crypto";

import {
  PseudonymMapping,
  AnonymizationRuleType,
} from "../types/anonymization-types";

export class PseudonymManager {
  private mappings: Map<string, PseudonymMapping> = new Map();
  private pseudonymLookup: Map<string, PseudonymMapping> = new Map();

  /**
   * Get or generate pseudonym for a value
   */
  getPseudonym(
    originalValue: string,
    type: AnonymizationRuleType,
    category: string,
  ): string {
    if (!originalValue || originalValue.trim().length === 0) {
      throw new Error("Original value cannot be empty");
    }

    // Check if we already have a pseudonym for this value
    const existing = this.mappings.get(originalValue);
    if (existing) {
      return existing.pseudonym;
    }

    // Generate new pseudonym
    const pseudonym = this.generatePseudonym(originalValue, type);

    // Store mapping
    const mapping: PseudonymMapping = {
      originalValue,
      pseudonym,
      type,
      category,
      createdAt: new Date().toISOString(),
    };

    this.mappings.set(originalValue, mapping);
    this.pseudonymLookup.set(pseudonym, mapping);

    return pseudonym;
  }

  /**
   * Get mapping by original value
   */
  getMapping(originalValue: string): PseudonymMapping | null {
    return this.mappings.get(originalValue) || null;
  }

  /**
   * Get mapping by pseudonym
   */
  getMappingByPseudonym(pseudonym: string): PseudonymMapping | null {
    return this.pseudonymLookup.get(pseudonym) || null;
  }

  /**
   * Get all mappings
   */
  getAllMappings(): PseudonymMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Clear all mappings
   */
  clearMappings(): void {
    this.mappings.clear();
    this.pseudonymLookup.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalMappings: number;
    mappingsByType: Record<string, number>;
    mappingsByCategory: Record<string, number>;
  } {
    const stats = {
      totalMappings: this.mappings.size,
      mappingsByType: {} as Record<string, number>,
      mappingsByCategory: {} as Record<string, number>,
    };

    // Convert iterator to array to avoid downlevelIteration issues
    const mappings = Array.from(this.mappings.values());
    for (const mapping of mappings) {
      stats.mappingsByType[mapping.type] =
        (stats.mappingsByType[mapping.type] || 0) + 1;
      stats.mappingsByCategory[mapping.category] =
        (stats.mappingsByCategory[mapping.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Export mappings
   */
  exportMappings(): PseudonymMapping[] {
    return this.getAllMappings();
  }

  /**
   * Import mappings
   */
  importMappings(mappings: PseudonymMapping[]): void {
    for (const mapping of mappings) {
      if (!this.mappings.has(mapping.originalValue)) {
        this.mappings.set(mapping.originalValue, mapping);
        this.pseudonymLookup.set(mapping.pseudonym, mapping);
      }
    }
  }

  /**
   * Generate pseudonym based on type
   */
  private generatePseudonym(
    originalValue: string,
    type: AnonymizationRuleType,
  ): string {
    const hash = this.generateHash(originalValue);

    switch (type) {
      case "email":
        return this.generateEmailPseudonym(hash);
      case "ip_address":
        return this.generateIPPseudonym(hash);
      case "hostname":
        return this.generateHostnamePseudonym(hash);
      case "uuid":
        return this.generateUUIDPseudonym(hash);
      case "username":
        return this.generateUsernamePseudonym(hash);
      case "path":
        return this.generatePathPseudonym(originalValue, hash);
      default:
        return this.generateGenericPseudonym(hash);
    }
  }

  /**
   * Generate deterministic hash from original value
   */
  private generateHash(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  /**
   * Generate email pseudonym
   */
  private generateEmailPseudonym(hash: string): string {
    const username = "user" + hash.substring(0, 8);
    const domains = [
      "company.local",
      "example.org",
      "test.com",
      "internal.net",
    ];
    const domainIndex = parseInt(hash.substring(8, 10), 16) % domains.length;
    return `${username}@${domains[domainIndex]}`;
  }

  /**
   * Generate IP address pseudonym
   */
  private generateIPPseudonym(hash: string): string {
    // Generate private IP ranges to maintain realistic format
    const ranges = [
      { prefix: "10", range: [0, 255] },
      { prefix: "192.168", range: [1, 254] },
      { prefix: "172.16", range: [0, 255] },
    ];

    const rangeIndex = parseInt(hash.substring(0, 2), 16) % ranges.length;
    const selectedRange = ranges[rangeIndex];

    if (selectedRange.prefix === "192.168") {
      const subnet = (parseInt(hash.substring(2, 4), 16) % 254) + 1;
      const host = (parseInt(hash.substring(4, 6), 16) % 254) + 1;
      return `192.168.${subnet}.${host}`;
    } else if (selectedRange.prefix === "10") {
      const b = parseInt(hash.substring(2, 4), 16) % 256;
      const c = parseInt(hash.substring(4, 6), 16) % 256;
      const d = (parseInt(hash.substring(6, 8), 16) % 254) + 1;
      return `10.${b}.${c}.${d}`;
    } else {
      const c = parseInt(hash.substring(2, 4), 16) % 16;
      const d = (parseInt(hash.substring(4, 6), 16) % 254) + 1;
      return `172.${16 + c}.0.${d}`;
    }
  }

  /**
   * Generate hostname pseudonym
   */
  private generateHostnamePseudonym(hash: string): string {
    const prefixes = ["srv", "host", "node", "server", "vm", "app"];
    const prefixIndex = parseInt(hash.substring(0, 2), 16) % prefixes.length;
    const suffix = hash.substring(2, 8);
    return `${prefixes[prefixIndex]}-${suffix}`;
  }

  /**
   * Generate UUID pseudonym
   */
  private generateUUIDPseudonym(hash: string): string {
    // Create valid UUID v4 format from hash
    const uuid = [
      hash.substring(0, 8),
      hash.substring(8, 12),
      "4" + hash.substring(13, 16), // UUID v4
      ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) +
        hash.substring(17, 20),
      hash.substring(20, 32),
    ].join("-");

    return uuid;
  }

  /**
   * Generate username pseudonym
   */
  private generateUsernamePseudonym(hash: string): string {
    const prefixes = ["user", "admin", "operator", "service"];
    const prefixIndex = parseInt(hash.substring(0, 2), 16) % prefixes.length;
    const suffix = hash.substring(2, 8);
    return `${prefixes[prefixIndex]}${suffix}`;
  }

  /**
   * Generate path pseudonym
   */
  private generatePathPseudonym(originalValue: string, _hash: string): string {
    // Preserve path structure but anonymize components
    const parts = originalValue.split("/");
    const anonymizedParts = parts.map((part, index) => {
      if (part === "" || part === "." || part === "..") {
        return part; // Preserve special path components
      }

      // Create deterministic pseudonym for each path component
      const componentHash = crypto
        .createHash("sha256")
        .update(part + index)
        .digest("hex");
      if (part.includes(".")) {
        // Handle file extensions
        const [_name, ...extensions] = part.split(".");
        const ext = extensions.join(".");
        return `file${componentHash.substring(0, 8)}.${ext}`;
      }
      return `dir${componentHash.substring(0, 8)}`;
    });

    return anonymizedParts.join("/");
  }

  /**
   * Generate generic pseudonym
   */
  private generateGenericPseudonym(hash: string): string {
    return `anon-${hash.substring(0, 12)}`;
  }
}
