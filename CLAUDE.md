# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Co-do is a Cowork-like experience in the browser using the File System Access API. This project enables collaborative coding and file editing directly in the browser with native filesystem integration.

> **IMPORTANT: Always run `npm test` after making code changes.** Tests must pass before committing.
>
> **Exception:** Tests do not need to be run for documentation-only changes (`.md` files, comments, etc.) that don't affect application behavior.

## Browser Support

**Target: Latest Chrome (Chrome 140+)**

This project relies on the File System Access API, which is currently best supported in Chromium-based browsers. This means:

- Use all modern web platform APIs without concern for legacy browser support
- No polyfills required for modern JavaScript features
- Chrome-specific APIs are acceptable when they provide better functionality
- Focus on Baseline Newly Available and Baseline Widely Available features
- The File System Access API is the core dependency (Chrome 86+, Edge 86+, limited Safari support)

When implementing features, always use modern browser APIs as documented in `.claude/skills/modern-web-dev/SKILL.md`. Use the code review skills documented in the "Code Review Skills" section below before committing code.

## Development Commands

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts the Vite development server on http://localhost:3000

### Build

```bash
npm run build
```

Full production build: compiles WASM tools, runs TypeScript, and bundles with Vite. Output goes to `dist/` including WASM binaries.

```bash
npm run build:web-only
```

Build without WASM compilation (TypeScript + Vite only). Useful when WASM tools haven't changed.

### Type Checking

```bash
npm run type-check
```

Runs TypeScript type checking without emitting files.

### Preview

```bash
npm run preview
```

Preview the production build locally.

### Testing

```bash
npm test
```

Runs all Playwright tests (visual regression and accessibility).

```bash
npm run test:visual
```

Runs only visual regression tests to detect UI changes.

```bash
npm run test:accessibility
```

Runs only accessibility tests (WCAG 2.1 Level AA compliance, color contrast, etc.).

```bash
npm run test:visual:update
```

Updates baseline screenshots for visual regression tests. Run this when you intentionally change UI appearance.

```bash
npm run test:unit
```

Runs unit tests with Vitest (pure function tests, pipe logic, etc.).

```bash
npm run test:unit:watch
```

Runs unit tests in watch mode for development.

```bash
npm run test:ui
```

Opens the Playwright UI mode for interactive test debugging.

```bash
npm run test:debug
```

Runs tests in debug mode with the Playwright Inspector.

```bash
npm run test:report
```

Opens the HTML test report after a test run.

### WASM Tools

```bash
npm run wasm:build
```

Build all WASM tools from C/WASI source (requires wasi-sdk).

```bash
npm run wasm:build:native
```

Build native-only WASM tools (no wasi-sdk required).

## Project Structure

```
Co-do/
├── src/
│   ├── main.ts               # Entry point, PWA init, version checking
│   ├── ui.ts                  # UI manager, event handlers, conversations, permissions UI
│   ├── ai.ts                  # AI SDK integration (streaming, multi-provider, dynamic import)
│   ├── tools.ts               # 20 file operation tools + pipe command
│   ├── pipeable.ts            # Self-registering pipeable command registry
│   ├── fileSystem.ts          # File System Access API wrapper with caching
│   ├── preferences.ts         # Tool permissions (ToolName type, permission levels)
│   ├── storage.ts             # IndexedDB manager (configs, conversations, WASM tools, directory handles)
│   ├── diff.ts                # Unified diff generation (LCS algorithm)
│   ├── markdown.ts            # Markdown rendering in sandboxed iframes (XSS protection)
│   ├── toasts.ts              # Toast notification system
│   ├── notifications.ts       # Native browser notifications (Notifications API)
│   ├── viewTransitions.ts     # View Transitions API integration
│   ├── provider-registry.ts   # Provider cookie management + CSP coordination
│   ├── tool-response-format.ts # Pure functions for tool response formatting (escapeHtml, etc.)
│   ├── toolResultCache.ts     # Caching for large tool outputs (>2KB → summary to AI, full to UI)
│   ├── styles.css             # CSS with custom properties for dark mode theming
│   └── wasm-tools/            # WebAssembly custom tools system
│       ├── manager.ts         # Central tool orchestrator (load, execute, permissions)
│       ├── runtime.ts         # WASI runtime for main-thread execution (fallback)
│       ├── wasm-worker.ts     # Worker-based WASM runtime (default, sandboxed)
│       ├── worker-manager.ts  # Worker lifecycle and pooling
│       ├── vfs.ts             # Virtual file system for WASM (WASI syscall interception)
│       ├── loader.ts          # ZIP package loader and manifest validator
│       ├── registry.ts        # Built-in tool configuration (41 tools by category)
│       ├── types.ts           # TypeScript interfaces and Zod schemas
│       ├── worker-types.ts    # Worker message protocol types
│       ├── index.ts           # Public API exports
│       └── adapters/          # Non-WASI tool adapters (FFmpeg, ImageMagick)
├── server/
│   ├── main.ts                # Vite server plugins entry
│   ├── providers.ts           # Provider registry and cookie parsing
│   └── csp.ts                 # Dynamic CSP header generation per provider
├── tests/
│   ├── visual/                # Visual regression tests (screenshots)
│   │   ├── ui-components.spec.ts
│   │   ├── dark-mode.spec.ts
│   │   ├── tool-responses.spec.ts
│   │   └── button-styling.spec.ts
│   ├── accessibility/         # WCAG 2.1 Level AA compliance tests
│   │   └── wcag-compliance.spec.ts
│   ├── unit/                  # Unit tests (Vitest)
│   │   ├── tool-response-format.test.ts
│   │   └── pipe.test.ts
│   └── helpers/               # Test utilities
│       ├── test-utils.ts
│       └── dom-inspector.ts
├── docs/
│   ├── WASM-SANDBOXING-ANALYSIS.md  # Security deep-dive on WASM isolation
│   ├── WASM-TOOLS-PLAN.md          # Implementation architecture for WASM tools
│   ├── WASM-TOOLS-LIST.md          # Catalog of 80+ potential WASM tools
│   ├── models-csp-report.md        # CSP strategy for AI provider SDK loading
│   └── worker-csp-isolation.md     # Worker CSP isolation details
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker (cache-first for assets, network-only for APIs)
│   ├── icon.svg               # App icon (SVG source)
│   ├── icon-192.png           # PWA icon (192px)
│   └── icon-512.png           # PWA icon (512px)
├── wasm-tools/
│   ├── src/                   # C/WASI source for built-in tools
│   ├── manifests/             # Tool manifest definitions (JSON)
│   ├── build.sh               # Build script (requires wasi-sdk)
│   ├── README.md              # WASM tools development guide
│   └── LIBRARIES.md           # Library references
├── index.html                 # HTML entry point (UI structure, modals, permissions)
├── vite.config.ts             # Vite config with dynamic CSP plugin + version plugin
├── playwright.config.ts       # Playwright test configuration
├── tsconfig.json              # TypeScript strict mode configuration
└── package.json               # Dependencies and scripts
```

