/**
 * Main entry point for the Co-do application
 */

import './styles.css';
import { UIManager } from './ui';
import { preferencesManager } from './preferences';
import { networkMonitor } from './network-monitor';

// Start monitoring CSP violations and network requests as early as possible
// so violations during page load are captured before other initialization.
networkMonitor.initialize();

// Version checking constants
const VERSION_STORAGE_KEY = 'co-do-app-version';

interface VersionInfo {
  version: string;
  appVersion: string | null;
  buildTime: string;
  commitHash: string | null;
  commitShortHash: string | null;
  repositoryUrl: string | null;
}

/**
 * Shows the update notification to the user
 * @param versionInfo - The new version information from the server
 */
function showUpdateNotification(versionInfo: VersionInfo): void {
  const notification = document.getElementById('update-notification');
  const reloadBtn = document.getElementById('update-reload-btn');
  const dismissBtn = document.getElementById('update-dismiss-btn');
  const changelogLink = document.getElementById(
    'update-changelog-link'
  ) as HTMLAnchorElement | null;
  const notificationText = document.querySelector(
    '.update-notification-text'
  );

  if (notification && reloadBtn && dismissBtn) {
    // Show which version is available
    if (notificationText && versionInfo.appVersion) {
      notificationText.textContent = `Version ${versionInfo.appVersion} is available`;
    }

    // Link to changelog for the specific version, or fall back to changelog file
    if (changelogLink && versionInfo.repositoryUrl) {
      changelogLink.href = `${versionInfo.repositoryUrl}/blob/main/CHANGELOG.md`;
      changelogLink.title = versionInfo.appVersion
        ? `View what's new in v${versionInfo.appVersion}`
        : 'View changelog';
      changelogLink.hidden = false;
    }

    notification.hidden = false;
    // Trigger animation after a brief delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        notification.classList.add('show');
      });
    });

    // Handle reload button click
    const handleReload = () => {
      // Clear stored version so after reload we pick up the new version
      localStorage.removeItem(VERSION_STORAGE_KEY);
      window.location.reload();
    };

    // Handle dismiss button click
    const handleDismiss = () => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.hidden = true;
      }, 300);
    };

    // Remove existing listeners to prevent duplicates
    reloadBtn.replaceWith(reloadBtn.cloneNode(true));
    dismissBtn.replaceWith(dismissBtn.cloneNode(true));

    // Re-query and add listeners
    document.getElementById('update-reload-btn')?.addEventListener('click', handleReload);
    document.getElementById('update-dismiss-btn')?.addEventListener('click', handleDismiss);
  }
}

/**
 * Handles version info received from the version check worker.
 * Compares against the stored version in localStorage.
 */
function handleVersionInfo(versionInfo: VersionInfo): void {
  // Development mode is already filtered by the worker, but guard anyway
  if (versionInfo.version === 'development') return;

  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

  if (!storedVersion) {
    // First visit or cleared storage — store current version
    localStorage.setItem(VERSION_STORAGE_KEY, versionInfo.version);
    console.log('Stored initial version:', versionInfo.version);
    return;
  }

  if (storedVersion !== versionInfo.version) {
    console.log(
      `New version available! Current: ${storedVersion}, New: ${versionInfo.version}`
    );
    showUpdateNotification(versionInfo);
  }
}

/**
 * Sets up version checking via a SharedWorker (preferred) or regular Worker (fallback).
 *
 * SharedWorker deduplicates polling across tabs — only one network request per interval
 * regardless of how many tabs are open. Falls back to a regular Worker on platforms
 * that don't support SharedWorker (e.g., Android WebView).
 */
function setupVersionChecking(): void {
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'version-info') {
      handleVersionInfo(event.data.versionInfo);
    }
  };

  type ClientMessage =
    | { type: 'init'; baseUrl: string }
    | { type: 'check-now' };

  let sendMessage: (msg: ClientMessage) => void;

  // Vite requires `new URL(...)` to be inlined directly in the Worker/SharedWorker
  // constructor for static analysis to recognise it as a worker entry point.
  if ('SharedWorker' in window) {
    try {
      const shared = new SharedWorker(
        new URL('./version-check-worker.ts', import.meta.url),
        { name: 'co-do-version-check', type: 'module' }
      );
      shared.port.onmessage = onMessage;
      sendMessage = (msg) => shared.port.postMessage(msg);
      console.log('Version checking: using SharedWorker');
    } catch (e) {
      console.warn('SharedWorker failed, falling back to Worker:', e);
      const worker = new Worker(
        new URL('./version-check-worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = onMessage;
      sendMessage = (msg) => worker.postMessage(msg);
      console.log('Version checking: using Worker fallback');
    }
  } else {
    const worker = new Worker(
      new URL('./version-check-worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = onMessage;
    sendMessage = (msg) => worker.postMessage(msg);
    console.log('Version checking: using Worker fallback');
  }

  // Tell the worker to start polling
  sendMessage({ type: 'init', baseUrl: import.meta.env.BASE_URL });

  // Request an immediate check whenever the tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sendMessage({ type: 'check-now' });
    }
  });
}

// Initialize the application
async function init() {
  console.log('Co-do - AI File System Manager');
  console.log('Initializing application...');

  // Check for File System Access API support
  if (!('showDirectoryPicker' in window)) {
    alert(
      'Your browser does not support the File System Access API.\n\n' +
        'Please use Chrome 86+, Edge 86+, or another Chromium-based browser.\n\n' +
        'For the best experience, use the latest version of Chrome.'
    );
    return;
  }

  // Initialize preferences manager (includes storage migration)
  try {
    await preferencesManager.init();
    console.log('Preferences manager initialized');
  } catch (error) {
    console.error('Failed to initialize preferences manager:', error);
  }

  // Initialize UI
  new UIManager();

  // Handle PWA shortcut actions
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'select-folder') {
    // Trigger folder selection when launched via PWA shortcut
    // Use setTimeout to ensure UI is fully initialized
    setTimeout(() => {
      const selectFolderBtn = document.getElementById('select-folder-btn');
      if (selectFolderBtn) {
        selectFolderBtn.click();
      }
    }, 100);
  }

  // Register Service Worker for PWA support (caching only)
  if ('serviceWorker' in navigator) {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }

  // Set up version checking via SharedWorker (or Worker fallback)
  setupVersionChecking();

  console.log('Application initialized successfully');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
