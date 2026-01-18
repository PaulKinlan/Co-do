/**
 * Main entry point for the Co-do application
 */

import './styles.css';
import { UIManager } from './ui';
import { preferencesManager } from './preferences';

// Version checking constants
const VERSION_STORAGE_KEY = 'co-do-app-version';
const VERSION_CHECK_INTERVAL = 60000; // 60 seconds

interface VersionInfo {
  version: string;
  buildTime: string;
}

/**
 * Fetches the current version from the server
 * Uses cache-busting to ensure we always get the latest version
 */
async function fetchVersion(): Promise<VersionInfo | null> {
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`,
      {
        cache: 'no-store',
      }
    );
    if (!response.ok) {
      console.warn('Failed to fetch version.json:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('Error fetching version:', error);
    return null;
  }
}

/**
 * Shows the update notification to the user
 */
function showUpdateNotification(): void {
  const notification = document.getElementById('update-notification');
  const reloadBtn = document.getElementById('update-reload-btn');
  const dismissBtn = document.getElementById('update-dismiss-btn');

  if (notification && reloadBtn && dismissBtn) {
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
 * Checks for application updates by comparing version.json
 */
async function checkForUpdates(): Promise<void> {
  console.log('Checking for application updates...');

  const serverVersion = await fetchVersion();
  if (!serverVersion) {
    return; // Couldn't fetch version, try again later
  }

  // Skip update checks in development mode
  if (serverVersion.version === 'development') {
    console.log('Development mode - skipping version check');
    return;
  }

  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

  if (!storedVersion) {
    // First visit or cleared storage - store current version
    localStorage.setItem(VERSION_STORAGE_KEY, serverVersion.version);
    console.log('Stored initial version:', serverVersion.version);
    return;
  }

  if (storedVersion !== serverVersion.version) {
    console.log(`New version available! Current: ${storedVersion}, New: ${serverVersion.version}`);
    showUpdateNotification();
  }
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

  // Set up version-based update checking
  // Check for updates periodically
  setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);

  // Check when page becomes visible (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdates();
    }
  });

  // Check immediately on load
  checkForUpdates();

  console.log('Application initialized successfully');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
