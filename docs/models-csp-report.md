# Adding More AI Models Without Loosening CSP Restrictions

> Report addressing [Issue #94](https://github.com/ArcadeLabsInc/Co-do/issues/94) (OpenRouter) and [Issue #95](https://github.com/ArcadeLabsInc/Co-do/issues/95) (BYOLLM / custom endpoints).

## Context

**Issue #94** requests adding [OpenRouter](https://openrouter.ai) as a provider.
**Issue #95** requests BYOLLM support (Ollama, private Mistral, Azure, etc.).

## Current Architecture

Co-do is a pure client-side app with no backend. The browser makes direct API calls to AI providers using user-supplied API keys. The CSP `connect-src` directive in both `index.html` and `vite.config.ts` restricts outbound connections to exactly three domains:

```
connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com
```

The Vercel AI SDK's `createOpenAI()` already supports a `baseURL` parameter, which means OpenAI-compatible providers (OpenRouter, Azure, Ollama, Mistral, etc.) can be used with the existing SDK -- the only barrier is CSP blocking the connection.

## The Core Tension

- **Named providers** (OpenRouter, Mistral, Azure) have known, fixed API domains. Adding them to CSP is safe and straightforward.
- **Local models** (Ollama) run on `localhost` at known ports. Allowing localhost connections is a minimal CSP widening.
- **Truly arbitrary endpoints** (private servers, self-hosted instances) have unknowable URLs. Supporting them within a strict CSP is fundamentally difficult without architectural changes.

## Recommended Strategy: Three Tiers

### Tier 1 -- Add Named Providers to CSP (Addresses #94)

For providers with known, stable API domains, simply add their origins to the `connect-src` allowlist. This maintains the same level of CSP strictness -- you're just extending the curated list.

**Providers to add:**

| Provider | Domain to allowlist |
|----------|-------------------|
| OpenRouter | `https://openrouter.ai` |
| Mistral | `https://api.mistral.ai` |
| Azure OpenAI | `https://*.openai.azure.com` |
| Groq | `https://api.groq.com` |
| Together AI | `https://api.together.xyz` |
| Fireworks | `https://api.fireworks.ai` |
| DeepSeek | `https://api.deepseek.com` |
| Cohere | `https://api.cohere.com` |

**Implementation approach:**

1. All of the above are OpenAI-compatible. Use `createOpenAI({ baseURL, apiKey })` from the existing `@ai-sdk/openai` package -- no new dependencies needed.
2. Add an `openai-compatible` provider type to `AIProvider` in `src/ai.ts` that accepts a `baseURL` from a curated list.
3. Update `connect-src` in both `index.html` and `vite.config.ts`.
4. Add each provider to the UI's provider selector.

**CSP impact:** Minimal. You're adding specific, trusted HTTPS origins to a curated allowlist. This is the same security model as today, just with more entries.

**Note on wildcard subdomains:** CSP supports `https://*.openai.azure.com` syntax for Azure, but wildcard only matches one subdomain level. This is reasonable since Azure resource names are user-specific.

### Tier 2 -- Allow Localhost for Local Models (Partially Addresses #95)

For Ollama and other locally-run models, add localhost to `connect-src`:

```
connect-src 'self' http://localhost:* http://127.0.0.1:* ...existing domains...
```

**Why this is safe:**

- Connections stay on the user's own machine -- no data leaves to external servers.
- `'self'` does NOT cover different ports (Co-do runs on `:3000`, Ollama on `:11434`), so explicit localhost entries are needed.
- Localhost connections can't be intercepted by network-level attackers (no TLS downgrade risk since traffic never hits the network).

**Implementation approach:**

1. Add `http://localhost:*` and `http://127.0.0.1:*` to `connect-src` in both CSP locations.
2. Add an "Ollama" or "Local Model" provider option that uses `createOpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' })`.
3. Optionally let users configure the port in the provider settings UI.

**CSP impact:** Low. Only opens connections to the user's own machine. No external network exposure.

**CORS caveat:** Ollama enables CORS for localhost by default. Other local servers may need CORS configured. This is a documentation concern, not a CSP concern.

### Tier 3 -- Truly Arbitrary Endpoints (Fully Addresses #95)

This is the hard case. Supporting `https://my-private-server.example.com/v1` requires connecting to a domain that can't be pre-listed in CSP. There are several approaches, ranked by feasibility:

#### Option A: Build-time CSP Configuration (Recommended for self-hosters)

Allow CSP to be configured at build time via environment variables:

```typescript
// vite.config.ts
const extraConnectSrc = process.env.EXTRA_CSP_CONNECT_SRC || '';

// In CSP header:
`connect-src 'self' ${extraConnectSrc} https://api.anthropic.com ...`
```

Users who self-host Co-do can set `EXTRA_CSP_CONNECT_SRC=https://my-server.example.com` when building.

- **Pros:** No runtime CSP loosening. Self-hosters control their own security.
- **Cons:** Doesn't help users of the hosted version. Requires a rebuild per domain.

#### Option B: Production CSP at the hosting layer

The existing codebase already notes (in `vite.config.ts`) that production CSP should be configured at the hosting/CDN level. Self-hosters can set their own `Content-Security-Policy` header to include their custom domains. The meta tag in `index.html` would need to be removed or made configurable, since the meta tag CSP and the HTTP header CSP are intersected (most restrictive wins).

- **Pros:** Standard deployment practice. No code changes needed.
- **Cons:** Requires the meta tag to not conflict with server headers. Users need hosting knowledge.

#### Option C: Remove the meta tag CSP, rely solely on server headers

Move CSP entirely to the HTTP header level:

- Development: Vite config (already there).
- Production: Hosting provider config (Vercel, Netlify, Cloudflare, etc.).

Remove the CSP meta tag from `index.html`. This gives deployment-time control over CSP without code changes.

- **Pros:** Standard practice. Self-hosters get full control. Hosted version keeps strict CSP via server config.
- **Cons:** Removes the defense-in-depth of having CSP in the HTML itself.

#### Option D: Local proxy mode (Heaviest change)

Add an optional lightweight local proxy (e.g., a Node.js script or CLI tool) that users run alongside Co-do:

```bash
npx co-do-proxy --target https://my-server.example.com:8080
# Proxies requests from localhost:4000 -> my-server.example.com:8080
```

The app connects to `localhost:4000` (already allowed by Tier 2), and the proxy forwards to the actual endpoint.

- **Pros:** CSP stays strict. Works with any endpoint.
- **Cons:** Extra process for users to run. Added complexity.

## Alternative Strategy: Dynamic Per-Provider CSP

The tiered approach above adds every supported provider's domain to `connect-src` simultaneously, even though a user only talks to **one** provider at a time. As the number of supported providers grows (Tier 1 lists eight new ones), the CSP allowlist becomes increasingly broad.

A fundamentally different approach is to **restrict the CSP to only the active provider's domain**, dynamically, based on the user's selection.

### How It Works

1. **Provider registry** -- Each provider gets a globally unique ID and a record of its API endpoint URL(s). This registry lives in a shared module (`src/provider-registry.ts`) that both the server (Vite dev middleware / production edge function) and the client can import.

2. **Selection stored in a cookie** -- When the user selects a provider (setting it as default), the app writes a cookie like `co-do-provider=anthropic`. Cookies are readable by the server on every request, unlike `localStorage` or `IndexedDB`.

3. **Server sets CSP dynamically** -- On each page request, the server reads the `co-do-provider` cookie and builds the `connect-src` directive with **only** that provider's domain(s):
   - User selected Anthropic → `connect-src 'self' https://api.anthropic.com`
   - User selected OpenAI → `connect-src 'self' https://api.openai.com`
   - No cookie set (first visit) → `connect-src 'self'` (no external connections until configured)

4. **Only the selected provider's SDK is loaded** -- Instead of statically importing all three SDK packages (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`), the app uses dynamic `import()` to load only the one that matches the active provider. This reduces initial bundle size and avoids shipping SDK code for providers the user has not selected, which helps prevent accidental or implicit support for additional endpoints. Note: this is **not** a security boundary -- if CSP is bypassed, a malicious script can use `fetch`/`XMLHttpRequest`/`WebSocket` directly without any SDK. The CSP header itself is the security boundary; dynamic imports are a defense-in-depth measure for reducing the application's surface area.

5. **Meta tag CSP removed for `connect-src`** -- The `<meta>` tag CSP in `index.html` omits `connect-src` entirely (keeping all other directives). The HTTP header from the server is the sole authority for `connect-src`. This is necessary because meta tag CSP and header CSP are intersected (most restrictive wins), and the meta tag can't be dynamic.

### Provider Registry Design

```typescript
// src/provider-registry.ts
export interface ProviderDefinition {
  id: string;            // Globally unique ID, e.g. 'anthropic'
  name: string;          // Display name, e.g. 'Anthropic (Claude)'
  connectSrc: string[];  // CSP connect-src origins for this provider
  apiKeyUrl: string;     // URL where users get their API key
}

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
  // Future providers added here -- only their entry is needed:
  // openrouter: { connectSrc: ['https://openrouter.ai'], ... },
  // groq:       { connectSrc: ['https://api.groq.com'], ... },
};
```

### Server Middleware (Vite Dev)

In Vite, dev-server middleware is registered inside a plugin's `configureServer` hook:

```typescript
// vite.config.ts -- simplified but structurally correct
import { defineConfig, Plugin } from 'vite';
import { PROVIDER_REGISTRY } from './src/provider-registry';

function dynamicCspPlugin(): Plugin {
  return {
    name: 'dynamic-csp',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cookies = parseCookies(req.headers.cookie);
        const selectedProvider = cookies['co-do-provider'];
        const provider = PROVIDER_REGISTRY[selectedProvider];

        // Only allow the selected provider's domains.
        // If the cookie value doesn't match a known registry key, treat
        // it as absent -- never interpolate arbitrary values into the CSP.
        const connectSrc = provider
          ? provider.connectSrc.join(' ')
          : '';  // No provider selected = no external connections

        res.setHeader('Content-Security-Policy',
          `default-src 'self'; connect-src 'self' ${connectSrc}; ` +
          `script-src 'self'; style-src 'self' 'unsafe-inline'; ` +
          `img-src 'self' data:; font-src 'self'; object-src 'none'; ` +
          `base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
        );
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [dynamicCspPlugin()],
  // ...
});
```

### Dynamic SDK Loading

```typescript
// src/ai.ts -- only import the needed SDK
async function loadProvider(provider: string, apiKey: string, model: string) {
  switch (provider) {
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      return createAnthropic({ apiKey })(model);
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey })(model);
    }
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      return createGoogleGenerativeAI({ apiKey })(model);
    }
  }
}
```

Vite automatically code-splits dynamic imports into separate chunks. Only the chunk for the active provider is fetched.

### Benefits

- **Maximally restrictive CSP** -- At any point in time, the browser can only connect to one provider's API domain. The CSP blocks connections to every other origin, reducing the exfiltration surface to the single provider the user intentionally chose.
- **Scales to any number of providers** -- Adding a new provider means adding one entry to the registry. The CSP doesn't grow; it always contains exactly one provider's domain.
- **Smaller runtime footprint** -- Only the selected provider's SDK code is loaded. No dead code for unused providers. (This is a bundle-size and surface-area benefit, not a security boundary -- see "Security Hardening" above.)
- **Cookie is server-readable** -- Unlike `localStorage` or `IndexedDB`, the cookie is available in the HTTP request, so the server can set the correct CSP header before any JavaScript executes.
- **Graceful first-visit behavior** -- With no cookie set, `connect-src` defaults to `'self'` only. The user must configure a provider before any external connections are possible.

### Trade-offs

- **Requires server cooperation** -- The server (dev middleware or production edge function) must read the cookie and generate the CSP header. Pure static hosting without edge functions cannot do this dynamically. However, static hosts can fall back to the "all providers" approach via a static CSP header.
- **Page reload on provider switch** -- Changing the active provider updates the cookie, but the CSP header was already sent for the current page load. The user must reload (or the app reloads automatically) for the new CSP to take effect.
- **Cookie limitations** -- Cookies are sent on every request, adding a few bytes of overhead. The `co-do-provider` cookie is small (~30 bytes) and scoped to the app's path, so this is negligible.

### Security Hardening

The dynamic CSP approach introduces a new trust boundary -- the cookie value influences the CSP header. The following measures prevent this from becoming an attack vector:

1. **Validate the cookie against the registry** -- The server middleware must **only** use cookie values that match a key in `PROVIDER_REGISTRY`. If the cookie contains an unrecognised value (e.g. `https://evil.com`), the middleware must treat it as absent and fall back to `connect-src 'self'`. This is critical: blindly interpolating the cookie value into the CSP header would allow CSP injection.

   ```typescript
   // Safe: lookup returns undefined for unknown keys → no external origins
   const provider = PROVIDER_REGISTRY[selectedProvider];
   const connectSrc = provider ? provider.connectSrc.join(' ') : '';
   ```

