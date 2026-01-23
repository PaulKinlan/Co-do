# WebAssembly Sandboxing: Security and Performance Analysis

This document provides a deep analysis of WebAssembly sandboxing concerns and the implementation strategy for secure, performant WASM tool execution in Co-do.

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation Analysis](#current-implementation-analysis)
3. [Security Concerns](#security-concerns)
4. [Performance Concerns](#performance-concerns)
5. [Recommended Architecture](#recommended-architecture)
6. [Implementation Plan](#implementation-plan)
7. [CSP and Network Isolation](#csp-and-network-isolation)
8. [Resource Limits and Termination](#resource-limits-and-termination)

---

## Executive Summary

### Critical Issues Identified

| Category | Issue | Severity | Impact |
|----------|-------|----------|--------|
| Performance | WASM runs on main thread | **High** | UI freeze during FFmpeg-like operations |
| Security | No Worker isolation | **Medium** | WASM shares execution context with app |
| Security | Timeout doesn't terminate | **Medium** | `Promise.race` doesn't stop execution |
| Performance | No streaming compilation | **Low** | Slower initial load for large modules |

### Recommended Solution

**Web Worker-based sandboxed WASM execution** with:
- Dedicated Worker per execution (or pooled)
- Message-passing for all I/O
- `worker.terminate()` for true cancellation
- CSP enforcement at Worker level
- Memory limits via WebAssembly.Memory bounds

---

## Current Implementation Analysis

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Thread                             │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────────┐   │
│  │    UI       │◄──►│   Manager   │───►│  WasmRuntime   │   │
│  └─────────────┘    └─────────────┘    └────────────────┘   │
│                                               │              │
│                                               ▼              │
│                                        ┌────────────┐        │
│                                        │   WASM     │        │
│                                        │  Module    │        │
│                                        └────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**Problem**: Everything runs on the main thread. A long-running WASM module (e.g., FFmpeg encoding) will freeze the entire UI.

### Current Security Model

1. **WASI Syscall Restrictions** (`runtime.ts:184-206`)
   - Socket operations return `NOSYS` (not implemented)
   - Many filesystem operations return `NOSYS`
   - This is **passive security** - relies on WASI returning errors

2. **Timeout Implementation** (`runtime.ts:83-94`)
   ```typescript
   await Promise.race([executionPromise, timeoutPromise]);
   ```
   **Problem**: This doesn't actually stop WASM execution. It just stops waiting.

3. **CSP Configuration** (`vite.config.ts:145-160`)
   - `connect-src 'self' https://api.anthropic.com ...`
   - No `'unsafe-eval'` (good - WASM doesn't need it in modern browsers)
   - Workers inherit this CSP

### Current Gaps

| Gap | Current State | Risk |
|-----|---------------|------|
| Main thread execution | All WASM runs on UI thread | UI freeze |
| No real termination | Timeout races promise, doesn't stop WASM | Runaway execution |
| Shared memory context | WASM can access app globals | Information leak |
| No Worker isolation | Single execution context | Cross-tool interference |

---

## Security Concerns

### 1. Execution Context Isolation

**Current**: WASM executes in the same JavaScript context as the main application.

**Risks**:
- Timing side-channels (Spectre-like attacks)
- Potential access to shared ArrayBuffer memory
- Same origin for network requests (if we ever add networking)

**Mitigation**: Run WASM in a dedicated Web Worker.

### 2. Network Access

**Current**: WASI `sock_*` syscalls return `NOSYS`.

**Analysis**:
```typescript
sock_recv: () => WASI_ERRNO.NOSYS,
sock_send: () => WASI_ERRNO.NOSYS,
sock_shutdown: () => WASI_ERRNO.NOSYS,
sock_accept: () => WASI_ERRNO.NOSYS,
```

**Risks**:
- A malicious WASM module can't use WASI sockets, but...
- WebAssembly can call imported JavaScript functions
- If we import `fetch`, WASM could make network calls

**Mitigation**:
1. Never import `fetch` or network APIs into WASM
2. Run in Worker without network imports
3. CSP `connect-src` as last-resort defense

### 3. Memory Access

**Current**: WASM uses `WebAssembly.Memory` with no explicit limits.

**Risks**:
- Memory exhaustion attacks
- Reading beyond allocated bounds (mitigated by WASM sandboxing)

**Mitigation**:
```typescript
const memory = new WebAssembly.Memory({
  initial: 256,  // 16MB
  maximum: 512,  // 32MB - hard limit
});
```

### 4. CPU Exhaustion / Infinite Loops

**Current**: `Promise.race` with timeout.

**Problem**:
```typescript
// This doesn't stop WASM execution!
await Promise.race([executionPromise, timeoutPromise]);
```

**Mitigation**: Use `Worker.terminate()` which actually kills the execution.

### 5. File System Access

**Current**: VFS mediates access through File System Access API.

**Analysis**:
- Path traversal protection exists in VFS
- File access modes (none/read/write/readwrite) are enforced
- Permissions are checked before execution

**Status**: Adequately secured.

---

## Performance Concerns

### 1. Main Thread Blocking

**Impact Matrix**:

| Tool Type | Typical Duration | UI Impact |
|-----------|------------------|-----------|
| base64 encode | <100ms | None |
| grep (large file) | 100-500ms | Noticeable |
| sort (10MB file) | 1-5s | **Unusable** |
| FFmpeg transcode | 10-60s | **Frozen** |
| Image resize | 2-10s | **Frozen** |

**Solution**: Web Worker execution.

### 2. Compilation Strategy

**Current**:
```typescript
const module = await WebAssembly.compile(wasmBinary);
const instance = await WebAssembly.instantiate(module, imports);
```

**Better** (for Workers fetching WASM):
```typescript
// Streaming compilation - faster for large modules
const module = await WebAssembly.compileStreaming(fetch(wasmUrl));
```

**Note**: Since we load from IndexedDB (not URL), we'll use ArrayBuffer compilation with caching.

### 3. Memory Allocation

**Current**: No pre-allocation, no limits.

**Recommended**:
```typescript
// Pre-allocate reasonable memory
const memory = new WebAssembly.Memory({
  initial: 16,   // 1MB initial
  maximum: 512,  // 32MB max
  shared: false, // Not shared (isolation)
});
```

### 4. Worker Pool vs Per-Execution Workers

| Strategy | Pros | Cons |
|----------|------|------|
| **Per-execution** | Clean isolation, simple | Worker startup overhead (~5-10ms) |
| **Worker pool** | Fast reuse, amortized startup | Potential state leakage, complexity |

**Recommendation**: Start with per-execution Workers for security. Optimize to pooling only if performance is insufficient.

---

## Recommended Architecture

### New Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Main Thread                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │    UI       │◄──►│  AI/Tools   │───►│   WasmToolManager       │  │
│  └─────────────┘    └─────────────┘    └───────────┬─────────────┘  │
│                                                    │                 │
│                                          postMessage()               │
│                                                    │                 │
└────────────────────────────────────────────────────┼─────────────────┘
                                                     │
                    ┌────────────────────────────────┼──────────────────┐
                    │                    Web Worker   │                  │
                    │  ┌────────────────────────────────────────────┐   │
                    │  │           WasmSandboxWorker                │   │
                    │  │  ┌──────────────┐  ┌────────────────────┐  │   │
                    │  │  │ WasmRuntime  │  │ VirtualFileSystem  │  │   │
                    │  │  └──────┬───────┘  └────────────────────┘  │   │
                    │  │         │                                   │   │
                    │  │         ▼                                   │   │
                    │  │  ┌──────────────┐                          │   │
                    │  │  │    WASM      │  (Isolated execution)    │   │
                    │  │  │   Module     │                          │   │
                    │  │  └──────────────┘                          │   │
                    │  └────────────────────────────────────────────┘   │
                    │                                                    │
                    │  No network access, no DOM access, terminable     │
                    └────────────────────────────────────────────────────┘
```

### Message Protocol

```typescript
// Main Thread → Worker
interface WorkerRequest {
  type: 'execute';
  id: string;
  wasmBinary: ArrayBuffer;
  args: string[];
  options: ExecutionOptions;
  stdin?: string;
}

// Worker → Main Thread
interface WorkerResponse {
  type: 'result' | 'error' | 'progress';
  id: string;
  result?: ExecutionResult;
  error?: string;
  progress?: { stdout: string; stderr: string };
}
```

### File System Access Pattern

Since Workers can't access File System Access API directly, we use message passing:

```
┌──────────────┐          ┌──────────────┐
│ Main Thread  │          │   Worker     │
│              │          │              │
│  FileSystem  │◄────────►│     VFS      │
│   Access API │ messages │   (virtual)  │
└──────────────┘          └──────────────┘
```

For simplicity, files are pre-loaded into the Worker's VFS before execution, and results are sent back after completion.

---

## Implementation Plan

### Phase 1: Core Worker Implementation

1. **Create `wasm-worker.ts`**
   - Self-contained WASM execution environment
   - Includes: WasmRuntime, VFS (modified for Worker)
   - Message handling for execute/cancel

2. **Create `worker-manager.ts`**
   - Manages Worker lifecycle
   - Handles message passing
   - Implements proper termination

### Phase 2: Integration

3. **Update `manager.ts`**
   - Use WorkerManager instead of direct execution
   - Handle async results

4. **Update VFS for Worker context**
   - Pre-serialize file data for Worker transfer
   - Handle results transfer back

### Phase 3: Hardening

5. **Add CSP headers for Workers**
   - Ensure Workers can't make network requests
   - Document production CSP requirements

6. **Implement resource limits**
   - Memory limits in WebAssembly.Memory
   - True termination via Worker.terminate()

### Phase 4: Testing

7. **Test with long-running operations**
   - Verify UI remains responsive
   - Test termination works

---

## CSP and Network Isolation

### Worker CSP Inheritance

Workers inherit CSP from the parent document. Our current CSP:
```
connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com
```

### Worker Network Capabilities

By default, Workers CAN use:
- `fetch()`
- `XMLHttpRequest`
- WebSockets

**But**: We don't import these into the WASM context, and the WASI implementation doesn't provide networking.

### Defense in Depth

1. **Layer 1**: Don't import network APIs into WASM
2. **Layer 2**: WASI sock_* returns NOSYS
3. **Layer 3**: CSP limits connect-src
4. **Layer 4**: Worker isolation prevents access to main thread network state

### Production CSP Recommendations

For production hosting, configure at the web server level:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self';
  connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com;
  worker-src 'self';
  img-src 'self' data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
```

**Key additions**:
- `worker-src 'self'` - Only allow Workers from same origin
- Remove `'unsafe-inline'` from style-src in production

---

## Resource Limits and Termination

### Memory Limits

```typescript
// In Worker
const memory = new WebAssembly.Memory({
  initial: 16,    // 1MB (16 * 64KB pages)
  maximum: 512,   // 32MB maximum
});
```

For different tool categories:
| Category | Max Memory | Rationale |
|----------|-----------|-----------|
| Text processing | 32MB | grep, sort, etc. |
| Image processing | 128MB | ImageMagick-like |
| Media processing | 512MB | FFmpeg (careful!) |

### True Termination

```typescript
// In main thread
class WorkerManager {
  private worker: Worker | null = null;

  async execute(request: WorkerRequest): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.terminate();
        reject(new Error('Execution timeout'));
      }, request.options.timeout);

      this.worker = new Worker('./wasm-worker.js', { type: 'module' });
      this.worker.postMessage(request);

      this.worker.onmessage = (event) => {
        clearTimeout(timeout);
        resolve(event.data.result);
        this.worker?.terminate();
        this.worker = null;
      };
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate(); // This ACTUALLY stops execution
      this.worker = null;
    }
  }
}
```

### Resource Cleanup Checklist

- [ ] Worker terminated after each execution
- [ ] Memory released (automatic with Worker termination)
- [ ] Timeout clears on success
- [ ] Error handling doesn't leak Workers
- [ ] VFS buffers released

---

## Security Checklist

Before deploying WASM tools:

### Sandboxing
- [ ] WASM runs in Web Worker
- [ ] Worker terminable via `terminate()`
- [ ] No network APIs imported to WASM
- [ ] Memory limits configured
- [ ] Timeout actually terminates execution

### CSP
- [ ] `connect-src` limits network access
- [ ] `worker-src 'self'` configured
- [ ] No `'unsafe-eval'` (not needed for WASM)
- [ ] Production removes `'unsafe-inline'`

### Permissions
- [ ] User approval before execution
- [ ] File access permissions enforced
- [ ] Built-in vs user tools distinguished

### Input Validation
- [ ] Tool manifest validated (Zod schema)
- [ ] WASM binary size limited (20MB)
- [ ] ZIP extraction limits enforced
- [ ] Path traversal prevented in VFS

---

## Conclusion

The current implementation has solid foundations (WASI restrictions, permissions, CSP) but lacks critical performance and security features:

1. **Must have**: Web Worker execution to prevent UI blocking
2. **Must have**: True termination via `Worker.terminate()`
3. **Should have**: Memory limits per tool category
4. **Should have**: Worker pooling for performance (future)

The recommended architecture maintains security while enabling long-running tools like FFmpeg to execute without freezing the UI.
