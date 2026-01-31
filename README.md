# Co-do

An AI-powered file system manager built with the File System Access API. Co-do lets you select a folder on your local machine and use AI to perform operations on the files within.

## Features

### Core Features

- **File System Access**: Native browser integration with your local file system using the File System Access API
- **AI-Powered**: Use Anthropic Claude, OpenAI GPT, or Google Gemini to interact with your files
- **Multi-Provider Support**: Configure multiple AI providers and switch between them seamlessly
- **Real-time Streaming**: AI responses stream in real-time as they're generated
- **Granular Permissions**: Control which operations the AI can perform (always allow, ask, or never allow)
- **Client-Side Only**: Your API key and files never leave your browser (except for AI model API calls)
- **Multi-Conversation**: Maintain multiple concurrent conversations with persistent history stored in IndexedDB
- **39 Built-in WebAssembly Tools**: Text processing, crypto, data format conversion, code minification, and more — all running sandboxed in Web Workers
- **Pipe Command Chaining**: Chain tools together Unix-style — output of one command feeds into the next
- **Custom WASM Tool Upload**: Install your own WebAssembly tools via ZIP packages

### Progressive Web App (PWA)

- **Installable**: Install Co-do on your device like a native app
- **Offline Support**: Core app functionality works without internet connection
- **Automatic Updates**: Get notified when new versions are available with changelog links
- **App Shortcuts**: Quick access to workspace via home screen shortcuts

### Security & Privacy

- **Dynamic CSP**: Content Security Policy headers are generated per-request based on the selected AI provider, ensuring network access is limited to only the active provider's API endpoint
- **Directory Sandboxing**: File operations are restricted to the user-selected directory
- **WebAssembly Sandboxing**: WASM tools execute in isolated Web Workers with no DOM access, no network access, and configurable memory limits. Binary data (images, compressed files) flows through the pipeline without corruption
- **Markdown Sandboxing**: AI responses are rendered inside sandboxed `<iframe>` elements to prevent XSS
- **API Key Security**: Keys are stored in browser IndexedDB and only transmitted to the selected AI provider — no server-side storage
- **Permission Controls**: Granular per-tool permission levels (always/ask/never) for both file operations and WASM tools
- **Ask Before Execute**: Destructive operations can require explicit user approval

### UI Features

- **Voice Input**: Real-time voice transcription using Web Speech API — click the microphone button to dictate prompts
- **Dark Mode Support**: Automatic theme switching based on system preferences
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Toast Notifications**: Non-intrusive feedback for operations
- **View Transitions**: Smooth visual transitions between UI states using the View Transitions API
- **Markdown Rendering**: AI responses render as formatted markdown in sandboxed iframes
- **File System Observer**: Real-time file change detection (Chrome 129+)
- **Conversation Tabs**: Switch between multiple conversations with tab-based navigation

## Browser Support

Co-do requires the File System Access API, which is currently available in:

- Chrome 86+ (Recommended: Chrome 140+)
- Edge 86+
- Other Chromium-based browsers

Safari has limited support for the File System Access API.

### Voice Input Support

The voice transcription feature uses the Web Speech API (Speech Recognition), which is available in:

- Chrome 25+ (Desktop and Android)
- Edge 79+
- Safari 14.1+ (with limitations)

If your browser doesn't support voice recognition, the microphone button will be automatically hidden.

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building

```bash
npm run build
```

The built files will be in the `dist` directory.

### Testing

```bash
npm test              # Run all tests
npm run test:visual   # Visual regression tests only
npm run test:accessibility  # Accessibility tests only
npm run test:ui       # Interactive test mode
```

### PWA Setup

Co-do is a Progressive Web App that can be installed on your device:

1. **Generate Icons**: Open `generate-icons.html` in Chrome to create PWA icons
2. **Save Icons**: Download and save `icon-192.png` and `icon-512.png` to the `public/` directory
3. **Deploy**: Build and deploy the app to a HTTPS server
4. **Install**: Click the install icon in Chrome's address bar or use the browser menu

For detailed PWA setup instructions, see [PWA-SETUP.md](PWA-SETUP.md).

## Usage

1. **Select an AI Provider**: Choose between Anthropic, OpenAI, or Google
2. **Enter API Key**: Your API key is stored locally and only sent to the selected AI provider
3. **Choose a Model**: Select which AI model to use
4. **Select a Folder**: Click "Select Folder" to choose a directory on your local machine
5. **Set Permissions**: Configure which file operations the AI can perform
6. **Start Chatting**: Ask the AI to help you with your files!

### Example Prompts