## Key Dependencies

### Runtime
- **Vercel AI SDK** (`ai` ^6.0.39): Multi-provider AI integration with streaming and tool calling
- **@ai-sdk/anthropic** (^3.0.15): Anthropic Claude integration
- **@ai-sdk/openai** (^3.0.12): OpenAI GPT integration
- **@ai-sdk/google** (^3.0.10): Google Gemini integration
- **zod** (^3.24.1): Schema validation for tool parameters and WASM manifests
- **marked** (^17.0.1): Markdown parsing for AI response rendering
- **jszip** (^3.10.1): ZIP extraction for WASM tool package uploads

### Development
- **Vite** (^6.0.7): Build tool with dynamic CSP plugin and version tracking
- **TypeScript** (^5.7.2): Type safety with strict mode (target ES2022)
- **Playwright** (^1.57.0): E2E visual regression and accessibility testing
- **Vitest** (^4.0.18): Unit testing for pure functions
- **@axe-core/playwright** (^4.11.0): WCAG compliance testing

## Key Technologies

This project uses:

- **File System Access API**: Core functionality for native filesystem integration
- **Vercel AI SDK**: AI model integration with streaming, tool calling, and `stepCountIs(10)` step limits
- **WebAssembly + WASI**: Custom tool runtime with 41 built-in tools, sandboxed in Web Workers
- **Web Workers**: Isolated execution environment for WASM tools with true termination support
- **IndexedDB**: Primary persistent storage for provider configs, conversations, directory handles, and WASM tools
- **localStorage**: User preferences and tool permission levels
- **Modern ES Modules**: Dynamic imports for per-provider code splitting
- **TypeScript**: Type safety with strict mode
- **Vite**: Build tool with custom plugins for dynamic CSP and version tracking
- **View Transitions API**: Smooth UI state transitions
- **Web Speech API**: Voice input transcription

## Architecture Guidelines

When building this project:

1. **Modern APIs First**: Always prefer modern web platform APIs over polyfills or legacy approaches. See `.claude/skills/modern-web-dev/SKILL.md` for comprehensive guidance.

2. **File System Access API**: This is the core feature. Familiarize yourself with:
   - `window.showDirectoryPicker()` — primary entry point for selecting a workspace
   - FileSystemFileHandle and FileSystemDirectoryHandle APIs
   - Directory handles are persisted in IndexedDB for session restoration

3. **Security Considerations**: File system access requires user permission. Always handle:
   - Permission requests gracefully
   - Permission denial scenarios
   - Secure file operations
   - All file ops must be sandboxed to the user-selected directory

4. **Adding New File Operation Tools**: When creating a new AI tool in `src/tools.ts`, you must also:
   - Add the tool name to the `ToolName` type in `src/preferences.ts`
   - Add a default permission entry in `DEFAULT_PERMISSIONS` in `src/preferences.ts`
   - Add a corresponding permission UI element in `index.html` inside the `#tool-permissions` container
   - Use the `checkPermission()` function in the tool's execute function to enforce permissions

