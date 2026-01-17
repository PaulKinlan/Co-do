/**
 * PWA Service Worker Registration and Update Handling
 */

import { registerSW } from 'virtual:pwa-register';

/**
 * Register and manage the service worker with automatic updates
 */
export function initializePWA(): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Show a notification to the user that an update is available
      showUpdateNotification(updateSW);
    },
    onOfflineReady() {
      console.log('App is ready to work offline');
      showOfflineNotification();
    },
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      console.log('Service Worker registered', registration);
    },
    onRegisterError(error: Error) {
      console.error('Service Worker registration error', error);
    }
  });

  // Check for updates periodically (every hour)
  setInterval(() => {
    updateSW();
  }, 60 * 60 * 1000);
}

/**
 * Show notification when app update is available
 */
function showUpdateNotification(updateSW: () => Promise<void>): void {
  const notification = document.createElement('div');
  notification.id = 'pwa-update-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #2563eb;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 400px;
  `;

  notification.innerHTML = `
    <div style="flex: 1;">
      <div style="font-weight: 600; margin-bottom: 4px;">Update Available</div>
      <div style="font-size: 14px; opacity: 0.95;">A new version of Co-do is available</div>
    </div>
    <button id="pwa-update-btn" style="
      background: white;
      color: #2563eb;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
    ">Update</button>
    <button id="pwa-dismiss-btn" style="
      background: transparent;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.5);
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
    ">Later</button>
  `;

  document.body.appendChild(notification);

  // Handle update button click
  const updateBtn = document.getElementById('pwa-update-btn');
  updateBtn?.addEventListener('click', async () => {
    notification.remove();
    await updateSW();
    window.location.reload();
  });

  // Handle dismiss button click
  const dismissBtn = document.getElementById('pwa-dismiss-btn');
  dismissBtn?.addEventListener('click', () => {
    notification.remove();
  });
}

/**
 * Show notification when app is ready for offline use
 */
function showOfflineNotification(): void {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">Ready for Offline Use</div>
    <div style="font-size: 14px; opacity: 0.95;">Co-do is now available offline</div>
  `;

  document.body.appendChild(notification);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

/**
 * Check if the app is running in standalone mode (installed as PWA)
 */
export function isInstalledPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

/**
 * Show install prompt for PWA
 */
export function setupInstallPrompt(): void {
  let deferredPrompt: any;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser install prompt
    e.preventDefault();
    deferredPrompt = e;

    // Show custom install button
    showInstallButton(deferredPrompt);
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    deferredPrompt = null;
    hideInstallButton();
  });
}

/**
 * Show custom install button
 */
function showInstallButton(deferredPrompt: any): void {
  if (isInstalledPWA()) {
    return; // Already installed
  }

  const installBtn = document.createElement('button');
  installBtn.id = 'pwa-install-btn';
  installBtn.textContent = 'Install App';
  installBtn.className = 'primary-btn';
  installBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 1000;
  `;

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to the install prompt: ${outcome}`);

    // Clear the deferredPrompt
    deferredPrompt = null;
    installBtn.remove();
  });

  document.body.appendChild(installBtn);
}

/**
 * Hide install button
 */
function hideInstallButton(): void {
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.remove();
  }
}
