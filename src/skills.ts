/**
 * Skills System — SKILL.md Open Standard Parser & Manager
 *
 * Provides YAML frontmatter parsing, $ARGUMENTS/$N parameter substitution,
 * IndexedDB-backed metadata indexing, and filesystem-based skill discovery.
 *
 * Skills are directories containing a SKILL.md file that follows the open
 * standard used by Claude Code, Codex CLI, and other AI tools.
 */

import { fileSystemManager } from './fileSystem';
import { storageManager, SkillMetadata } from './storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed SKILL.md frontmatter fields. */
export interface SkillFrontmatter {
  name: string;
  description: string;
  'allowed-tools'?: string[];
  'user-invocable'?: boolean;
  'disable-model-invocation'?: boolean;
  model?: string;
  'argument-hint'?: string;
}

/** A fully-parsed skill with frontmatter + markdown body. */
export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
  /** Relative path from workspace root to the skill directory. */
  sourcePath: string;
  /** Whether this skill is read-only (e.g. from .claude/skills/). */
  readOnly: boolean;
}

// ---------------------------------------------------------------------------
// YAML Frontmatter Parser
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from a SKILL.md file.
 *
 * Supports the subset of YAML used in SKILL.md files:
 * - String values (plain and quoted)
 * - Boolean values
 * - String arrays (block sequence with `- item` syntax)
 * - Multi-line strings via `|` (literal block scalar)
 *
 * This avoids pulling in a full YAML parser dependency.
 */
export function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const yamlBlock = match[1]!;
  const body = match[2]!;

  const frontmatter: Record<string, unknown> = {};
  const lines = yamlBlock.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++;
      continue;
    }

    // Match `key: value` at root level (no leading whitespace)
    const kvMatch = line.match(/^([a-z][a-z0-9-]*)\s*:\s*(.*)$/i);
    if (!kvMatch) {
      i++;
      continue;
    }

    const key = kvMatch[1]!;
    let rawValue = kvMatch[2]!.trim();

    // Literal block scalar: `key: |`
    if (rawValue === '|') {
      const blockLines: string[] = [];
      i++;
      while (i < lines.length) {
        const blockLine = lines[i]!;
        // Block continues as long as lines are indented
        if (blockLine.match(/^\s+/) || blockLine.trim() === '') {
          blockLines.push(blockLine.replace(/^ {2}/, ''));
          i++;
        } else {
          break;
        }
      }
      // Trim trailing empty lines, add single trailing newline
      while (blockLines.length > 0 && blockLines[blockLines.length - 1]!.trim() === '') {
        blockLines.pop();
      }
      frontmatter[key] = blockLines.join('\n');
      continue;
    }

    // Array: next lines start with `  - `
    if (rawValue === '') {
      // Could be an array — peek at next lines
      const items: string[] = [];
      const nextIdx = i + 1;
      let j = nextIdx;
      while (j < lines.length) {
        const arrLine = lines[j]!;
        const arrMatch = arrLine.match(/^\s+-\s+(.+)$/);
        if (arrMatch) {
          items.push(arrMatch[1]!.trim());
          j++;
        } else if (arrLine.trim() === '') {
          j++;
        } else {
          break;
        }
      }
      if (items.length > 0) {
        frontmatter[key] = items;
        i = j;
        continue;
      }
    }

    // Inline array: `[item1, item2]` — must contain commas to distinguish
    // from plain string values like `[directory] [format]`
    if (rawValue.startsWith('[') && rawValue.endsWith(']') && rawValue.includes(',')) {
      const inner = rawValue.slice(1, -1);
      frontmatter[key] = inner.split(',').map(s => {
        const trimmed = s.trim();
        // Remove surrounding quotes
        if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      }).filter(s => s !== '');
      i++;
      continue;
    }

    // Remove surrounding quotes from string value
    if ((rawValue.startsWith("'") && rawValue.endsWith("'")) ||
        (rawValue.startsWith('"') && rawValue.endsWith('"'))) {
      rawValue = rawValue.slice(1, -1);
    }

    // Boolean values
    if (rawValue === 'true') {
      frontmatter[key] = true;
    } else if (rawValue === 'false') {
      frontmatter[key] = false;
    } else {
      frontmatter[key] = rawValue;
    }

    i++;
  }

  // Validate required fields
  if (!frontmatter.name || typeof frontmatter.name !== 'string') {
    return null;
  }

  const result: SkillFrontmatter = {
    name: frontmatter.name as string,
    description: (frontmatter.description as string) ?? '',
  };

  if (Array.isArray(frontmatter['allowed-tools'])) {
    result['allowed-tools'] = frontmatter['allowed-tools'] as string[];
  }
  if (typeof frontmatter['user-invocable'] === 'boolean') {
    result['user-invocable'] = frontmatter['user-invocable'];
  }
  // Accept both spellings: user-invocable (from existing .claude/skills) and user-invokable
  if (typeof frontmatter['user-invokable'] === 'boolean' && result['user-invocable'] === undefined) {
    result['user-invocable'] = frontmatter['user-invokable'] as boolean;
  }
  if (typeof frontmatter['disable-model-invocation'] === 'boolean') {
    result['disable-model-invocation'] = frontmatter['disable-model-invocation'];
  }
  if (typeof frontmatter.model === 'string') {
    result.model = frontmatter.model;
  }
  if (typeof frontmatter['argument-hint'] === 'string') {
    result['argument-hint'] = frontmatter['argument-hint'];
  }

  return { frontmatter: result, body };
}