5. **Adding Pipeable Commands**: To make a tool available in pipe chains:
   - Import `registerPipeable` from `src/pipeable.ts`
   - Call `registerPipeable('name', { execute, permissionName, description, argsDescription })` at module evaluation time
   - The pipe tool discovers registered commands automatically at runtime

6. **Adding Built-in WASM Tools**: To add a new WASM tool that ships with Co-do:
   - Add C/WASI source in `wasm-tools/src/`
   - Add the tool config to `BUILTIN_TOOLS` array in `src/wasm-tools/registry.ts`
   - **Assign a functional `category`** — tools are grouped by category in the permissions UI. Use an existing category when the tool fits (`text`, `data`, `crypto`, `file`, `code`, `search`, `compression`, `database`). If none fits, create a new category and add its display name to `CATEGORY_DISPLAY_NAMES` and ordering to `CATEGORY_DISPLAY_ORDER` in `src/wasm-tools/registry.ts`
   - Build with `npm run wasm:build`
   - Set `pipeable: true` in the manifest if the tool should participate in pipe chains
   - **Binary data support**: For tools that process binary data (images, compressed files, etc.):
     - Use parameter type `'binary'` in the manifest — the AI sends base64-encoded data which is decoded to raw bytes and delivered via stdin
     - Binary stdout is automatically detected (non-UTF-8 output) and preserved as `stdoutBinary` in the result
     - VFS file reads use `readFileBinary()` so WASM tools can read binary files from the project directory without corruption
     - VFS file writes pass `Uint8Array` directly so binary output is written correctly
     - Worker execution transfers binary data via `Transferable` ArrayBuffers for zero-copy performance

7. **Tool Grouping by Function**: Tools in the permissions UI are organized into functional groups so users can understand what each tool does at a glance:
   - Built-in file tools are grouped statically in `index.html` (File Management, File Reading, Pipe Commands)
   - WASM tools are grouped dynamically by their `category` field — the UI reads each tool's category and renders collapsible groups automatically
   - Category display names are defined in `CATEGORY_DISPLAY_NAMES` in `src/wasm-tools/registry.ts`
   - Display order is controlled by `CATEGORY_DISPLAY_ORDER` — categories listed first appear first in the UI
   - User-uploaded custom tools are automatically grouped by their manifest's `category` field
   - **Never group tools by implementation detail** (e.g., "WebAssembly Tools") — always group by function (e.g., "Text Processing", "Crypto & Encoding")

8. **IndexedDB Storage Pattern**: All persistent data uses IndexedDB via `src/storage.ts`:
   - Provider configs, conversations, directory handles, and WASM tools each have their own object store
   - Use the `storageManager` singleton — never access IndexedDB directly
   - API keys are stored in IndexedDB (not localStorage) for better isolation

9. **Dynamic CSP Strategy**: Content Security Policy is generated per-request:
   - The selected provider is stored in a cookie (`co-do-provider`)
   - `server/csp.ts` reads the cookie and builds `connect-src` for only that provider's API domain
   - Vite code-splits provider SDKs so only the active one is fetched
   - Workers inherit the page's CSP

10. **Tool Result Caching**: Large tool outputs (>2KB) are cached in `toolResultCache`:
    - AI receives a summary + first 5 lines (reduces context usage)
    - UI retrieves full content via `resultId` for expandable display
    - WASM tools also use this pattern for their outputs

11. **Collaboration Features**: When implementing Cowork-like functionality, consider:
    - Real-time synchronization patterns
    - Conflict resolution for concurrent edits
    - Presence indicators for collaborators
    - Efficient data transfer for file content

## Documentation Guidelines

**IMPORTANT:** Documentation must be kept up-to-date with every feature implementation.

### When to Update Documentation

After completing any feature implementation, you MUST update the relevant documentation files:

1. **README.md** - Update when:
   - Adding new features or capabilities
   - Changing available AI tools
   - Modifying security measures
   - Updating browser support requirements
   - Adding new configuration options
   - Changing the project architecture

2. **CHANGELOG.md** - Update when:
   - Releasing new versions
   - Adding significant features
   - Making breaking changes
   - Fixing important bugs

3. **PWA-SETUP.md** - Update when:
   - Changing PWA configuration
   - Modifying service worker behavior
   - Updating manifest settings

4. **CLAUDE.md** - Update when:
   - Adding new development commands
   - Changing project structure
   - Adding new guidelines or conventions
   - Learning from PR review feedback

### Documentation Checklist

Before marking a feature as complete, verify:

- [ ] README.md reflects the new feature (if user-facing)
- [ ] Feature is listed in the appropriate section
- [ ] Example prompts are updated if relevant
- [ ] Security implications are documented if applicable
- [ ] Any new tools are listed in the "Available Tools" section
- [ ] Architecture changes are reflected in the project structure

