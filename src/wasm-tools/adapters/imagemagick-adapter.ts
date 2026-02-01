/**
 * ImageMagick Adapter
 *
 * Bridges the Co-do WASM tool interface with the @imagemagick/magick-wasm library.
 * The WASM binary is stored in IndexedDB and passed to initializeImageMagick().
 * The JS wrapper is code-split by Vite and loaded on first execution.
 */

import type { ToolExecutionResult } from '../types';

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the ImageMagick WASM module with the stored binary.
 * Uses a shared promise to deduplicate concurrent initialization calls.
 */
async function ensureInitialized(wasmBinary: ArrayBuffer): Promise<void> {
  if (initialized) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      const { initializeImageMagick } = await import('@imagemagick/magick-wasm');
      await initializeImageMagick(new Uint8Array(wasmBinary));
      initialized = true;
    } catch (error) {
      // Reset so next call retries
      initPromise = null;
      throw error;
    }
  })();

  await initPromise;
}

/**
 * Execute an ImageMagick operation.
 *
 * @param wasmBinary - The cached WASM binary from IndexedDB
 * @param args - Tool arguments from the AI (input, command, outputFormat)
 */
export async function execute(
  wasmBinary: ArrayBuffer,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    await ensureInitialized(wasmBinary);

    const { ImageMagick, MagickFormat, MagickGeometry } = await import('@imagemagick/magick-wasm');

    // Parse arguments
    const command = args.command as string;
    const outputFormatStr = ((args.outputFormat as string) ?? 'png').toUpperCase();

    // Resolve the output format enum (keys are title-case, e.g. "Png" → "PNG")
    const formatKey = outputFormatStr.charAt(0) + outputFormatStr.slice(1).toLowerCase();
    const format = MagickFormat[formatKey as keyof typeof MagickFormat] ?? MagickFormat.Png;

    // The input binary is already decoded by convertArgsToCliFormat
    // and passed as stdinBinary. For adapter tools, we receive it in args.
    let inputBytes: Uint8Array;
    if (args._stdinBinary instanceof Uint8Array) {
      inputBytes = args._stdinBinary;
    } else if (typeof args.input === 'string') {
      // Fallback: decode base64 manually
      try {
        const binaryStr = atob(args.input);
        inputBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          inputBytes[i] = binaryStr.charCodeAt(i);
        }
      } catch {
        return {
          success: false,
          stdout: '',
          stderr: 'Invalid base64 input data',
          exitCode: 1,
          error: 'Invalid base64 input data',
        };
      }
    } else {
      return {
        success: false,
        stdout: '',
        stderr: 'No input image provided',
        exitCode: 1,
        error: 'No input image provided',
      };
    }

    // Execute ImageMagick operations
    const outputBytes = await new Promise<Uint8Array>((resolve, reject) => {
      ImageMagick.read(inputBytes, (image) => {
        try {
          // Parse and apply command arguments
          const cmdArgs = parseCommandArgs(command);

          for (let i = 0; i < cmdArgs.length; i++) {
            const arg = cmdArgs[i]!;

            switch (arg) {
              case '-resize': {
                const geometry = cmdArgs[++i];
                if (geometry) {
                  const geo = new MagickGeometry(geometry);
                  image.resize(geo);
                }
                break;
              }
              case '-rotate': {
                const degrees = parseFloat(cmdArgs[++i] ?? '0');
                image.rotate(degrees);
                break;
              }
              case '-flip':
                image.flip();
                break;
              case '-flop':
                image.flop();
                break;
              case '-quality': {
                const quality = parseInt(cmdArgs[++i] ?? '85', 10);
                image.quality = quality;
                break;
              }
              case '-strip':
                image.strip();
                break;
              case '-negate':
                image.negate();
                break;
              case '-grayscale':
              case '-colorspace': {
                const colorspace = cmdArgs[++i];
                if (colorspace?.toLowerCase() === 'gray' || arg === '-grayscale') {
                  image.grayscale();
                }
                break;
              }
              case '-blur': {
                const blur = cmdArgs[++i] ?? '0x1';
                const [radiusStr, sigmaStr] = blur.split('x');
                const radius = parseFloat(radiusStr ?? '0');
                const sigma = parseFloat(sigmaStr ?? '1');
                image.blur(radius, sigma);
                break;
              }
              case '-sharpen': {
                const sharpen = cmdArgs[++i] ?? '0x1';
                const [sRadius, sSigma] = sharpen.split('x');
                image.sharpen(parseFloat(sRadius ?? '0'), parseFloat(sSigma ?? '1'));
                break;
              }
              case '-trim':
                image.trim();
                break;
              case '-auto-orient':
                image.autoOrient();
                break;
              default:
                // Skip unknown arguments
                break;
            }
          }

          image.write(format, (data) => {
            resolve(new Uint8Array(data));
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    // Return binary output as base64
    let base64 = '';
    const chunk = 8192;
    for (let i = 0; i < outputBytes.length; i += chunk) {
      base64 += String.fromCharCode(...outputBytes.subarray(i, i + chunk));
    }
    base64 = btoa(base64);

    return {
      success: true,
      stdout: base64,
      stderr: '',
      exitCode: 0,
      stdoutBinary: outputBytes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      stdout: '',
      stderr: message,
      exitCode: 1,
      error: message,
    };
  }
}

/**
 * Parse command-line style arguments, handling quoted strings.
 */
function parseCommandArgs(command: string): string[] {
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
