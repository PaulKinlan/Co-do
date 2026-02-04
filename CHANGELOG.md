# Changelog

All notable changes to Co-do will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Co-do now monitors your Content Security Policy in real-time, making the firewall visible. A shield icon in the header shows whether network access is locked to your AI provider (green) or fully restricted (red). Click it to see the full network log with CSP violations, blocked requests, and resource timing data. Toast notifications alert you immediately when requests are blocked.

### Added

- CSP violation monitoring via `SecurityPolicyViolationEvent`, `PerformanceObserver`, and `ReportingObserver`
- Network & Security button in header with status dot and violation badge
- Network log modal with CSP state banner, request history, and clear functionality
- Request classification (success, cached, blocked, error, opaque) via Resource Timing API
- Unit tests for network monitor (37 tests)
- Visual regression and accessibility tests for network UI

## [0.1.55] - 2026-02-03

Co-do now supports a powerful new Skills system that lets you save and reuse complex AI workflows across projects. You can now create, list, and run custom skills directly from the app, with easy discovery of skills from `.skills/` and `.claude/skills/` directories.


### Added

- Implement Skills system with SKILL.md open standard support (#182)

## [0.1.54] - 2026-02-03

Co-do now supports OpenRouter, a new AI provider that gives you access to multiple AI models from different providers using a single API key. You can now choose from models like Claude 3.5 Sonnet, GPT-4.1, Gemini 2.5 Flash, and more, expanding the range of AI tools available in the app.


### Added

- Add OpenRouter as AI provider (#94) (#181)

## [0.1.53] - 2026-02-02

We fixed a minor visual glitch by ensuring the background color switches to dark mode in the markdown preview. Now the markdown rendering looks cleaner and more consistent when you're using a dark theme in your browser.


### Fixed

- Set dark mode background on markdown iframe html element (#176)

## [0.1.52] - 2026-02-02

We've improved the workspace list by adding a copy link button directly to each workspace, making it easier to share and access your workspaces. The workspace indicator has been removed, and the list now shows more details and actions for each workspace.


### Other

- Move copy button from workspace indicator into workspace list items (#177)

## [0.1.51] - 2026-02-02

We've removed the ImageMagick tool from Co-do due to technical compatibility issues. You can still use FFmpeg for most media processing tasks, such as video and audio conversion.


### Other

- Remove ImageMagick WASM plugin due to WASI incompatibility (#173)

## [0.1.50] - 2026-02-02

We've given the dark mode a warmer, more sophisticated look with deeper, earthier colors for assistant messages, tool outputs, and activity groups. The changes add depth and subtlety to the interface, making the dark mode feel more polished and easier on the eyes.


### Other

- Redesign dark mode assistant message and tool output styling (#175)

## [0.1.49] - 2026-02-02

We've streamlined our documentation by compressing the CLAUDE.md file, reducing its size by 61% while preserving the essential information about the project's development process and structure. This makes our technical documentation more concise and easier to read without losing any critical details.


### Other

- Compress CLAUDE.md from 44KB to 17KB (61% reduction) (#172)

## [0.1.48] - 2026-02-01

We've improved the file sidebar by adding an expandable/collapsible directory tree structure. Now you can easily collapse and expand folders to better organize and navigate your project files, making it simpler to explore complex directory structures.


### Other

- Fix directory listing to use expandable/collapsible tree structure (#171)

## [0.1.47] - 2026-02-01

Co-do now offers a workspace switcher in the sidebar, making it easy to view and jump between different project spaces. You can also remove workspaces you no longer need, helping you keep your development environment clean and organized.


### Added

- Add workspace switcher to sidebar (#170)

## [0.1.46] - 2026-02-01

Co-do now supports reading and writing media files directly from disk when using FFmpeg tools, making it easier to handle large files without cluttering the conversation context. You can now specify input and output file paths, which helps keep your AI interactions clean and efficient.


### Other

- Add inputPath/outputPath support for media tools to avoid base64 in context (#169)

## [0.1.45] - 2026-02-01

Co-do has improved how tool permissions work during an AI conversation. Now, when the AI wants to use a tool, you'll see a smoother permission process that remembers your choices for the current response and batches similar requests together.


### Other

- Add session-level permission caching and unified tool permission queue (#167)

## [0.1.44] - 2026-02-01

We added a clear guideline for our team about version number management, explaining that automatic version updates happen via GitHub Action and team members should not manually modify version numbers in the project.


### Other

- Remove version number update from commit (#168)

## [0.1.43] - 2026-02-01

We've updated our development tools and dependencies to their latest versions, which should help improve the app's performance and stability behind the scenes. These updates include refreshed build tools and type definitions that make Co-do run more smoothly.


### Other

- Bump the dev-dependencies group with 3 updates (#161)

## [0.1.42] - 2026-02-01

We've updated our AI dependencies to the latest versions, which should improve performance and stability for our AI-powered features like code completion and chat assistance. These updates bring the latest improvements from our AI integration providers to enhance your collaborative coding experience.


### Other

- Bump the ai-sdk-dependencies group with 4 updates (#160)

## [0.1.41] - 2026-02-01

We updated our GitHub Actions workflow to use the latest version of the Node.js setup action, which helps ensure our testing infrastructure stays current and reliable.


### Other

- Bump actions/setup-node from 4 to 6 (#158)

## [0.1.40] - 2026-02-01

We've updated our GitHub Actions workflows to use the latest version of the checkout action. This ensures our automated processes run smoothly with the most up-to-date tools.


### Other

- Bump actions/checkout from 4 to 6 (#157)

## [0.1.39] - 2026-02-01

We've added a new section to our documentation with contact information and a link to an informative article about Co-do's approach to browser-based collaborative coding. Users can now easily find ways to reach out or learn more about our platform.


### Other

- Add contact information and reading resources to documentation (#166)

## [0.1.38] - 2026-02-01

We've added an instant scroll option when restoring previous chat history, making it easier to quickly jump to the bottom of long conversations without unnecessary animations. This is especially helpful for users who prefer faster interactions or have accessibility needs.


### Other

- Add instant scroll option for restored message history (#163)

## [0.1.37] - 2026-02-01

We've added a "New Workspace" button to the sidebar, making it easier for you to start a fresh coding project with just one click. The button will appear when you have an active workspace and allows you to quickly create a new workspace without navigating through multiple menus.


### Other

- Add "New Workspace" button to sidebar (#164)

## [0.1.36] - 2026-02-01

We've updated our documentation to provide a clearer overview of WebAssembly (WASM) tools, classifying them by their build interface and highlighting which tools work best with Co-do. This helps developers more easily understand how different programming language runtimes and tools can be integrated into our collaborative coding platform.


### Other

- Classify all WASM tools by build interface (WASI vs Emscripten vs wasm-bindgen) (#165)

## [0.1.35] - 2026-02-01

We've added automatic updates for our project's dependencies, which means Co-do will now get regular, safe upgrades to its underlying libraries and tools. This helps keep the app secure and running smoothly with minimal manual effort.


### Added

- Add dependabot configuration for npm and GitHub Actions dependencies

## [0.1.34] - 2026-02-01

Co-do now supports on-demand loading of powerful image and video processing tools. ImageMagick and FFmpeg can now be downloaded when needed, reducing initial app size and making advanced media manipulation just a click away.


### Added

- Add lazy-loaded WASM modules for ImageMagick and FFmpeg (#153)

## [0.1.32] - 2026-02-01

Co-do now supports connecting to Google Stitch servers for enhanced cloud integration, allowing users to seamlessly link their projects with additional backend services. This update provides more flexibility for developers looking to extend their collaborative coding environment with Google's cloud infrastructure.


### Added

- Add Google Stitch MCP server configuration (#152)

## [0.1.31] - 2026-02-01

Co-do now sends desktop notifications when AI tasks require permission approval and the app is running in a background tab. This helps users stay informed about important actions even when they're working in another window or application.


### Other

- Add desktop notification when AI needs permission approval (#150)

## [0.1.30] - 2026-02-01

We've improved the dark mode experience by making checkboxes more readable. Now, form controls like checkboxes will properly adjust to dark color schemes, ensuring better visibility and contrast for users who prefer darker interfaces.


### Fixed

- Apply dark color scheme to checkboxes for proper dark mode contrast (#151)

## [0.1.29] - 2026-02-01

Co-do now displays tool outputs as prominent, easy-to-read inline blocks right next to assistant messages, making it easier to see the results of code generation or analysis tools. These new output blocks have improved formatting, scrollable content, and clear headers to help you quickly understand what each tool produced.


### Other

- Promote tool output to prominent inline blocks alongside LLM text (#149)

## [0.1.28] - 2026-02-01

Co-do now supports native desktop notifications for AI tasks, so you'll get an alert when a task completes while you're working in another browser tab. You can enable these notifications in the app settings, and they require your browser's permission to work.


### Other

- Add native desktop notifications for task completion (#148)

## [0.1.27] - 2026-02-01

We've added a helpful new feature that automatically installs project dependencies if they're missing when you run build or type-checking scripts. This means you'll have a smoother setup experience and fewer unexpected errors when getting started with Co-do.


### Fixed

- Auto-install deps when node_modules is missing in build/type-check scripts (#147)

## [0.1.26] - 2026-01-31

We updated our list of WebAssembly tools to use authentic, verified GitHub repository links instead of fabricated ones. This ensures that developers can trust and easily access the real projects when exploring WebAssembly capabilities in Co-do.


### Fixed

- Replace all fabricated GitHub URLs in WASM tools list with verified real repos (#146)

## [0.1.25] - 2026-01-31

We've made the code generation faster and more efficient by improving how our AI handles large tool outputs. Now, when running tools, the AI gets a quick summary instead of the full result, which helps it respond more quickly and avoids unnecessary repetition.


### Other

- Improve LLM context efficiency for WASM tool output (#145)

## [0.1.24] - 2026-01-31

Co-do now supports binary data in WASM tools, allowing you to process images, compressed files, and other non-text data without corruption. Tools can now receive and output raw binary files seamlessly, making it easier to work with a wider range of file types.


### Other

- Add binary data support for WASM tools (#142)

## [0.1.23] - 2026-01-31

We've added more detailed guidelines for code reviews and documentation accuracy, focusing on catching common bugs and improving the review process for our collaborative coding tool. These updates will help our team write more robust code and catch potential issues earlier in development.


### Other

- Add lessons learned from PR reviews and improve review skills (#144)

## [0.1.22] - 2026-01-31

We've improved how WebAssembly tools are loaded and updated in Co-do, adding automatic cache-busting for tool binaries and ensuring built-in tools stay up-to-date with the latest configurations. This means faster, more reliable tool loading and seamless updates in the background.


### Fixed

- Fix WASM output pipeline and add unit tests (#143)

## [0.1.21] - 2026-01-31

Co-do now includes a powerful new PR review system that helps developers catch potential issues early and improve their code quality. With new review tools that check everything from test coverage to code complexity, you can get comprehensive feedback on your pull requests with just a single command.


### Added

- Add code-simplifier agent and pr-review-toolkit plugin (#141)

## [0.1.20] - 2026-01-31

Co-do now uses a smarter way to check for app updates across browser tabs. This means you'll get update notifications more reliably, especially if you have multiple Co-do tabs open, with less unnecessary network requests.


### Other

- Refactor version checking to use SharedWorker for cross-tab deduplication (#137)

## [0.1.19] - 2026-01-31

We've improved how tool results are displayed and processed. Now, when a tool runs, you'll see the full output directly in the results, and large outputs are neatly organized in an expandable section. We've also added better support for tools that need text input, making the experience smoother for complex operations.


### Fixed

- Return full WASM stdout to LLM and add stdin support to all tools (#140)

## [0.1.18] - 2026-01-31

We've added a new GitHub Actions workflow that allows Claude AI to automatically help with code suggestions and reviews when tagged in comments or issues. This should help streamline collaboration and provide intelligent code assistance directly in your GitHub repository.


### Other

- Add Claude Code GitHub Actions workflow (#139)

## [0.1.17] - 2026-01-31

We've added an automated system to help our team quickly categorize and prioritize GitHub issues. Now, when a new issue is created, our AI assistant will automatically analyze it and apply the most appropriate labels to help us track and manage incoming feedback more efficiently.


### Other

- Add Claude issue triage workflow (#138)

## [0.1.16] - 2026-01-31

We've reorganized how tools are displayed in the permissions panel, now grouping WebAssembly tools by their functional purpose like "Text Processing" or "Crypto" instead of listing them all together. This makes it easier to find and understand the tools available in Co-do.


### Other

- Group WASM tools by functional category in permissions UI (#136)

## [0.1.15] - 2026-01-31

We've improved the update notification to show the exact version number when a new version is available, and made sure the changelog link points directly to the relevant version details. Now you'll see a clear message about which new version you can update to, with an easy link to see what's changed.


### Fixed

- Show version number in update notification and fix changelog links (#135)

## [0.1.14] - 2026-01-31

We've updated our documentation to provide more clarity on how our WebAssembly tools work, including details about our new tool chaining capabilities and our comprehensive security approach. The update includes insights into how we build, load, and securely execute custom tools within the browser.


### Other

- Comprehensive documentation update for WASM tools, pipe chaining, and security (#134)

## [0.1.13] - 2026-01-31

We've made a small internal update that helps ensure our collaborative coding environment runs smoothly. This version bump and minor log change improves the reliability of our background processing.


### Other

- Modify wasm worker string to force hash regeneration (#133)

## [0.1.12] - 2026-01-31

We've updated our rebase workflow documentation to make it crystal clear: always commit your changes before rebasing to prevent potential errors. The new guide provides more detailed, step-by-step instructions to help developers smoothly integrate their code changes.


### Other

- Fix rebase workflow to explicitly commit before rebasing (#132)

## [0.1.11] - 2026-01-31

We updated our background code processing to ensure you get the latest performance improvements and features when using Co-do's collaborative coding environment.


### Other

- Bump worker cache version to invalidate Cloudflare cache (#131)

## [0.1.10] - 2026-01-31

Co-do just got better at showing tool results! We've improved how we display tool outputs by creating cleaner, more readable formatting for tool calls and results, which makes it easier to understand what's happening behind the scenes.


### Other

- Extract tool response formatting to pure functions and add dark mode tests (#127)

## [0.1.9] - 2026-01-31

We've added detailed guidelines for our team's git workflow, focusing on how to cleanly rebase branches and handle dependency conflicts before pushing code. These new instructions will help prevent merge issues and keep our collaborative coding environment running smoothly.


### Other

- Add pre-push rebase workflow guidelines to CLAUDE.md (#130)

## [0.1.8] - 2026-01-31

We've simplified our security settings to make WebAssembly and web workers work more smoothly across Co-do. This update improves performance and reduces potential access restrictions when using advanced code compilation features.


### Other

- Simplify CSP by always including wasm-unsafe-eval in script-src (#128)

## [0.1.7] - 2026-01-31

We've upgraded our WebAssembly tools to support pipe chaining, allowing you to now connect different text processing and cryptography tools more seamlessly in your workflows. You can now send the output of one tool directly as input to another tool, making complex text transformations and data processing much easier.


### Other

- Add pipeable manifest field for WASM tools pipe chain support (#129)

## [0.1.6] - 2026-01-31

We've improved how web browsers and content delivery networks cache Co-do's pages and assets. Now, HTML pages will always load with the most up-to-date security settings, while static assets like images and scripts will load faster by being cached more efficiently.


### Other

- Add Cache-Control headers to prevent CDN caching of dynamic CSP (#126)

## [0.1.5] - 2026-01-31

We've simplified the tool permissions and streamlined our command processing. Now you can easily chain text processing commands like grep, sort, and word count directly through a single "pipe" command, making complex file operations more intuitive and efficient.


### Other

- Remove duplicate JS tools, prefer WASM implementations (#119)

## [0.1.4] - 2026-01-31

Co-do now supports WebAssembly compilation in worker scripts with improved security settings. This update allows developers to run WebAssembly modules in collaborative coding sessions while maintaining strict content security policies.


### Other

- Add wasm-unsafe-eval CSP for worker scripts (#124)

## [0.1.3] - 2026-01-31

We've added an information button next to the tool upload section that opens a comprehensive guide for creating custom WebAssembly tools. This guide provides developers with detailed instructions on how to package and upload their own tools to Co-do.


### Other

- Add WebAssembly tool packaging guide and info button (#122)

## [0.1.2] - 2026-01-31

We've improved our changelog and version tracking to automatically update the app's version number and create organized changelog sections when we merge changes. Now when new features or fixes are added, the changelog will be automatically updated with clear, easy-to-read version details.


### Fixed

- Auto-bump version and create versioned changelog sections on each merge to main (#125)

## [0.1.1] - 2025-01-19

### Added
- Changelog notifications - update notifications now include a link to view what's changed

### Fixed
- Add color-scheme declaration to markdown iframe for dark mode support (#118)
- Set transparent background on markdown iframe to fix dark mode contrast (#116)

### Other
- Refactor pipe tool to use self-registering pipeable command pattern (#120)
- Reorganize dark mode styles to fix CSS cascade issues (#121)
- Improve tool result display and implement result caching (#117)
- Claude/add command chaining (#115)
- Fix changelog automation workflow failures (#114)

## [0.1.0] - 2025-01-18

### Added
- SEO: Added robots.txt to allow search engine indexing
- Auto-dismiss restore message after folder restoration
- Version-based update detection with build checksums
- Added humans.txt with author credit
- App icon in header next to title

### Changed
- Improved privacy notice styling

## [0.0.1] - 2025-01-17

### Added
- Initial release of Co-do
- File System Access API integration for native filesystem access
- AI-powered file operations with support for multiple providers (Anthropic, OpenAI, Google)
- Real-time chat interface for interacting with AI
- Tool permissions system for controlling AI capabilities
- PWA support with offline caching
- Dark mode support








[0.1.11]: https://github.com/PaulKinlan/Co-do/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/PaulKinlan/Co-do/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/PaulKinlan/Co-do/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/PaulKinlan/Co-do/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/PaulKinlan/Co-do/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/PaulKinlan/Co-do/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/PaulKinlan/Co-do/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/PaulKinlan/Co-do/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/PaulKinlan/Co-do/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/PaulKinlan/Co-do/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/PaulKinlan/Co-do/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/PaulKinlan/Co-do/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/PaulKinlan/Co-do/releases/tag/v0.0.1

[0.1.15]: https://github.com/PaulKinlan/Co-do/compare/v0.1.11......v0.1.15

[0.1.16]: https://github.com/PaulKinlan/Co-do/compare/v0.1.15......v0.1.16

[0.1.17]: https://github.com/PaulKinlan/Co-do/compare/v0.1.16......v0.1.17

[0.1.18]: https://github.com/PaulKinlan/Co-do/compare/v0.1.17......v0.1.18

[0.1.19]: https://github.com/PaulKinlan/Co-do/compare/v0.1.18......v0.1.19

[0.1.20]: https://github.com/PaulKinlan/Co-do/compare/v0.1.19......v0.1.20

[0.1.21]: https://github.com/PaulKinlan/Co-do/compare/v0.1.20......v0.1.21

[0.1.22]: https://github.com/PaulKinlan/Co-do/compare/v0.1.21......v0.1.22

[0.1.23]: https://github.com/PaulKinlan/Co-do/compare/v0.1.22......v0.1.23

[0.1.24]: https://github.com/PaulKinlan/Co-do/compare/v0.1.23......v0.1.24

[0.1.25]: https://github.com/PaulKinlan/Co-do/compare/v0.1.24......v0.1.25

[0.1.26]: https://github.com/PaulKinlan/Co-do/compare/v0.1.25......v0.1.26

[0.1.27]: https://github.com/PaulKinlan/Co-do/compare/v0.1.26......v0.1.27

[0.1.28]: https://github.com/PaulKinlan/Co-do/compare/v0.1.27......v0.1.28

[0.1.29]: https://github.com/PaulKinlan/Co-do/compare/v0.1.28......v0.1.29

[0.1.30]: https://github.com/PaulKinlan/Co-do/compare/v0.1.29......v0.1.30

[0.1.31]: https://github.com/PaulKinlan/Co-do/compare/v0.1.30......v0.1.31

[0.1.32]: https://github.com/PaulKinlan/Co-do/compare/v0.1.31......v0.1.32

[0.1.33]: https://github.com/PaulKinlan/Co-do/compare/v0.1.32......v0.1.33

[0.1.34]: https://github.com/PaulKinlan/Co-do/compare/v0.1.33......v0.1.34

[0.1.35]: https://github.com/PaulKinlan/Co-do/compare/v0.1.34......v0.1.35

[0.1.36]: https://github.com/PaulKinlan/Co-do/compare/v0.1.35......v0.1.36

[0.1.37]: https://github.com/PaulKinlan/Co-do/compare/v0.1.36......v0.1.37

[0.1.38]: https://github.com/PaulKinlan/Co-do/compare/v0.1.37......v0.1.38

[0.1.39]: https://github.com/PaulKinlan/Co-do/compare/v0.1.38......v0.1.39

[0.1.40]: https://github.com/PaulKinlan/Co-do/compare/v0.1.39......v0.1.40

[0.1.41]: https://github.com/PaulKinlan/Co-do/compare/v0.1.40......v0.1.41

[0.1.42]: https://github.com/PaulKinlan/Co-do/compare/v0.1.41......v0.1.42

[0.1.43]: https://github.com/PaulKinlan/Co-do/compare/v0.1.42......v0.1.43

[0.1.44]: https://github.com/PaulKinlan/Co-do/compare/v0.1.43......v0.1.44

[0.1.45]: https://github.com/PaulKinlan/Co-do/compare/v0.1.44......v0.1.45

[0.1.46]: https://github.com/PaulKinlan/Co-do/compare/v0.1.45......v0.1.46

[0.1.47]: https://github.com/PaulKinlan/Co-do/compare/v0.1.46......v0.1.47

[0.1.48]: https://github.com/PaulKinlan/Co-do/compare/v0.1.47......v0.1.48

[0.1.49]: https://github.com/PaulKinlan/Co-do/compare/v0.1.48......v0.1.49

[0.1.50]: https://github.com/PaulKinlan/Co-do/compare/v0.1.49......v0.1.50

[0.1.51]: https://github.com/PaulKinlan/Co-do/compare/v0.1.50......v0.1.51

[0.1.52]: https://github.com/PaulKinlan/Co-do/compare/v0.1.51......v0.1.52

[0.1.53]: https://github.com/PaulKinlan/Co-do/compare/v0.1.52......v0.1.53

[0.1.54]: https://github.com/PaulKinlan/Co-do/compare/v0.1.53......v0.1.54

[Unreleased]: https://github.com/PaulKinlan/Co-do/compare/v0.1.55...HEAD
[0.1.55]: https://github.com/PaulKinlan/Co-do/compare/v0.1.54......v0.1.55