### What to Document

For each new feature, document:
- **What it does** - Clear, concise description
- **How to use it** - User-facing instructions if applicable
- **Configuration** - Any settings or options available
- **Security** - Any security considerations

### What NOT to Document

Skip documentation updates for:
- Internal refactoring that doesn't change behavior
- Bug fixes that don't affect documented behavior
- Code comment improvements
- Test-only changes
## Asking Clarifying Questions

**IMPORTANT:** When working on design decisions or implementation choices, ask clarifying questions rather than making assumptions. This ensures the solution matches user expectations and avoids wasted effort.

### When to Ask Questions

Ask clarifying questions before proceeding when:

1. **Multiple valid approaches exist** - Different architectural patterns, libraries, or implementation strategies could work
2. **Design trade-offs are involved** - Performance vs. readability, simplicity vs. flexibility, etc.
3. **Scope is ambiguous** - The request could be interpreted as a small fix or a larger refactor
4. **New features are requested** - Understanding the full requirements prevents rework
5. **Breaking changes might occur** - Changes that affect other parts of the codebase or user experience
6. **UI/UX decisions are needed** - Placement, styling, interaction patterns, or user flow choices

### Types of Clarifying Questions

**Architecture & Design:**
- "Should this be a separate module or part of the existing component?"
- "Do you want this to be configurable, or is a fixed implementation fine?"
- "Should this support multiple providers/backends, or just one for now?"

**Scope & Requirements:**
- "Should this handle edge cases like X and Y, or focus on the happy path first?"
- "Do you want error handling to be user-facing (with UI feedback) or silent (logged only)?"
- "Should this work on mobile viewports as well?"

**Implementation Choices:**
- "Would you prefer using library X or implementing this with native APIs?"
- "Should this be synchronous or asynchronous?"
- "Do you want to store this in localStorage, or should it be session-only?"

**User Experience:**
- "Where should this new button/control be placed?"
- "Should this show a confirmation dialog or act immediately?"
- "What should happen if the operation fails?"

### How to Ask

When asking clarifying questions:

1. **Be specific** - Reference the exact decision point
2. **Offer options** - Present 2-3 concrete alternatives when possible
3. **Explain trade-offs** - Briefly note pros/cons of each approach
4. **Suggest a default** - Indicate which option you'd recommend and why

**Example:**
> "For the new export feature, I see two approaches:
> 1. **Single format (JSON)** - Simpler to implement, covers most use cases
> 2. **Multiple formats (JSON, CSV, XML)** - More flexible but requires more UI for format selection
>
> I'd recommend starting with option 1 and adding formats later if needed. Which approach would you prefer?"

### When NOT to Ask

Skip questions and proceed directly when:

- The task is straightforward with an obvious implementation
- You're following established patterns already in the codebase
- The user has already specified exactly what they want
- It's a bug fix with a clear solution
- You're making documentation-only changes

### Proactive Suggestions

When asking questions, you can also proactively suggest additional considerations:

- "While implementing X, should we also consider adding Y?"
- "This would be a good opportunity to also improve Z - interested?"
- "I noticed a related issue with A - should I address that too?"

This helps surface improvements the user might not have thought of, while still keeping them in control of scope.

## Modern Web Development Skill

This repository includes a custom skill at `.claude/skills/modern-web-dev/SKILL.md` that enforces modern web API usage. The skill is automatically available and should be referenced when:

- Implementing browser features
- Working with DOM APIs
- Adding new UI components
- Integrating browser capabilities

Key principles from the skill:
- Use `fetch()` instead of XMLHttpRequest
- Use `navigator.clipboard` instead of `document.execCommand`
- Use Constraint Validation API for forms
- Use IntersectionObserver instead of scroll event polling
- Use `structuredClone()` instead of JSON parse/stringify
- Always verify browser support against this project's requirements

## Code Review Skills (PR Review Toolkit)

This repository includes a full suite of code review agents in `.claude/skills/` and a coordinating command in `.claude/commands/`. These **must be used** as part of the development workflow for all code changes.

### Available Skills

| Skill | Location | Purpose |
|-------|----------|---------|
| **code-simplifier** | `.claude/skills/code-simplifier/` | Simplifies code for clarity and maintainability while preserving functionality |
| **code-reviewer** | `.claude/skills/code-reviewer/` | Reviews code against CLAUDE.md guidelines; reports issues with confidence >= 80 |
| **comment-analyzer** | `.claude/skills/comment-analyzer/` | Verifies comment accuracy, identifies comment rot and misleading docs |
| **pr-test-analyzer** | `.claude/skills/pr-test-analyzer/` | Evaluates test coverage quality, identifies critical gaps and missing edge cases |
| **silent-failure-hunter** | `.claude/skills/silent-failure-hunter/` | Finds silent failures, empty catch blocks, and inadequate error handling |
| **type-design-analyzer** | `.claude/skills/type-design-analyzer/` | Rates type design quality (encapsulation, invariants, usefulness, enforcement) |

