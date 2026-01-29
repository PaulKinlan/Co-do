/**
 * Client-side Provider Registry
 *
 * Re-exports the provider registry from server/providers.ts and adds
 * client-side cookie utilities for setting/reading the provider selection.
 *
 * The cookie is read by the server (Deno or Vite) to build a per-request
 * CSP header that restricts connect-src to only the selected provider.
 */

// Re-export server-side registry for client use
export {
  PROVIDER_REGISTRY,
  PROVIDER_COOKIE_NAME,
  PROVIDER_COOKIE_MAX_AGE,
  type ProviderDefinition,
} from '../server/providers';

import {
  PROVIDER_REGISTRY,
  PROVIDER_COOKIE_NAME,
  PROVIDER_COOKIE_MAX_AGE,
  parseCookies,
} from '../server/providers';

/**
 * Set the provider cookie on the client side.
 *
 * Uses SameSite=Strict for security and a 1-year expiry.
 * In production (HTTPS), the Secure flag is also set.
 *
 * The cookie value is validated against PROVIDER_REGISTRY to prevent
 * setting invalid values that could affect the server-side CSP generation.
 *
 * If the provider changes, the page is reloaded to pick up the new CSP
 * header from the server.
 *
 * @param providerId - The provider ID (e.g. 'anthropic', 'openai', 'google')
 * @param skipReload - If true, don't reload even if provider changed (for initial page load)
 */
export function setProviderCookie(providerId: string, skipReload = false): void {
  // Only set cookie for known providers to prevent any injection
  if (!PROVIDER_REGISTRY[providerId]) {
    console.warn(`Unknown provider ID "${providerId}" -- not setting cookie`);
    return;
  }

  // Check if the provider is actually changing
  const currentProvider = getProviderCookie();
  const isChanging = currentProvider !== undefined && currentProvider !== providerId;

  const isSecure = globalThis.location?.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';

  document.cookie =
    `${PROVIDER_COOKIE_NAME}=${encodeURIComponent(providerId)}; ` +
    `path=/; SameSite=Strict; max-age=${PROVIDER_COOKIE_MAX_AGE}${secureFlag}`;

  // Reload if provider changed to pick up new CSP header
  if (isChanging && !skipReload) {
    // Small delay to ensure cookie is written before reload
    setTimeout(() => {
      globalThis.location.reload();
    }, 100);
  }
}

/**
 * Read the current provider cookie value on the client side.
 *
 * @returns The provider ID string, or undefined if not set.
 */
export function getProviderCookie(): string | undefined {
  const cookies = parseCookies(document.cookie);
  return cookies[PROVIDER_COOKIE_NAME] || undefined;
}
