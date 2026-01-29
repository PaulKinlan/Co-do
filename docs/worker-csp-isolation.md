# Worker CSP Isolation - Future Enhancement

## Problem

Currently, WASM workers inherit the CSP from the parent document. This means:

- If the parent document allows `connect-src https://api.anthropic.com`, workers can also make requests there
- Workers only need filesystem access and computation - they should NOT need network access
- A compromised or malicious WASM tool could potentially exfiltrate data via the network

## Current Behavior

Dedicated Workers (`new Worker()`) inherit their CSP from the document that created them:

```
Parent Document CSP:
  connect-src 'self' https://api.anthropic.com

Worker inherits same CSP:
  connect-src 'self' https://api.anthropic.com  (UNDESIRED - worker shouldn't need network)
```

The CSP header on the worker script response is ignored by browsers for dedicated workers.

## Desired Behavior

Workers should have NO network access:

```
Worker CSP:
  connect-src 'none'  (or just 'self' for same-origin only)
```

## Potential Solutions

### 1. Double Worker / Iframe Sandwich

Similar to the iframe sandbox pattern:

1. Create a sandboxed iframe with restrictive CSP (`connect-src 'none'`)
2. The iframe creates the actual worker
3. Worker inherits the iframe's restrictive CSP
4. Communicate with the iframe via `postMessage`

```
Main Document                    Sandboxed Iframe              Worker
     |                                  |                         |
     |---postMessage (run tool)-------->|                         |
     |                                  |---creates worker------->|
     |                                  |<--postMessage (result)--|
     |<--postMessage (result)-----------|                         |
```

Iframe would have:
```html
<iframe sandbox="allow-scripts"
        csp="default-src 'none'; script-src 'self'; worker-src 'self'">
```

### 2. Service Worker Interception

Use a Service Worker to intercept and block fetch requests from WASM workers:

1. Register a Service Worker
2. In the worker, intercept all fetch events
3. Check the request origin - block if from a WASM worker context
4. Allow only same-origin requests or block all external

Drawback: More complex, requires Service Worker registration.

### 3. Blob URL Workers with Inline CSP

Create workers from Blob URLs that include restrictive CSP directives in a wrapper.

Drawback: CSP on Blob URL responses may not be honored.

## Recommendation

**Option 1 (Iframe Sandwich)** is the most reliable approach because:

- Iframes with `sandbox` attribute have well-defined CSP inheritance
- The `csp` attribute on iframes (CSP Embedded Enforcement) allows setting CSP for iframe content
- Browser support is good for the sandbox approach
- Similar pattern is used for secure sandboxing in other contexts

## Implementation Notes

- The iframe would need to be invisible (`display: none` or positioned off-screen)
- Communication overhead via `postMessage` is minimal
- May need to handle iframe creation/destruction lifecycle
- Consider pooling iframes for performance

## References

- [CSP for Workers - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#csp_and_web_workers)
- [Iframe sandbox attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox)
- [CSP Embedded Enforcement](https://www.w3.org/TR/csp-embedded-enforcement/)

## Priority

Medium - The current setup is functional and WASM tools are user-installed with consent. However, defense-in-depth suggests limiting worker network access to prevent potential data exfiltration from compromised tools.