### Coordinating Command

**`/review-pr`** — runs all applicable review agents based on what files changed. Can also target specific aspects:
- `/review-pr code` — general code quality
- `/review-pr tests` — test coverage analysis
- `/review-pr errors` — silent failure hunting
- `/review-pr types` — type design review
- `/review-pr comments` — comment accuracy check
- `/review-pr simplify` — code simplification pass

### Required Pre-Commit Workflow

**When making code changes, follow this ordered workflow:**

1. **Write code** — implement the feature or fix
2. **Run code-reviewer** — check for CLAUDE.md violations, bugs, and quality issues
3. **Run silent-failure-hunter** — verify error handling is adequate (if error handling was touched)
4. **Run pr-test-analyzer** — verify test coverage is sufficient (if tests were added/changed)
5. **Run type-design-analyzer** — review new or modified types (if types were added/changed)
6. **Fix all critical and important issues** found by the review agents
7. **Run code-simplifier** — final polish pass for clarity and consistency
8. **Run `npm test`** — ensure all tests pass
9. **Commit** — only after reviews pass and tests are green

For a comprehensive review covering all aspects at once, use `/review-pr` or `/review-pr all`.

### When to Skip Reviews

Skip the review agents for:
- Documentation-only changes (`.md` files, comments)
- Configuration file changes that don't affect runtime behavior
- Updating test baselines (`npm run test:visual:update`)

### Key Principles

- **Address critical issues (90-100 confidence) before committing** — these are bugs or explicit guideline violations
- **Address important issues (80-89 confidence) before creating a PR** — these are significant quality issues
- **Use code-simplifier last** — it should run after all other reviews so it simplifies the final version
- **Re-run reviews after fixes** — verify that fixes don't introduce new issues

## Testing Guidelines

**CRITICAL: All UI changes must include tests. Do not skip this step.**

This project uses Playwright for comprehensive visual regression and accessibility testing. Testing is mandatory to prevent:
- Visual regressions (buttons misplaced, broken layouts)
- Accessibility issues (poor contrast, missing ARIA labels)
- Broken UI components
- Responsive design problems

### When to Write Tests

**You MUST write tests when:**

1. **Adding new UI components** - Create visual regression tests for the component
2. **Modifying existing UI** - Update baseline screenshots with `npm run test:visual:update`
3. **Adding new features** - Test all UI states (normal, hover, focus, disabled)
4. **Changing styles** - Verify contrast ratios and visual appearance
5. **Adding modals or overlays** - Test open/close states and accessibility
6. **Implementing responsive design** - Test mobile, tablet, and desktop viewports

### When Tests Are NOT Required

**Skip running tests for:**

- **Markdown files** (`.md`) - Documentation changes don't affect application behavior
- **Comment-only changes** - Adding or updating code comments
- **README updates** - Repository documentation
- **License file changes** - Legal documentation
- **Configuration file comments** - Non-functional changes to config files

### Test Types

#### Visual Regression Tests

Visual regression tests capture screenshots and compare them against baseline images. These tests catch:
- Button misalignment
- Incorrect spacing or padding
- Font size or color changes
- Layout breaks
- Component rendering issues

**Location:** `tests/visual/`

**Example:**
```typescript
test('button displays correctly', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('#my-button');
  await expect(button).toHaveScreenshot('my-button.png', {
    animations: 'disabled',
  });
});
```

#### Accessibility Tests

Accessibility tests verify WCAG 2.1 Level AA compliance, including:
- Color contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text)
- ARIA attributes and labels
- Keyboard navigation
- Focus management
- Semantic HTML

**Location:** `tests/accessibility/`

