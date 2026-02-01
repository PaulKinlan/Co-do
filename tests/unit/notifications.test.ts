/**
 * Unit tests for the NotificationManager
 *
 * Mocks browser APIs (Notification, document.hidden, localStorage)
 * since vitest runs in a node environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to set up globals before importing the module,
// so we use dynamic import and reset modules between tests.

function setupBrowserGlobals(overrides: {
  permission?: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
  hidden?: boolean;
  storage?: Record<string, string>;
} = {}) {
  const storage: Record<string, string> = overrides.storage ?? {};
  const notificationInstances: Array<{ title: string; options: NotificationOptions }> = [];
  const requestPermission = overrides.requestPermission ??
    vi.fn(async () => overrides.permission ?? 'granted');

  let permission = overrides.permission ?? 'default';

  // Mock Notification constructor + static permission
  const NotificationMock = vi.fn(function (this: unknown, title: string, options: NotificationOptions = {}) {
    notificationInstances.push({ title, options });
  }) as unknown as typeof Notification;

  Object.defineProperty(NotificationMock, 'permission', {
    get: () => permission,
    configurable: true,
  });
  NotificationMock.requestPermission = requestPermission as typeof Notification.requestPermission;

  // Assign globals
  (globalThis as Record<string, unknown>).Notification = NotificationMock;
  (globalThis as Record<string, unknown>).window = globalThis;

  // Mock document.hidden
  let hidden = overrides.hidden ?? false;
  if (typeof globalThis.document === 'undefined') {
    (globalThis as Record<string, unknown>).document = {};
  }
  Object.defineProperty(globalThis.document, 'hidden', {
    get: () => hidden,
    configurable: true,
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete storage[key]; }),
    clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
    get length() { return Object.keys(storage).length; },
    key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
  };
  (globalThis as Record<string, unknown>).localStorage = localStorageMock;

  return {
    notificationInstances,
    setPermission(p: NotificationPermission) { permission = p; },
    setHidden(h: boolean) { hidden = h; },
    storage,
    localStorageMock,
  };
}

function cleanupGlobals() {
  delete (globalThis as Record<string, unknown>).Notification;
  delete (globalThis as Record<string, unknown>).localStorage;
}

describe('NotificationManager', () => {
  let helpers: ReturnType<typeof setupBrowserGlobals>;

  afterEach(() => {
    cleanupGlobals();
    vi.resetModules();
  });

  async function loadManager() {
    const mod = await import('../../src/notifications');
    return mod.notificationManager;
  }

  describe('isSupported', () => {
    it('returns true when Notification API exists', async () => {
      helpers = setupBrowserGlobals();
      const mgr = await loadManager();
      expect(mgr.isSupported).toBe(true);
    });

    it('returns false when Notification API is absent', async () => {
      helpers = setupBrowserGlobals();
      delete (globalThis as Record<string, unknown>).Notification;
      const mgr = await loadManager();
      expect(mgr.isSupported).toBe(false);
    });
  });

  describe('permissionState', () => {
    it('returns the current Notification.permission value', async () => {
      helpers = setupBrowserGlobals({ permission: 'granted' });
      const mgr = await loadManager();
      expect(mgr.permissionState).toBe('granted');
    });

    it('returns "unsupported" when API is absent', async () => {
      helpers = setupBrowserGlobals();
      delete (globalThis as Record<string, unknown>).Notification;
      const mgr = await loadManager();
      expect(mgr.permissionState).toBe('unsupported');
    });
  });

  describe('isEnabled', () => {
    it('returns false by default', async () => {
      helpers = setupBrowserGlobals({ permission: 'granted' });
      const mgr = await loadManager();
      expect(mgr.isEnabled).toBe(false);
    });

    it('returns true only when preference is enabled AND permission is granted', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      expect(mgr.isEnabled).toBe(true);
    });

    it('returns false when preference is enabled but permission is denied', async () => {
      helpers = setupBrowserGlobals({
        permission: 'denied',
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      expect(mgr.isEnabled).toBe(false);
    });

    it('returns false when preference is enabled but permission is default', async () => {
      helpers = setupBrowserGlobals({
        permission: 'default',
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      expect(mgr.isEnabled).toBe(false);
    });
  });

  describe('enable()', () => {
    it('requests permission and saves enabled state on grant', async () => {
      helpers = setupBrowserGlobals({
        permission: 'default',
        requestPermission: vi.fn(async () => 'granted'),
      });
      // After requestPermission resolves 'granted', the permission getter should return 'granted'
      const mgr = await loadManager();
      helpers.setPermission('default');

      // The requestPermission mock returns 'granted'
      const mockReqPerm = vi.fn(async () => {
        helpers.setPermission('granted');
        return 'granted' as NotificationPermission;
      });
      (Notification as unknown as Record<string, unknown>).requestPermission = mockReqPerm;

      const result = await mgr.enable();
      expect(result).toBe(true);
      expect(mgr.isEnabled).toBe(true);
      expect(helpers.localStorageMock.setItem).toHaveBeenCalled();
    });

    it('returns false when permission is denied', async () => {
      helpers = setupBrowserGlobals({ permission: 'denied' });
      const mgr = await loadManager();
      const result = await mgr.enable();
      expect(result).toBe(false);
      expect(mgr.isEnabled).toBe(false);
    });

    it('returns false when user dismisses the permission prompt', async () => {
      helpers = setupBrowserGlobals({
        permission: 'default',
        requestPermission: vi.fn(async () => 'default'),
      });
      const mgr = await loadManager();
      const result = await mgr.enable();
      expect(result).toBe(false);
    });

    it('returns false when requestPermission throws', async () => {
      helpers = setupBrowserGlobals({
        permission: 'default',
        requestPermission: vi.fn(async () => { throw new Error('blocked'); }),
      });
      const mgr = await loadManager();
      const result = await mgr.enable();
      expect(result).toBe(false);
    });

    it('skips permission request when already granted', async () => {
      const reqPerm = vi.fn(async () => 'granted' as NotificationPermission);
      helpers = setupBrowserGlobals({
        permission: 'granted',
        requestPermission: reqPerm,
      });
      const mgr = await loadManager();
      const result = await mgr.enable();
      expect(result).toBe(true);
      expect(reqPerm).not.toHaveBeenCalled();
    });

    it('returns false when API is unsupported', async () => {
      helpers = setupBrowserGlobals();
      delete (globalThis as Record<string, unknown>).Notification;
      const mgr = await loadManager();
      const result = await mgr.enable();
      expect(result).toBe(false);
    });
  });

  describe('disable()', () => {
    it('sets enabled to false and saves', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      expect(mgr.isEnabled).toBe(true);
      mgr.disable();
      expect(mgr.isEnabled).toBe(false);
      expect(helpers.localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('notify()', () => {
    it('sends a notification when enabled, granted, and page is hidden', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        hidden: true,
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      mgr.notify('Test', 'Hello');
      expect(helpers.notificationInstances).toHaveLength(1);
      expect(helpers.notificationInstances[0].title).toBe('Test');
      expect(helpers.notificationInstances[0].options.body).toBe('Hello');
      expect(helpers.notificationInstances[0].options.tag).toBe('codo-task-complete');
    });

    it('uses a custom tag when provided', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        hidden: true,
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      mgr.notify('Co-do — Permission Needed', 'Approve "open_file" to continue.', 'codo-permission-request');
      expect(helpers.notificationInstances).toHaveLength(1);
      expect(helpers.notificationInstances[0].options.tag).toBe('codo-permission-request');
    });

    it('does not send when page is visible', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        hidden: false,
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      mgr.notify('Test', 'Hello');
      expect(helpers.notificationInstances).toHaveLength(0);
    });

    it('does not send when not enabled', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        hidden: true,
      });
      const mgr = await loadManager();
      mgr.notify('Test', 'Hello');
      expect(helpers.notificationInstances).toHaveLength(0);
    });

    it('does not send when permission is denied', async () => {
      helpers = setupBrowserGlobals({
        permission: 'denied',
        hidden: true,
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      mgr.notify('Test', 'Hello');
      expect(helpers.notificationInstances).toHaveLength(0);
    });

    it('does not send when API is unsupported', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        hidden: true,
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      delete (globalThis as Record<string, unknown>).Notification;
      const mgr = await loadManager();
      mgr.notify('Test', 'Hello');
      expect(helpers.notificationInstances).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('loads saved settings from localStorage', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        storage: { 'co-do-notification-settings': JSON.stringify({ enabled: true }) },
      });
      const mgr = await loadManager();
      expect(mgr.isEnabled).toBe(true);
    });

    it('handles corrupted localStorage gracefully', async () => {
      helpers = setupBrowserGlobals({
        permission: 'granted',
        storage: { 'co-do-notification-settings': 'not-json{{{' },
      });
      const mgr = await loadManager();
      expect(mgr.isEnabled).toBe(false);
    });
  });
});
