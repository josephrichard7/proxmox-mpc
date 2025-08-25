/**
 * Observability Infrastructure
 * Comprehensive logging, tracing, and diagnostics for AI-assisted troubleshooting
 */

// Unified manager - preferred interface
export { ObservabilityManager, observability } from './manager';
export type { ObservabilityConfig } from './manager';

// Individual components - for backwards compatibility and direct access
export { Logger } from './logger';
export { Tracer } from './tracer';
export { MetricsCollector, metrics } from './metrics';
export { DiagnosticsCollector } from './diagnostics';

export type {
  // Logger types
  LogLevel,
  OperationLog,
  ErrorCategory,
  LoggerConfig,
  
  // Tracer types
  TraceSpan,
  
  // Metrics types
  PerformanceMetric,
  
  // Diagnostics types
  HealthStatus,
  DiagnosticSnapshot
} from './types';