// ---------------------------------------------------------------------------
// $ARGUMENTS Substitution
// ---------------------------------------------------------------------------

/**
 * Substitute `$ARGUMENTS`, `$0`, `$1`, ... `$N` placeholders in a skill body.
 *
 * `$ARGUMENTS` is replaced with the full arguments string.
 * `$0`, `$1`, ... are replaced with positional arguments split by whitespace.
 */
export function substituteArguments(body: string, args: string): string {
  if (!args && !body.includes('$')) return body;

  // Split arguments by whitespace, respecting quoted strings
  const positional = splitArguments(args);

  // Replace $ARGUMENTS with the full string
  let result = body.replaceAll('$ARGUMENTS', args);

  // Find the highest $N referenced in the body so we replace all of them
  let maxN = positional.length - 1;
  const matches = body.matchAll(/\$(\d+)/g);
  for (const m of matches) {
    const n = parseInt(m[1]!, 10);
    if (n > maxN) maxN = n;
  }

  // Replace $N positional arguments (highest first to avoid $1 matching in $10)
  for (let n = maxN; n >= 0; n--) {
    result = result.replaceAll(`$${n}`, positional[n] ?? '');
  }

  return result;
}

/**
 * Split an arguments string into positional tokens.
 * Supports simple quoted strings: `"hello world"` or `'hello world'`
 * are treated as a single argument.
 */
