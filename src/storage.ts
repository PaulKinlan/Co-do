/**
 * IndexedDB Storage Manager for Provider Configurations
 * Handles persistent storage of API provider configurations
 */

export interface ProviderConfig {
  id: string; // Unique identifier
  name: string; // User-defined name for this configuration
  provider: 'anthropic' | 'openai' | 'google';
  apiKey: string;
  model: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'co-do-db';
const DB_VERSION = 1;
const STORE_NAME = 'provider-configs';

/**
 * Storage Manager for provider configurations using IndexedDB
 */
export class StorageManager {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for provider configs
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('isDefault', 'isDefault', { unique: false });
          store.createIndex('provider', 'provider', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Add a new provider configuration
   */
  async addConfig(config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderConfig> {
    const db = this.ensureDB();
    const now = Date.now();

    // If this is set as default, unset all other defaults
    if (config.isDefault) {
      await this.unsetAllDefaults();
    }

    const newConfig: ProviderConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(newConfig);

      request.onsuccess = () => resolve(newConfig);
      request.onerror = () => reject(new Error('Failed to add config'));
    });
  }

  /**
   * Update an existing provider configuration
   */
  async updateConfig(id: string, updates: Partial<Omit<ProviderConfig, 'id' | 'createdAt'>>): Promise<ProviderConfig> {
    const db = this.ensureDB();

    // If setting as default, unset all other defaults first
    if (updates.isDefault) {
      await this.unsetAllDefaults();
    }

    const existing = await this.getConfig(id);
    if (!existing) {
      throw new Error('Config not found');
    }

    const updated: ProviderConfig = {
      ...existing,
      ...updates,
      id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(new Error('Failed to update config'));
    });
  }

  /**
   * Delete a provider configuration
   */
  async deleteConfig(id: string): Promise<void> {
    const db = this.ensureDB();

    // Check if this is the default config
    const config = await this.getConfig(id);
    const wasDefault = config?.isDefault;

    // Perform the delete operation
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete config'));
    });

    // If we deleted the default, set the first remaining config as default
    // This runs outside the transaction to avoid lifecycle issues
    if (wasDefault) {
      const allConfigs = await this.getAllConfigs();
      if (allConfigs.length > 0) {
        await this.updateConfig(allConfigs[0]!.id, { isDefault: true });
      }
    }
  }

  /**
   * Get a specific provider configuration
   */
  async getConfig(id: string): Promise<ProviderConfig | null> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get config'));
    });
  }

  /**
   * Get all provider configurations
   */
  async getAllConfigs(): Promise<ProviderConfig[]> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const configs = request.result as ProviderConfig[];
        // Sort by: default first, then by created date
        configs.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return b.createdAt - a.createdAt;
        });
        resolve(configs);
      };
      request.onerror = () => reject(new Error('Failed to get all configs'));
    });
  }

  /**
   * Get the default provider configuration
   */
  async getDefaultConfig(): Promise<ProviderConfig | null> {
    const allConfigs = await this.getAllConfigs();
    return allConfigs.find(config => config.isDefault) || null;
  }

  /**
   * Set a configuration as the default
   */
  async setDefault(id: string): Promise<void> {
    await this.updateConfig(id, { isDefault: true });
  }

  /**
   * Unset all defaults (internal helper)
   */
  private async unsetAllDefaults(): Promise<void> {
    const db = this.ensureDB();
    const allConfigs = await this.getAllConfigs();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let pending = 0;
      let hasError = false;

      for (const config of allConfigs) {
        if (config.isDefault) {
          pending++;
          const updated = { ...config, isDefault: false };
          const request = store.put(updated);

          request.onerror = () => {
            hasError = true;
          };

          request.onsuccess = () => {
            pending--;
            if (pending === 0) {
              if (hasError) {
                reject(new Error('Failed to unset defaults'));
              } else {
                resolve();
              }
            }
          };
        }
      }

      if (pending === 0) {
        resolve();
      }
    });
  }

  /**
   * Clear all provider configurations
   */
  async clearAll(): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear configs'));
    });
  }
}

// Export a singleton instance
export const storageManager = new StorageManager();
