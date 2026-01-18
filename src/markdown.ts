/**
 * Markdown Renderer - Renders markdown content in a sandboxed iframe
 */

import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
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

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #1A1A1A;
      padding: 0;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }

    @media (prefers-color-scheme: dark) {
      body {
        color: #F5F5F5;
      }

      code {
        background: #3A3A3A;
      }

      pre {
        background: #2A2A2A;
        border-color: #3A3A3A;
      }

      blockquote {
        border-color: #5B7C99;
        background: #2A2A2A;
      }

      a {
        color: #7A9CB8;
      }

      table th {
        background: #3A3A3A;
      }

      table td, table th {
        border-color: #3A3A3A;
      }

      hr {
        border-color: #3A3A3A;
      }
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
      background: #FAFAFA;
      color: #6B6B6B;
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
  <style>${getMarkdownStyles()}</style>
</head>
<body>${html}</body>
</html>`;
}

/**
 * Create a sandboxed iframe for rendering markdown
 */
export function createMarkdownIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.className = 'markdown-iframe';
  iframe.sandbox.add('allow-same-origin'); // Needed for height calculation
  iframe.setAttribute('title', 'Markdown content');
  return iframe;
}

/**
 * Update the content of a markdown iframe
 */
export function updateMarkdownIframe(iframe: HTMLIFrameElement, content: string): void {
  const doc = createIframeDocument(content);

  // Use srcdoc for sandboxed content
  iframe.srcdoc = doc;

  // Adjust iframe height after content loads
  iframe.onload = () => {
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