- "List all JavaScript files in this directory"
- "Create a README.md file with a description of this project"
- "Find all TODO comments in my code"
- "Rename all .txt files to .md"
- "Update the version number in package.json to 2.0.0"
- "Show me the first 20 lines of main.ts"
- "Compare the differences between old.js and new.js"
- "Search for 'TODO' in all files"
- "Create a new directory called 'backup'"
- "Show me the directory structure as a tree"

## Available Tools

### File Operation Tools (20 tools)

The AI has access to these file operations, each with configurable permissions:

#### Basic File Operations
- **open_file**: Open and read file contents
- **create_file**: Create a new file with content
- **write_file**: Write or update file contents (full overwrite)
- **edit_file**: Efficiently edit a file using search/replace or line-based operations (shows a unified diff of changes)
- **rename_file**: Rename a file
- **move_file**: Move a file to a different location
- **delete_file**: Delete a file (use with caution!)
- **cp**: Copy a file to a new location

#### Directory Operations
- **list_files**: List all files in the directory
- **mkdir**: Create a new directory

#### File Reading Tools
- **cat**: Display file contents (alias for open_file)
- **read_file_content**: Read actual file content for AI analysis
- **head_file**: Read the first N lines of a file
- **tail_file**: Read the last N lines of a file
- **get_file_metadata**: Get file size, type, and last modified date

#### Text Processing & Pipe Tools
- **grep**: Search for text patterns in files (supports case-insensitive search)
- **wc**: Count lines, words, and characters in a file
- **sort**: Sort lines in a file
- **uniq**: Filter duplicate consecutive lines
- **pipe**: Chain multiple commands together (see Pipe Command Chaining below)

### Built-in WebAssembly Tools (39 tools)

Co-do ships with 39 WASM tools compiled to WebAssembly and executed in sandboxed Web Workers. These tools are organized by category:

#### Crypto & Encoding (6 tools)
- **base64**: Encode/decode Base64 data
- **md5sum**: Calculate MD5 checksums
- **sha256sum**: Calculate SHA-256 hashes
- **sha512sum**: Calculate SHA-512 hashes
- **xxd**: Create hex dumps or reverse hex to text
- **uuid**: Generate random UUID v4 identifiers

#### Text Processing (12 tools)
- **wc**: Count lines, words, and characters
- **head**: Output first N lines
- **tail**: Output last N lines
- **cut**: Extract columns/fields using delimiters
- **sort**: Sort lines alphabetically or numerically
- **uniq**: Filter adjacent duplicate lines
- **tr**: Translate or delete characters
- **grep**: Pattern matching with case-insensitive and inverted search
- **sed**: Stream editor with `s/pattern/replacement/` syntax
- **awk**: Field extraction and pattern processing
- **diff**: Compare two texts and show differences
- **patch**: Apply diffs to text

#### Data Format Tools (6 tools)
- **toml2json**: Convert TOML to JSON
- **csvtool**: Process CSV (convert to JSON, extract columns, filter rows)
- **markdown**: Convert Markdown to HTML
- **jwt**: Decode and inspect JWT tokens
- **xmllint**: Validate and format XML
- **yq**: Query YAML with jq-like syntax

#### File Utilities (6 tools)
- **file**: Determine file type from content (magic numbers)
- **du**: Calculate and format file sizes
- **stat**: Display formatted file information
- **tree**: Display directory structure as a tree
- **touch**: Create or update file timestamps
- **truncate**: Truncate text to a specific length

#### Code & Minification (5 tools)
- **shfmt**: Format shell scripts
- **minify**: Minify JavaScript
- **terser**: Advanced JavaScript minification
- **csso**: Minify CSS
- **html-minifier**: Minify HTML

#### Search (1 tool)
- **fzf**: Fuzzy find matching items from a list

#### Compression (1 tool)
- **gzip**: Compress/decompress data using gzip format

#### Database (1 tool)
- **sqlite3**: Execute SQL queries on in-memory SQLite databases

#### Custom WASM Tools

You can install your own WebAssembly tools by uploading a ZIP package containing:
- `manifest.json` — Tool definition (name, parameters, execution config)
- `tool.wasm` — Compiled WASI binary

Custom tools are stored in IndexedDB and have their own permission controls. WASM tools that declare `pipeable: true` in their manifest automatically participate in pipe chains.

### Pipe Command Chaining

The **pipe** tool chains commands together Unix-style, where the output of each command becomes the input to the next. Only the final output is returned to the AI, keeping conversations efficient.

**Example:** Read a file, filter import lines, and sort them:
```
pipe: [
  { tool: "cat", args: { path: "src/main.ts" } },
  { tool: "grep", args: { pattern: "^import" } },
  { tool: "sort", args: {} }
]
```

Both built-in file tools and WASM tools can participate in pipe chains. Pipeable WASM tools automatically receive stdin from the previous command mapped to their first text parameter.

## AI Providers

