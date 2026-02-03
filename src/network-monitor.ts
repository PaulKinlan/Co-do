/**
 * Network Request Logger & CSP Violation Monitor
 *
 * Provides visibility into the application's Content Security Policy by:
 * - Listening for `securitypolicyviolation` events
 * - Tracking network requests via PerformanceObserver (Resource Timing API)
 * - Capturing buffered violations via ReportingObserver (Chrome 140+)
 * - Deriving the active CSP state from the provider cookie + registry
 *
 * See: https://github.com/PaulKinlan/Co-do/issues/154
 */

import { showToast } from './toasts';
import {
  getProviderCookie,
  PROVIDER_REGISTRY,
} from './provider-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Classification of a network request's outcome. */
export type RequestStatus =
  | 'success'
  | 'cached'
  | 'blocked'
  | 'error'
  | 'opaque';

/** A single logged network request (from PerformanceObserver). */
export interface NetworkRequest {
  kind: 'request';
  timestamp: number;
  url: string;
  initiatorType: string;
  status: RequestStatus;
  duration: number;
  transferSize: number;
  decodedBodySize: number;
  responseStatus: number;
}

/** A single CSP violation event. */
export interface CspViolation {
  kind: 'violation';
  timestamp: number;
  effectiveDirective: string;
  blockedUri: string;
  violatedDirective: string;
  originalPolicy: string;
  sourceFile: string;
  lineNumber: number;
  columnNumber: number;
  sample: string;
  documentUri: string;
  disposition: string;
}

/** Union type for all log entries. */
export type LogEntry = NetworkRequest | CspViolation;

/** Describes the current CSP state derived from the provider cookie. */
export interface CspState {
  status: 'locked' | 'restricted';
  provider: string | null;
  domains: string[];
}

/** Summary statistics. */
export interface MonitorStats {
  totalEntries: number;
  totalViolations: number;
  uniqueViolations: number;
  requestsByStatus: Record<RequestStatus, number>;
}

/** Callback signature for violation listeners. */
export type ViolationCallback = (violation: CspViolation) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum entries in the circular buffer. */
const MAX_BUFFER_SIZE = 500;

/** Maximum number of unique toasts shown for violations. */
const MAX_VIOLATION_TOASTS = 5;

/** Deduplication window for toast notifications (ms). */
const TOAST_DEDUP_WINDOW_MS = 5000;

// ---------------------------------------------------------------------------
// Network Monitor
// ---------------------------------------------------------------------------

export class NetworkMonitor {
  private buffer: LogEntry[] = [];
  private violationDedupMap = new Map<string, number>();
  private violationToastCount = 0;
  private violationCallbacks: ViolationCallback[] = [];
  private initialized = false;

  // Event handler references for cleanup
  private boundCspHandler: ((e: SecurityPolicyViolationEvent) => void) | null =
    null;
  private performanceObserver: PerformanceObserver | null = null;
  private reportingObserver: unknown = null;

  /**
   * Start all monitoring. Safe to call multiple times.
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.startCspViolationListener();
    this.startPerformanceObserver();
    this.startReportingObserver();
  }

  /**
   * Stop all monitoring and clear state.
   */
  destroy(): void {
    if (this.boundCspHandler) {
      document.removeEventListener(
        'securitypolicyviolation',
        this.boundCspHandler,
      );
      this.boundCspHandler = null;
    }
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    if (this.reportingObserver && typeof (this.reportingObserver as PerformanceObserver).disconnect === 'function') {
      (this.reportingObserver as PerformanceObserver).disconnect();
      this.reportingObserver = null;
    }
    this.initialized = false;
    this.buffer = [];
    this.violationDedupMap.clear();
    this.violationToastCount = 0;
    this.violationCallbacks = [];
  }

  // -----------------------------------------------------------------------
  // CSP Violation Listener
  // -----------------------------------------------------------------------

  private startCspViolationListener(): void {
    this.boundCspHandler = (event: SecurityPolicyViolationEvent) => {
      this.handleCspViolation(event);
    };
    document.addEventListener('securitypolicyviolation', this.boundCspHandler);
  }

