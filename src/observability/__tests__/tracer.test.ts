/**
 * Tracer Component TDD Test Suite
 * Comprehensive tests for operation tracing with parent-child relationships
 */

import { Tracer } from '../tracer';
import { TraceSpan } from '../types';
import { Logger } from '../logger';

// Create stable mock logger instance
const mockLoggerInstance = {
  setTraceContext: jest.fn(),
  clearTraceContext: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock Logger to avoid interference
jest.mock('../logger', () => ({
  Logger: {
    getInstance: () => mockLoggerInstance
  }
}));

describe('Tracer', () => {
  let tracer: Tracer;

  beforeEach(() => {
    // Clear all mock calls
    jest.clearAllMocks();
    
    // Reset singleton instance
    (Tracer as any).instance = undefined;
    tracer = Tracer.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const tracer1 = Tracer.getInstance();
      const tracer2 = Tracer.getInstance();
      
      expect(tracer1).toBe(tracer2);
    });
  });

  describe('Trace Management', () => {
    it('should start a new trace with unique ID', () => {
      const spanId = tracer.startTrace('test-operation', { tag1: 'value1' });
      
      expect(spanId).toBeDefined();
      expect(typeof spanId).toBe('string');
      expect(spanId.length).toBeGreaterThan(0);
    });

    it('should create spans with proper structure', () => {
      const spanId = tracer.startTrace('test-operation', { 
        environment: 'test',
        custom: 'tag'
      });

      const span = tracer.getSpan(spanId);
      
      expect(span).toBeDefined();
      expect(span!.operation).toBe('test-operation');
      expect(span!.status).toBe('pending');
      expect(span!.traceId).toBeDefined();
      expect(span!.spanId).toBe(spanId);
      expect(span!.parentSpanId).toBeUndefined();
      expect(span!.startTime).toBeGreaterThan(0);
      expect(span!.endTime).toBeUndefined();
      expect(span!.tags.environment).toBe('test');
      expect(span!.tags.custom).toBe('tag');
      expect(span!.tags.operation).toBe('test-operation');
      expect(span!.logs).toEqual([]);
    });

    it('should generate unique trace IDs for different traces', () => {
      const spanId1 = tracer.startTrace('operation1');
      const spanId2 = tracer.startTrace('operation2');

      const span1 = tracer.getSpan(spanId1);
      const span2 = tracer.getSpan(spanId2);

      expect(span1!.traceId).not.toBe(span2!.traceId);
    });
  });

  describe('Child Span Management', () => {
    it('should create child spans with parent relationship', () => {
      const parentSpanId = tracer.startTrace('parent-operation');
      const childSpanId = tracer.startSpan('child-operation', parentSpanId, {
        child: 'true'
      });

      const parentSpan = tracer.getSpan(parentSpanId);
      const childSpan = tracer.getSpan(childSpanId);

      expect(childSpan).toBeDefined();
      expect(childSpan!.parentSpanId).toBe(parentSpanId);
      expect(childSpan!.traceId).toBe(parentSpan!.traceId);
      expect(childSpan!.operation).toBe('child-operation');
      expect(childSpan!.tags.child).toBe('true');
      expect(childSpan!.tags.parent).toBe('parent-operation');
    });

    it('should throw error when parent span does not exist', () => {
      expect(() => {
        tracer.startSpan('child-operation', 'non-existent-parent-id');
      }).toThrow('Parent span non-existent-parent-id not found');
    });

    it('should create multiple levels of nested spans', () => {
      const rootSpanId = tracer.startTrace('root');
      const level1SpanId = tracer.startSpan('level1', rootSpanId);
      const level2SpanId = tracer.startSpan('level2', level1SpanId);

      const rootSpan = tracer.getSpan(rootSpanId);
      const level1Span = tracer.getSpan(level1SpanId);
      const level2Span = tracer.getSpan(level2SpanId);

      // All spans should share the same trace ID
      expect(level1Span!.traceId).toBe(rootSpan!.traceId);
      expect(level2Span!.traceId).toBe(rootSpan!.traceId);

      // Parent-child relationships should be correct
      expect(level1Span!.parentSpanId).toBe(rootSpanId);
      expect(level2Span!.parentSpanId).toBe(level1SpanId);
    });
  });

  describe('Span Lifecycle', () => {
    it('should finish span successfully with duration calculation', () => {
      const spanId = tracer.startTrace('test-operation');
      
      // Wait a small amount to ensure duration > 0
      setTimeout(() => {
        tracer.finishSpan(spanId, { result: 'success' });
        
        const span = tracer.getSpan(spanId);
        expect(span).toBeUndefined(); // Should be moved to completed
        
        const completedSpans = tracer.getCompletedSpans();
        expect(completedSpans).toHaveLength(1);
        
        const completedSpan = completedSpans[0];
        expect(completedSpan.status).toBe('success');
        expect(completedSpan.duration).toBeGreaterThan(0);
        expect(completedSpan.endTime).toBeDefined();
        expect(completedSpan.tags.result).toBe('success');
      }, 10);
    });

    it('should finish span with error and capture error details', () => {
      const spanId = tracer.startTrace('failing-operation');
      const error = new Error('Test error');

      tracer.finishSpanWithError(spanId, error, { context: 'test' });

      const completedSpans = tracer.getCompletedSpans();
      expect(completedSpans).toHaveLength(1);

      const span = completedSpans[0];
      expect(span.status).toBe('error');
      expect(span.tags.error).toBe('Test error');
      expect(span.tags.errorType).toBe('Error');
      expect(span.tags.context).toBe('test');
    });

    it('should handle finishing non-existent spans gracefully', () => {
      // Should not throw error
      tracer.finishSpan('non-existent-span-id');
      tracer.finishSpanWithError('non-existent-span-id', new Error('test'));
      
      expect(tracer.getCompletedSpans()).toHaveLength(0);
    });

    it('should abort active spans', () => {
      const spanId = tracer.startTrace('abortable-operation');
      
      expect(tracer.isSpanActive(spanId)).toBe(true);
      
      tracer.abortSpan(spanId);
      
      expect(tracer.isSpanActive(spanId)).toBe(false);
      
      const completedSpans = tracer.getCompletedSpans();
      expect(completedSpans).toHaveLength(1);
      
      const abortedSpan = completedSpans[0];
      expect(abortedSpan.status).toBe('error');
      expect(abortedSpan.tags.aborted).toBe('true');
    });

    it('should abort all active spans', () => {
      const spanId1 = tracer.startTrace('operation1');
      const spanId2 = tracer.startTrace('operation2');
      const spanId3 = tracer.startTrace('operation3');

      expect(tracer.getActiveSpans()).toHaveLength(3);

      tracer.abortAllSpans();

      expect(tracer.getActiveSpans()).toHaveLength(0);
      expect(tracer.getCompletedSpans()).toHaveLength(3);

      const completedSpans = tracer.getCompletedSpans();
      completedSpans.forEach(span => {
        expect(span.status).toBe('error');
        expect(span.tags.aborted).toBe('true');
      });
    });
  });

  describe('Span Querying', () => {
    it('should return active spans', () => {
      const spanId1 = tracer.startTrace('active1');
      const spanId2 = tracer.startTrace('active2');

      const activeSpans = tracer.getActiveSpans();
      expect(activeSpans).toHaveLength(2);
      
      const operations = activeSpans.map(span => span.operation);
      expect(operations).toContain('active1');
      expect(operations).toContain('active2');
    });

    it('should return completed spans in reverse chronological order', () => {
      const spanId1 = tracer.startTrace('first');
      const spanId2 = tracer.startTrace('second');
      const spanId3 = tracer.startTrace('third');

      // Finish spans in order
      tracer.finishSpan(spanId1);
      tracer.finishSpan(spanId2);
      tracer.finishSpan(spanId3);

      const completedSpans = tracer.getCompletedSpans();
      expect(completedSpans).toHaveLength(3);
      
      // Most recent first
      expect(completedSpans[0].operation).toBe('third');
      expect(completedSpans[1].operation).toBe('second');
      expect(completedSpans[2].operation).toBe('first');
    });

    it('should limit completed spans when requested', () => {
      // Create and finish multiple spans
      for (let i = 0; i < 10; i++) {
        const spanId = tracer.startTrace(`operation-${i}`);
        tracer.finishSpan(spanId);
      }

      const limitedSpans = tracer.getCompletedSpans(3);
      expect(limitedSpans).toHaveLength(3);
      
      // Should be the most recent 3
      expect(limitedSpans[0].operation).toBe('operation-9');
      expect(limitedSpans[1].operation).toBe('operation-8');
      expect(limitedSpans[2].operation).toBe('operation-7');
    });

    it('should return spans by trace ID', () => {
      const rootSpanId = tracer.startTrace('root');
      const childSpanId = tracer.startSpan('child', rootSpanId);
      const grandchildSpanId = tracer.startSpan('grandchild', childSpanId);

      const rootSpan = tracer.getSpan(rootSpanId);
      const traceId = rootSpan!.traceId;

      const traceSpans = tracer.getTrace(traceId);
      expect(traceSpans).toHaveLength(3);
      
      // Should be sorted by start time
      expect(traceSpans[0].operation).toBe('root');
      expect(traceSpans[1].operation).toBe('child');
      expect(traceSpans[2].operation).toBe('grandchild');
    });

    it('should check if span is active', () => {
      const spanId = tracer.startTrace('active-check');
      
      expect(tracer.isSpanActive(spanId)).toBe(true);
      
      tracer.finishSpan(spanId);
      
      expect(tracer.isSpanActive(spanId)).toBe(false);
    });
  });

  describe('Span Modification', () => {
    it('should add tags to spans', () => {
      const spanId = tracer.startTrace('taggable', { initial: 'tag' });
      
      tracer.addTags(spanId, { 
        additional: 'value',
        number: '42'
      });

      const span = tracer.getSpan(spanId);
      expect(span!.tags.initial).toBe('tag');
      expect(span!.tags.additional).toBe('value');
      expect(span!.tags.number).toBe('42');
    });

    it('should handle adding tags to non-existent spans gracefully', () => {
      // Should not throw error
      tracer.addTags('non-existent', { tag: 'value' });
    });

    it('should add logs to spans', () => {
      const spanId = tracer.startTrace('loggable');
      const mockLog = {
        timestamp: new Date().toISOString(),
        correlationId: 'test-id',
        operation: 'test',
        phase: 'test',
        level: 'info' as const,
        message: 'test log',
        context: {
          resourcesAffected: []
        }
      };

      tracer.addLog(spanId, mockLog);

      const span = tracer.getSpan(spanId);
      expect(span!.logs).toHaveLength(1);
      expect(span!.logs[0]).toEqual(mockLog);
    });

    it('should handle adding logs to non-existent spans gracefully', () => {
      const mockLog = {
        timestamp: new Date().toISOString(),
        correlationId: 'test-id',
        operation: 'test',
        phase: 'test',
        level: 'info' as const,
        message: 'test log',
        context: {
          resourcesAffected: []
        }
      };

      // Should not throw error
      tracer.addLog('non-existent', mockLog);
    });
  });

  describe('Memory Management', () => {
    it('should trim completed spans to prevent memory issues', () => {
      // Create more spans than the limit (500)
      for (let i = 0; i < 600; i++) {
        const spanId = tracer.startTrace(`span-${i}`);
        tracer.finishSpan(spanId);
      }

      const completedSpans = tracer.getCompletedSpans(1000);
      expect(completedSpans.length).toBeLessThanOrEqual(500);

      // Should keep the most recent spans
      expect(completedSpans[0].operation).toBe('span-599');
    });

    it('should clear completed spans when requested', () => {
      const spanId1 = tracer.startTrace('span1');
      const spanId2 = tracer.startTrace('span2');
      
      tracer.finishSpan(spanId1);
      tracer.finishSpan(spanId2);

      expect(tracer.getCompletedSpans()).toHaveLength(2);

      tracer.clearCompletedSpans();

      expect(tracer.getCompletedSpans()).toHaveLength(0);
    });
  });

  describe('Trace Summary', () => {
    it('should generate trace summary for completed trace', () => {
      const rootSpanId = tracer.startTrace('root-operation');
      
      // Add a small delay to ensure duration > 0
      const originalHrtime = process.hrtime.bigint;
      let callCount = 0;
      process.hrtime.bigint = jest.fn(() => {
        callCount++;
        // Return incrementing values to simulate time passing
        return BigInt(callCount * 1000000); // 1ms per call
      });
      
      const child1SpanId = tracer.startSpan('child1', rootSpanId);
      const child2SpanId = tracer.startSpan('child2', rootSpanId);

      tracer.finishSpan(child1SpanId);
      tracer.finishSpanWithError(child2SpanId, new Error('test error'));
      tracer.finishSpan(rootSpanId);

      const rootSpan = tracer.getCompletedSpans().find(s => s.operation === 'root-operation');
      const summary = tracer.getTraceSummary(rootSpan!.traceId);

      expect(summary).toBeDefined();
      expect(summary!.operation).toBe('root-operation');
      expect(summary!.spanCount).toBe(3);
      expect(summary!.successCount).toBe(2);
      expect(summary!.errorCount).toBe(1);
      expect(summary!.status).toBe('error'); // Has errors
      expect(summary!.totalDuration).toBeGreaterThanOrEqual(0);
      
      // Restore original hrtime
      process.hrtime.bigint = originalHrtime;
    });

    it('should return undefined for non-existent trace', () => {
      const summary = tracer.getTraceSummary('non-existent-trace-id');
      expect(summary).toBeUndefined();
    });

    it('should show pending status for traces with active spans', () => {
      const spanId = tracer.startTrace('pending-operation');
      const span = tracer.getSpan(spanId);
      
      const summary = tracer.getTraceSummary(span!.traceId);
      
      expect(summary!.status).toBe('pending');
      expect(summary!.spanCount).toBe(1);
      expect(summary!.successCount).toBe(0);
      expect(summary!.errorCount).toBe(0);
    });
  });

  describe('Logger Integration', () => {
    it('should set trace context on Logger when trace starts', () => {
      const spanId = tracer.startTrace('logged-operation');
      const span = tracer.getSpan(spanId);
      
      expect(mockLoggerInstance.setTraceContext).toHaveBeenCalledWith(
        span!.traceId,
        spanId
      );
    });

    it('should clear trace context on Logger when root span finishes', () => {
      const spanId = tracer.startTrace('root-operation');
      tracer.finishSpan(spanId);
      
      expect(mockLoggerInstance.clearTraceContext).toHaveBeenCalled();
    });

    it('should not clear trace context when child span finishes', () => {
      const rootSpanId = tracer.startTrace('root');
      const childSpanId = tracer.startSpan('child', rootSpanId);
      
      // Clear mock calls from span creation
      mockLoggerInstance.clearTraceContext.mockClear();
      
      tracer.finishSpan(childSpanId);
      
      expect(mockLoggerInstance.clearTraceContext).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent access gracefully', () => {
      const spanId = tracer.startTrace('concurrent-test');
      
      // Simulate concurrent operations
      Promise.all([
        tracer.addTags(spanId, { tag1: 'value1' }),
        tracer.addTags(spanId, { tag2: 'value2' }),
        tracer.finishSpan(spanId, { final: 'tag' })
      ]);

      // Should not throw errors and final state should be consistent
      expect(tracer.getCompletedSpans()).toHaveLength(1);
    });

    it('should handle invalid operations gracefully', () => {
      // All these should not throw errors
      expect(() => tracer.getSpan('invalid-id')).not.toThrow();
      expect(() => tracer.finishSpan('invalid-id')).not.toThrow();
      expect(() => tracer.abortSpan('invalid-id')).not.toThrow();
      expect(() => tracer.addTags('invalid-id', {})).not.toThrow();
    });
  });
});