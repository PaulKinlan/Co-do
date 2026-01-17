# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Co-do is a Cowork-like experience in the browser using the File System Access API. This project enables collaborative coding and file editing directly in the browser with native filesystem integration.

## Browser Support

**Target: Latest Chrome (Chrome 140+)**

This project relies on the File System Access API, which is currently best supported in Chromium-based browsers. This means:

- Use all modern web platform APIs without concern for legacy browser support
- No polyfills required for modern JavaScript features
- Chrome-specific APIs are acceptable when they provide better functionality
- Focus on Baseline Newly Available and Baseline Widely Available features
- The File System Access API is the core dependency (Chrome 86+, Edge 86+, limited Safari support)

When implementing features, always use modern browser APIs as documented in `.claude/skills/modern-web-dev/SKILL.md`.

## Development Status

**This is an early-stage project.** As the codebase develops, this file should be updated with:

- Build commands (e.g., `npm run build`, `npm run dev`)
- Test commands (e.g., `npm test`, `npm run test:watch`)
- Lint/format commands (e.g., `npm run lint`, `npm run format`)
- Project structure and architecture details
- Key dependencies and their purposes

## Key Technologies

Given the project goals, expect to use:

- **File System Access API**: Core functionality for native filesystem integration
- **Modern ES Modules**: For all JavaScript code
- **Web Workers or Service Workers**: For background processing if needed
- **IndexedDB or localStorage**: For local state/settings persistence
- **WebSockets or WebRTC**: For real-time collaboration features

## Architecture Guidelines

When building this project:

1. **Modern APIs First**: Always prefer modern web platform APIs over polyfills or legacy approaches. See `.claude/skills/modern-web-dev/SKILL.md` for comprehensive guidance.

2. **File System Access API**: This is the core feature. Familiarize yourself with:
   - `window.showOpenFilePicker()`
   - `window.showSaveFilePicker()`
   - `window.showDirectoryPicker()`
   - FileSystemFileHandle and FileSystemDirectoryHandle APIs

3. **Security Considerations**: File system access requires user permission. Always handle:
   - Permission requests gracefully
   - Permission denial scenarios
   - Secure file operations

4. **Collaboration Features**: When implementing Cowork-like functionality, consider:
   - Real-time synchronization patterns
   - Conflict resolution for concurrent edits
   - Presence indicators for collaborators
   - Efficient data transfer for file content

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
