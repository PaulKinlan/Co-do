/**
 * AI Provider Registry
 *
 * Single source of truth for provider metadata, shared by:
 * - server/main.ts  (Deno Deploy production server)
 * - server/csp.ts   (CSP header building)
 * - vite.config.ts  (Vite development server)
 * - src/provider-registry.ts (client-side cookie utilities)
 *
 * Each provider entry defines the CSP connect-src origins required for that
 * provider's API.  The dynamic CSP system uses this to restrict outbound
 * connections to only the user's selected provider.
 */

export interface ProviderDefinition {
  /** Globally unique identifier (stored in the provider cookie). */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** CSP connect-src origins required by this provider. */
  connectSrc: string[];
  /** URL where the user can obtain an API key. */
  apiKeyUrl: string;
}

/**
 * Name of the cookie that stores the active provider ID.
 * Readable by the server to set a per-provider CSP header.
 */
export const PROVIDER_COOKIE_NAME = 'co-do-provider';

/**
 * Max-age for the provider cookie (1 year in seconds).
 */
export const PROVIDER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Registry of all known providers, keyed by their unique ID.
 *
 * To add a new provider:
 * 1. Add an entry here with the correct connectSrc domains.
 * 2. Add the provider's models to AVAILABLE_MODELS in src/ai.ts.
 * 3. Add a case to the dynamic import switch in AIManager.getProvider().
 * 4. Add the provider value to the AIProvider type in src/ai.ts.
 */
export const PROVIDER_REGISTRY: Record<string, ProviderDefinition> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    connectSrc: ['https://api.anthropic.com'],
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT)',
    connectSrc: ['https://api.openai.com'],
    apiKeyUrl: 'https://platform.openai.com/api-keys',
  },
  google: {
    id: 'google',
    name: 'Google (Gemini)',
    connectSrc: ['https://generativelanguage.googleapis.com'],
    apiKeyUrl: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    connectSrc: ['https://openrouter.ai'],
    apiKeyUrl: 'https://openrouter.ai/keys',
  },
};

/**
 * Build the connect-src value for a given provider ID.
 *
 * @param providerId - The provider ID from the cookie, or undefined for first-visit.
 * @returns A string suitable for the connect-src CSP directive.
 *          Always includes 'self'. If the provider is unknown or absent,
 *          no external origins are included (maximum restriction).
 */
export function buildConnectSrc(providerId: string | undefined): string {
  if (!providerId) {
    return "'self'";
  }

  const provider = PROVIDER_REGISTRY[providerId];
  if (!provider) {
    // Unknown provider ID -- treat as absent to prevent CSP injection
    return "'self'";
  }

  return ["'self'", ...provider.connectSrc].join(' ');
}

/**
 * Parse a cookie header string into a key→value map.
 * Works in both Node.js (Vite) and Deno (server).
 */
export function parseCookies(
  cookieHeader: string | null | undefined,
): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const pair of cookieHeader.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}
