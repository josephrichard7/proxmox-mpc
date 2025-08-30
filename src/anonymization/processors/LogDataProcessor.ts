/**
 * LogDataProcessor
 * Specialized processor for operation log data
 */

import { OperationLog } from "../../observability/types";
import { AnonymizationEngine } from "../engine/AnonymizationEngine";
import {
  DataProcessor,
  AnonymizationOptions,
  AnonymizedData,
} from "../types/anonymization-types";

export class LogDataProcessor implements DataProcessor<OperationLog[]> {
  private engine: AnonymizationEngine;

  constructor() {
    this.engine = AnonymizationEngine.getInstance();
  }

  canProcess(data: any): boolean {
    return (
      Array.isArray(data) &&
      data.length > 0 &&
      data.every((item) => this.isOperationLog(item))
    );
  }

  async process(
    data: OperationLog[],
    options: AnonymizationOptions,
  ): Promise<AnonymizedData<OperationLog[]>> {
    const startTime = Date.now();
    const rulesApplied: string[] = [];
    const totalPseudonyms = 0;

    const anonymizedLogs = await Promise.all(
      data.map(
        async (log) => await this.processLog(log, options, rulesApplied),
      ),
    );

    const processingTime = Date.now() - startTime;

    return {
      data: anonymizedLogs,
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
    return "LogDataProcessor";
  }

  private async processLog(
    log: OperationLog,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<OperationLog> {
    const anonymizedLog: OperationLog = {
      ...log,
      message: await this.anonymizeField(log.message, options, rulesApplied),
      context: await this.processContext(log.context, options, rulesApplied),
      error: log.error
        ? await this.processError(log.error, options, rulesApplied)
        : undefined,
      metadata: log.metadata
        ? await this.processMetadata(log.metadata, options, rulesApplied)
        : undefined,
    };

    return anonymizedLog;
  }

  private async processContext(
    context: OperationLog["context"],
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<OperationLog["context"]> {
    const anonymizedContext = { ...context };

    // Anonymize specific context fields
    if (context.workspace) {
      anonymizedContext.workspace = await this.anonymizeField(
        context.workspace,
        options,
        rulesApplied,
      );
    }

    if (context.proxmoxServer) {
      anonymizedContext.proxmoxServer = await this.anonymizeField(
        context.proxmoxServer,
        options,
        rulesApplied,
      );
    }

    if (context.userId) {
      anonymizedContext.userId = await this.anonymizeField(
        context.userId,
        options,
        rulesApplied,
      );
    }

    if (context.sessionId) {
      anonymizedContext.sessionId = await this.anonymizeField(
        context.sessionId,
        options,
        rulesApplied,
      );
    }

    // Process any additional dynamic properties
    for (const [key, value] of Object.entries(context)) {
      if (
        typeof value === "string" &&
        !["resourcesAffected", "duration"].includes(key)
      ) {
        anonymizedContext[key] = await this.anonymizeField(
          value,
          options,
          rulesApplied,
        );
      }
    }

    return anonymizedContext;
  }

  private async processError(
    error: NonNullable<OperationLog["error"]>,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<NonNullable<OperationLog["error"]>> {
    return {
      ...error,
      message: await this.anonymizeField(error.message, options, rulesApplied),
      stack: await this.anonymizeField(error.stack, options, rulesApplied),
    };
  }

  private async processMetadata(
    metadata: Record<string, any>,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<Record<string, any>> {
    const result = await this.engine.anonymize(metadata, options);

    // Merge rules applied
    result.metadata.rulesApplied.forEach((rule) => {
      if (!rulesApplied.includes(rule)) {
        rulesApplied.push(rule);
      }
    });

    return result.data;
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

  private isOperationLog(obj: any): obj is OperationLog {
    return (
      obj &&
      typeof obj === "object" &&
      typeof obj.timestamp === "string" &&
      typeof obj.correlationId === "string" &&
      typeof obj.operation === "string" &&
      typeof obj.phase === "string" &&
      typeof obj.level === "string" &&
      typeof obj.message === "string" &&
      obj.context &&
      typeof obj.context === "object" &&
      Array.isArray(obj.context.resourcesAffected)
    );
  }
}
