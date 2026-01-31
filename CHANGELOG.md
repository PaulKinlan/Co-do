# Changelog

All notable changes to Co-do will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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










[Unreleased]: https://github.com/PaulKinlan/Co-do/compare/v0.1.10...HEAD
[0.1.10]: https://github.com/PaulKinlan/Co-do/commits/main
