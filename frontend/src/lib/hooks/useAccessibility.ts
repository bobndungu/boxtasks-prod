import { useCallback, useEffect, useRef } from 'react';

// Live region announcements for screen readers
let announceContainer: HTMLDivElement | null = null;

function getAnnounceContainer(): HTMLDivElement {
  if (!announceContainer) {
    announceContainer = document.createElement('div');
    announceContainer.setAttribute('aria-live', 'polite');
    announceContainer.setAttribute('aria-atomic', 'true');
    announceContainer.setAttribute('role', 'status');
    announceContainer.className = 'sr-only';
    announceContainer.style.cssText = `
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
    document.body.appendChild(announceContainer);
  }
  return announceContainer;
}

export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const container = getAnnounceContainer();
  container.setAttribute('aria-live', priority);

  // Clear and set message to trigger announcement
  container.textContent = '';
  requestAnimationFrame(() => {
    container.textContent = message;
  });
}

// Focus management hook
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Focus first element when trap activates
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, isActive]);
}

// Restore focus after modal closes
export function useFocusReturn() {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    previousActiveElement.current?.focus();
  }, []);

  return { saveFocus, restoreFocus };
}

// Skip link support
export function useSkipLink() {
  useEffect(() => {
    // Check if skip link already exists
    if (document.getElementById('skip-link')) return;

    const skipLink = document.createElement('a');
    skipLink.id = 'skip-link';
    skipLink.href = '#main-content';
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg';
    skipLink.textContent = 'Skip to main content';

    document.body.insertBefore(skipLink, document.body.firstChild);

    return () => {
      skipLink.remove();
    };
  }, []);
}

// Keyboard navigation utilities
export function useArrowNavigation(
  items: HTMLElement[],
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    wrap?: boolean;
    onSelect?: (index: number) => void;
  } = {}
) {
  const { orientation = 'vertical', wrap = true, onSelect } = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowUp':
        if (orientation !== 'horizontal') {
          e.preventDefault();
          nextIndex = currentIndex - 1;
        }
        break;
      case 'ArrowDown':
        if (orientation !== 'horizontal') {
          e.preventDefault();
          nextIndex = currentIndex + 1;
        }
        break;
      case 'ArrowLeft':
        if (orientation !== 'vertical') {
          e.preventDefault();
          nextIndex = currentIndex - 1;
        }
        break;
      case 'ArrowRight':
        if (orientation !== 'vertical') {
          e.preventDefault();
          nextIndex = currentIndex + 1;
        }
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = items.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect?.(currentIndex);
        return;
      default:
        return;
    }

    // Handle wrapping
    if (wrap) {
      if (nextIndex < 0) nextIndex = items.length - 1;
      if (nextIndex >= items.length) nextIndex = 0;
    } else {
      nextIndex = Math.max(0, Math.min(nextIndex, items.length - 1));
    }

    items[nextIndex]?.focus();
  }, [items, orientation, wrap, onSelect]);

  useEffect(() => {
    items.forEach((item) => {
      item.addEventListener('keydown', handleKeyDown);
    });

    return () => {
      items.forEach((item) => {
        item.removeEventListener('keydown', handleKeyDown);
      });
    };
  }, [items, handleKeyDown]);
}

// Reduced motion detection
export function useReducedMotion(): boolean {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
}

// High contrast mode detection
export function useHighContrast(): boolean {
  const mediaQuery = window.matchMedia('(prefers-contrast: more)');
  return mediaQuery.matches;
}

// Generate unique IDs for ARIA relationships
let idCounter = 0;
export function useId(prefix: string = 'id'): string {
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) {
    idRef.current = `${prefix}-${++idCounter}`;
  }
  return idRef.current;
}

// ARIA live region hook for dynamic content
export function useLiveRegion(message: string, priority: 'polite' | 'assertive' = 'polite') {
  useEffect(() => {
    if (message) {
      announceToScreenReader(message, priority);
    }
  }, [message, priority]);
}
