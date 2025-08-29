/**
 * Debounce Hook for Performance Optimization
 * 
 * Delays execution of expensive operations like API calls and search filters.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
  deps: React.DependencyList = []
) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay, ...deps]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// Advanced debounce with immediate execution option
export function useAdvancedDebounce<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
  options: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
  } = {}
) {
  const { leading = false, trailing = true, maxWait } = options;
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCallTimeRef = useRef<number>(0);
  const lastInvokeTimeRef = useRef<number>(0);

  const debouncedCallback = useCallback(
    (...args: Args) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTimeRef.current;
      const timeSinceLastInvoke = now - lastInvokeTimeRef.current;

      lastCallTimeRef.current = now;

      const shouldInvokeLeading = leading && timeSinceLastCall >= delay;
      const shouldInvokeMaxWait = maxWait && timeSinceLastInvoke >= maxWait;

      // Clear existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }

      // Invoke immediately if conditions are met
      if (shouldInvokeLeading || shouldInvokeMaxWait) {
        lastInvokeTimeRef.current = now;
        callback(...args);
        return;
      }

      // Set up trailing invocation
      if (trailing) {
        timeoutRef.current = setTimeout(() => {
          lastInvokeTimeRef.current = Date.now();
          callback(...args);
        }, delay);
      }

      // Set up max wait timeout
      if (maxWait && timeSinceLastInvoke < maxWait) {
        maxTimeoutRef.current = setTimeout(() => {
          lastInvokeTimeRef.current = Date.now();
          callback(...args);
        }, maxWait - timeSinceLastInvoke);
      }
    },
    [callback, delay, leading, trailing, maxWait]
  );

  // Cleanup function
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = undefined;
    }
    lastCallTimeRef.current = 0;
    lastInvokeTimeRef.current = 0;
  }, []);

  // Flush function - invoke immediately
  const flush = useCallback(
    (...args: Args) => {
      cancel();
      lastInvokeTimeRef.current = Date.now();
      callback(...args);
    },
    [callback, cancel]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { debouncedCallback, cancel, flush };
}