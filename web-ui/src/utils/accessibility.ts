/**
 * Accessibility Utilities for WCAG 2.1 AA Compliance
 * Provides utilities for keyboard navigation, screen readers, and accessibility features
 */

/**
 * Color contrast utilities
 */
export const colorContrast = {
  // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
  calculateContrast: (color1: string, color2: string): number => {
    const getLuminance = (color: string): number => {
      // Convert hex to RGB
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      // Calculate relative luminance
      const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };
    
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  },
  
  meetsAA: (color1: string, color2: string, large = false): boolean => {
    const contrast = colorContrast.calculateContrast(color1, color2);
    return contrast >= (large ? 3 : 4.5);
  },
  
  meetsAAA: (color1: string, color2: string, large = false): boolean => {
    const contrast = colorContrast.calculateContrast(color1, color2);
    return contrast >= (large ? 4.5 : 7);
  }
};

/**
 * Keyboard navigation utilities
 */
export const keyboardNavigation = {
  // Trap focus within a container (for modals, dropdowns)
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], ' +
      'input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
      
      if (e.key === 'Escape') {
        const closeButton = container.querySelector('[data-autofocus]') as HTMLElement;
        closeButton?.focus();
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();
    
    return () => container.removeEventListener('keydown', handleKeyDown);
  },
  
  // Skip links for keyboard users
  addSkipLink: (targetId: string, label = 'Skip to main content') => {
    const skipLink = document.createElement('a');
    skipLink.href = `#${targetId}`;
    skipLink.className = 'skip-link';
    skipLink.textContent = label;
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: white;
      padding: 8px;
      text-decoration: none;
      z-index: 100;
      border-radius: 4px;
    `;
    
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });
    
    document.body.insertAdjacentElement('afterbegin', skipLink);
  }
};

/**
 * Screen reader utilities
 */
export const screenReader = {
  // Announce messages to screen readers
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    
    document.body.appendChild(announcer);
    announcer.textContent = message;
    
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  },
  
  // Create accessible labels for form elements
  labelElement: (element: HTMLElement, label: string, description?: string) => {
    const labelId = `label-${Math.random().toString(36).substr(2, 9)}`;
    const descId = description ? `desc-${Math.random().toString(36).substr(2, 9)}` : undefined;
    
    element.setAttribute('aria-labelledby', labelId);
    if (descId) {
      element.setAttribute('aria-describedby', descId);
    }
    
    return { labelId, descId };
  }
};

/**
 * ARIA utilities
 */
export const aria = {
  // Set expanded state for collapsible elements
  setExpanded: (trigger: HTMLElement, target: HTMLElement, expanded: boolean) => {
    trigger.setAttribute('aria-expanded', expanded.toString());
    target.setAttribute('aria-hidden', (!expanded).toString());
    
    if (expanded) {
      target.removeAttribute('inert');
    } else {
      target.setAttribute('inert', '');
    }
  },
  
  // Manage ARIA live regions
  updateLiveRegion: (id: string, message: string, level: 'polite' | 'assertive' = 'polite') => {
    let region = document.getElementById(id);
    
    if (!region) {
      region = document.createElement('div');
      region.id = id;
      region.setAttribute('aria-live', level);
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only';
      document.body.appendChild(region);
    }
    
    region.textContent = message;
  },
  
  // Status indicators for operations
  setStatus: (element: HTMLElement, status: 'loading' | 'success' | 'error' | 'idle', message?: string) => {
    element.setAttribute('aria-busy', (status === 'loading').toString());
    
    if (message) {
      element.setAttribute('aria-label', message);
    }
    
    const statusClass = `status-${status}`;
    element.classList.remove('status-loading', 'status-success', 'status-error', 'status-idle');
    element.classList.add(statusClass);
  }
};

/**
 * Focus management utilities
 */
export const focusManagement = {
  // Save and restore focus (useful for modals)
  saveFocus: (): HTMLElement | null => {
    return document.activeElement as HTMLElement;
  },
  
  restoreFocus: (element: HTMLElement | null) => {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  },
  
  // Focus first error in a form
  focusFirstError: (container: HTMLElement) => {
    const firstError = container.querySelector('[aria-invalid="true"], .error input, .error select, .error textarea') as HTMLElement;
    if (firstError) {
      firstError.focus();
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
  
  // Check if element is focusable
  isFocusable: (element: HTMLElement): boolean => {
    if (element.tabIndex < 0) return false;
    
    const focusableTags = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'];
    if (focusableTags.includes(element.tagName)) return true;
    
    return element.tabIndex >= 0;
  }
};

/**
 * Motion and animation preferences
 */
export const motionPreferences = {
  // Respect prefers-reduced-motion
  prefersReducedMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  
  // Safe animation wrapper
  safeAnimate: (element: HTMLElement, keyframes: Keyframe[], options?: KeyframeAnimationOptions) => {
    if (motionPreferences.prefersReducedMotion()) {
      // Skip animation, just apply final state
      const finalFrame = keyframes[keyframes.length - 1] as any;
      Object.assign(element.style, finalFrame);
      return;
    }
    
    return element.animate(keyframes, options);
  }
};

/**
 * Accessibility testing utilities (for development)
 */
export const a11yTesting = {
  // Check for common accessibility issues
  auditPage: (): Array<{ type: string; message: string; element?: HTMLElement }> => {
    const issues: Array<{ type: string; message: string; element?: HTMLElement }> = [];
    
    // Check for missing alt text
    const images = document.querySelectorAll('img:not([alt])');
    images.forEach(img => {
      issues.push({
        type: 'missing-alt',
        message: 'Image missing alt attribute',
        element: img as HTMLElement
      });
    });
    
    // Check for empty links
    const links = document.querySelectorAll('a:empty, a[aria-label=""], a[title=""]');
    links.forEach(link => {
      issues.push({
        type: 'empty-link',
        message: 'Link has no accessible text',
        element: link as HTMLElement
      });
    });
    
    // Check for missing form labels
    const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby]):not([id])');
    inputs.forEach(input => {
      const associatedLabel = document.querySelector(`label[for="${(input as HTMLInputElement).id}"]`);
      if (!associatedLabel) {
        issues.push({
          type: 'missing-label',
          message: 'Form input missing accessible label',
          element: input as HTMLElement
        });
      }
    });
    
    return issues;
  }
};

// CSS class for screen reader only text
export const srOnlyClass = `
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  
  .skip-link:focus {
    position: fixed !important;
    top: 6px !important;
    left: 6px !important;
    z-index: 999999 !important;
  }
`;

// Add CSS to document head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = srOnlyClass;
  document.head.appendChild(style);
}