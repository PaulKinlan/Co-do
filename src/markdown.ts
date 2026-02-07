/**
 * Markdown Renderer - Renders markdown content in a sandboxed iframe
 */

import { marked, type Renderer } from 'marked';

/**
 * Escape raw HTML to prevent it from being rendered as actual DOM elements.
 * This is critical for the sandboxed iframe: raw HTML in markdown (e.g. <script> tags
 * from AI responses) must be escaped to avoid "Blocked script execution" errors.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Configure marked for safe rendering with raw HTML escaped
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
});

// Override the html renderer to escape raw HTML instead of passing it through.
// This prevents <script>, <iframe>, event handlers, etc. from being injected
// into the sandboxed markdown iframes.
marked.use({
  renderer: {
    html({ text }: { text: string }): string {
      return escapeHtml(text);
    },
  } as Partial<Renderer>,
});

/**
 * Get the base styles for the markdown iframe content
 */
function getMarkdownStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      background: transparent;
      color-scheme: dark light;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #1A1A1A;
      background: transparent;
      padding: 0;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }

    p {
      margin-bottom: 1em;
    }

    p:last-child {
      margin-bottom: 0;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
    }

    h1:first-child, h2:first-child, h3:first-child,
    h4:first-child, h5:first-child, h6:first-child {
      margin-top: 0;
    }

    h1 { font-size: 1.5em; }
    h2 { font-size: 1.3em; }
    h3 { font-size: 1.15em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.9em; }
    h6 { font-size: 0.85em; }

    code {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.875em;
      background: #F5F5F5;
      color: #1A1A1A;
      padding: 0.2em 0.4em;
      border-radius: 4px;
    }

    pre {
      background: #F5F5F5;
      border: 1px solid #E5E5E5;
      border-radius: 6px;
      padding: 1em;
      overflow-x: auto;
      margin: 1em 0;
    }

    pre code {
      background: none;
      padding: 0;
      font-size: 0.85em;
    }

    blockquote {
      border-left: 4px solid #D97757;
      margin: 1em 0;
      padding: 0.5em 1em;
      background: #F5F5F5;
      color: #555555;
    }

    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }

    li {
      margin-bottom: 0.25em;
    }

    li:last-child {
      margin-bottom: 0;
    }

    a {
      color: #D97757;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    table th, table td {
      border: 1px solid #E5E5E5;
      padding: 0.5em 1em;
      text-align: left;
    }

    table th {
      background: #FAFAFA;
      font-weight: 600;
    }

    hr {
      border: none;
      border-top: 1px solid #E5E5E5;
      margin: 1.5em 0;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    strong {
      font-weight: 600;
    }

    em {
      font-style: italic;
    }

    /* Scrollbar styling for light mode */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: #E5E5E5;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #999999;
    }

    /* Standard scrollbar properties */
    * {
      scrollbar-width: thin;
      scrollbar-color: #E5E5E5 transparent;
    }

    /* Dark mode overrides - must come after all base styles for proper cascade */
    @media (prefers-color-scheme: dark) {
      html {
        background: #2a2725;
      }

      body {
        color: #F5F5F5;
      }

      code {
        background: #3A3633;
        color: #E8E8E8;
      }

      pre {
        background: #2A2725;
        border-color: rgba(255, 255, 255, 0.08);
        color: #D4D4D4;
      }

      pre code {
        color: #D4D4D4;
      }

      blockquote {
        border-color: #D97757;
        background: #302D2B;
        color: #CCCCCC;
      }

      a {
        color: #E8A48C;
      }

      a:hover {
        color: #F0BDA8;
      }

      table th {
        background: #3A3633;
        color: #F5F5F5;
      }

      table td {
        color: #E8E8E8;
      }

      table td, table th {
        border-color: rgba(255, 255, 255, 0.1);
      }

      hr {
        border-color: rgba(255, 255, 255, 0.1);
      }

      strong {
        color: #FFFFFF;
      }

      h1, h2, h3, h4, h5, h6 {
        color: #FFFFFF;
      }

      ::-webkit-scrollbar-thumb {
        background: #4A4A4A;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #666666;
      }

      * {
        scrollbar-color: #4A4A4A transparent;
      }
    }
  `;
}

/**
 * Create an HTML document for the iframe with the given markdown content
 */
function createIframeDocument(markdownContent: string): string {
  const html = marked.parse(markdownContent) as string;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <style>${getMarkdownStyles()}</style>
</head>
<body>${html}</body>
</html>`;
}

/**
 * Create a sandboxed iframe for rendering markdown
 *
 * SECURITY CRITICAL: This iframe uses `allow-same-origin` for height calculation.
 * NEVER add `allow-scripts` to this sandbox. The combination of `allow-same-origin`
 * and `allow-scripts` allows the iframe content to remove its own sandbox attribute,
 * completely bypassing all sandbox protections. This would enable XSS attacks via
 * malicious markdown content from the LLM.
 *
 * Current sandbox: allow-same-origin (ONLY)
 * - Allows JavaScript in parent to access iframe.contentDocument for height calculation
 * - Does NOT allow scripts to execute inside the iframe
 * - Does NOT allow form submission, popups, or other dangerous actions
 */
export function createMarkdownIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.className = 'markdown-iframe';
  // SECURITY: Only allow-same-origin, NEVER allow-scripts (see function comment)
  iframe.sandbox.add('allow-same-origin');
  iframe.setAttribute('title', 'Markdown content');
  return iframe;
}

/**
 * Update the content of a markdown iframe
 * Uses direct DOM update when possible to prevent flickering during streaming
 */
export function updateMarkdownIframe(iframe: HTMLIFrameElement, content: string): void {
  const html = marked.parse(content) as string;

  // Only use direct DOM update if iframe has been initialized with styles
  // This prevents unstyled content and race conditions during initial load
  if (iframe.dataset.initialized === 'true') {
    try {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc && iframeDoc.body) {
        iframeDoc.body.innerHTML = html;
        adjustIframeHeight(iframe);
        return;
      }
    } catch {
      // If we can't access contentDocument, fall back to srcdoc
    }
  }

  // Initial load or fallback: use srcdoc for sandboxed content with styles
  const doc = createIframeDocument(content);
  iframe.srcdoc = doc;

  // Mark iframe as initialized after styles are loaded
  iframe.onload = () => {
    iframe.dataset.initialized = 'true';
    adjustIframeHeight(iframe);
  };
}

/**
 * Adjust iframe height to match content
 */
function adjustIframeHeight(iframe: HTMLIFrameElement): void {
  try {
    const doc = iframe.contentDocument;
    if (doc && doc.body) {
      const height = doc.body.scrollHeight;
      iframe.style.height = `${height}px`;
    }
  } catch {
    // If we can't access content, use a default height
    iframe.style.height = 'auto';
  }
}

/**
 * Parse markdown to HTML string (for use outside of iframe context)
 */
export function parseMarkdown(content: string): string {
  return marked.parse(content) as string;
}

/**
 * Check if iframe content exceeds a given max height
 * Returns true if content is taller than maxHeight
 */
export function checkContentOverflow(iframe: HTMLIFrameElement, maxHeight: number): boolean {
  try {
    const doc = iframe.contentDocument;
    if (doc && doc.body) {
      const height = doc.body.scrollHeight;
      return height > maxHeight;
    }
  } catch {
    // If we can't access content, assume no overflow
  }
  return false;
}