  /**
   * Process a CSP violation event. Exposed for testing.
   */
  handleCspViolation(event: SecurityPolicyViolationEvent): void {
    const violation: CspViolation = {
      kind: 'violation',
      timestamp: Date.now(),
      effectiveDirective: event.effectiveDirective,
      blockedUri: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber,
      sample: event.sample,
      documentUri: event.documentURI,
      disposition: event.disposition,
    };

    this.addEntry(violation);

    // Structured console warning
    console.warn('[CSP Violation]', {
      directive: violation.effectiveDirective,
      blockedUri: violation.blockedUri,
      source: violation.sourceFile
        ? `${violation.sourceFile}:${violation.lineNumber}:${violation.columnNumber}`
        : '(unknown)',
      disposition: violation.disposition,
    });

    // Notify subscribers
    for (const cb of this.violationCallbacks) {
      try {
        cb(violation);
      } catch {
        // Swallow callback errors to avoid breaking the monitor
      }
    }

    // Deduplicated toast notification (enforce mode only)
    if (violation.disposition === 'enforce') {
      this.showViolationToast(violation);
    }
  }

  private showViolationToast(violation: CspViolation): void {
    const dedupKey = `${violation.effectiveDirective}|${violation.blockedUri}`;
    const now = Date.now();
    const lastSeen = this.violationDedupMap.get(dedupKey);

    // Skip if same violation was toasted within the dedup window
    if (lastSeen !== undefined && now - lastSeen < TOAST_DEDUP_WINDOW_MS) {
      return;
    }
    this.violationDedupMap.set(dedupKey, now);

    if (this.violationToastCount < MAX_VIOLATION_TOASTS) {
      this.violationToastCount++;
      const blocked = violation.blockedUri || 'inline';
      showToast(
        `Blocked: ${blocked} (${violation.effectiveDirective})`,
        'error',
        8000,
      );
    } else if (this.violationToastCount === MAX_VIOLATION_TOASTS) {
      this.violationToastCount++;
      showToast(
        'Further CSP violation notifications suppressed — check Network & Security panel',
        'warning',
        8000,
      );
    }
  }

  // -----------------------------------------------------------------------
  // PerformanceObserver (Resource Timing)
  // -----------------------------------------------------------------------

