/**
 * Unit tests for the Skills system — SKILL.md parser, argument substitution,
 * and SKILL.md generation.
 */
import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  substituteArguments,
  splitArguments,
  generateSkillMd,
} from '../../src/skills';

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------
describe('parseFrontmatter', () => {
  it('parses basic frontmatter with all fields', () => {
    const content = `---
name: rename-images
description: Rename images by content
argument-hint: [directory] [format]
allowed-tools:
  - list_files
  - open_file
  - rename_file
user-invocable: true
model: opus
---

# Instructions here

Do stuff.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe('rename-images');
    expect(result!.frontmatter.description).toBe('Rename images by content');
    expect(result!.frontmatter['argument-hint']).toBe('[directory] [format]');
    expect(result!.frontmatter['allowed-tools']).toEqual(['list_files', 'open_file', 'rename_file']);
    expect(result!.frontmatter['user-invocable']).toBe(true);
    expect(result!.frontmatter.model).toBe('opus');
    expect(result!.body).toContain('# Instructions here');
    expect(result!.body).toContain('Do stuff.');
  });

  it('parses multi-line description with literal block scalar', () => {
    const content = `---
name: test-skill
description: |
  This is a multi-line description.
  It spans several lines.

  With a blank line too.
---

Body text.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.description).toContain('This is a multi-line description.');
    expect(result!.frontmatter.description).toContain('It spans several lines.');
  });

  it('returns null when no frontmatter delimiters present', () => {
    const content = '# Just a markdown file\n\nNo frontmatter here.';
    expect(parseFrontmatter(content)).toBeNull();
  });

  it('returns null when name field is missing', () => {
    const content = `---
description: No name field
---

Body.`;

    expect(parseFrontmatter(content)).toBeNull();
  });

  it('parses quoted string values', () => {
    const content = `---
name: "my-skill"
description: 'A skill with quotes'
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe('my-skill');
    expect(result!.frontmatter.description).toBe('A skill with quotes');
  });

  it('parses inline array syntax', () => {
    const content = `---
name: inline-array
description: Test inline arrays
allowed-tools: [list_files, open_file, create_file]
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter['allowed-tools']).toEqual(['list_files', 'open_file', 'create_file']);
  });

  it('handles boolean values correctly', () => {
    const content = `---
name: bool-test
description: Test booleans
user-invocable: false
disable-model-invocation: true
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter['user-invocable']).toBe(false);
    expect(result!.frontmatter['disable-model-invocation']).toBe(true);
  });

  it('handles empty body after frontmatter', () => {
    const content = `---
name: empty-body
description: No body
---
`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe('empty-body');
    expect(result!.body.trim()).toBe('');
  });

  it('parses real-world Claude Code SKILL.md format', () => {
    const content = `---
name: code-reviewer
description: |
  Expert code reviewer that checks code against project guidelines in CLAUDE.md with high
  precision to minimize false positives. Reviews for bugs, style violations, and code quality.

  Triggers: Before committing code, when reviewing changes, when checking code quality.

  Examples:
  - "Review my recent changes" -> reviews unstaged git diff against project guidelines
  - "Check if everything looks good" -> comprehensive code review
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - TodoWrite
  - Task
user-invokable: true
---

# Code Reviewer Agent

You are an expert code reviewer.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe('code-reviewer');
    expect(result!.frontmatter.description).toContain('Expert code reviewer');
    expect(result!.frontmatter['allowed-tools']).toEqual(['Bash', 'Read', 'Glob', 'Grep', 'TodoWrite', 'Task']);
    // user-invokable (alternate spelling) should be mapped to user-invocable
    expect(result!.frontmatter['user-invocable']).toBe(true);
    expect(result!.body).toContain('# Code Reviewer Agent');
  });

  it('handles comments in YAML', () => {
    const content = `---
name: comment-test
# This is a comment
description: Has comments
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe('comment-test');
    expect(result!.frontmatter.description).toBe('Has comments');
  });

  it('defaults description to empty string when missing', () => {
    const content = `---
name: no-desc
---

Body.`;

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.description).toBe('');
  });
});

// ---------------------------------------------------------------------------
// splitArguments
// ---------------------------------------------------------------------------
describe('splitArguments', () => {
  it('splits simple space-separated arguments', () => {
    expect(splitArguments('./photos kebab-case')).toEqual(['./photos', 'kebab-case']);
  });

  it('handles double-quoted arguments', () => {
    expect(splitArguments('"hello world" foo')).toEqual(['hello world', 'foo']);
  });

  it('handles single-quoted arguments', () => {
    expect(splitArguments("'hello world' foo")).toEqual(['hello world', 'foo']);
  });

  it('returns empty array for empty string', () => {
    expect(splitArguments('')).toEqual([]);
  });

  it('handles multiple spaces between arguments', () => {
    expect(splitArguments('a   b   c')).toEqual(['a', 'b', 'c']);
  });

  it('handles tabs as separators', () => {
    expect(splitArguments("a\tb")).toEqual(['a', 'b']);
  });

  it('handles single argument', () => {
    expect(splitArguments('only-one')).toEqual(['only-one']);
  });

  it('handles mixed quoted and unquoted', () => {
    expect(splitArguments('./dir "file name.txt" --flag')).toEqual(['./dir', 'file name.txt', '--flag']);
  });
});

// ---------------------------------------------------------------------------
// substituteArguments
// ---------------------------------------------------------------------------
describe('substituteArguments', () => {
  it('substitutes $ARGUMENTS with full args string', () => {
    const body = 'Process: $ARGUMENTS';
    expect(substituteArguments(body, './photos kebab-case')).toBe('Process: ./photos kebab-case');
  });

  it('substitutes positional $0 and $1', () => {
    const body = 'Dir: $0, Format: $1';
    expect(substituteArguments(body, './photos kebab-case')).toBe('Dir: ./photos, Format: kebab-case');
  });

  it('substitutes $ARGUMENTS and positional args together', () => {
    const body = 'All: $ARGUMENTS\nFirst: $0\nSecond: $1';
    const result = substituteArguments(body, './photos kebab-case');
    expect(result).toBe('All: ./photos kebab-case\nFirst: ./photos\nSecond: kebab-case');
  });

  it('replaces missing positional args with empty string', () => {
    const body = 'A: $0, B: $1, C: $2';
    expect(substituteArguments(body, 'only-one')).toBe('A: only-one, B: , C: ');
  });

  it('handles no arguments', () => {
    const body = 'Dir: $0 (default: .)';
    expect(substituteArguments(body, '')).toBe('Dir:  (default: .)');
  });

  it('handles body without any placeholders', () => {
    const body = 'Just some text with no placeholders';
    expect(substituteArguments(body, 'args')).toBe('Just some text with no placeholders');
  });

  it('handles multiple occurrences of the same placeholder', () => {
    const body = '$0 and $0 again';
    expect(substituteArguments(body, 'value')).toBe('value and value again');
  });

  it('handles quoted arguments in positional substitution', () => {
    const body = 'Dir: $0, Name: $1';
    expect(substituteArguments(body, '"my directory" "my name"')).toBe('Dir: my directory, Name: my name');
  });
});

// ---------------------------------------------------------------------------
// generateSkillMd
// ---------------------------------------------------------------------------
describe('generateSkillMd', () => {
  it('generates valid SKILL.md with all fields', () => {
    const content = generateSkillMd({
      name: 'rename-images',
      description: 'Rename images by content',
      instructions: '# Rename Images\n\nDo the thing.',
      allowedTools: ['list_files', 'open_file', 'rename_file'],
      model: 'opus',
      userInvocable: true,
      argumentHint: '[directory] [format]',
    });

    expect(content).toContain('---');
    expect(content).toContain('name: rename-images');
    expect(content).toContain('description: Rename images by content');
    expect(content).toContain('argument-hint: [directory] [format]');
    expect(content).toContain('  - list_files');
    expect(content).toContain('  - open_file');
    expect(content).toContain('  - rename_file');
    expect(content).toContain('user-invocable: true');
    expect(content).toContain('model: opus');
    expect(content).toContain('# Rename Images');

    // Verify it round-trips through the parser
    const parsed = parseFrontmatter(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.name).toBe('rename-images');
    expect(parsed!.frontmatter['allowed-tools']).toEqual(['list_files', 'open_file', 'rename_file']);
  });

  it('generates minimal SKILL.md with required fields only', () => {
    const content = generateSkillMd({
      name: 'simple',
      description: 'A simple skill',
      instructions: 'Do something simple.',
    });

    expect(content).toContain('name: simple');
    expect(content).toContain('description: A simple skill');
    expect(content).toContain('Do something simple.');
    expect(content).not.toContain('allowed-tools');
    expect(content).not.toContain('model');
    expect(content).not.toContain('argument-hint');

    // Verify round-trip
    const parsed = parseFrontmatter(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.name).toBe('simple');
  });

  it('handles multi-line description with literal block scalar', () => {
    const content = generateSkillMd({
      name: 'multi-line',
      description: 'Line one\nLine two\nLine three',
      instructions: 'Body.',
    });

    expect(content).toContain('description: |');
    expect(content).toContain('  Line one');
    expect(content).toContain('  Line two');

    // Verify round-trip preserves multi-line description
    const parsed = parseFrontmatter(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.description).toContain('Line one');
    expect(parsed!.frontmatter.description).toContain('Line two');
  });

  it('end-to-end: generate, parse, and substitute', () => {
    const content = generateSkillMd({
      name: 'find-todos',
      description: 'Find TODO comments in a directory',
      instructions: 'Search $0 (default: .) for TODO, FIXME, and HACK comments.\nReport findings with $1 format (default: table).',
      allowedTools: ['list_files', 'open_file'],
      argumentHint: '[directory] [format]',
    });

    const parsed = parseFrontmatter(content);
    expect(parsed).not.toBeNull();

    const filled = substituteArguments(parsed!.body, './src markdown');
    expect(filled).toContain('Search ./src');
    expect(filled).toContain('with markdown format');
  });
});
