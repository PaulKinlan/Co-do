/**
 * FFmpeg Adapter
 *
 * Bridges the Co-do WASM tool interface with the @ffmpeg/ffmpeg library.
 * The core WASM binary is stored in IndexedDB and loaded via blob URL.
 * The JS wrapper is code-split by Vite and loaded on first execution.
 *
 * Note: This uses the single-threaded FFmpeg core which does NOT require
 * SharedArrayBuffer or COOP/COEP headers.
 */

import type { ToolExecutionResult } from '../types';
import { WasmToolLoader } from '../loader';

/**
 * Path to the FFmpeg core JS file (Emscripten glue code), served from
 * the same origin via the wasmHashPlugin build integration.
 */
const FFMPEG_CORE_JS_PATH = 'wasm-tools/binaries/ffmpeg-core.js';

let ffmpegInstance: InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the FFmpeg instance with the stored WASM binary.
 * Uses a shared promise to deduplicate concurrent initialization calls.
 */
async function ensureInitialized(wasmBinary: ArrayBuffer): Promise<void> {
  if (ffmpegInstance) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();

      // Create a blob URL for the cached WASM binary from IndexedDB
      const wasmBlob = new Blob([wasmBinary], { type: 'application/wasm' });
      const wasmURL = URL.createObjectURL(wasmBlob);

      // Resolve the core JS path through the hash manifest for cache busting,
      // then convert to a blob URL for the FFmpeg loader
      const loader = new WasmToolLoader();
      const resolvedCoreJsUrl = await loader.resolveWasmUrl(FFMPEG_CORE_JS_PATH);
      const coreURL = await toBlobURL(resolvedCoreJsUrl, 'text/javascript');

      await ffmpeg.load({ coreURL, wasmURL });

      ffmpegInstance = ffmpeg;
    } catch (error) {
      // Reset so next call retries
      initPromise = null;
      throw error;
    }
  })();

  await initPromise;
}

/**
 * Execute an FFmpeg operation.
 *
 * @param wasmBinary - The cached WASM binary from IndexedDB
 * @param args - Tool arguments from the AI (input, inputFilename, args, outputFilename)
 */
export async function execute(
  wasmBinary: ArrayBuffer,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    await ensureInitialized(wasmBinary);
    const ffmpeg = ffmpegInstance!;

    const inputFilename = args.inputFilename as string;
    const ffmpegArgs = args.args as string;
    const outputFilename = args.outputFilename as string;

    if (!inputFilename || !ffmpegArgs || !outputFilename) {
      return {
        success: false,
        stdout: '',
        stderr: 'Missing required arguments: inputFilename, args, and outputFilename',
        exitCode: 1,
        error: 'Missing required arguments',
      };
    }

    // Get input binary
    let inputBytes: Uint8Array;
    if (args._stdinBinary instanceof Uint8Array) {
      inputBytes = args._stdinBinary;
    } else if (typeof args.input === 'string') {
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
        stderr: 'No input media provided',
        exitCode: 1,
        error: 'No input media provided',
      };
    }

    // Write input file to FFmpeg's virtual filesystem
    await ffmpeg.writeFile(inputFilename, inputBytes);

    // Parse and execute FFmpeg command
    const cmdArgs = parseFFmpegArgs(ffmpegArgs);
    const exitCode = await ffmpeg.exec(['-i', inputFilename, ...cmdArgs, outputFilename]);

    if (exitCode !== 0) {
      // Clean up
      try { await ffmpeg.deleteFile(inputFilename); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile(outputFilename); } catch { /* ignore */ }

      return {
        success: false,
        stdout: '',
        stderr: `FFmpeg exited with code ${exitCode}`,
        exitCode,
        error: `FFmpeg exited with code ${exitCode}`,
      };
    }

    // Read output file
    const outputData = await ffmpeg.readFile(outputFilename);
    const outputBytes = outputData instanceof Uint8Array
      ? outputData
      : new TextEncoder().encode(outputData as string);

    // Clean up virtual filesystem
    try { await ffmpeg.deleteFile(inputFilename); } catch { /* ignore */ }
    try { await ffmpeg.deleteFile(outputFilename); } catch { /* ignore */ }

    // Return binary output
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
 * Parse FFmpeg arguments string into an array, handling quoted strings.
 */
function parseFFmpegArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of argsStr) {
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
