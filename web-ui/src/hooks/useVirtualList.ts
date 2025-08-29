/**
 * Virtual List Hook for Performance Optimization
 * 
 * Provides virtual scrolling for large datasets to improve rendering performance.
 */

import { useMemo, useState, useCallback } from 'react';

interface VirtualListOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  scrollElement?: HTMLElement | null;
}

interface VirtualListItem {
  index: number;
  start: number;
  end: number;
}

export function useVirtualList<T>(
  items: T[],
  options: VirtualListOptions
) {
  const { itemHeight, containerHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    // Add overscan items for smoother scrolling
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(items.length - 1, visibleEnd + overscan);

    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  // Get visible items
  const visibleItems = useMemo((): VirtualListItem[] => {
    const result: VirtualListItem[] = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        start: i * itemHeight,
        end: (i + 1) * itemHeight
      });
    }
    return result;
  }, [visibleRange, itemHeight]);

  // Total height for scrollbar
  const totalHeight = items.length * itemHeight;

  // Scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    offsetY: visibleRange.start * itemHeight
  };
}

// Enhanced version with variable item heights
export function useVariableVirtualList<T>(
  items: T[],
  getItemHeight: (index: number, item: T) => number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  // Pre-calculate item positions for performance
  const itemPositions = useMemo(() => {
    const positions: number[] = [0];
    let totalHeight = 0;

    items.forEach((item, index) => {
      totalHeight += getItemHeight(index, item);
      positions.push(totalHeight);
    });

    return positions;
  }, [items, getItemHeight]);

  // Binary search to find first visible item
  const findStartIndex = useCallback((scrollTop: number) => {
    let low = 0;
    let high = itemPositions.length - 1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (itemPositions[mid] <= scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    return Math.max(0, high);
  }, [itemPositions]);

  // Calculate visible range for variable heights
  const visibleRange = useMemo(() => {
    const startIndex = findStartIndex(scrollTop);
    let endIndex = startIndex;
    
    // Find end index
    while (
      endIndex < items.length - 1 &&
      itemPositions[endIndex + 1] < scrollTop + containerHeight
    ) {
      endIndex++;
    }

    return {
      start: Math.max(0, startIndex - overscan),
      end: Math.min(items.length - 1, endIndex + overscan)
    };
  }, [scrollTop, containerHeight, findStartIndex, itemPositions, items.length, overscan]);

  // Get visible items with positions
  const visibleItems = useMemo(() => {
    const result: (VirtualListItem & { height: number })[] = [];
    
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        start: itemPositions[i],
        end: itemPositions[i + 1],
        height: getItemHeight(i, items[i])
      });
    }
    
    return result;
  }, [visibleRange, itemPositions, getItemHeight, items]);

  const totalHeight = itemPositions[itemPositions.length - 1] || 0;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    offsetY: itemPositions[visibleRange.start] || 0
  };
}