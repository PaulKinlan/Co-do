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

  console.log('Application initialized successfully');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
