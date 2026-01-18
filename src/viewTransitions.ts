/**
 * View Transitions API utilities
 * Provides smooth animated transitions for DOM updates
 */

/**
 * Counter for generating unique view transition names
 */
let transitionIdCounter = 0;

/**
 * Generate a unique view transition name
 * This prevents conflicts when multiple elements are transitioning simultaneously
 */
export function generateUniqueTransitionName(prefix: string): string {
  return `${prefix}-${++transitionIdCounter}`;
}

/**
 * Check if View Transitions API is supported
 */
export function isViewTransitionsSupported(): boolean {
  return 'startViewTransition' in document;
}

/**
 * Check if an error is a view transition abort error
 * These occur when a transition is skipped (e.g., another transition starts)
 */
function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return false;
}

/**
 * Wrap a DOM update callback in a view transition
 * Falls back to immediate execution if not supported
 *
 * @param updateCallback - Function that performs DOM updates
 * @returns Promise that resolves when the transition completes
 */
export async function withViewTransition(
  updateCallback: () => void | Promise<void>
): Promise<void> {
  if (!isViewTransitionsSupported()) {
    await updateCallback();
    return;
  }

  // Cast to access startViewTransition since TypeScript may not have it in older lib versions
  const doc = document as Document & {
    startViewTransition: (callback: () => void | Promise<void>) => {
      finished: Promise<void>;
      ready: Promise<void>;
      updateCallbackDone: Promise<void>;
      skipTransition: () => void;
    };
  };

  const transition = doc.startViewTransition(async () => {
    await updateCallback();
  });

  try {
    await transition.finished;
  } catch (error) {
    // Abort errors are expected when transitions are skipped or interrupted
    if (!isAbortError(error)) {
      console.warn('View transition failed:', error);
    }
  }
}

/**
 * Wrap a DOM update with a view transition, with a specific transition name
 * This temporarily assigns a view-transition-name to an element
 *
 * @param element - The element to transition
 * @param transitionName - The view-transition-name to use
 * @param updateCallback - Function that performs DOM updates
 */
export async function withNamedViewTransition(
  element: HTMLElement,
  transitionName: string,
  updateCallback: () => void | Promise<void>
): Promise<void> {
  if (!isViewTransitionsSupported()) {
    await updateCallback();
    return;
  }

  // Assign transition name
  const originalName = element.style.viewTransitionName;
  element.style.viewTransitionName = transitionName;

  // Cast to access startViewTransition since TypeScript may not have it in older lib versions
  const doc = document as Document & {
    startViewTransition: (callback: () => void | Promise<void>) => {
      finished: Promise<void>;
      ready: Promise<void>;
      updateCallbackDone: Promise<void>;
      skipTransition: () => void;
    };
  };

  const transition = doc.startViewTransition(async () => {
    await updateCallback();
  });

  try {
    await transition.finished;
  } catch (error) {
    // Abort errors are expected when transitions are skipped or interrupted
    if (!isAbortError(error)) {
      console.warn('View transition failed:', error);
    }
  } finally {
    // Restore original transition name
    element.style.viewTransitionName = originalName;
  }
}
