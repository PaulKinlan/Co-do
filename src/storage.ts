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

import type { StoredWasmTool } from './wasm-tools/types';

const DB_NAME = 'co-do-db';
const DB_VERSION = 5;
const STORE_NAME = 'provider-configs';
const DIRECTORY_STORE_NAME = 'directory-handles';
const DIRECTORY_HANDLE_KEY = 'current-directory';
const CONVERSATIONS_STORE_NAME = 'conversations';
const WASM_TOOLS_STORE_NAME = 'wasm-tools';
const WORKSPACES_STORE_NAME = 'workspaces';

/**
 * Tool activity record for storage
 */
export interface StoredToolActivity {
  toolName: string;
  args: unknown;
  result?: unknown;
}

/**
 * Serializable message for storage
 */
export interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolActivity?: StoredToolActivity[];
}

/**
 * Conversation data structure
 */
export interface Conversation {
  id: string;
  workspaceId: string | null;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
  hasUnread: boolean;
}

/**
 * Workspace data structure — ties a directory handle to a bookmarkable UUID
 */
export interface Workspace {
  id: string;
  handle: FileSystemDirectoryHandle;
  name: string;
  createdAt: number;
  lastAccessedAt: number;
}

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
        const transaction = (event.target as IDBOpenDBRequest).transaction!;

        // Create object store for provider configs
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('isDefault', 'isDefault', { unique: false });
          store.createIndex('provider', 'provider', { unique: false });
        }

        // Create object store for directory handles (legacy, kept for migration)
        if (!db.objectStoreNames.contains(DIRECTORY_STORE_NAME)) {
          db.createObjectStore(DIRECTORY_STORE_NAME, { keyPath: 'key' });
        }

        // Create object store for conversations
        if (!db.objectStoreNames.contains(CONVERSATIONS_STORE_NAME)) {
          const store = db.createObjectStore(CONVERSATIONS_STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Create object store for WASM tools (v3 -> v4)
        if (!db.objectStoreNames.contains(WASM_TOOLS_STORE_NAME)) {
          const store = db.createObjectStore(WASM_TOOLS_STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'manifest.name', { unique: true });
          store.createIndex('source', 'source', { unique: false });
        }

        // v5: Multi-workspace support
        if (!db.objectStoreNames.contains(WORKSPACES_STORE_NAME)) {
          const store = db.createObjectStore(WORKSPACES_STORE_NAME, { keyPath: 'id' });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        }

        // Add workspaceId index to conversations (fresh install and upgrade)
        const convStore = transaction.objectStore(CONVERSATIONS_STORE_NAME);
        if (!convStore.indexNames.contains('workspaceId')) {
          convStore.createIndex('workspaceId', 'workspaceId', { unique: false });
        }

        // Migrate existing directory handle to a workspace (upgrade from v4 only)
        if (event.oldVersion > 0 && event.oldVersion < 5) {
          if (db.objectStoreNames.contains(DIRECTORY_STORE_NAME)) {
            const dirStore = transaction.objectStore(DIRECTORY_STORE_NAME);
            const getReq = dirStore.get(DIRECTORY_HANDLE_KEY);

            getReq.onsuccess = () => {
              if (getReq.result?.handle) {
                const workspaceId = crypto.randomUUID();
                const now = Date.now();
                const wsStore = transaction.objectStore(WORKSPACES_STORE_NAME);
                wsStore.add({
                  id: workspaceId,
                  handle: getReq.result.handle,
                  name: getReq.result.handle.name || 'Migrated workspace',
                  createdAt: now,
                  lastAccessedAt: now,
                });

                // Associate all existing conversations with the migrated workspace
                const cStore = transaction.objectStore(CONVERSATIONS_STORE_NAME);
                const cursorReq = cStore.openCursor();
                cursorReq.onsuccess = () => {
                  const cursor = cursorReq.result;
                  if (cursor) {
                    const conv = cursor.value;
                    conv.workspaceId = workspaceId;
                    const updateReq = cursor.update(conv);
                    updateReq.onsuccess = () => {
                      cursor.continue();
                    };
                    updateReq.onerror = () => {
                      console.error('Migration: failed to update a conversation with workspace ID');
                    };
                  }
                };
                cursorReq.onerror = () => {
                  console.error('Migration: failed to open cursor for conversation migration');
                };
              }
            };
            getReq.onerror = () => {
              console.error('Migration: failed to read legacy directory handle');
            };
          }
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

  /**
   * Save the current directory handle to IndexedDB
   */
  async saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DIRECTORY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DIRECTORY_STORE_NAME);
      const request = store.put({ key: DIRECTORY_HANDLE_KEY, handle });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save directory handle'));
    });
  }

  /**
   * Get the saved directory handle from IndexedDB
   */
  async getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DIRECTORY_STORE_NAME], 'readonly');
      const store = transaction.objectStore(DIRECTORY_STORE_NAME);
      const request = store.get(DIRECTORY_HANDLE_KEY);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.handle : null);
      };
      request.onerror = () => reject(new Error('Failed to get directory handle'));
    });
  }

  /**
   * Delete the saved directory handle from IndexedDB
   */
  async deleteDirectoryHandle(): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DIRECTORY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DIRECTORY_STORE_NAME);
      const request = store.delete(DIRECTORY_HANDLE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete directory handle'));
    });
  }

  /**
   * Create a new conversation
   */
  async createConversation(title: string = 'New Conversation', workspaceId: string | null = null): Promise<Conversation> {
    const db = this.ensureDB();
    const now = Date.now();

    const conversation: Conversation = {
      id: crypto.randomUUID(),
      workspaceId,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
      hasUnread: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
      const request = store.add(conversation);

      request.onsuccess = () => resolve(conversation);
      request.onerror = () => reject(new Error('Failed to create conversation'));
    });
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get conversation'));
    });
  }

  /**
   * Get all conversations sorted by updatedAt (most recent first)
   */
  async getAllConversations(): Promise<Conversation[]> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const conversations = request.result as Conversation[];
        // Sort by updatedAt (most recent first)
        conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(conversations);
      };
      request.onerror = () => reject(new Error('Failed to get conversations'));
    });
  }

  /**
   * Update a conversation
   */
  async updateConversation(id: string, updates: Partial<Omit<Conversation, 'id' | 'createdAt'>>): Promise<Conversation> {
    const db = this.ensureDB();

    const existing = await this.getConversation(id);
    if (!existing) {
      throw new Error('Conversation not found');
    }

    const updated: Conversation = {
      ...existing,
      ...updates,
      id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(new Error('Failed to update conversation'));
    });
  }

  /**
   * Add a message to a conversation
   */
  async addMessageToConversation(
    conversationId: string,
    message: Omit<StoredMessage, 'timestamp'>
  ): Promise<Conversation> {
    const existing = await this.getConversation(conversationId);
    if (!existing) {
      throw new Error('Conversation not found');
    }

    const storedMessage: StoredMessage = {
      ...message,
      timestamp: Date.now(),
    };

    const updatedMessages = [...existing.messages, storedMessage];

    return this.updateConversation(conversationId, { messages: updatedMessages });
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete conversation'));
    });
  }

  /**
   * Clear all conversations
   */
  async clearAllConversations(): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear conversations'));
    });
  }

  // ==========================================================================
  // Workspace Storage Methods
  // ==========================================================================

  /**
   * Create a new workspace from a directory handle
   */
  async createWorkspace(handle: FileSystemDirectoryHandle): Promise<Workspace> {
    const db = this.ensureDB();
    const now = Date.now();

    const workspace: Workspace = {
      id: crypto.randomUUID(),
      handle,
      name: handle.name,
      createdAt: now,
      lastAccessedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKSPACES_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(WORKSPACES_STORE_NAME);
      const request = store.add(workspace);

      request.onsuccess = () => resolve(workspace);
      request.onerror = () => reject(new Error('Failed to create workspace'));
    });
  }

  /**
   * Get a workspace by ID
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKSPACES_STORE_NAME], 'readonly');
      const store = transaction.objectStore(WORKSPACES_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get workspace'));
    });
  }

  /**
   * Get all workspaces sorted by lastAccessedAt (most recent first)
   */
  async getAllWorkspaces(): Promise<Workspace[]> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKSPACES_STORE_NAME], 'readonly');
      const store = transaction.objectStore(WORKSPACES_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const workspaces = request.result as Workspace[];
        workspaces.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
        resolve(workspaces);
      };
      request.onerror = () => reject(new Error('Failed to get all workspaces'));
    });
  }

  /**
   * Get the most recently accessed workspace
   */
  async getMostRecentWorkspace(): Promise<Workspace | null> {
    const workspaces = await this.getAllWorkspaces();
    return workspaces[0] || null;
  }

  /**
   * Update a workspace's lastAccessedAt timestamp
   */
  async updateWorkspaceAccess(id: string): Promise<void> {
    const db = this.ensureDB();

    const workspace = await this.getWorkspace(id);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    workspace.lastAccessedAt = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKSPACES_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(WORKSPACES_STORE_NAME);
      const request = store.put(workspace);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update workspace access'));
    });
  }

  /**
   * Delete a workspace by ID
   */
  async deleteWorkspace(id: string): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKSPACES_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(WORKSPACES_STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete workspace'));
    });
  }

  /**
   * Get conversations for a specific workspace.
   * Pass null to get conversations with no workspace association.
   */
  async getConversationsForWorkspace(workspaceId: string | null): Promise<Conversation[]> {
    if (workspaceId === null) {
      // IDB indexes don't index null values, so filter all conversations
      const all = await this.getAllConversations();
      return all.filter(c => c.workspaceId == null);
    }

    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
      const index = store.index('workspaceId');
      const request = index.getAll(workspaceId);

      request.onsuccess = () => {
        const conversations = request.result as Conversation[];
        conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(conversations);
      };
      request.onerror = () => reject(new Error('Failed to get conversations for workspace'));
    });
  }

  /**
   * Reassign conversations with no workspace to a specific workspace
   */
  async reassignOrphanedConversations(workspaceId: string): Promise<void> {
    const orphaned = await this.getConversationsForWorkspace(null);
    for (const conv of orphaned) {
      await this.updateConversation(conv.id, { workspaceId });
    }
  }

  // ==========================================================================
  // WASM Tools Storage Methods
  // ==========================================================================

  /**
   * Save a WASM tool to IndexedDB
   */
  async saveWasmTool(tool: StoredWasmTool): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WASM_TOOLS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(WASM_TOOLS_STORE_NAME);
      const request = store.put(tool);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save WASM tool'));
    });
  }

  /**
   * Get a WASM tool by ID
   */
  async getWasmTool(id: string): Promise<StoredWasmTool | null> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WASM_TOOLS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(WASM_TOOLS_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get WASM tool'));
    });
  }

  /**
   * Get a WASM tool by name
   */
  async getWasmToolByName(name: string): Promise<StoredWasmTool | null> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WASM_TOOLS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(WASM_TOOLS_STORE_NAME);
      const index = store.index('name');
      const request = index.get(name);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get WASM tool by name'));
    });
  }

  /**
   * Get all WASM tools
   */
  async getAllWasmTools(): Promise<StoredWasmTool[]> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WASM_TOOLS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(WASM_TOOLS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const tools = request.result as StoredWasmTool[];
        // Sort by name
        tools.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
        resolve(tools);
      };
      request.onerror = () => reject(new Error('Failed to get all WASM tools'));
    });
  }

  /**
   * Get all enabled WASM tools
   */
  async getEnabledWasmTools(): Promise<StoredWasmTool[]> {
    const allTools = await this.getAllWasmTools();
    return allTools.filter(tool => tool.enabled);
  }

  /**
   * Delete a WASM tool by ID
   */
  async deleteWasmTool(id: string): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WASM_TOOLS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(WASM_TOOLS_STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete WASM tool'));
    });
  }

  /**
   * Update a WASM tool's enabled state
   */
  async setWasmToolEnabled(id: string, enabled: boolean): Promise<void> {
    const tool = await this.getWasmTool(id);
    if (!tool) {
      throw new Error('WASM tool not found');
    }

    tool.enabled = enabled;
    tool.updatedAt = Date.now();

    await this.saveWasmTool(tool);
  }

  /**
   * Clear all WASM tools (for testing/reset)
   */
  async clearAllWasmTools(): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WASM_TOOLS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(WASM_TOOLS_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear WASM tools'));
    });
  }
}

// Export a singleton instance
export const storageManager = new StorageManager();
