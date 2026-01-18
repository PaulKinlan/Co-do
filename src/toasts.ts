/**
 * Toast notification system for displaying temporary messages
 */

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  timeoutId?: number;
}

class ToastManager {
  private toasts: Map<string, Toast> = new Map();
  private container: HTMLElement | null = null;
  private toastCounter = 0;

  /**
   * Initialize the toast manager by finding or creating the toast container
   */
  initialize(): void {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      console.warn('Toast container not found in DOM');
    }
  }

  /**
   * Show a new toast notification
   */
  show(message: string, type: ToastType = 'info', duration: number = 5000): string {
    if (!this.container) {
      this.initialize();
      if (!this.container) {
        console.error('Cannot show toast: container not initialized');
        return '';
      }
    }

    const id = `toast-${++this.toastCounter}-${Date.now()}`;
    const toast: Toast = { id, message, type, duration };

    // Create toast element
    const toastElement = this.createToastElement(toast);
    this.container.appendChild(toastElement);

    // Store toast
    this.toasts.set(id, toast);

    // Trigger animation by adding 'show' class after a small delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toastElement.classList.add('show');
      });
    });

    // Set up auto-dismiss
    if (duration > 0) {
      const timeoutId = window.setTimeout(() => {
        this.remove(id);
      }, duration);
      toast.timeoutId = timeoutId;
    }

    return id;
  }

  /**
   * Remove a toast by ID
   */
  remove(id: string): void {
    const toast = this.toasts.get(id);
    if (!toast) return;

    // Clear timeout if exists
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }

    // Find and remove element
    const toastElement = document.getElementById(id);
    if (toastElement) {
      // Trigger exit animation
      toastElement.classList.remove('show');
      toastElement.classList.add('hiding');

      // Remove from DOM after the CSS transition completes
      toastElement.addEventListener(
        'transitionend',
        () => {
          toastElement.remove();
          this.toasts.delete(id);
        },
        { once: true },
      );
    } else {
      // If no DOM element, still clean up the map entry
      this.toasts.delete(id);
    }
  }

  /**
   * Remove all toasts
   */
  removeAll(): void {
    this.toasts.forEach((_, id) => this.remove(id));
  }

  /**
   * Create the DOM element for a toast
   */
  private createToastElement(toast: Toast): HTMLElement {
    const toastEl = document.createElement('div');
    toastEl.id = toast.id;
    toastEl.className = `toast toast-${toast.type}`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');

    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = toast.message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => this.remove(toast.id);

    toastEl.appendChild(messageEl);
    toastEl.appendChild(closeBtn);

    return toastEl;
  }
}

// Export singleton instance
export const toastManager = new ToastManager();

/**
 * Show a toast notification
 * @param message - The message to display
 * @param type - The type of toast (error, success, info, warning)
 * @param duration - How long to show the toast in milliseconds (0 = no auto-dismiss)
 * @returns The toast ID
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 5000
): string {
  return toastManager.show(message, type, duration);
}

/**
 * Remove a specific toast by ID
 */
export function removeToast(id: string): void {
  toastManager.remove(id);
}

/**
 * Remove all toasts
 */
export function removeAllToasts(): void {
  toastManager.removeAll();
}
