# Co-do

An AI-powered file system manager built with the File System Access API. Co-do lets you select a folder on your local machine and use AI to perform operations on the files within.

## Features

- **Progressive Web App (PWA)**: Install Co-do on your device and use it offline
- **File System Access**: Native browser integration with your local file system using the File System Access API
- **AI-Powered**: Use Anthropic Claude, OpenAI GPT, or Google Gemini to interact with your files
- **Granular Permissions**: Control which operations the AI can perform (always allow, ask, or never allow)
- **Client-Side Only**: Your API key and files never leave your browser (except for AI model API calls)
- **Strict Security**: Content Security Policy (CSP) ensures data only goes to AI provider endpoints
- **Offline Support**: Core app functionality works without internet connection

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

## Available Tools

The AI has access to the following file operations:

- **open_file**: Read file contents
- **create_file**: Create a new file
- **write_file**: Write or update file contents
- **rename_file**: Rename a file
- **move_file**: Move a file to a different location
- **delete_file**: Delete a file (use with caution!)
- **list_files**: List all files in the directory
- **get_file_metadata**: Get file size, type, and last modified date

## Security

Co-do implements several security measures:

1. **Content Security Policy (CSP)**: Only allows connections to AI model provider APIs
2. **Local Storage**: API keys are stored in browser localStorage and never transmitted except to the chosen AI provider
3. **Permission Controls**: User can control which operations are allowed
4. **Ask Before Execute**: By default, all destructive operations require user approval

## Architecture

- **Vite**: Build tool and development server
- **TypeScript**: Type-safe code
- **Vercel AI SDK**: Multi-provider AI integration
- **File System Access API**: Native file system integration
- **Modern CSS**: No frameworks, just modern CSS

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
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration with CSP
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

### Type Checking

```bash
npm run type-check
```

## License

MIT

## Acknowledgments

Inspired by Anthropic's Co-work project.
