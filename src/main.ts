/**
 * Main entry point for the Co-do application
 */

import './styles.css';
import { UIManager } from './ui';
import { preferencesManager } from './preferences';

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

  // Register Service Worker for PWA support
  // Use import.meta.env.BASE_URL to dynamically determine the base path
  if ('serviceWorker' in navigator) {
    // Register immediately - no need to wait for 'load' event since we're already in init()
    // which runs on or after DOMContentLoaded
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    // Track update check interval to prevent resource leaks
    let updateCheckInterval: number | undefined;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);

        // Check for updates periodically (every 60 seconds)
        // Store interval ID to allow cleanup if needed
        updateCheckInterval = window.setInterval(() => {
          registration.update();
        }, 60000);

        // Listen for controller changes and reload
        // This is placed inside the registration promise to ensure it only runs after successful registration
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('Service Worker controller changed, reloading...');
          // Clean up interval before reload
          if (updateCheckInterval !== undefined) {
            clearInterval(updateCheckInterval);
          }
          window.location.reload();
        });

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available, show update notification
              console.log('New version available! Showing update notification...');

              const notification = document.getElementById('update-notification');
              const reloadBtn = document.getElementById('update-reload-btn');
              const dismissBtn = document.getElementById('update-dismiss-btn');

              if (notification && reloadBtn && dismissBtn) {
                // Show the notification
                notification.hidden = false;
                // Trigger animation after a brief delay
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    notification.classList.add('show');
                  });
                });

                // Handle reload button click
                reloadBtn.addEventListener('click', () => {
                  // Tell the new service worker to skip waiting
                  // The controllerchange event will handle the reload
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                });

                // Handle dismiss button click
                dismissBtn.addEventListener('click', () => {
                  notification.classList.remove('show');
                  // Hide after animation completes
                  setTimeout(() => {
                    notification.hidden = true;
                  }, 300);
                });
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }

  console.log('Application initialized successfully');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