**Example:**
```typescript
test('component has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

### Test Organization

- **`tests/visual/`** - Visual regression tests for UI components
  - `ui-components.spec.ts` - Main UI components (header, sidebar, chat)
  - `button-styling.spec.ts` - Button appearance and positioning
  - `dark-mode.spec.ts` - Dark theme visual regression
  - `tool-responses.spec.ts` - Tool result display formatting
- **`tests/accessibility/`** - Accessibility and WCAG compliance tests
  - `wcag-compliance.spec.ts` - Color contrast, ARIA, keyboard navigation
- **`tests/unit/`** - Unit tests (Vitest)
  - `tool-response-format.test.ts` - Pure function tests for response formatting
  - `pipe.test.ts` - Pipe command chaining logic tests
- **`tests/helpers/`** - Shared test utilities
  - `test-utils.ts` - Helper functions for common test operations
  - `dom-inspector.ts` - DOM inspection utilities

### Running Tests

**Before committing code:**
```bash
npm test
```

**After changing UI appearance (intentionally):**
```bash
npm run test:visual:update
```

**For debugging:**
```bash
npm run test:ui          # Interactive UI mode
npm run test:debug       # Debug mode with inspector
npm run test:headed      # Run with browser visible
```

### CI/CD Integration

Tests automatically run on:
- Every pull request
- Every push to main
- Every commit to feature branches

If tests fail, the build fails. Do not merge code with failing tests.

### Updating Baseline Screenshots

When you intentionally change UI appearance:

1. Make your UI changes
2. Run `npm run test:visual:update` to update baseline screenshots
3. Review the updated screenshots in `tests/visual/*.spec.ts-snapshots/`
4. Commit both code changes AND updated screenshots together

### Writing New Tests

When adding a new feature, follow this pattern:

1. **Create the feature** - Implement the UI component or feature
2. **Write visual tests** - Capture screenshots of all states
3. **Write accessibility tests** - Verify WCAG compliance
4. **Test interactivity** - Test hover, focus, and active states
5. **Test responsiveness** - Test on different viewport sizes
6. **Run tests** - Ensure all tests pass before committing

**Example workflow:**
```bash
# 1. Implement feature
# (edit source files)

# 2. Create test file
# tests/visual/my-feature.spec.ts

# 3. Run tests to create baselines
npm run test:visual:update

# 4. Run all tests to verify
npm test

# 5. Commit everything
git add .
git commit -m "Add new feature with tests"
```

### Best Practices

1. **Disable animations** - Use `animations: 'disabled'` in screenshot tests
2. **Wait for page load** - Always use `await page.waitForLoadState('networkidle')`
3. **Test all states** - Normal, hover, focus, active, disabled
4. **Use semantic selectors** - Prefer IDs and data-testid over CSS classes
5. **Keep tests focused** - One test should verify one thing
6. **Use helper functions** - Reuse common test operations from `tests/helpers/test-utils.ts`
7. **Test mobile views** - Use `page.setViewportSize()` for responsive tests
8. **Verify contrast** - All text must meet WCAG AA contrast requirements (4.5:1)

### Common Issues and Solutions

**Issue: Screenshot tests failing**
- **Cause:** UI changed unintentionally or test is flaky
- **Solution:** Review the diff in the test report (`npm run test:report`), fix the UI issue, or update baselines if change was intentional

**Issue: Accessibility violations**
- **Cause:** Missing ARIA labels, poor contrast, or semantic HTML issues
- **Solution:** Review the axe-core violations in the test output, add proper labels, improve contrast, or fix HTML structure

**Issue: Tests passing locally but failing in CI**
- **Cause:** Different font rendering, timing issues, or missing dependencies
- **Solution:** Use `animations: 'disabled'`, add proper wait conditions, or update CI configuration

### Test Coverage Requirements

All new code must maintain:
- **Visual coverage:** All visible UI components must have screenshot tests
- **Accessibility coverage:** All interactive elements must pass WCAG 2.1 AA
- **Responsive coverage:** Key pages must be tested on mobile, tablet, and desktop

**Remember: Tests are not optional. They protect users from broken UI and accessibility issues.**

## Pre-Push Rebase Workflow

**IMPORTANT:** Before pushing a branch or creating/updating a pull request, always rebase onto the latest main branch. This prevents merge conflicts — especially in `package-lock.json` — and ensures PRs can merge cleanly without manual intervention.

### Required Steps Before Pushing

**You MUST commit your changes FIRST, then rebase.** Do not attempt to fetch or rebase with uncommitted changes — this will cause errors.

1. **Commit your changes first:**
   ```bash
   git add <files>
   git commit -m "your commit message"
   ```

2. **Fetch the latest main branch:**
   ```bash
   git fetch origin main
   ```

3. **Rebase your branch onto main:**
   ```bash
   git rebase origin/main
   ```

4. **If there are conflicts, resolve them:**
   - For `package-lock.json` conflicts: accept main's version, then run `npm install` to regenerate it with your branch's dependency changes
   - For code conflicts: resolve manually, keeping your changes where appropriate
   - After resolving: `git add <resolved-files> && git rebase --continue`

5. **If `package-lock.json` was regenerated, amend it into your last commit:**
   ```bash
   git add package-lock.json
   git commit --amend --no-edit
   ```

6. **Run tests again after rebase** (for code changes):
   ```bash
   npm test
   ```

7. **Push your branch** (use force-with-lease since you rebased):
   ```bash
   git push -u origin <branch-name> --force-with-lease
   ```

### Handling `package-lock.json` Conflicts

`package-lock.json` is the most common source of merge conflicts because multiple PRs landing on main frequently change it. The correct resolution is:

1. **Never manually edit `package-lock.json`** — always regenerate it
2. During a rebase conflict on `package-lock.json`:
   ```bash
   # During rebase, --ours = the branch being rebased onto (main)
   # and --theirs = your branch's commits being replayed
   git checkout --ours package-lock.json
   npm install
   git add package-lock.json
   git rebase --continue
   ```
3. This ensures the lockfile reflects both main's dependency state and your branch's changes

### When Updating an Existing PR

If your PR already exists and main has moved ahead:

1. Fetch and rebase as described above
2. Force-push with lease to update the PR branch
3. Verify the PR still shows a clean diff and no conflicts

### Summary Checklist

Before every push, verify:

- [ ] **Committed all changes first** (never rebase with uncommitted work)
- [ ] Fetched latest `origin/main`
- [ ] Rebased branch onto `origin/main`
- [ ] Resolved any conflicts (especially `package-lock.json`)
- [ ] Ran `npm install` if `package-lock.json` was conflicted
- [ ] Tests pass after rebase (for code changes)
- [ ] Pushed with `--force-with-lease`

## GitHub PR Review Feedback

When working through feedback from GitHub pull request reviews, follow this process to ensure continuous improvement:

### Addressing Review Comments

1. **Fix all issues** - Address every comment raised by reviewers
2. **Run tests** - After fixes, run `npm test` to verify nothing is broken
3. **Document patterns** - If a reviewer raises an issue that reflects a recurring pattern or common mistake, update this CLAUDE.md file

### Updating CLAUDE.md with Lessons Learned

**IMPORTANT:** After resolving GitHub PR review feedback, evaluate whether the issues raised represent patterns that should be documented to prevent future occurrences.

**When to update CLAUDE.md:**
- A reviewer points out a coding pattern that should be avoided
- Multiple PRs have similar feedback about the same issue
- A reviewer identifies a project-specific convention not yet documented
- Security, accessibility, or performance issues are raised that apply broadly

**How to update:**
1. Identify the root cause of the feedback
2. Add a clear guideline to the appropriate section of this file
3. Include examples if helpful (what to do vs. what not to do)
4. Commit the CLAUDE.md update along with the PR fixes

**Example additions:**
- Add to "Architecture Guidelines" if it's about code structure
- Add to "Testing Guidelines" if it's about test coverage or patterns
- Add to "Security Considerations" if it's about security practices
- Create a new section if the feedback covers a new area

### Lessons Learned from PR Reviews

This section captures specific guidelines that emerged from PR review feedback. Add new items here as they arise:

<!-- Add lessons learned from PR reviews below this line -->

#### 1. Empty String vs Falsy — Use Explicit Undefined Checks

**Problem:** Using truthiness checks (`if (value)`) silently drops empty strings, which are often valid input (e.g., empty stdin for hash tools, empty search queries).

**Rule:** When a value can legitimately be an empty string, always use `value !== undefined` or `value != null` instead of `if (value)`.

```typescript
// BAD — drops empty string
if (stdin) {
  options.stdin = stdin;
}

// GOOD — preserves empty string as valid input
if (stdin !== undefined) {
  options.stdin = stdin;
}
```

**Applies to:** Any parameter that accepts string input, especially stdin, search queries, file contents, and user-provided text.

#### 2. One-Time Init Must Handle Failure Gracefully

**Problem:** Setting a "loaded" or "initialized" flag to `true` immediately (even on failure) prevents retry on transient errors, permanently breaking functionality until a full page reload.

**Rule:** Only set initialization flags on **successful** completion. For lazy-loading patterns, use a three-state approach: `unloaded | loading | loaded`. Consider retry mechanisms for transient failures.

```typescript
// BAD — permanent failure on transient error
async function loadManifest() {
  manifestLoaded = true; // Set before knowing if it worked
  const res = await fetch(url);
  if (res.ok) { /* parse */ }
}

