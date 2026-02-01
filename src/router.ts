/**
 * Hash-based workspace router
 *
 * Maps workspace UUIDs to URL hashes for bookmarkable workspace URLs.
 * Format: https://example.com/#<workspace-uuid>
 */

/**
 * Read the workspace ID from the current URL hash.
 * Returns null if no valid UUID is present.
 */
export function getWorkspaceIdFromUrl(): string | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;

  // Validate UUID v4 format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hash)) {
    return hash;
  }

  return null;
}

/**
 * Set the workspace ID in the URL hash.
 * Uses replaceState to avoid polluting browser history.
 */
export function setWorkspaceIdInUrl(id: string): void {
  history.replaceState(null, '', `#${id}`);
}

/**
 * Remove the workspace ID from the URL hash.
 */
export function clearWorkspaceIdFromUrl(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
