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

## Summary of Recommendations

| Approach | Addresses | CSP Impact | Effort | Recommendation |
|----------|-----------|-----------|--------|---------------|
| **Tier 1: Named providers** | #94 fully | None (curated list) | Low | **Do this first** |
| **Tier 2: Localhost** | #95 partially (Ollama) | Minimal (localhost only) | Low | **Do this first** |
| **Tier 3A: Build-time config** | #95 for self-hosters | None (compile-time) | Low | **Do this** |
| **Tier 3B: Server-only CSP** | #95 for self-hosters | None (deployment config) | Low | **Do this** |
| **Tier 3C: Remove meta tag** | Enables 3B cleanly | Slight (one fewer layer) | Trivial | **Do this if 3B is adopted** |
| **Tier 3D: Local proxy** | #95 fully | None | Medium | **Consider later** |

## Key Insight

The answer to "how to add models without loosening CSP" depends on which models:

- **Known providers:** No CSP loosening needed -- just extend the allowlist.
- **Local models:** Minimal loosening (localhost only) -- very safe.
- **Arbitrary endpoints:** Cannot be done without either (a) loosening CSP, (b) moving CSP to the deployment layer where the deployer controls it, or (c) adding a local proxy. Option (b) is the most practical.

The combination of **Tier 1 + Tier 2 + Tier 3B/C** covers the vast majority of use cases while keeping CSP strict for the hosted version and giving self-hosters the flexibility they need.