Co-do supports three AI providers. Provider SDKs are loaded via dynamic import, so only the selected provider's code is ever fetched by the browser.

### Anthropic Claude
- Claude Opus 4.5
- Claude Sonnet 4.5
- Claude 3.5 Sonnet

### OpenAI
- GPT-5.2
- GPT-4.1
- GPT-4.1 Mini
- o4-mini (Reasoning)
- o3-mini (Reasoning)
- GPT-4o (Legacy)

### Google Gemini
- Gemini 3 Flash (Preview)
- Gemini 3 Pro (Preview)
- Gemini 2.5 Flash
- Gemini 2.0 Flash (Retiring Soon)
- Gemini 1.5 Pro (Legacy)

## Security

Co-do implements multiple layers of security to keep your data safe:

### Content Security Policy (CSP)
- **Dynamic per-request CSP**: Headers are generated based on the selected AI provider cookie, so `connect-src` only includes the active provider's API domain
- `worker-src 'self'` restricts Worker scripts to same-origin
- `wasm-unsafe-eval` in `script-src` enables WebAssembly compilation without requiring full `unsafe-eval`
- Frame ancestors blocked to prevent clickjacking
- `Cache-Control: no-store` on HTML responses prevents CDN caching of dynamic CSP headers
- Only the selected provider's SDK chunk is fetched (Vite code-splitting), complementing the CSP

### API Key Security
- API keys stored in IndexedDB (migrated from localStorage for better isolation)
- Keys only transmitted to the selected AI provider's API endpoint
- No server-side storage or logging — Co-do is entirely client-side
- Multiple provider configurations supported, each stored independently

### Permission Controls
- Granular control over 20 file operations (always/ask/never)
- Separate permission levels for each WASM custom tool
- Batch permission dialog with 50ms debounce for multi-tool operations
- Destructive operations default to "ask" for explicit approval

### Sandboxing
- **Directory Sandboxing**: All file operations are restricted to the user-selected directory — no access outside it
- **Markdown Sandboxing**: AI responses are rendered in sandboxed `<iframe srcdoc>` elements to prevent XSS from AI-generated content
- **WebAssembly Sandboxing**: WASM tools run in isolated Web Workers (see below)

### WebAssembly Sandbox Security
WASM tools execute in isolated Web Workers with multiple security boundaries:

1. **Process Isolation**: Each WASM execution runs in a dedicated Worker thread, separate from the main application
2. **True Termination**: Runaway or malicious modules can be forcefully terminated via `Worker.terminate()`
3. **Memory Limits**: Configurable memory bounds per tool (default: 32MB, max: 256MB)
4. **Network Blocking**: WASI socket syscalls return `EPERM` (permission denied) — WASM tools cannot make network requests
5. **No DOM Access**: Workers cannot access the main thread's DOM, `window`, or application globals
6. **CSP Enforcement**: Workers inherit the page's Content Security Policy, blocking unauthorized network requests
7. **Timeout Enforcement**: Long-running executions are automatically terminated after the configured timeout (default: 30 seconds)
8. **Virtual File System**: File access is mediated through a VFS layer that enforces the manifest's `fileAccess` declaration (none/read/write/readwrite)
9. **Manifest Validation**: Tool manifests are validated against a Zod schema before installation — malformed packages are rejected

**Execution modes:**
- **Worker mode** (default): Full process isolation with true termination support
- **Main-thread mode** (fallback): Used when Workers are unavailable; supports file access via the VFS but timeout uses `Promise.race()` which cannot forcefully stop execution

For detailed security analysis, see [docs/WASM-SANDBOXING-ANALYSIS.md](docs/WASM-SANDBOXING-ANALYSIS.md).

## Architecture

- **Vite**: Build tool and development server with dynamic CSP plugin and version tracking
- **TypeScript**: Type-safe code with strict mode (target ES2022)
- **Vercel AI SDK**: Multi-provider AI integration with streaming and tool calling
- **File System Access API**: Native file system integration with persistent directory handles
- **IndexedDB**: Persistent storage for provider configurations, conversations, WASM tools, and directory handles
- **Service Worker**: PWA offline support and asset caching
- **Web Workers**: Isolated WASM execution environment with true termination
- **WebAssembly + WASI**: Custom tool runtime with virtual file system and sandboxed syscalls
- **Modern CSS**: CSS custom properties for dark mode theming, no frameworks
- **View Transitions API**: Smooth UI state transitions
- **Web Speech API**: Voice input transcription
- **Dynamic Code Splitting**: Per-provider SDK chunks loaded on demand

### Data Flow

```
User Input → AI (streamText with tools) → Tool Execution → Streaming Response
                                              ↓
                                    Permission Check → File System / WASM Worker
                                              ↓
                                    Tool Result Cache (>2KB) → Summary to AI, Full content to UI
```

