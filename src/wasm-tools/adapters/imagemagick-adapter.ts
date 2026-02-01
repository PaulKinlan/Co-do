/**
 * ImageMagick Adapter
 *
 * Bridges the Co-do WASM tool interface with the @imagemagick/magick-wasm library.
 * The WASM binary is stored in IndexedDB and passed to initializeImageMagick().
 * The JS wrapper is code-split by Vite and loaded on first execution.
 */

import type { ToolExecutionResult } from '../types';
import { uint8ArrayToBase64, base64ToUint8Array, parseShellArgs } from './utils';

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
    const rawOutputFormat = args.outputFormat;
    const hasExplicitFormat =
      typeof rawOutputFormat === 'string' && rawOutputFormat.trim().length > 0;
    const outputFormatStr = ((hasExplicitFormat ? rawOutputFormat : 'png') as string).toUpperCase();

    // Resolve the output format enum (keys are title-case, e.g. "Png" → "PNG")
    const formatKey = outputFormatStr.charAt(0) + outputFormatStr.slice(1).toLowerCase();
    const resolvedFormat =
      MagickFormat[formatKey as keyof typeof MagickFormat] ?? undefined;

    if (!resolvedFormat && hasExplicitFormat) {
      const message = `Unsupported output format: "${rawOutputFormat}"`;
      return {
        success: false,
        stdout: '',
        stderr: message,
        exitCode: 1,
        error: message,
      };
    }

    const format = resolvedFormat ?? MagickFormat.Png;

    // The input binary is already decoded by convertArgsToCliFormat
    // and passed as stdinBinary. For adapter tools, we receive it in args.
    let inputBytes: Uint8Array;
    if (args._stdinBinary instanceof Uint8Array) {
      inputBytes = args._stdinBinary;
    } else if (typeof args.input === 'string') {
      // Fallback: decode base64 manually
      try {
        inputBytes = base64ToUint8Array(args.input);
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
          const cmdArgs = parseShellArgs(command);
          const skipped: string[] = [];
          const idx = { v: 0 };

          /** Consume the next argument value, returning undefined if exhausted. */
          function nextArg(): string | undefined {
            idx.v++;
            return idx.v < cmdArgs.length ? cmdArgs[idx.v] : undefined;
          }

          for (idx.v = 0; idx.v < cmdArgs.length; idx.v++) {
            const arg = cmdArgs[idx.v]!;

            switch (arg) {
              case '-resize': {
                const geometry = nextArg();
                if (geometry) {
                  const geo = new MagickGeometry(geometry);
                  image.resize(geo);
                }
                break;
              }
              case '-rotate': {
                const val = nextArg();
                image.rotate(parseFloat(val ?? '0'));
                break;
              }
              case '-flip':
                image.flip();
                break;
              case '-flop':
                image.flop();
                break;
              case '-quality': {
                const val = nextArg();
                image.quality = parseInt(val ?? '85', 10);
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
                const colorspace = nextArg();
                if (colorspace?.toLowerCase() === 'gray' || arg === '-grayscale') {
                  image.grayscale();
                }
                break;
              }
              case '-blur': {
                const blur = nextArg() ?? '0x1';
                const [radiusStr, sigmaStr] = blur.split('x');
                image.blur(parseFloat(radiusStr ?? '0'), parseFloat(sigmaStr ?? '1'));
                break;
              }
              case '-sharpen': {
                const sharpen = nextArg() ?? '0x1';
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
                skipped.push(arg);
                break;
            }
          }

          if (skipped.length > 0) {
            console.warn(`[ImageMagick] Skipped unrecognized arguments: ${skipped.join(', ')}`);
          }

          image.write(format, (data) => {
            resolve(new Uint8Array(data));
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    return {
      success: true,
      stdout: uint8ArrayToBase64(outputBytes),
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

