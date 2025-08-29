/**
 * Accessibility Hooks and Utilities
 * 
 * Provides WCAG 2.1 AA compliance features and accessibility enhancements.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Focus management hook
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstFocusable) {
            lastFocusable?.focus();
            e.preventDefault();
          }
        } else {
          // Tab
          if (document.activeElement === lastFocusable) {
            firstFocusable?.focus();
            e.preventDefault();
          }
        }
      }

      // Escape to close modal/dialog
      if (e.key === 'Escape') {
        const escapeEvent = new CustomEvent('accessibility:escape');
        container.dispatchEvent(escapeEvent);
      }
    };

    // Focus first element when trap becomes active
    if (firstFocusable) {
      firstFocusable.focus();
    }

    document.addEventListener('keydown', handleTabKey);
    
    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
}

// Keyboard navigation hook
export function useKeyboardNavigation(
  items: string[],
  onSelect?: (index: number) => void,
  isActive = true
) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % items.length);
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + items.length) % items.length);
        break;
      
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      
      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      
      case 'Enter':
      case ' ':
        if (activeIndex >= 0 && onSelect) {
          e.preventDefault();
          onSelect(activeIndex);
        }
        break;
    }
  }, [activeIndex, items.length, onSelect, isActive]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  return {
    activeIndex,
    setActiveIndex,
    containerRef
  };
}

// Screen reader announcements
export function useAnnouncer() {
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create screen reader announcer element
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;
    
    document.body.appendChild(announcer);
    announcerRef.current = announcer;

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority);
      announcerRef.current.textContent = message;
      
      // Clear after announcement to allow repeat announcements
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return announce;
}

// High contrast mode detection
export function useHighContrast() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    // Check for Windows high contrast mode
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isHighContrast;
}

// Reduced motion detection
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

// Skip links hook
export function useSkipLinks() {
  const skipLinksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
      <a href="#search" class="skip-link">Skip to search</a>
    `;
    
    // Style skip links
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -100px;
        left: 0;
        z-index: 1000;
      }
      
      .skip-link {
        position: absolute;
        top: 0;
        left: 0;
        background: #000;
        color: #fff;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 0 0 4px 0;
        font-weight: bold;
        transform: translateY(-100%);
        transition: transform 0.2s ease-in-out;
      }
      
      .skip-link:focus {
        transform: translateY(0);
      }
      
      .skip-link:hover {
        background: #333;
      }
    `;
    
    document.head.appendChild(style);
    document.body.insertBefore(skipLinks, document.body.firstChild);
    skipLinksRef.current = skipLinks;

    return () => {
      if (skipLinksRef.current) {
        document.body.removeChild(skipLinksRef.current);
      }
      document.head.removeChild(style);
    };
  }, []);

  return skipLinksRef;
}

// Color contrast utilities
export const colorContrast = {
  // Calculate relative luminance
  getLuminance(rgb: [number, number, number]): number {
    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  },

  // Calculate contrast ratio between two colors
  getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    const bright = Math.max(lum1, lum2);
    const dark = Math.min(lum1, lum2);
    
    return (bright + 0.05) / (dark + 0.05);
  },

  // Check if contrast ratio meets WCAG guidelines
  meetsWCAG(ratio: number, level: 'AA' | 'AAA' = 'AA'): boolean {
    const thresholds = {
      AA: { normal: 4.5, large: 3 },
      AAA: { normal: 7, large: 4.5 }
    };
    
    return ratio >= thresholds[level].normal;
  },

  // Parse hex color to RGB
  hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ]
      : null;
  }
};

// Form validation announcements
export function useFormAnnouncements() {
  const announce = useAnnouncer();

  const announceError = useCallback((fieldName: string, error: string) => {
    announce(`Error in ${fieldName}: ${error}`, 'assertive');
  }, [announce]);

  const announceSuccess = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  const announceFieldChange = useCallback((fieldName: string, value: string) => {
    announce(`${fieldName} changed to ${value}`, 'polite');
  }, [announce]);

  return {
    announceError,
    announceSuccess,
    announceFieldChange
  };
}