// GOOD — only mark loaded on success
async function loadManifest() {
  try {
    const res = await fetch(url);
    if (res.ok) {
      manifest = await res.json();
      manifestLoaded = true; // Only on success
    }
    // Leave manifestLoaded = false so it can be retried
  } catch {
    // Transient failure — will retry on next call
  }
}
```

#### 3. Concurrent Access — Deduplicate Lazy Initialization

**Problem:** When multiple callers trigger a lazy-load simultaneously (e.g., loading WASM tools in parallel), each caller initiates a separate fetch, causing redundant network requests and potential race conditions.

**Rule:** Use a shared Promise to deduplicate concurrent initialization. The first caller creates the Promise; subsequent callers await the same one.

```typescript
// BAD — each caller fetches independently
async function ensureLoaded() {
  if (!loaded) {
    data = await fetch(url);
    loaded = true;
  }
}

// GOOD — shared promise deduplicates
let loadPromise: Promise<void> | null = null;
function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = fetch(url).then(res => { data = res; });
  }
  return loadPromise;
}
```

#### 4. Update All Related State When Syncing Cached Entities

**Problem:** When updating one part of a cached entity (e.g., syncing a WASM tool's manifest from registry), the related binary/data may also need updating. Partial syncs create mismatches where new manifests reference old binaries.

**Rule:** When syncing any part of a cached entity, check if related parts also need refreshing. Treat manifest + binary (or config + data) as an atomic unit.

#### 5. Dynamic Registries Must Stay in Sync

**Problem:** Registering items (e.g., pipeable commands) only at initialization means later changes (install, enable, disable, uninstall) leave the registry stale. Descriptions built from the registry at init time become wrong after registration changes.

**Rule:** Any dynamic registry must be updated whenever its source data changes. If a description is derived from registry contents, rebuild it after modifications. Consider using a getter or callback pattern instead of caching the description once.

#### 6. URL and Path Handling — Strip Query Strings, Handle Dev vs Prod

**Problem:** In Vite dev mode, URLs include query parameters (`?worker_file&type=module`) and use `.ts` extensions. Production uses hashed `.js` files. Path-matching logic that only handles one format breaks in the other.

**Rule:** Always strip query strings and hash fragments before path matching. Handle both `.ts` (dev) and `.js` (prod) extensions when matching asset URLs.

```typescript
// BAD — fails in dev mode
function isWorkerRequest(url: string): boolean {
  return url.endsWith('.js') && url.includes('wasm-worker');
}