### IndexedDB Stores

Co-do uses IndexedDB (database: `co-do-db`, version 4) with four object stores:
- **provider-configs**: AI provider API keys and model selections (supports multiple configs)
- **directory-handles**: Persisted `FileSystemDirectoryHandle` for session restoration
- **conversations**: Chat history with tool activity records
- **wasm-tools**: Installed WASM tool binaries and manifests

## Development

### Project Structure

```
Co-do/
├── src/
│   ├── main.ts               # Entry point, PWA init, version checking
│   ├── ui.ts                  # UI manager, event handlers, conversations
│   ├── ai.ts                  # AI SDK integration (streaming, multi-provider)
│   ├── tools.ts               # 20 file operation tools + pipe command
│   ├── pipeable.ts            # Self-registering pipeable command registry
│   ├── fileSystem.ts          # File System Access API wrapper
│   ├── preferences.ts         # Tool permissions and user settings
│   ├── storage.ts             # IndexedDB manager (configs, conversations, WASM tools)
│   ├── diff.ts                # Unified diff generation (LCS algorithm)
│   ├── markdown.ts            # Markdown rendering in sandboxed iframes
│   ├── toasts.ts              # Toast notification system
│   ├── viewTransitions.ts     # View Transitions API integration
│   ├── provider-registry.ts   # Provider cookie management + CSP coordination
│   ├── tool-response-format.ts # Pure functions for tool response formatting
│   ├── toolResultCache.ts     # Caching for large tool outputs
│   ├── styles.css             # CSS with custom properties for dark mode
│   └── wasm-tools/            # WebAssembly custom tools system
│       ├── manager.ts         # Central tool orchestrator
│       ├── runtime.ts         # WASI runtime (main-thread fallback)
│       ├── wasm-worker.ts     # Worker-based WASM runtime
│       ├── worker-manager.ts  # Worker lifecycle and pooling
│       ├── vfs.ts             # Virtual file system for WASM
│       ├── loader.ts          # ZIP package loader and validator
│       ├── registry.ts        # Built-in tool configuration (39 tools)
│       ├── types.ts           # TypeScript interfaces and Zod schemas
│       ├── worker-types.ts    # Worker message protocol types
│       └── index.ts           # Public API exports
├── server/
│   ├── main.ts                # Vite server plugins
│   ├── providers.ts           # Provider registry and cookie parsing
│   └── csp.ts                 # Dynamic CSP header generation
├── tests/
│   ├── visual/                # Visual regression tests (screenshots)
│   ├── accessibility/         # WCAG 2.1 Level AA compliance tests
│   ├── unit/                  # Unit tests (Vitest)
│   └── helpers/               # Test utilities and DOM inspector
├── docs/
│   ├── WASM-SANDBOXING-ANALYSIS.md  # Security deep-dive
│   ├── WASM-TOOLS-PLAN.md          # Implementation architecture
│   ├── WASM-TOOLS-LIST.md          # Catalog of 80+ potential WASM tools
│   ├── models-csp-report.md        # CSP strategy documentation
│   └── worker-csp-isolation.md     # Worker isolation details
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   ├── icon.svg               # App icon (SVG)
│   ├── icon-192.png           # PWA icon (192px)
│   └── icon-512.png           # PWA icon (512px)
├── wasm-tools/
│   ├── src/                   # C/WASI source for built-in tools
│   ├── manifests/             # Tool manifest definitions (JSON)
│   ├── build.sh               # Build script (requires wasi-sdk)
│   ├── README.md              # WASM tools development guide
│   └── LIBRARIES.md           # Library references
├── index.html                 # HTML entry point
├── vite.config.ts             # Vite config with CSP and version plugins
├── playwright.config.ts       # Playwright test configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

### Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Start development server (port 3000)
npm run build                  # Full build (WASM + TypeScript + Vite)
npm run build:web-only         # Build without WASM compilation
npm run preview                # Preview production build
npm run type-check             # Run TypeScript type checking
npm test                       # Run all Playwright tests
npm run test:visual            # Visual regression tests only
npm run test:accessibility     # Accessibility tests only
npm run test:visual:update     # Update visual baseline screenshots
npm run test:unit              # Run unit tests (Vitest)
npm run test:unit:watch        # Run unit tests in watch mode
npm run test:ui                # Interactive Playwright UI mode
npm run test:debug             # Debug mode with Playwright Inspector
npm run test:headed            # Run tests with browser visible
npm run test:report            # View HTML test report
npm run wasm:build             # Build all WASM tools from source
npm run wasm:build:native      # Build native-only WASM tools
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## License

MIT

## Acknowledgments

Inspired by Anthropic's Co-work project.
