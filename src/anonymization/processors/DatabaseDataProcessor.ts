/**
 * DatabaseDataProcessor
 * Specialized processor for database record data
 */

import { AnonymizationEngine } from "../engine/AnonymizationEngine";
import {
  DataProcessor,
  AnonymizationOptions,
  AnonymizedData,
} from "../types/anonymization-types";

export class DatabaseDataProcessor implements DataProcessor {
  private engine: AnonymizationEngine;

  constructor() {
    this.engine = AnonymizationEngine.getInstance();
  }

  canProcess(data: any): boolean {
    return data && typeof data === "object" && this.hasDatabaseStructure(data);
  }

  async process(
    data: any,
    options: AnonymizationOptions,
  ): Promise<AnonymizedData> {
    const startTime = Date.now();
    const rulesApplied: string[] = [];
    const totalPseudonyms = 0;

    const anonymizedData = await this.processDbData(
      data,
      options,
      rulesApplied,
    );
    const processingTime = Date.now() - startTime;

    return {
      data: anonymizedData,
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
    return "DatabaseDataProcessor";
  }

  private async processDbData(
    data: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    if (!data || typeof data !== "object") {
      return data;
    }

    const result: any = {};

    for (const [tableName, records] of Object.entries(data)) {
      if (Array.isArray(records)) {
        result[tableName] = await Promise.all(
          records.map((record) =>
            this.processRecord(record, options, rulesApplied),
          ),
        );
      } else if (typeof records === "object") {
        result[tableName] = await this.processRecord(
          records,
          options,
          rulesApplied,
        );
      } else {
        result[tableName] = records;
      }
    }

    return result;
  }

  private async processRecord(
    record: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    if (!record || typeof record !== "object") {
      return record;
    }

    const anonymizedRecord: any = {};

    for (const [field, value] of Object.entries(record)) {
      if (this.shouldAnonymizeField(field)) {
        if (typeof value === "string") {
          anonymizedRecord[field] = await this.anonymizeField(
            value,
            options,
            rulesApplied,
          );
        } else {
          // For non-string PII fields, still try to anonymize if they can be converted
          if (value !== null && value !== undefined) {
            const stringValue = String(value);
            const anonymized = await this.anonymizeField(
              stringValue,
              options,
              rulesApplied,
            );
            // Try to preserve original type if possible
            if (typeof value === "number" && !isNaN(Number(anonymized))) {
              anonymizedRecord[field] = Number(anonymized);
            } else {
              anonymizedRecord[field] = anonymized;
            }
          } else {
            anonymizedRecord[field] = value;
          }
        }
      } else {
        // Preserve non-PII fields as-is
        anonymizedRecord[field] = value;
      }
    }

    return anonymizedRecord;
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

  private shouldAnonymizeField(fieldName: string): boolean {
    const piiFields = [
      "hostname",
      "name",
      "node",
      "server",
      "host",
      "ip",
      "ip_address",
      "ipv4",
      "ipv6",
      "email",
      "user",
      "username",
      "owner",
      "description",
      "notes",
      "comment",
      "path",
      "location",
      "directory",
      "mac",
      "mac_address",
      "uuid",
      "id", // Be selective with ID fields
    ];

    const lowerField = fieldName.toLowerCase();
    return piiFields.some(
      (piiField) => lowerField.includes(piiField) || lowerField === piiField,
    );
  }

  private hasDatabaseStructure(data: any): boolean {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return false;
    }

    // Check if the object has table-like structure
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return false;
    }

    // Check if values are arrays (like database table results) or objects (single records)
    return keys.some((key) => {
      const value = data[key];
      if (Array.isArray(value)) {
        return value.every(
          (item) => item && typeof item === "object" && !Array.isArray(item),
        );
      }
      return value && typeof value === "object" && !Array.isArray(value);
    });
  }
}
