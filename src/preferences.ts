/**
 * User Preferences Manager
 * Handles tool permissions and other user settings
 *
 * SECURITY NOTE: API keys are stored in localStorage which has inherent security limitations:
 * - Accessible to browser extensions with appropriate permissions
 * - Vulnerable to XSS attacks if the application has any XSS vulnerabilities
 * - Persists until explicitly cleared
 *
 * For enhanced security, users should:
 * - Use API keys with limited permissions/scopes when possible
 * - Regularly rotate their API keys
 * - Clear browser data when using shared computers
 *
 * A more secure approach would require server-side storage with proper authentication,
 * but this application is designed for local-only operation.
 */

export type PermissionLevel = 'always' | 'ask' | 'never';

export type ToolName =
  | 'open_file'
  | 'rename_file'
  | 'move_file'
  | 'delete_file'
  | 'create_file'
  | 'write_file'
  | 'cat'
  | 'grep';

export interface ToolPermissions {
  open_file: PermissionLevel;
  rename_file: PermissionLevel;
  move_file: PermissionLevel;
  delete_file: PermissionLevel;
  create_file: PermissionLevel;
  write_file: PermissionLevel;
  cat: PermissionLevel;
  grep: PermissionLevel;
}

export interface UserPreferences {
  toolPermissions: ToolPermissions;
  apiKey: string;
  aiProvider: 'anthropic' | 'openai' | 'google';
  model: string;
}

const DEFAULT_PERMISSIONS: ToolPermissions = {
  open_file: 'ask',
  rename_file: 'ask',
  move_file: 'ask',
  delete_file: 'ask',
  create_file: 'ask',
  write_file: 'ask',
  cat: 'ask',
  grep: 'ask',
};

const DEFAULT_PREFERENCES: UserPreferences = {
  toolPermissions: DEFAULT_PERMISSIONS,
  apiKey: '',
  aiProvider: 'anthropic',
  model: 'claude-opus-4-5-20251101',
};

const STORAGE_KEY = 'co-do-preferences';

export class PreferencesManager {
  private preferences: UserPreferences;

  constructor() {
    this.preferences = this.loadPreferences();
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          toolPermissions: {
            ...DEFAULT_PERMISSIONS,
            ...parsed.toolPermissions,
          },
        };
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  /**
   * Get permission level for a tool
   */
  getToolPermission(tool: ToolName): PermissionLevel {
    return this.preferences.toolPermissions[tool];
  }

  /**
   * Set permission level for a tool
   */
  setToolPermission(tool: ToolName, level: PermissionLevel): void {
    this.preferences.toolPermissions[tool] = level;
    this.savePreferences();
  }

  /**
   * Get all tool permissions
   */
  getAllToolPermissions(): ToolPermissions {
    return { ...this.preferences.toolPermissions };
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    return this.preferences.apiKey;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.preferences.apiKey = apiKey;
    this.savePreferences();
  }

  /**
   * Get AI provider
   */
  getAiProvider(): 'anthropic' | 'openai' | 'google' {
    return this.preferences.aiProvider;
  }

  /**
   * Set AI provider
   */
  setAiProvider(provider: 'anthropic' | 'openai' | 'google'): void {
    this.preferences.aiProvider = provider;
    this.savePreferences();
  }

  /**
   * Get model
   */
  getModel(): string {
    return this.preferences.model;
  }

  /**
   * Set model
   */
  setModel(model: string): void {
    this.preferences.model = model;
    this.savePreferences();
  }

  /**
   * Reset all preferences to defaults
   */
  reset(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.savePreferences();
  }

  /**
   * Export preferences
   */
  export(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * Import preferences
   */
  import(preferences: Partial<UserPreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...preferences,
      toolPermissions: {
        ...this.preferences.toolPermissions,
        ...preferences.toolPermissions,
      },
    };
    this.savePreferences();
  }
}

// Export a singleton instance
export const preferencesManager = new PreferencesManager();
