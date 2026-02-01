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
import { uint8ArrayToBase64, base64ToUint8Array, parseShellArgs } from './utils';

/**
 * Path to the FFmpeg core JS file (Emscripten glue code), served from
 * the same origin via the wasmHashPlugin build integration.
 */
const FFMPEG_CORE_JS_PATH = 'wasm-tools/binaries/ffmpeg-core.js';

let ffmpegInstance: InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg> | null = null;
let initPromise: Promise<void> | null = null;
let wasmBlobURL: string | null = null;

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

      // Create a blob URL for the cached WASM binary from IndexedDB.
      // Store it so we can revoke it on failure to prevent memory leaks.
      const wasmBlob = new Blob([wasmBinary], { type: 'application/wasm' });
      wasmBlobURL = URL.createObjectURL(wasmBlob);

      // Resolve the core JS path through the hash manifest for cache busting,
      // then convert to a blob URL for the FFmpeg loader
      const loader = new WasmToolLoader();
      const resolvedCoreJsUrl = await loader.resolveWasmUrl(FFMPEG_CORE_JS_PATH);
      const coreURL = await toBlobURL(resolvedCoreJsUrl, 'text/javascript');

      await ffmpeg.load({ coreURL, wasmURL: wasmBlobURL });

      // Revoke the WASM blob URL after successful loading to free memory
      URL.revokeObjectURL(wasmBlobURL);
      wasmBlobURL = null;

      ffmpegInstance = ffmpeg;
    } catch (error) {
      // Revoke blob URL on failure to prevent memory leaks
      if (wasmBlobURL) {
        URL.revokeObjectURL(wasmBlobURL);
        wasmBlobURL = null;
      }
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
        stderr: 'No input media provided',
        exitCode: 1,
        error: 'No input media provided',
      };
    }

    // Write input file to FFmpeg's virtual filesystem
    await ffmpeg.writeFile(inputFilename, inputBytes);

    // Parse and execute FFmpeg command
    const cmdArgs = parseShellArgs(ffmpegArgs);
    const exitCode = await ffmpeg.exec(['-i', inputFilename, ...cmdArgs, outputFilename]);

    if (exitCode !== 0) {
      // Clean up
      try { await ffmpeg.deleteFile(inputFilename); } catch (e) { console.debug('FFmpeg cleanup (input):', e); }
      try { await ffmpeg.deleteFile(outputFilename); } catch (e) { console.debug('FFmpeg cleanup (output):', e); }

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
    try { await ffmpeg.deleteFile(inputFilename); } catch (e) { console.debug('FFmpeg cleanup (input):', e); }
    try { await ffmpeg.deleteFile(outputFilename); } catch (e) { console.debug('FFmpeg cleanup (output):', e); }

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