// GOOD — works in both dev and prod
function isWorkerRequest(url: string): boolean {
  const pathname = url.split(/[?#]/, 1)[0];
  const segment = pathname.split('/').pop() ?? '';
  return segment.startsWith('wasm-worker') &&
    (segment.endsWith('.js') || segment.endsWith('.ts'));
}
```

#### 7. JSON.stringify Is Unreliable for Deep Equality

**Problem:** `JSON.stringify(a) !== JSON.stringify(b)` can produce different strings for semantically identical objects due to property ordering, triggering unnecessary updates or missing real changes.

**Rule:** Do not use `JSON.stringify` for deep equality comparison. Use a proper deep-equal utility or normalize objects before comparing (e.g., sort keys recursively).

#### 8. MessagePort and Worker Cleanup

**Problem:** `MessagePort` does not fire a `close` event when a tab/page unloads. Code relying on a `close` event for cleanup will leak ports, and broadcasting to closed ports throws `InvalidStateError`.

**Rule:** When broadcasting via `postMessage` to multiple ports, wrap each call in try-catch and remove ports that fail. Use explicit disconnect protocols (e.g., `beforeunload` → send disconnect message) rather than relying on events that don't fire.

#### 9. Permission Checks Must Be Granular

**Problem:** Registering WASM pipeable commands with a generic `permissionName: 'pipe'` bypasses per-tool permission checks. In a pipe chain, if a user has denied a specific WASM tool, pre-validation still passes because it only checks the global pipe permission.

**Rule:** Pipeable commands should respect their own tool-specific permission, not just the pipe tool's global permission. Pre-validation should check every command in the chain against its specific permission before executing any of them.

#### 10. GitHub Actions — Validate Workflow Syntax and Add Safety Controls

**Problem:** Multiple workflow PRs had invalid YAML keys (`description` at top level), insufficient permissions, missing concurrency controls, and operations that weren't idempotent (duplicate tags on re-run).

**Rules for GitHub Actions workflows:**
- Only use valid top-level keys: `name`, `on`, `permissions`, `env`, `defaults`, `concurrency`, `jobs`
- Follow principle of least privilege for permissions — only request `write` when needed
- Add `concurrency` groups to prevent duplicate runs
- Make operations idempotent — check if tags/labels exist before creating them
- Create git tags **after** rebase/push, not before (rebase rewrites commits, leaving tags dangling)
- Pin action versions to specific SHAs or exact version tags, not mutable tags like `@v1`

#### 11. Comments and Docstrings Must Match Actual Behavior

**Problem:** PR reviews repeatedly caught comments that were factually wrong — describing behavior that didn't exist, using wrong terminology, or citing incorrect thresholds.

**Common mistakes caught in reviews:**
- Docstrings saying "falls back to title-cased" when code only capitalizes first character
- Claiming cache thresholds of "2KB" when the actual code uses `2000` bytes
- Using "incoming (main) version" when rebase semantics make "theirs" mean your branch, not main
- Comments referencing a `<meta>` tag CSP fallback that doesn't exist in the HTML
- Cache version markers placed in comments that get stripped by minification

**Rule:** After writing or updating any comment or docstring, verify each factual claim against the actual code. Check: numeric thresholds, function signatures, parameter names, git semantics, and referenced code/files.

#### 12. Wrap Potentially Throwing Calls in Try-Catch at System Boundaries

**Problem:** Functions like `atob()` (base64 decoding) can throw on invalid input. When called inside a code path that lacks try-catch, the exception propagates up and crashes the operation with an unhelpful error.

**Rule:** Any call that decodes, parses, or processes external/user input (`atob`, `JSON.parse`, `new URL`, `decodeURIComponent`) should be wrapped in try-catch at the point where it's first used, converting the exception to a meaningful error response.

#### 13. Avoid Redundant File I/O — Cache Parsed Configuration

**Problem:** Multiple functions independently reading and parsing the same file (e.g., `package.json`) during a build creates redundant I/O.

**Rule:** When multiple functions need the same configuration data, read and parse the file once, then share the result. Use a shared helper or cache the parsed result.
