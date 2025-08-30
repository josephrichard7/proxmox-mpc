/**
 * Anonymization System
 * Main entry point for data anonymization functionality
 */

// Core types
export * from "./types/anonymization-types";

// Engine components
export { AnonymizationEngine } from "./engine/AnonymizationEngine";
export { PseudonymManager } from "./engine/PseudonymManager";

// Data processors
export { LogDataProcessor } from "./processors/LogDataProcessor";
export { ConfigDataProcessor } from "./processors/ConfigDataProcessor";
export { DatabaseDataProcessor } from "./processors/DatabaseDataProcessor";
export { ErrorDataProcessor } from "./processors/ErrorDataProcessor";

// Rules
export {
  PROXMOX_RULES,
  getRulesByCategory,
  getRulesByType,
  getHighPriorityRules,
} from "./rules/ProxmoxRules";

// Default configuration

export const DEFAULT_ANONYMIZATION_OPTIONS: AnonymizationOptions = {
  enablePseudonyms: true,
  preserveStructure: true,
  maxProcessingTime: 5000,
  hashSalt: "proxmox-mpc-default-salt",
};

// Import classes for factory functions
import { AnonymizationEngine } from "./engine/AnonymizationEngine";
import { PseudonymManager } from "./engine/PseudonymManager";
import { ConfigDataProcessor } from "./processors/ConfigDataProcessor";
import { DatabaseDataProcessor } from "./processors/DatabaseDataProcessor";
import { ErrorDataProcessor } from "./processors/ErrorDataProcessor";
import { LogDataProcessor } from "./processors/LogDataProcessor";
import { AnonymizationOptions } from "./types/anonymization-types";

// Convenience factory functions
export function createAnonymizationEngine() {
  return AnonymizationEngine.getInstance();
}

export function createPseudonymManager() {
  return new PseudonymManager();
}

// Processor factory function
export function createDataProcessor(
  type: "log" | "config" | "database" | "error",
) {
  switch (type) {
    case "log":
      return new LogDataProcessor();
    case "config":
      return new ConfigDataProcessor();
    case "database":
      return new DatabaseDataProcessor();
    case "error":
      return new ErrorDataProcessor();
    default:
      throw new Error(`Unknown processor type: ${type}`);
  }
}
