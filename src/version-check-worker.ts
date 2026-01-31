/**
 * Version Check Worker
 *
 * Runs as a SharedWorker (preferred) to deduplicate version polling across tabs,
 * or as a regular Worker on platforms without SharedWorker support (e.g., Android).
 *
 * SharedWorker: a single instance is shared across all tabs for the same origin,
 * so only one network request per interval is made regardless of how many tabs are open.
 *
 * Regular Worker: one per tab. Each tab polls independently (same behavior as before
 * but offloaded from the main thread).
 *
 * Protocol:
 *   Tab → Worker:  { type: 'init', baseUrl: string }   Start polling
 *   Tab → Worker:  { type: 'check-now' }               Trigger immediate check
 *   Worker → Tab:  { type: 'version-info', versionInfo } Version data from server
 */

const VERSION_CHECK_INTERVAL = 60_000; // 60 seconds

interface VersionInfo {
  version: string;
  appVersion: string | null;
  buildTime: string;
  commitHash: string | null;
  commitShortHash: string | null;
  repositoryUrl: string | null;
}

interface InitMessage {
  type: 'init';
  baseUrl: string;
}

interface CheckNowMessage {
  type: 'check-now';
}

type ClientMessage = InitMessage | CheckNowMessage;

// --- Worker state ---
let baseUrl = '/';
let latestVersionInfo: VersionInfo | null = null;
let pollingStarted = false;
const ports: MessagePort[] = [];

/**
 * Fetches the current version info from the server.
 * Uses cache-busting to bypass any intermediary caches.
 */
async function fetchVersion(): Promise<VersionInfo | null> {
  try {
    const response = await fetch(`${baseUrl}version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Sends a message to all connected ports.
 */
function broadcast(versionInfo: VersionInfo): void {
  const message = { type: 'version-info' as const, versionInfo };
  for (const port of ports) {
    port.postMessage(message);
  }
}

/**
 * Fetches version.json and broadcasts the result to all tabs.
 * Skips broadcasting in development mode.
 */
async function checkForUpdates(): Promise<void> {
  const serverVersion = await fetchVersion();
  if (!serverVersion || serverVersion.version === 'development') return;

  latestVersionInfo = serverVersion;
  broadcast(serverVersion);
}

/**
 * Starts the periodic polling interval (only once).
 */
function startPolling(): void {
  if (pollingStarted) return;
  pollingStarted = true;
  setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);
  // Immediate first check
  checkForUpdates();
}

/**
 * Registers a port (MessagePort from SharedWorker, or self from DedicatedWorker)
 * and sets up message handling.
 */
function addPort(port: MessagePort): void {
  ports.push(port);

  port.onmessage = (event: MessageEvent<ClientMessage>) => {
    const msg = event.data;
    switch (msg.type) {
      case 'init':
        baseUrl = msg.baseUrl;
        startPolling();
        // Send cached version info immediately so the tab doesn't wait for the next poll
        if (latestVersionInfo) {
          port.postMessage({
            type: 'version-info',
            versionInfo: latestVersionInfo,
          });
        }
        break;
      case 'check-now':
        checkForUpdates();
        break;
    }
  };

  // Clean up disconnected ports when the browser supports the close event
  port.addEventListener('close', () => {
    const index = ports.indexOf(port);
    if (index !== -1) ports.splice(index, 1);
  });

  // MessagePort requires explicit start() to begin receiving queued messages.
  // DedicatedWorkerGlobalScope does not have start(), so guard the call.
  if (typeof port.start === 'function') {
    port.start();
  }
}

// --- Entry point: detect SharedWorker vs DedicatedWorker ---
//
// SharedWorkerGlobalScope defines 'onconnect' (initially null).
// DedicatedWorkerGlobalScope does not have this property at all.
const isSharedWorker = 'onconnect' in self;

if (isSharedWorker) {
  // SharedWorker: each new tab connection fires the 'connect' event
  self.addEventListener('connect', (event: Event) => {
    const messageEvent = event as MessageEvent;
    const port = messageEvent.ports[0];
    if (port) addPort(port);
  });
} else {
  // DedicatedWorker: the global scope itself acts as the single port.
  // Its postMessage/onmessage interface is compatible with MessagePort.
  addPort(self as unknown as MessagePort);
}
