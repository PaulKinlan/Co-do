# Co-do

An AI-powered file system manager built with the File System Access API. Co-do lets you select a folder on your local machine and use AI to perform operations on the files within.

## Features

### Core Features

- **File System Access**: Native browser integration with your local file system using the File System Access API
- **AI-Powered**: Use Anthropic Claude, OpenAI GPT, or Google Gemini to interact with your files
- **Multi-Provider Support**: Configure multiple AI providers and switch between them
- **Real-time Streaming**: AI responses stream in real-time as they're generated
- **Granular Permissions**: Control which operations the AI can perform (always allow, ask, or never allow)
- **Client-Side Only**: Your API key and files never leave your browser (except for AI model API calls)

### Progressive Web App (PWA)

- **Installable**: Install Co-do on your device like a native app
- **Offline Support**: Core app functionality works without internet connection
- **Automatic Updates**: Get notified when new versions are available with changelog links
- **App Shortcuts**: Quick access to workspace via home screen shortcuts

### Security & Privacy

- **Strict CSP**: Content Security Policy ensures data only goes to AI provider endpoints
- **Sandboxed Operations**: File operations are restricted to the selected directory
- **Local Storage**: API keys are stored in browser IndexedDB and never transmitted except to AI providers
- **Permission Controls**: User controls which operations are allowed
- **Ask Before Execute**: Destructive operations can require user approval

### UI Features

- **Dark Mode Support**: Automatic theme switching based on system preferences
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Toast Notifications**: Non-intrusive feedback for operations
- **Status Bar**: Real-time operation status display
- **Markdown Rendering**: AI responses render as formatted markdown
- **File System Observer**: Real-time file change detection (Chrome 129+)

## Browser Support

Co-do requires the File System Access API, which is currently available in:

- Chrome 86+ (Recommended: Chrome 140+)
- Edge 86+
- Other Chromium-based browsers

Safari has limited support for the File System Access API.

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

The AI has access to 18 file operations:

### Basic File Operations
- **open_file**: Open and read file contents
- **create_file**: Create a new file with content
- **write_file**: Write or update file contents
- **rename_file**: Rename a file
- **move_file**: Move a file to a different location
- **delete_file**: Delete a file (use with caution!)
- **cp**: Copy a file to a new location

### Directory Operations
- **list_files**: List all files in the directory
- **mkdir**: Create a new directory
- **tree**: Display directory structure as a tree

### File Reading Tools
- **cat**: Display file contents (alias for open_file)
- **head_file**: Read the first N lines of a file
- **tail_file**: Read the last N lines of a file
- **get_file_metadata**: Get file size, type, and last modified date

### Text Processing Tools
- **grep**: Search for text patterns in files (supports case-insensitive search)
- **diff**: Compare two files and show differences
- **wc**: Count lines, words, and characters in a file
- **sort**: Sort lines in a file
- **uniq**: Filter duplicate consecutive lines

## AI Providers

### Anthropic Claude
- Claude Opus 4.5
- Claude Sonnet 4.5
- Claude Sonnet 3.5

### OpenAI
- GPT-5.2
- GPT-4.1
- GPT-4.1 Mini
- o4-mini
- o3-mini
- GPT-4o

### Google Gemini
- Gemini 3 Flash Preview
- Gemini 3 Pro Preview
- Gemini 2.5 Flash
- Gemini 2.0 Flash
- Gemini 1.5 Pro

## Security

Co-do implements several security measures:

1. **Content Security Policy (CSP)**: Only allows connections to AI model provider APIs
2. **IndexedDB Storage**: API keys are stored securely in IndexedDB and never transmitted except to the chosen AI provider
3. **Permission Controls**: User can control which operations are allowed at a granular level
4. **Ask Before Execute**: Destructive operations can require user approval
5. **Sandboxed Markdown**: Markdown content is rendered in sandboxed iframes for XSS protection
6. **Directory Sandboxing**: File operations are restricted to the user-selected directory

## Architecture

- **Vite**: Build tool and development server
- **TypeScript**: Type-safe code with strict mode
- **Vercel AI SDK**: Multi-provider AI integration with streaming support
- **File System Access API**: Native file system integration
- **IndexedDB**: Secure local storage for provider configurations
- **Service Worker**: PWA offline support and caching
- **Modern CSS**: CSS custom properties for theming, no frameworks

## Development

### Project Structure

```
Co-do/
├── src/
│   ├── main.ts          # Application entry point
│   ├── ui.ts            # UI manager and event handlers
│   ├── fileSystem.ts    # File System Access API wrapper
│   ├── ai.ts            # AI SDK integration
│   ├── tools.ts         # AI tools for file operations
│   ├── preferences.ts   # User preferences and permissions
│   └── styles.css       # Application styles
├── tests/
│   ├── visual/          # Visual regression tests
│   ├── accessibility/   # Accessibility tests (WCAG 2.1 AA)
│   └── helpers/         # Test utilities
├── public/
│   ├── manifest.json    # PWA manifest
│   ├── sw.js            # Service worker
│   └── icons/           # App icons
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration with CSP
├── playwright.config.ts # Test configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

### Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run type-check   # Run TypeScript type checking
npm test             # Run all tests
npm run test:visual  # Run visual regression tests
npm run test:accessibility  # Run accessibility tests
npm run test:visual:update  # Update visual baselines
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## License

MIT

## Acknowledgments

Inspired by Anthropic's Co-work project.
