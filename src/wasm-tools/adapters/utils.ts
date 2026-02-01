/**
 * Shared utilities for WASM tool adapters.
 *
 * Consolidates common operations (base64 encoding/decoding, command parsing)
 * that would otherwise be duplicated across adapter modules.
 */

/**
 * Encode a Uint8Array to a base64 string.
 *
 * Processes in 8 KiB chunks to avoid blowing the call-stack limit of
 * `String.fromCharCode` when dealing with large binaries.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let raw = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    raw += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(raw);
}

/**
 * Decode a base64 string to a Uint8Array.
 *
 * Throws if the input is not valid base64.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse a command-line style string into an array of arguments,
 * handling single and double quoted strings.
 */
export function parseShellArgs(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of command) {
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === ' ' || char === '\t') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}
