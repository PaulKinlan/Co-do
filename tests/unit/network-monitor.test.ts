/**
 * Unit tests for the NetworkMonitor
 *
 * Mocks browser APIs (SecurityPolicyViolationEvent, PerformanceObserver)
 * since vitest runs in a node environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock showToast before importing NetworkMonitor
vi.mock('../../src/toasts', () => ({
  showToast: vi.fn(),
}));

// Mock provider-registry
vi.mock('../../src/provider-registry', () => ({
  getProviderCookie: vi.fn(),
  PROVIDER_REGISTRY: {
    anthropic: {
      id: 'anthropic',
      name: 'Anthropic (Claude)',
      connectSrc: ['https://api.anthropic.com'],
      apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    },
    openai: {
      id: 'openai',
      name: 'OpenAI (GPT)',
      connectSrc: ['https://api.openai.com'],
      apiKeyUrl: 'https://platform.openai.com/api-keys',
    },
  },
}));

import { NetworkMonitor, classifyRequest } from '../../src/network-monitor';
import { showToast } from '../../src/toasts';
import { getProviderCookie } from '../../src/provider-registry';

const mockShowToast = vi.mocked(showToast);
const mockGetProviderCookie = vi.mocked(getProviderCookie);

/** Create a minimal SecurityPolicyViolationEvent-like object for testing. */
function createViolationEvent(
  overrides: Partial<SecurityPolicyViolationEvent> = {},
): SecurityPolicyViolationEvent {
  return {
    effectiveDirective: 'connect-src',
    blockedURI: 'https://evil.example.com',
    violatedDirective: 'connect-src',
    originalPolicy: "default-src 'self'; connect-src 'self'",
    sourceFile: 'https://example.com/app.js',
    lineNumber: 42,
    columnNumber: 10,
    sample: '',
    documentURI: 'https://example.com/',
    disposition: 'enforce',
    ...overrides,
  } as SecurityPolicyViolationEvent;
}

/** Create a minimal PerformanceResourceTiming-like object. */
function createResourceEntry(
  overrides: Partial<PerformanceResourceTiming> = {},
): PerformanceResourceTiming {
  return {
    name: 'https://example.com/api/data',
    initiatorType: 'fetch',
    transferSize: 1024,
    decodedBodySize: 2048,
    duration: 150,
    responseStatus: 200,
    startTime: 100,
    ...overrides,
  } as PerformanceResourceTiming;
}

