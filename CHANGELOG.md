# Changelog

All notable changes to Co-do will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

[Unreleased]: https://github.com/PaulKinlan/Co-do/compare/v0.1.29...HEAD
[0.1.29]: https://github.com/PaulKinlan/Co-do/compare/v0.1.28......v0.1.29
