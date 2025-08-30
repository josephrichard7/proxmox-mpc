/**
 * ErrorDataProcessor
 * Specialized processor for error data and diagnostic snapshots
 */

import { DiagnosticSnapshot } from "../../observability/types";
import { AnonymizationEngine } from "../engine/AnonymizationEngine";
import {
  DataProcessor,
  AnonymizationOptions,
  AnonymizedData,
} from "../types/anonymization-types";

export class ErrorDataProcessor implements DataProcessor {
  private engine: AnonymizationEngine;

  constructor() {
    this.engine = AnonymizationEngine.getInstance();
  }

  canProcess(data: any): boolean {
    return this.isError(data) || this.isDiagnosticSnapshot(data);
  }

  async process(
    data: any,
    options: AnonymizationOptions,
  ): Promise<AnonymizedData> {
    const startTime = Date.now();
    const rulesApplied: string[] = [];
    const totalPseudonyms = 0;

    let anonymizedData: any;

    if (this.isDiagnosticSnapshot(data)) {
      anonymizedData = await this.processDiagnosticSnapshot(
        data,
        options,
        rulesApplied,
      );
    } else if (this.isError(data)) {
      anonymizedData = await this.processError(data, options, rulesApplied);
    } else {
      // Fallback to general anonymization
      const result = await this.engine.anonymize(data, options);
      anonymizedData = result.data;
      rulesApplied.push(...result.metadata.rulesApplied);
    }

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
    return "ErrorDataProcessor";
  }

  private async processDiagnosticSnapshot(
    snapshot: DiagnosticSnapshot,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<DiagnosticSnapshot> {
    const anonymizedSnapshot: DiagnosticSnapshot = {
      ...snapshot,
      workspace: snapshot.workspace
        ? await this.anonymizeField(snapshot.workspace, options, rulesApplied)
        : undefined,
      error: snapshot.error
        ? await this.processErrorObject(snapshot.error, options, rulesApplied)
        : undefined,
      logs: await Promise.all(
        snapshot.logs.map((log) =>
          this.processLogEntry(log, options, rulesApplied),
        ),
      ),
      workspaceInfo: snapshot.workspaceInfo
        ? await this.processWorkspaceInfo(
            snapshot.workspaceInfo,
            options,
            rulesApplied,
          )
        : undefined,
    };

    return anonymizedSnapshot;
  }

  private async processError(
    error: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: await this.anonymizeField(
          error.message,
          options,
          rulesApplied,
        ),
        stack: error.stack
          ? await this.anonymizeField(error.stack, options, rulesApplied)
          : undefined,
      };
    } else if (typeof error === "object" && error !== null) {
      return this.processErrorObject(error, options, rulesApplied);
    }

    return error;
  }

  private async processErrorObject(
    error: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    const result: any = {};

    for (const [key, value] of Object.entries(error)) {
      if (typeof value === "string") {
        result[key] = await this.anonymizeField(value, options, rulesApplied);
      } else if (typeof value === "object" && value !== null) {
        result[key] = await this.processErrorObject(
          value,
          options,
          rulesApplied,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private async processLogEntry(
    log: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    if (!log || typeof log !== "object") {
      return log;
    }

    const anonymizedLog: any = { ...log };

    // Anonymize specific fields that might contain PII
    if (typeof log.message === "string") {
      anonymizedLog.message = await this.anonymizeField(
        log.message,
        options,
        rulesApplied,
      );
    }

    if (log.context && typeof log.context === "object") {
      anonymizedLog.context = await this.processContext(
        log.context,
        options,
        rulesApplied,
      );
    }

    if (log.error && typeof log.error === "object") {
      anonymizedLog.error = await this.processErrorObject(
        log.error,
        options,
        rulesApplied,
      );
    }

    if (log.metadata && typeof log.metadata === "object") {
      anonymizedLog.metadata = await this.anonymizeGenericObject(
        log.metadata,
        options,
        rulesApplied,
      );
    }

    return anonymizedLog;
  }

  private async processContext(
    context: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    const anonymizedContext: any = { ...context };

    // Anonymize known PII fields in context
    const piiFields = ["workspace", "proxmoxServer", "userId", "sessionId"];

    for (const field of piiFields) {
      if (typeof context[field] === "string") {
        anonymizedContext[field] = await this.anonymizeField(
          context[field],
          options,
          rulesApplied,
        );
      }
    }

    // Process any additional fields
    for (const [key, value] of Object.entries(context)) {
      if (!piiFields.includes(key) && typeof value === "string") {
        anonymizedContext[key] = await this.anonymizeField(
          value,
          options,
          rulesApplied,
        );
      }
    }

    return anonymizedContext;
  }

  private async processWorkspaceInfo(
    workspaceInfo: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    const anonymizedInfo: any = { ...workspaceInfo };

    if (typeof workspaceInfo.path === "string") {
      anonymizedInfo.path = await this.anonymizeField(
        workspaceInfo.path,
        options,
        rulesApplied,
      );
    }

    if (workspaceInfo.config && typeof workspaceInfo.config === "object") {
      anonymizedInfo.config = await this.anonymizeGenericObject(
        workspaceInfo.config,
        options,
        rulesApplied,
      );
    }

    return anonymizedInfo;
  }

  private async anonymizeGenericObject(
    obj: any,
    options: AnonymizationOptions,
    rulesApplied: string[],
  ): Promise<any> {
    const result = await this.engine.anonymize(obj, options);

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

  private isError(data: any): boolean {
    return (
      data instanceof Error ||
      (data &&
        typeof data === "object" &&
        (typeof data.message === "string" ||
          typeof data.stack === "string" ||
          typeof data.name === "string"))
    );
  }

  private isDiagnosticSnapshot(data: any): boolean {
    return (
      data &&
      typeof data === "object" &&
      typeof data.id === "string" &&
      typeof data.timestamp === "string" &&
      Array.isArray(data.logs) &&
      Array.isArray(data.metrics) &&
      Array.isArray(data.healthStatus) &&
      data.systemInfo &&
      typeof data.systemInfo === "object"
    );
  }
}
