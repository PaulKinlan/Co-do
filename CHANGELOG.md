# Changelog

All notable changes to Co-do will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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


[Unreleased]: https://github.com/PaulKinlan/Co-do/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/PaulKinlan/Co-do/commits/main
