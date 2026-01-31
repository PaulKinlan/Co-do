/**
 * User Preferences Manager
 * Handles tool permissions and other user settings
 *
 * SECURITY NOTE: API keys are stored in IndexedDB which has inherent security limitations:
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

import { storageManager, ProviderConfig } from './storage';

export type PermissionLevel = 'always' | 'ask' | 'never';

export type ToolName =
  | 'open_file'
  | 'read_file_content'
  | 'rename_file'
  | 'move_file'
  | 'delete_file'
  | 'create_file'
  | 'write_file'
  | 'edit_file'
  | 'list_files'
  | 'get_file_metadata'
  | 'cat'
  | 'grep'
  | 'head_file'
  | 'tail_file'
  | 'cp'
  | 'mkdir'
  | 'wc'
  | 'sort'
  | 'uniq'
  | 'pipe';

export interface ToolPermissions {
  open_file: PermissionLevel;
  read_file_content: PermissionLevel;
  rename_file: PermissionLevel;
  move_file: PermissionLevel;
  delete_file: PermissionLevel;
  create_file: PermissionLevel;
  write_file: PermissionLevel;
  edit_file: PermissionLevel;
  list_files: PermissionLevel;
  get_file_metadata: PermissionLevel;
  cat: PermissionLevel;
  grep: PermissionLevel;
  head_file: PermissionLevel;
  tail_file: PermissionLevel;
  cp: PermissionLevel;
  mkdir: PermissionLevel;
  wc: PermissionLevel;
  sort: PermissionLevel;
  uniq: PermissionLevel;
  pipe: PermissionLevel;
}

export interface UserPreferences {
  toolPermissions: ToolPermissions;
  dataShareWarningAcknowledged: boolean;
  // Legacy fields for migration only
  apiKey?: string;
  aiProvider?: 'anthropic' | 'openai' | 'google';
  model?: string;
}

const DEFAULT_PERMISSIONS: ToolPermissions = {
  open_file: 'ask',
  read_file_content: 'ask',
  rename_file: 'ask',
  move_file: 'ask',
  delete_file: 'ask',
  create_file: 'ask',
  write_file: 'ask',
  edit_file: 'ask',
  list_files: 'ask',
  get_file_metadata: 'ask',
  cat: 'ask',
  grep: 'ask',
  head_file: 'ask',
  tail_file: 'ask',
  cp: 'ask',
  mkdir: 'ask',
  wc: 'ask',
  sort: 'ask',
  uniq: 'ask',
  pipe: 'ask',
};

const DEFAULT_PREFERENCES: UserPreferences = {
  toolPermissions: DEFAULT_PERMISSIONS,
  dataShareWarningAcknowledged: false,
};

const STORAGE_KEY = 'co-do-preferences';
const MIGRATION_KEY = 'co-do-migrated';

export class PreferencesManager {
  private preferences: UserPreferences;
  private initialized: boolean = false;

  constructor() {
    this.preferences = this.loadPreferences();
  }

  /**
   * Initialize the preferences manager (async operations)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Initialize storage manager
    await storageManager.init();

    // Check if we need to migrate from localStorage
    await this.migrateFromLocalStorage();

    this.initialized = true;
  }

  /**
   * Migrate old localStorage data to IndexedDB
   */
  private async migrateFromLocalStorage(): Promise<void> {
    // Check if already migrated
    const migrated = localStorage.getItem(MIGRATION_KEY);
    if (migrated === 'true') return;

    // Set migration flag immediately to prevent concurrent migrations
    localStorage.setItem(MIGRATION_KEY, 'true');

    // Check if there's old data to migrate
    const oldData = this.preferences;
    if (oldData.apiKey && oldData.aiProvider && oldData.model) {
      try {
        // Check for existing configs to prevent duplicates
        const existingConfigs = await storageManager.getAllConfigs();
        const hasSimilarConfig = existingConfigs.some(
          config => config.provider === oldData.aiProvider && config.apiKey === oldData.apiKey
        );

        if (!hasSimilarConfig) {
          // Create a default configuration from the old data
          await storageManager.addConfig({
            name: 'Default Configuration',
            provider: oldData.aiProvider,
            apiKey: oldData.apiKey,
            model: oldData.model,
            isDefault: true,
          });

          console.log('Successfully migrated provider configuration from localStorage to IndexedDB');
        } else {
          console.log('Similar configuration already exists, skipping migration');
        }
      } catch (error) {
        console.error('Failed to migrate provider configuration:', error);
        // Don't clear migration flag on error - prevent retry loops
        // User can manually add configuration if needed
      }
    }
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
   * Get the default provider configuration
   */
  async getDefaultProviderConfig(): Promise<ProviderConfig | null> {
    return await storageManager.getDefaultConfig();
  }

  /**
   * Get all provider configurations
   */
  async getAllProviderConfigs(): Promise<ProviderConfig[]> {
    return await storageManager.getAllConfigs();
  }

  /**
   * Add a new provider configuration
   */
  async addProviderConfig(
    config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ProviderConfig> {
    return await storageManager.addConfig(config);
  }

  /**
   * Update a provider configuration
   */
  async updateProviderConfig(
    id: string,
    updates: Partial<Omit<ProviderConfig, 'id' | 'createdAt'>>
  ): Promise<ProviderConfig> {
    return await storageManager.updateConfig(id, updates);
  }

  /**
   * Delete a provider configuration
   */
  async deleteProviderConfig(id: string): Promise<void> {
    return await storageManager.deleteConfig(id);
  }

  /**
   * Set a provider configuration as default
   */
  async setDefaultProviderConfig(id: string): Promise<void> {
    return await storageManager.setDefault(id);
  }

  /**
   * Check if data share warning has been acknowledged
   */
  hasAcknowledgedDataShareWarning(): boolean {
    return this.preferences.dataShareWarningAcknowledged;
  }

  /**
   * Set data share warning as acknowledged
   */
  setDataShareWarningAcknowledged(acknowledged: boolean): void {
    this.preferences.dataShareWarningAcknowledged = acknowledged;
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