  private startPerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      // Request a larger buffer to capture more entries before overflow
      if (typeof performance?.setResourceTimingBufferSize === 'function') {
        performance.setResourceTimingBufferSize(MAX_BUFFER_SIZE);
      }

      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handleResourceEntry(entry as PerformanceResourceTiming);
        }
      });

      this.performanceObserver.observe({
        type: 'resource',
        buffered: true,
      });
    } catch {
      // PerformanceObserver may throw if the entry type is not supported
    }
  }

  /**
   * Process a PerformanceResourceTiming entry. Exposed for testing.
   */
  handleResourceEntry(entry: PerformanceResourceTiming): void {
    const request: NetworkRequest = {
      kind: 'request',
      timestamp: Math.round(performance.timeOrigin + entry.startTime),
      url: entry.name,
      initiatorType: entry.initiatorType,
      status: classifyRequest(entry),
      duration: Math.round(entry.duration),
      transferSize: entry.transferSize ?? 0,
      decodedBodySize: entry.decodedBodySize ?? 0,
      responseStatus: entry.responseStatus ?? 0,
    };

    this.addEntry(request);
  }

  // -----------------------------------------------------------------------
  // ReportingObserver (Chrome-only, buffered CSP reports)
  // -----------------------------------------------------------------------

  private startReportingObserver(): void {
    if (!('ReportingObserver' in globalThis)) return;

    try {
      // ReportingObserver is only available in Chrome 140+
      const ReportingObserverCtor = (globalThis as Record<string, unknown>)
        .ReportingObserver as new (
        callback: (reports: ReportingObserverReport[]) => void,
        options: { types: string[]; buffered: boolean },
      ) => { observe(): void; disconnect(): void };

      const observer = new ReportingObserverCtor(
        (reports) => {
          for (const report of reports) {
            this.handleReport(report);
          }
        },
        { types: ['csp-violation'], buffered: true },
      );
      observer.observe();
      this.reportingObserver = observer;
    } catch {
      // Feature detection passed but construction failed
    }
  }

  /** Minimal shape of a reporting observer report body. */
  private handleReport(report: ReportingObserverReport): void {
    const body = report.body as Record<string, unknown> | null;
    if (!body) return;

    // ReportingObserver uses 'blockedURL' (capital URL) not 'blockedURI'
    const blockedUri = (body.blockedURL ?? body.blockedURI ?? '') as string;
    const dedupKey = `${body.effectiveDirective}|${blockedUri}`;

    // Skip if we already captured this via SecurityPolicyViolationEvent
    const existing = this.buffer.find(
      (e) =>
        e.kind === 'violation' &&
        `${e.effectiveDirective}|${e.blockedUri}` === dedupKey,
    );
    if (existing) return;

    const violation: CspViolation = {
      kind: 'violation',
      timestamp: Date.now(),
      effectiveDirective: (body.effectiveDirective ?? '') as string,
      blockedUri,
      violatedDirective: (body.violatedDirective ?? '') as string,
      originalPolicy: (body.originalPolicy ?? '') as string,
      sourceFile: (body.sourceFile ?? '') as string,
      lineNumber: (body.lineNumber ?? 0) as number,
      columnNumber: (body.columnNumber ?? 0) as number,
      sample: (body.sample ?? '') as string,
      documentUri: (body.documentURL ?? '') as string,
      disposition: (body.disposition ?? 'enforce') as string,
    };

    this.addEntry(violation);

    // Console warning for reporting-observer-sourced violations
    console.warn('[CSP Violation via ReportingObserver]', {
      directive: violation.effectiveDirective,
      blockedUri: violation.blockedUri,
    });
  }

  // -----------------------------------------------------------------------
  // Buffer management
  // -----------------------------------------------------------------------

  private addEntry(entry: LogEntry): void {
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  // -----------------------------------------------------------------------
  // CSP State
  // -----------------------------------------------------------------------

  /**
   * Derive the current CSP state from the provider cookie and registry.
   * This mirrors what the server does to build the CSP header.
   */
  getCspState(): CspState {
    const providerId = getProviderCookie();

    if (!providerId) {
      return { status: 'restricted', provider: null, domains: [] };
    }

    const provider = PROVIDER_REGISTRY[providerId];
    if (!provider) {
      return { status: 'restricted', provider: null, domains: [] };
    }

    return {
      status: 'locked',
      provider: provider.name,
      domains: provider.connectSrc.map((src) =>
        src.replace(/^https?:\/\//, ''),
      ),
    };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Subscribe to CSP violation events. Returns unsubscribe function. */
  onViolation(callback: ViolationCallback): () => void {
    this.violationCallbacks.push(callback);
    return () => {
      const idx = this.violationCallbacks.indexOf(callback);
      if (idx !== -1) this.violationCallbacks.splice(idx, 1);
    };
  }

  /** Get all entries (newest last). */
  getEntries(): readonly LogEntry[] {
    return this.buffer;
  }

  /** Get only CSP violations. */
  getViolations(): CspViolation[] {
    return this.buffer.filter((e): e is CspViolation => e.kind === 'violation');
  }

  /** Get only network requests. */
  getRequests(): NetworkRequest[] {
    return this.buffer.filter(
      (e): e is NetworkRequest => e.kind === 'request',
    );
  }

  /** Get summary statistics. */
  getStats(): MonitorStats {
    const violations = this.getViolations();
    const requests = this.getRequests();
    const uniqueViolationKeys = new Set(
      violations.map((v) => `${v.effectiveDirective}|${v.blockedUri}`),
    );

    const requestsByStatus: Record<RequestStatus, number> = {
      success: 0,
      cached: 0,
      blocked: 0,
      error: 0,
      opaque: 0,
    };
    for (const r of requests) {
      requestsByStatus[r.status]++;
    }

    return {
      totalEntries: this.buffer.length,
      totalViolations: violations.length,
      uniqueViolations: uniqueViolationKeys.size,
      requestsByStatus,
    };
  }

  /** Get the total number of CSP violations (for badge display). */
  getViolationCount(): number {
    return this.buffer.filter((e) => e.kind === 'violation').length;
  }

  /** Clear all logged data and reset dedup state. */
  clear(): void {
    this.buffer = [];
    this.violationDedupMap.clear();
    this.violationToastCount = 0;
  }
}

// ---------------------------------------------------------------------------
// Request classification
// ---------------------------------------------------------------------------

/** Classify a PerformanceResourceTiming entry by its outcome. */
export function classifyRequest(
  entry: PerformanceResourceTiming,
): RequestStatus {
  const transferSize = entry.transferSize ?? 0;
  const decodedBodySize = entry.decodedBodySize ?? 0;
  const duration = entry.duration ?? 0;
  const responseStatus = entry.responseStatus ?? 0;

  // Blocked by CSP: no transfer, no body, instant
  if (transferSize === 0 && decodedBodySize === 0 && duration === 0) {
    return 'blocked';
  }

  // Served from cache: no transfer but has decoded body
  if (transferSize === 0 && decodedBodySize > 0) {
    return 'cached';
  }

  // HTTP error
  if (responseStatus >= 400) {
    return 'error';
  }

  // Opaque response (CORS, etc.): status 0 but took time
  if (responseStatus === 0 && duration > 0) {
    return 'opaque';
  }

  return 'success';
}

// ---------------------------------------------------------------------------
// ReportingObserver type shim (not in standard lib)
// ---------------------------------------------------------------------------

interface ReportingObserverReport {
  type: string;
  url: string;
  body: unknown;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const networkMonitor = new NetworkMonitor();
