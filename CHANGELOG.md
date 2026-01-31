# Changelog

All notable changes to Co-do will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

We've cleaned up how dark mode styles are applied to resolve some visual inconsistencies. This should make the app's appearance more consistent and reliable when switching between light and dark modes.


### Other

- Reorganize dark mode styles to fix CSS cascade issues (#121)

Co-do now provides smarter handling of tool results, with improved display and caching for large outputs. When tools generate extensive results, users can now easily expand and view the full content, while the AI receives a concise summary.


### Other

- Improve tool result display and implement result caching (#117)

We've improved dark mode support in the markdown preview, ensuring a more consistent and comfortable reading experience across different color schemes and browser settings.


### Fixed

- Add color-scheme declaration to markdown iframe for dark mode support (#118)

We've added a new permission setting for piping or chaining commands in the Co-do app. Now you can control how you want to handle command chaining, with options to always allow, ask each time, or never allow.


### Other

- Claude/add command chaining (#115)

We've improved the markdown preview in dark mode by making the background transparent, ensuring better readability and a smoother visual experience when switching between light and dark themes.


### Fixed

- Set transparent background on markdown iframe to fix dark mode contrast (#116)

We've improved our changelog automation workflow behind the scenes to make sure our changelog updates run more smoothly. This should help our team keep the app's release notes accurate and up-to-date with less manual work.


### Other

- Fix changelog automation workflow failures (#114)

### Added
- Changelog notifications - update notifications now include a link to view what's changed

## [2025-01-18]

### Added
- SEO: Added robots.txt to allow search engine indexing
- Auto-dismiss restore message after folder restoration
- Version-based update detection with build checksums
- Added humans.txt with author credit
- App icon in header next to title

### Changed
- Improved privacy notice styling

## [2025-01-17]

### Added
- Initial release of Co-do
- File System Access API integration for native filesystem access
- AI-powered file operations with support for multiple providers (Anthropic, OpenAI, Google)
- Real-time chat interface for interacting with AI
- Tool permissions system for controlling AI capabilities
- PWA support with offline caching
- Dark mode support

[Unreleased]: https://github.com/PaulKinlan/Co-do/compare/main...HEAD
[2025-01-18]: https://github.com/PaulKinlan/Co-do/commits/main
[2025-01-17]: https://github.com/PaulKinlan/Co-do/commits/main
