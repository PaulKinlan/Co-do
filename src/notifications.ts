/**
 * Native browser notifications for task completion
 *
 * Uses the Notifications API to alert users when AI tasks complete
 * while the tab is not visible (e.g., user switched to another tab).
 */

const STORAGE_KEY = 'co-do-notification-settings';

export interface NotificationSettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
};

class NotificationManager {
  private settings: NotificationSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Whether the Notifications API is available in this browser
   */
  get isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Current browser permission state
   */
  get permissionState(): NotificationPermission | 'unsupported' {
    if (!this.isSupported) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Whether notifications are enabled by the user preference
   */
  get isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Whether the page is currently hidden (user switched tabs)
   */
  get isPageHidden(): boolean {
    return document.hidden;
  }

  /**
   * Enable notifications — requests browser permission if needed
   * Returns true if notifications were successfully enabled.
   */
  async enable(): Promise<boolean> {
    if (!this.isSupported) return false;

    if (Notification.permission === 'denied') {
      return false;
    }

    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        return false;
      }
    }

    this.settings.enabled = true;
    this.saveSettings();
    return true;
  }

  /**
   * Disable notifications
   */
  disable(): void {
    this.settings.enabled = false;
    this.saveSettings();
  }

  /**
   * Send a notification if the page is hidden and notifications are enabled.
   * Uses a tag to collapse repeated notifications into one.
   */
  notify(title: string, body: string): void {
    if (!this.isSupported) return;
    if (!this.settings.enabled) return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;

    new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: 'codo-task-complete',
    });
  }

  private loadSettings(): NotificationSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }
}

export const notificationManager = new NotificationManager();
