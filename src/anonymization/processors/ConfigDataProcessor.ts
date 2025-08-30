/**
 * ConfigDataProcessor
 * Specialized processor for configuration data
 */

import { AnonymizationEngine } from "../engine/AnonymizationEngine";
import {
  DataProcessor,
  AnonymizationOptions,
  AnonymizedData,
} from "../types/anonymization-types";

export class ConfigDataProcessor implements DataProcessor {
  private engine: AnonymizationEngine;
  private sensitiveKeys = [
    "password",
    "pwd",
    "pass",
    "secret",
    "token",
    "key",
    "apikey",
    "api_key",
    "tokenSecret",
    "tokenId",
    "privateKey",
    "publicKey",
    "cert",
    "certificate",
  ];

  constructor() {
    this.engine = AnonymizationEngine.getInstance();
  }

  canProcess(data: any): boolean {
    return (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      this.hasConfigStructure(data)
    );
  }

  async process(
    data: any,
    options: AnonymizationOptions,
  ): Promise<AnonymizedData> {
    const startTime = Date.now();
    const rulesApplied: string[] = [];
    const totalPseudonyms = 0;

    const anonymizedConfig = await this.processObject(
      data,
      options,
      rulesApplied,
    );
    const processingTime = Date.now() - startTime;

    return {
      data: anonymizedConfig,
      metadata: {
        rulesApplied: Array.from(new Set(rulesApplied)),
        pseudonymsUsed: totalPseudonyms,
        processingTimeMs: processingTime,
        isAnonymized: rulesApplied.length > 0,
        preservedStructure: options.preserveStructure,
      },
    };
  }

  getProcessorType(): string {
    return "ConfigDataProcessor";
  }

  private async processObject(
    obj: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return Promise.all(
        obj.map((item) => this.processObject(item, options, rulesApplied)),
      );
    }

    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        if (this.isSensitiveKey(key)) {
          // Always redact sensitive keys like passwords/tokens
          result[key] = "[REDACTED]";
          if (!rulesApplied.includes("password")) {
            rulesApplied.push("password");
          }
          if (!rulesApplied.includes("token")) {
            rulesApplied.push("token");
          }
        } else {
          // Anonymize other string values that might contain PII
          const anonymized = await this.anonymizeField(
            value,
            options,
            rulesApplied,
          );
          result[key] = anonymized;
        }
      } else if (typeof value === "object") {
        result[key] = await this.processObject(value, options, rulesApplied);
      } else {
        // Preserve non-string, non-object values (numbers, booleans, etc.)
        result[key] = value;
      }
    }

    return result;
  }

  private async anonymizeField(
    value: string,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<string> {
    const result = await this.engine.anonymize(value, options);

    // Merge rules applied
    result.metadata.rulesApplied.forEach((rule) => {
      if (!rulesApplied.includes(rule)) {
        rulesApplied.push(rule);
      }
    });

    return result.data;
  }

  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive));
  }

  private hasConfigStructure(data: any): boolean {
    // Check if the object looks like a configuration object
    // This is a heuristic check for common config patterns
    if (!data || typeof data !== "object") {
      return false;
    }

    const keys = Object.keys(data);
    const configKeywords = [
      "server",
      "database",
      "api",
      "auth",
      "connection",
      "config",
      "settings",
      "options",
      "credentials",
      "endpoint",
      "url",
      "host",
      "port",
      "username",
      "workspace",
      "proxmox",
    ];

    // Check if any top-level keys match configuration patterns
    return keys.some((key) =>
      configKeywords.some((keyword) => key.toLowerCase().includes(keyword)),
    );
  }
}