2. **Cookie attributes** -- The cookie should be set with:
   - `SameSite=Strict` -- Prevents the cookie from being sent on cross-site requests (CSRF mitigation). Since the cookie only needs to be sent to the app's own origin, `Strict` is the right choice.
   - `Secure` -- In production (HTTPS), set the `Secure` flag so the cookie is never sent over plaintext HTTP. In development (`localhost`), browsers allow `Secure` cookies on `localhost` in modern Chrome, but omitting it for dev is also acceptable.
   - `path=/` -- Scoped to the app's path. Since Co-do is served at the root, `path=/` is appropriate.
   - `HttpOnly` is **not** used because the client-side JavaScript must be able to set and read the cookie (the cookie is written when the user changes their default provider in the UI). This is an acceptable trade-off: the cookie value is not a secret (it's just a provider ID like `anthropic`), and the server validates it against a fixed allowlist.

3. **No secret data in the cookie** -- The cookie stores only the provider ID (e.g. `anthropic`, `openai`, `google`), not API keys or other credentials. API keys remain in IndexedDB. Even if the cookie is read by a malicious script, it reveals only which provider the user has selected -- information that is already visible in the CSP header itself.

4. **Meta tag CSP as a baseline** -- Even though `connect-src` is removed from the `<meta>` tag, all other CSP directives (`script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, etc.) remain in the meta tag. This provides defense-in-depth: if the server fails to set a CSP header (misconfigured proxy, CDN stripping headers), the meta tag still enforces all non-connect directives. The worst case is that `connect-src` falls back to `default-src 'self'` from the meta tag, which blocks all external connections -- a safe failure mode.

5. **CSP is the security boundary, not SDK loading** -- Dynamic `import()` reduces the application's surface area (smaller bundle, no unused SDK code in memory), but it is not a security boundary. If CSP is bypassed, a script can use `fetch`/`XMLHttpRequest`/`WebSocket` directly. The CSP header is the enforcement mechanism; dynamic imports are a complementary defense-in-depth measure.

### Comparison to Static Allowlist

| Aspect | Static Allowlist (Tiers 1-3) | Dynamic Per-Provider CSP |
|--------|------------------------------|--------------------------|
| CSP breadth | All providers listed | Only active provider |
| Adding providers | Edit CSP in two places | Add registry entry |
| Server requirement | None (meta tag works) | Middleware or edge function |
| First-visit security | All providers reachable | No external connections |
| Bundle size | All SDKs loaded | Only active SDK loaded |
| Provider switch | Instant | Requires page reload |

### Implementation with the Tier System

This approach is **orthogonal** to the tier system. It can be combined with any tier:

- **Tier 1 providers** (OpenRouter, Groq, etc.) get registry entries with their known domains. The dynamic CSP ensures only the selected one is reachable.
- **Tier 2 localhost** providers get `http://localhost:*` in their `connectSrc`. When selected, only localhost is allowed -- not external providers.
- **Tier 3 arbitrary endpoints** can use a registry entry with the user's custom domain, set at build time or via environment variable.

## Summary of Recommendations

| Approach | Addresses | CSP Impact | Effort | Recommendation |
|----------|-----------|-----------|--------|---------------|
| **Tier 1: Named providers** | #94 fully | None (curated list) | Low | **Do this first** |
| **Tier 2: Localhost** | #95 partially (Ollama) | Minimal (localhost only) | Low | **Do this first** |
| **Tier 3A: Build-time config** | #95 for self-hosters | None (compile-time) | Low | **Do this** |
| **Tier 3B: Server-only CSP** | #95 for self-hosters | None (deployment config) | Low | **Do this** |
| **Tier 3C: Remove meta tag** | Enables 3B cleanly | Slight (one fewer layer) | Trivial | **Do this if 3B is adopted** |
| **Tier 3D: Local proxy** | #95 fully | None | Medium | **Consider later** |
| **Dynamic Per-Provider CSP** | All tiers | **Tighter** (single provider) | Medium | **Recommended alongside Tier 1+2** |

## Key Insight

The answer to "how to add models without loosening CSP" depends on which models:

- **Known providers:** No CSP loosening needed -- just extend the allowlist.
- **Local models:** Minimal loosening (localhost only) -- very safe.
- **Arbitrary endpoints:** Cannot be done without either (a) loosening CSP, (b) moving CSP to the deployment layer where the deployer controls it, or (c) adding a local proxy. Option (b) is the most practical.

The **Dynamic Per-Provider CSP** approach goes further: instead of extending the allowlist, it **narrows** it to a single provider at a time. The CSP header -- not SDK code -- is the security enforcement mechanism; dynamic SDK loading complements it by reducing the application's surface area.

The combination of **Dynamic Per-Provider CSP + Tier 1 registry entries + Tier 2 localhost** covers the vast majority of use cases with the tightest possible CSP.
