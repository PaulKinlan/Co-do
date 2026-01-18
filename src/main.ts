/**
 * Main entry point for the Co-do application
 */

import './styles.css';
import { UIManager } from './ui';

// Initialize the application
function init() {
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
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
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