export function splitArguments(args: string): string[] {
  if (!args) return [];

  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const char = args[i]!;

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (char === ' ' || char === '\t') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// SKILL.md Generation
// ---------------------------------------------------------------------------

/**
 * Generate a SKILL.md file content string from structured data.
 */
export function generateSkillMd(opts: {
  name: string;
  description: string;
  instructions: string;
  allowedTools?: string[];
  model?: string;
  userInvocable?: boolean;
  argumentHint?: string;
}): string {
  const lines: string[] = ['---'];

  lines.push(`name: ${opts.name}`);

  // Multi-line description uses literal block scalar
  if (opts.description.includes('\n')) {
    lines.push('description: |');
    for (const descLine of opts.description.split('\n')) {
      lines.push(`  ${descLine}`);
    }
  } else {
    lines.push(`description: ${opts.description}`);
  }

  if (opts.argumentHint) {
    lines.push(`argument-hint: ${opts.argumentHint}`);
  }

  if (opts.allowedTools && opts.allowedTools.length > 0) {
    lines.push('allowed-tools:');
    for (const tool of opts.allowedTools) {
      lines.push(`  - ${tool}`);
    }
  }

  if (opts.userInvocable !== undefined) {
    lines.push(`user-invocable: ${opts.userInvocable}`);
  }

  if (opts.model) {
    lines.push(`model: ${opts.model}`);
  }

  lines.push('---');
  lines.push('');
  lines.push(opts.instructions);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Skills Manager
// ---------------------------------------------------------------------------

/** Directories to scan for skills, in order of priority. */
const SKILL_DIRECTORIES = [
  '.skills',
  '.claude/skills',
] as const;

/**
 * SkillsManager orchestrates skill discovery, indexing, and retrieval.
 */
export class SkillsManager {
  private indexedSkills: Map<string, SkillMetadata> = new Map();
  private initialized = false;

  /**
   * Initialize the skills manager by scanning the workspace and
   * building the IndexedDB index.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.refreshIndex();
    this.initialized = true;
  }

  /**
   * Scan skill directories and rebuild the in-memory + IndexedDB index.
   */
  async refreshIndex(): Promise<void> {
    const rootHandle = fileSystemManager.getRootHandle();
    if (!rootHandle) return;

    this.indexedSkills.clear();

    for (const dir of SKILL_DIRECTORIES) {
      const readOnly = dir === '.claude/skills';
      await this.scanDirectory(rootHandle, dir, readOnly);
    }

    // Persist to IndexedDB
    try {
      await storageManager.clearAllSkills();
      for (const meta of this.indexedSkills.values()) {
        await storageManager.saveSkill(meta);
      }
    } catch {
      // IndexedDB may not be available in all contexts
    }
  }

  /**
   * Get all indexed skills.
   */
  getAll(): SkillMetadata[] {
    return Array.from(this.indexedSkills.values());
  }

  /**
   * Get invocable skills (user-invocable and not hidden from model).
   */
  getInvocable(): SkillMetadata[] {
    return this.getAll().filter(s => s.userInvocable !== false);
  }

  /**
   * Get skills visible to the AI model (not disabled from model invocation).
   */
  getModelVisible(): SkillMetadata[] {
    return this.getAll().filter(s => !s.disableModelInvocation);
  }

  /**
   * Get a skill by name.
   */
  getByName(name: string): SkillMetadata | undefined {
    return this.indexedSkills.get(name);
  }

  /**
   * Load and parse the full SKILL.md content for a skill.
   */
  async loadSkill(name: string): Promise<ParsedSkill | null> {
    const meta = this.indexedSkills.get(name);
    if (!meta) return null;

    try {
      const skillMdPath = `${meta.sourcePath}/SKILL.md`;
      const content = await fileSystemManager.readFile(skillMdPath);
      const parsed = parseFrontmatter(content);
      if (!parsed) return null;

      return {
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        sourcePath: meta.sourcePath,
        readOnly: meta.readOnly,
      };
    } catch {
      return null;
    }
  }

  /**
   * Search skills by name or description.
   */
  search(query: string): SkillMetadata[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(s =>
      s.name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower)
    );
  }

  /**
   * Scan a skill directory and index any found skills.
   */
  private async scanDirectory(
    rootHandle: FileSystemDirectoryHandle,
    dirPath: string,
    readOnly: boolean,
  ): Promise<void> {
    try {
      const dirHandle = await this.resolveDirectoryHandle(rootHandle, dirPath);
      if (!dirHandle) return;

      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== 'directory') continue;

        try {
          const skillMdHandle = await (handle as FileSystemDirectoryHandle).getFileHandle('SKILL.md');
          const file = await skillMdHandle.getFile();
          const content = await file.text();
          const parsed = parseFrontmatter(content);

          if (parsed) {
            const sourcePath = `${dirPath}/${name}`;
            const meta: SkillMetadata = {
              name: parsed.frontmatter.name,
              description: parsed.frontmatter.description,
              sourcePath,
              readOnly,
              allowedTools: parsed.frontmatter['allowed-tools'],
              userInvocable: parsed.frontmatter['user-invocable'],
              disableModelInvocation: parsed.frontmatter['disable-model-invocation'],
              model: parsed.frontmatter.model,
              argumentHint: parsed.frontmatter['argument-hint'],
              indexedAt: Date.now(),
            };

            this.indexedSkills.set(meta.name, meta);
          }
        } catch {
          // No SKILL.md in this subdirectory — skip
        }
      }
    } catch {
      // Directory doesn't exist — skip
    }
  }

  /**
   * Resolve a directory handle from a path relative to root.
   */
  private async resolveDirectoryHandle(
    rootHandle: FileSystemDirectoryHandle,
    path: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    const parts = path.split('/').filter(Boolean);
    let current = rootHandle;

    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part);
      } catch {
        return null;
      }
    }

    return current;
  }
}

// Export singleton
export const skillsManager = new SkillsManager();
