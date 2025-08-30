/**
 * Anonymization Types
 * Core types for data anonymization system
 */

export type AnonymizationRuleType =
  | "ip_address"
  | "hostname"
  | "username"
  | "password"
  | "token"
  | "email"
  | "path"
  | "uuid"
  | "custom_pattern";

export type ReplacementStrategy = "pseudonym" | "redact" | "hash" | "generic";

export interface AnonymizationRule {
  type: AnonymizationRuleType;
  pattern: RegExp;
  replacement: ReplacementStrategy;
  category: string;
  preserveFormat?: boolean;
  priority: number;
}

export interface AnonymizationOptions {
  enablePseudonyms: boolean;
  preserveStructure: boolean;
  hashSalt?: string;
  maxProcessingTime?: number;
  enabledRules?: AnonymizationRuleType[];
  customRules?: AnonymizationRule[];
}

export interface PseudonymMapping {
  originalValue: string;
  pseudonym: string;
  type: AnonymizationRuleType;
  category: string;
  createdAt: string;
}

export interface AnonymizedData<T = any> {
  data: T;
  metadata: {
    rulesApplied: string[];
    pseudonymsUsed: number;
    processingTimeMs: number;
    isAnonymized: boolean;
    preservedStructure: boolean;
  };
  pseudonymMappings?: PseudonymMapping[];
}

export interface DataProcessor<T = any> {
  canProcess(data: any): boolean;
  process(data: T, options: AnonymizationOptions): Promise<AnonymizedData<T>>;
  getProcessorType(): string;
}

export interface AnonymizationReport {
  id: string;
  timestamp: string;
  dataType: string;
  rulesApplied: string[];
  pseudonymsCreated: number;
  processingTimeMs: number;
  originalSize: number;
  anonymizedSize: number;
  compressionRatio: number;
}

export interface PIIDetectionResult {
  hasPII: boolean;
  detectedTypes: AnonymizationRuleType[];
  confidence: number;
  locations: Array<{
    type: AnonymizationRuleType;
    path: string;
    value: string;
    startIndex: number;
    endIndex: number;
  }>;
}

export interface AnonymizationEngineStats {
  totalProcessed: number;
  totalPseudonyms: number;
  averageProcessingTime: number;
  rulesUsage: Record<string, number>;
  errorRate: number;
}