describe('NetworkMonitor', () => {
  let monitor: NetworkMonitor;

  beforeEach(() => {
    monitor = new NetworkMonitor();
    mockShowToast.mockClear();
    mockGetProviderCookie.mockReturnValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    monitor.destroy();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // CSP Violation Handling
  // -----------------------------------------------------------------------

  describe('handleCspViolation()', () => {
    it('records a violation in the log', () => {
      const event = createViolationEvent();
      monitor.handleCspViolation(event);

      const violations = monitor.getViolations();
      expect(violations).toHaveLength(1);
      expect(violations[0].effectiveDirective).toBe('connect-src');
      expect(violations[0].blockedUri).toBe('https://evil.example.com');
      expect(violations[0].kind).toBe('violation');
    });

    it('logs a structured warning to console', () => {
      monitor.handleCspViolation(createViolationEvent());

      expect(console.warn).toHaveBeenCalledWith('[CSP Violation]', {
        directive: 'connect-src',
        blockedUri: 'https://evil.example.com',
        source: 'https://example.com/app.js:42:10',
        disposition: 'enforce',
      });
    });

    it('logs "(unknown)" source when sourceFile is empty', () => {
      monitor.handleCspViolation(createViolationEvent({ sourceFile: '' }));

      expect(console.warn).toHaveBeenCalledWith(
        '[CSP Violation]',
        expect.objectContaining({ source: '(unknown)' }),
      );
    });

    it('shows a toast for enforce-mode violations', () => {
      monitor.handleCspViolation(createViolationEvent({ disposition: 'enforce' }));

      expect(mockShowToast).toHaveBeenCalledWith(
        'Blocked: https://evil.example.com (connect-src)',
        'error',
        8000,
      );
    });

    it('does not show a toast for report-mode violations', () => {
      monitor.handleCspViolation(createViolationEvent({ disposition: 'report' }));

      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('uses "inline" label in toast when blockedUri is empty', () => {
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: '', disposition: 'enforce' }),
      );

      expect(mockShowToast).toHaveBeenCalledWith(
        'Blocked: inline (connect-src)',
        'error',
        8000,
      );
    });

    it('deduplicates toasts within the 5-second window', () => {
      const event = createViolationEvent();
      monitor.handleCspViolation(event);
      monitor.handleCspViolation(event);
      monitor.handleCspViolation(event);

      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(monitor.getViolations()).toHaveLength(3);
    });

    it('shows separate toasts for different violations', () => {
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: 'https://a.example.com' }),
      );
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: 'https://b.example.com' }),
      );

      expect(mockShowToast).toHaveBeenCalledTimes(2);
    });

    it('stops showing toasts after the limit (5)', () => {
      for (let i = 0; i < 5; i++) {
        monitor.handleCspViolation(
          createViolationEvent({ blockedURI: `https://${i}.example.com` }),
        );
      }
      expect(mockShowToast).toHaveBeenCalledTimes(5);

      // 6th unique violation triggers suppression message
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: 'https://6.example.com' }),
      );
      expect(mockShowToast).toHaveBeenCalledTimes(6);
      expect(mockShowToast).toHaveBeenLastCalledWith(
        'Further CSP violation notifications suppressed — check Network & Security panel',
        'warning',
        8000,
      );

      // No more toasts after that
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: 'https://7.example.com' }),
      );
      expect(mockShowToast).toHaveBeenCalledTimes(6);
    });

    it('notifies violation callbacks', () => {
      const callback = vi.fn();
      monitor.onViolation(callback);
      monitor.handleCspViolation(createViolationEvent());

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'violation',
          effectiveDirective: 'connect-src',
          blockedUri: 'https://evil.example.com',
        }),
      );
    });

    it('unsubscribe stops callback from firing', () => {
      const callback = vi.fn();
      const unsub = monitor.onViolation(callback);
      unsub();
      monitor.handleCspViolation(createViolationEvent());

      expect(callback).not.toHaveBeenCalled();
    });

    it('swallows errors thrown by callbacks', () => {
      const badCallback = vi.fn(() => {
        throw new Error('callback error');
      });
      const goodCallback = vi.fn();

      monitor.onViolation(badCallback);
      monitor.onViolation(goodCallback);

      // Should not throw
      monitor.handleCspViolation(createViolationEvent());

      expect(badCallback).toHaveBeenCalledTimes(1);
      expect(goodCallback).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Resource Timing Handling
  // -----------------------------------------------------------------------

  describe('handleResourceEntry()', () => {
    it('records a network request in the log', () => {
      monitor.handleResourceEntry(createResourceEntry());

      const requests = monitor.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].kind).toBe('request');
      expect(requests[0].url).toBe('https://example.com/api/data');
      expect(requests[0].status).toBe('success');
    });

    it('classifies requests correctly', () => {
      // Success
      monitor.handleResourceEntry(
        createResourceEntry({ transferSize: 1024, responseStatus: 200 }),
      );
      expect(monitor.getRequests()[0].status).toBe('success');

      // Cached
      monitor.handleResourceEntry(
        createResourceEntry({ transferSize: 0, decodedBodySize: 1024, responseStatus: 200 }),
      );
      expect(monitor.getRequests()[1].status).toBe('cached');

      // Error
      monitor.handleResourceEntry(
        createResourceEntry({ responseStatus: 500, transferSize: 100 }),
      );
      expect(monitor.getRequests()[2].status).toBe('error');
    });
  });

  // -----------------------------------------------------------------------
  // Buffer Management
  // -----------------------------------------------------------------------

  describe('buffer management', () => {
    it('caps stored entries at 500', () => {
      for (let i = 0; i < 520; i++) {
        monitor.handleCspViolation(
          createViolationEvent({
            blockedURI: `https://${i}.example.com`,
          }),
        );
      }

      const entries = monitor.getEntries();
      expect(entries).toHaveLength(500);
    });

    it('evicts oldest entries when buffer overflows', () => {
      for (let i = 0; i < 510; i++) {
        monitor.handleCspViolation(
          createViolationEvent({
            blockedURI: `https://${i}.example.com`,
          }),
        );
      }

      const entries = monitor.getEntries();
      // First 10 should be evicted
      const firstEntry = entries[0] as { blockedUri: string };
      expect(firstEntry.blockedUri).toBe('https://10.example.com');
    });
  });

  // -----------------------------------------------------------------------
  // CSP State
  // -----------------------------------------------------------------------

  describe('getCspState()', () => {
    it('returns restricted when no provider cookie is set', () => {
      mockGetProviderCookie.mockReturnValue(undefined);
      const state = monitor.getCspState();

      expect(state.status).toBe('restricted');
      expect(state.provider).toBeNull();
      expect(state.domains).toEqual([]);
    });

    it('returns locked with provider info when cookie matches registry', () => {
      mockGetProviderCookie.mockReturnValue('anthropic');
      const state = monitor.getCspState();

      expect(state.status).toBe('locked');
      expect(state.provider).toBe('Anthropic (Claude)');
      expect(state.domains).toEqual(['api.anthropic.com']);
    });

    it('returns restricted when cookie has unknown provider', () => {
      mockGetProviderCookie.mockReturnValue('unknown-provider');
      const state = monitor.getCspState();

      expect(state.status).toBe('restricted');
      expect(state.provider).toBeNull();
    });

    it('strips protocol from domain names', () => {
      mockGetProviderCookie.mockReturnValue('openai');
      const state = monitor.getCspState();

      expect(state.domains).toEqual(['api.openai.com']);
    });
  });

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  describe('getStats()', () => {
    it('returns zero stats when empty', () => {
      const stats = monitor.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalViolations).toBe(0);
      expect(stats.uniqueViolations).toBe(0);
    });

    it('counts violations and unique violations', () => {
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: 'https://a.example.com' }),
      );
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: 'https://a.example.com' }),
      );
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: 'https://b.example.com' }),
      );

      const stats = monitor.getStats();
      expect(stats.totalViolations).toBe(3);
      expect(stats.uniqueViolations).toBe(2);
    });

    it('counts requests by status', () => {
      monitor.handleResourceEntry(
        createResourceEntry({ transferSize: 1024, responseStatus: 200 }),
      );
      monitor.handleResourceEntry(
        createResourceEntry({ transferSize: 0, decodedBodySize: 512, responseStatus: 200 }),
      );
      monitor.handleResourceEntry(
        createResourceEntry({ responseStatus: 404, transferSize: 100 }),
      );

      const stats = monitor.getStats();
      expect(stats.requestsByStatus.success).toBe(1);
      expect(stats.requestsByStatus.cached).toBe(1);
      expect(stats.requestsByStatus.error).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Violation Count
  // -----------------------------------------------------------------------

  describe('getViolationCount()', () => {
    it('returns 0 when no violations', () => {
      expect(monitor.getViolationCount()).toBe(0);
    });

    it('counts only violations, not requests', () => {
      monitor.handleCspViolation(createViolationEvent());
      monitor.handleResourceEntry(createResourceEntry());

      expect(monitor.getViolationCount()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  describe('clear()', () => {
    it('removes all entries and resets dedup state', () => {
      monitor.handleCspViolation(createViolationEvent());
      monitor.handleResourceEntry(createResourceEntry());

      monitor.clear();

      expect(monitor.getEntries()).toHaveLength(0);
      expect(monitor.getViolations()).toHaveLength(0);
      expect(monitor.getRequests()).toHaveLength(0);
    });

    it('allows toasts to show again after clear', () => {
      monitor.handleCspViolation(createViolationEvent());
      expect(mockShowToast).toHaveBeenCalledTimes(1);

      monitor.clear();
      mockShowToast.mockClear();

      monitor.handleCspViolation(createViolationEvent());
      expect(mockShowToast).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Initialize / Destroy
  // -----------------------------------------------------------------------

  describe('initialize() / destroy()', () => {
    // The initialize/destroy tests need a mock `document` global since
    // vitest runs in node. We set up a minimal mock and clean up afterward.
    // These tests manage their own monitor lifecycle so the outer afterEach
    // destroy() is skipped by creating a fresh monitor per-test.
    let mockDocument: { addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
    let originalDocument: typeof globalThis.document;
    let hasOriginalDocument: boolean;
    let localMonitor: NetworkMonitor;

    beforeEach(() => {
      hasOriginalDocument = 'document' in globalThis;
      originalDocument = globalThis.document;

      mockDocument = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      (globalThis as Record<string, unknown>).document = mockDocument;

      localMonitor = new NetworkMonitor();
    });

    afterEach(() => {
      // Destroy while mock document is still available
      localMonitor.destroy();

      if (hasOriginalDocument) {
        (globalThis as Record<string, unknown>).document = originalDocument;
      } else {
        delete (globalThis as Record<string, unknown>).document;
      }
    });

    it('attaches and removes CSP event listener', () => {
      localMonitor.initialize();
      expect(mockDocument.addEventListener).toHaveBeenCalledWith(
        'securitypolicyviolation',
        expect.any(Function),
      );

      localMonitor.destroy();
      expect(mockDocument.removeEventListener).toHaveBeenCalledWith(
        'securitypolicyviolation',
        expect.any(Function),
      );
    });

    it('only attaches listener once on multiple initialize calls', () => {
      localMonitor.initialize();
      localMonitor.initialize();

      const cspCalls = mockDocument.addEventListener.mock.calls.filter(
        (c: unknown[]) => c[0] === 'securitypolicyviolation',
      );
      expect(cspCalls).toHaveLength(1);
    });

    it('clears all state on destroy', () => {
      localMonitor.initialize();
      localMonitor.handleCspViolation(createViolationEvent());
      expect(localMonitor.getEntries()).toHaveLength(1);

      localMonitor.destroy();
      expect(localMonitor.getEntries()).toHaveLength(0);
    });

    it('can be re-initialized after destroy', () => {
      localMonitor.initialize();
      localMonitor.destroy();
      localMonitor.initialize();

      const cspCalls = mockDocument.addEventListener.mock.calls.filter(
        (c: unknown[]) => c[0] === 'securitypolicyviolation',
      );
      expect(cspCalls).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Entry Ordering
  // -----------------------------------------------------------------------

  describe('entry ordering', () => {
    it('maintains chronological order', () => {
      monitor.handleCspViolation(
        createViolationEvent({ blockedURI: 'https://first.example.com' }),
      );
      monitor.handleResourceEntry(
        createResourceEntry({ name: 'https://second.example.com/api' }),
      );

      const entries = monitor.getEntries();
      expect(entries[0].kind).toBe('violation');
      expect(entries[1].kind).toBe('request');
    });
  });
});

// ---------------------------------------------------------------------------
// classifyRequest (exported pure function)
// ---------------------------------------------------------------------------

describe('classifyRequest()', () => {
  it('classifies blocked requests (no transfer, no body, instant)', () => {
    const entry = createResourceEntry({
      transferSize: 0,
      decodedBodySize: 0,
      duration: 0,
    });
    expect(classifyRequest(entry)).toBe('blocked');
  });

  it('classifies cached requests (no transfer, has body)', () => {
    const entry = createResourceEntry({
      transferSize: 0,
      decodedBodySize: 1024,
      duration: 5,
    });
    expect(classifyRequest(entry)).toBe('cached');
  });

  it('classifies HTTP errors (status >= 400)', () => {
    const entry = createResourceEntry({
      responseStatus: 404,
      transferSize: 512,
      decodedBodySize: 512,
    });
    expect(classifyRequest(entry)).toBe('error');
  });

  it('classifies opaque responses (status 0, has duration)', () => {
    const entry = createResourceEntry({
      responseStatus: 0,
      transferSize: 0,
      decodedBodySize: 0,
      duration: 100,
    });
    expect(classifyRequest(entry)).toBe('opaque');
  });

  it('classifies successful requests', () => {
    const entry = createResourceEntry({
      responseStatus: 200,
      transferSize: 1024,
      decodedBodySize: 2048,
      duration: 150,
    });
    expect(classifyRequest(entry)).toBe('success');
  });
});
