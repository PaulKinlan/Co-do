/**
 * UI Components and Interactions
 */

import {
  fileSystemManager,
  FileSystemEntry,
  FileSystemChangeRecord,
} from './fileSystem';
import { preferencesManager, ToolName } from './preferences';
import { aiManager, AVAILABLE_MODELS } from './ai';
import { fileTools, setPermissionCallback } from './tools';
import { toolResultCache } from './toolResultCache';
import { wasmToolManager, setWasmPermissionCallback } from './wasm-tools';
import type { StoredWasmTool } from './wasm-tools/types';
import { BUILTIN_TOOLS, getCategoryDisplayName, CATEGORY_DISPLAY_ORDER } from './wasm-tools/registry';
import { toastManager, showToast } from './toasts';
import { notificationManager } from './notifications';
import { ProviderConfig, storageManager, Conversation, StoredMessage, StoredToolActivity, Workspace } from './storage';
import { setProviderCookie } from './provider-registry';
import { getWorkspaceIdFromUrl, setWorkspaceIdInUrl, clearWorkspaceIdFromUrl } from './router';
import { createMarkdownIframe, updateMarkdownIframe, checkContentOverflow } from './markdown';
import { withViewTransition, generateUniqueTransitionName } from './viewTransitions';
import {
  escapeHtml,
  formatToolResultSummary as formatToolResultSummaryUtil,
  generateToolCallHtml,
  serializeToolResult as serializeToolResultUtil,
} from './tool-response-format';
import { ModelMessage, Tool } from 'ai';

/** Recursive tree node used by the file list sidebar. */
interface FileTreeNode {
  entry: FileSystemEntry;
  children: FileTreeNode[];
}

/**
 * UI Manager handles all user interface interactions
 */
export class UIManager {
  private elements: {
    selectFolderBtn: HTMLButtonElement;
    folderInfo: HTMLDivElement;
    fileList: HTMLDivElement;
    promptInput: HTMLTextAreaElement;
    sendBtn: HTMLButtonElement;
    voiceBtn: HTMLButtonElement;
    messages: HTMLDivElement;
    chatContainer: HTMLDivElement;
    status: HTMLDivElement;
    statusMessage: HTMLSpanElement;
    statusDismiss: HTMLButtonElement;
    permissionSelects: NodeListOf<HTMLSelectElement>;
    infoBtn: HTMLButtonElement;
    settingsBtn: HTMLButtonElement;
    toolsBtn: HTMLButtonElement;
    infoModal: HTMLDialogElement;
    settingsModal: HTMLDialogElement;
    toolsModal: HTMLDialogElement;
    dataShareModal: HTMLDialogElement;
    dataShareAccept: HTMLButtonElement;
    dataShareCancel: HTMLButtonElement;
    mobileMenuBtn: HTMLButtonElement;
    sidebar: HTMLElement;
    sidebarOverlay: HTMLDivElement;
    // Provider configuration elements
    providersList: HTMLDivElement;
    addProviderBtn: HTMLButtonElement;
    providerEditModal: HTMLDialogElement;
    providerName: HTMLInputElement;
    providerType: HTMLSelectElement;
    providerApiKey: HTMLInputElement;
    providerApiKeyLink: HTMLAnchorElement;
    providerModel: HTMLSelectElement;
    providerIsDefault: HTMLInputElement;
    providerSaveBtn: HTMLButtonElement;
    providerCancelBtn: HTMLButtonElement;
    // Conversation tabs elements
    tabsContainer: HTMLDivElement;
    newConversationBtn: HTMLButtonElement;
    // Workspace elements
    workspaceList: HTMLDivElement;
    newWorkspaceBtn: HTMLButtonElement;
  };

  private currentText: string = '';
  private isProcessing: boolean = false;
  private currentOpenModal: HTMLDialogElement | null = null;
  private pendingFolderSelection: boolean = false;

  // Workspace state
  private activeWorkspaceId: string | null = null;

  // Conversation state
  private conversations: Map<string, Conversation> = new Map();
  private activeConversationId: string | null = null;
  private conversationMessages: Map<string, ModelMessage[]> = new Map();

  private currentEditingProviderId: string | null = null;
  private currentAbortController: AbortController | null = null;
  private currentMarkdownIframe: HTMLIFrameElement | null = null;
  private currentMarkdownWrapper: HTMLDivElement | null = null;
  private readonly MARKDOWN_MAX_HEIGHT = 400;

  // Throttle markdown updates to prevent flickering during streaming
  private markdownUpdatePending: boolean = false;
  private markdownUpdateScheduled: boolean = false;

  // Tool activity group for collapsible tool calls display
  private currentToolActivityGroup: HTMLDivElement | null = null;
  private toolCallCount: number = 0;
  private currentUserMessage: HTMLDivElement | null = null;
  private currentAssistantMessage: HTMLDivElement | null = null;

  // Tool activity tracking for persistence
  private currentToolActivity: StoredToolActivity[] = [];

  // Unified permission queue (handles both built-in and WASM tools).
  // Uses `string` instead of `ToolName` so WASM tool names (arbitrary
  // strings) and built-in tool names (ToolName literal union, which
  // extends string) can coexist in a single queue.
  private pendingPermissions: Array<{
    toolName: string;
    args: unknown;
    resolve: (value: boolean) => void;
  }> = [];
  private permissionBatchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly PERMISSION_BATCH_DELAY = 50; // ms to wait for additional permission requests
  private isPermissionDialogOpen: boolean = false;
  // Permissions currently displayed in an open dialog. Tracked so the
  // cleanup code can resolve them if the response ends while the dialog
  // is still showing (prevents permanently unresolved promises).
  private activeDialogPermissions: Array<{
    toolName: string;
    args: unknown;
    resolve: (value: boolean) => void;
  }> = [];

  // Session-level permission cache — auto-approves tools the user already
  // approved during the current AI response, cleared when the response ends.
  private sessionApprovedTools: Set<string> = new Set();
  private sessionDeniedTools: Set<string> = new Set();

  // Voice recognition
  private recognition: SpeechRecognition | null = null;
  private isRecording: boolean = false;
  private recognitionRestartAttempts: number = 0;
  private readonly MAX_RESTART_ATTEMPTS = 3;

  constructor() {
    // Get all DOM elements
    this.elements = {
      selectFolderBtn: document.getElementById('select-folder-btn') as HTMLButtonElement,
      folderInfo: document.getElementById('folder-info') as HTMLDivElement,
      fileList: document.getElementById('file-list') as HTMLDivElement,
      promptInput: document.getElementById('prompt-input') as HTMLTextAreaElement,
      sendBtn: document.getElementById('send-btn') as HTMLButtonElement,
      voiceBtn: document.getElementById('voice-btn') as HTMLButtonElement,
      messages: document.getElementById('messages') as HTMLDivElement,
      chatContainer: document.getElementById('chat-container') as HTMLDivElement,
      status: document.getElementById('status') as HTMLDivElement,
      statusMessage: document.getElementById('status-message') as HTMLSpanElement,
      statusDismiss: document.getElementById('status-dismiss') as HTMLButtonElement,
      permissionSelects: document.querySelectorAll('.permission-select'),
      infoBtn: document.getElementById('info-btn') as HTMLButtonElement,
      settingsBtn: document.getElementById('settings-btn') as HTMLButtonElement,
      toolsBtn: document.getElementById('tools-btn') as HTMLButtonElement,
      infoModal: document.getElementById('info-modal') as HTMLDialogElement,
      settingsModal: document.getElementById('settings-modal') as HTMLDialogElement,
      toolsModal: document.getElementById('tools-modal') as HTMLDialogElement,
      dataShareModal: document.getElementById('data-share-modal') as HTMLDialogElement,
      dataShareAccept: document.getElementById('data-share-accept') as HTMLButtonElement,
      dataShareCancel: document.getElementById('data-share-cancel') as HTMLButtonElement,
      mobileMenuBtn: document.getElementById('mobile-menu-btn') as HTMLButtonElement,
      sidebar: document.getElementById('sidebar') as HTMLElement,
      sidebarOverlay: document.getElementById('sidebar-overlay') as HTMLDivElement,
      // Provider configuration elements
      providersList: document.getElementById('providers-list') as HTMLDivElement,
      addProviderBtn: document.getElementById('add-provider-btn') as HTMLButtonElement,
      providerEditModal: document.getElementById('provider-edit-modal') as HTMLDialogElement,
      providerName: document.getElementById('provider-name') as HTMLInputElement,
      providerType: document.getElementById('provider-type') as HTMLSelectElement,
      providerApiKey: document.getElementById('provider-api-key') as HTMLInputElement,
      providerApiKeyLink: document.getElementById('provider-api-key-link') as HTMLAnchorElement,
      providerModel: document.getElementById('provider-model') as HTMLSelectElement,
      providerIsDefault: document.getElementById('provider-is-default') as HTMLInputElement,
      providerSaveBtn: document.getElementById('provider-save-btn') as HTMLButtonElement,
      providerCancelBtn: document.getElementById('provider-cancel-btn') as HTMLButtonElement,
      // Conversation tabs elements
      tabsContainer: document.getElementById('tabs-container') as HTMLDivElement,
      newConversationBtn: document.getElementById('new-conversation-btn') as HTMLButtonElement,
      // Workspace elements
      workspaceList: document.getElementById('workspace-list') as HTMLDivElement,
      newWorkspaceBtn: document.getElementById('new-workspace-btn') as HTMLButtonElement,
    };

    this.initializeUI();
    this.attachEventListeners();
    this.initializeSpeechRecognition();
    this.initWorkspace().catch((error) => {
      console.error('Failed to initialize workspace:', error);
      // Still load conversations (unscoped) as fallback
      this.loadConversations();
    });
  }

  /**
   * Initialize UI with saved preferences
   */
  private initializeUI(): void {
    // Initialize toast manager
    toastManager.initialize();

    // Load permission settings
    this.elements.permissionSelects.forEach((select) => {
      const toolName = select.dataset.tool as ToolName;
      if (toolName) {
        select.value = preferencesManager.getToolPermission(toolName);
      }
    });

    // Set permission callbacks — both route through the unified queue
    setPermissionCallback((toolName: ToolName, args: unknown) => {
      return this.requestToolPermission(toolName, args);
    });
    setWasmPermissionCallback((toolName: string, args: unknown) => {
      return this.requestToolPermission(toolName, args);
    });

    // Initialize WASM tool manager (async)
    this.initWasmTools();

    // Set up cleanup handlers for WASM Workers
    // This ensures Workers are terminated when the page unloads
    window.addEventListener('beforeunload', () => {
      wasmToolManager.cancelAllExecutions();
    });

    // Load provider configurations (async, skip reload on initial load)
    this.loadProviderConfigurations(true);

    // Conversations are loaded in initWorkspace() after workspace is determined

    // Initialize permission group collapse states
    this.initPermissionGroups();
  }

  /**
   * Initialize permission groups - restore collapsed state and add listeners
   */
  private initPermissionGroups(): void {
    const groups = document.querySelectorAll<HTMLDetailsElement>('.permission-group');

    // Load saved states
    const savedStates = this.loadPermissionGroupStates();

    groups.forEach((group) => {
      const groupId = group.dataset.group;
      if (!groupId) return;

      // Restore saved state (default is open)
      if (savedStates[groupId] !== undefined) {
        group.open = savedStates[groupId];
      }

      // Listen for toggle events to save state
      group.addEventListener('toggle', () => {
        this.savePermissionGroupState(groupId, group.open);
      });
    });
  }

  /**
   * Load permission group collapsed states from localStorage
   */
  private loadPermissionGroupStates(): Record<string, boolean> {
    try {
      const saved = localStorage.getItem('permission-group-states');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Failed to load permission group states:', error);
      return {};
    }
  }

  /**
   * Save a permission group's collapsed state to localStorage
   */
  private savePermissionGroupState(groupId: string, isOpen: boolean): void {
    try {
      const states = this.loadPermissionGroupStates();
      states[groupId] = isOpen;
      localStorage.setItem('permission-group-states', JSON.stringify(states));
    } catch (error) {
      console.error('Failed to save permission group state:', error);
    }
  }

  /**
   * Initialize the workspace from the URL hash or the most recent workspace.
   * Restores directory handle, sets workspace scope, then loads conversations.
   */
  private async initWorkspace(): Promise<void> {
    // Set up file system observer callback
    fileSystemManager.setChangeCallback((changes) => {
      this.handleFileSystemChanges(changes);
    });

    // Determine which workspace to load
    let workspace: Workspace | null = null;
    const urlWorkspaceId = getWorkspaceIdFromUrl();

    if (urlWorkspaceId) {
      workspace = await storageManager.getWorkspace(urlWorkspaceId);
      if (!workspace) {
        // Invalid bookmark — clear hash, fall through to default
        clearWorkspaceIdFromUrl();
      }
    }

    if (!workspace) {
      // No workspace in URL — try the most recently accessed
      workspace = await storageManager.getMostRecentWorkspace();
      if (workspace) {
        setWorkspaceIdInUrl(workspace.id);
      }
    }

    if (!workspace) {
      // No workspaces at all — fresh install, load unscoped conversations
      await this.loadConversations();
      return;
    }

    // Try to restore the workspace's directory
    try {
      const permission = await fileSystemManager.queryHandlePermission(workspace.handle);

      if (permission === 'granted') {
        this.activeWorkspaceId = workspace.id;
        fileSystemManager.setRootHandle(workspace.handle);

        // Touch lastAccessedAt
        storageManager.updateWorkspaceAccess(workspace.id).catch((err) =>
          console.warn(`Failed to update workspace access time for workspace ${workspace.id}:`, err)
        );

        // Start observing
        const observerStarted = await fileSystemManager.startObserving();

        // Display folder info
        this.updateFolderInfoDisplay(workspace.handle.name, observerStarted);

        // List files
        await this.refreshFileList();

        this.setStatus('Folder restored successfully', 'success');
        setTimeout(() => {
          if (this.elements.statusMessage.textContent === 'Folder restored successfully') {
            this.setStatus('', 'info');
          }
        }, 10000);
      } else {
        // Permission not yet granted — set workspace ID so folder selection
        // can reconnect to this workspace, but don't set the root handle
        this.activeWorkspaceId = workspace.id;
      }
    } catch (error) {
      console.error('Failed to restore workspace directory:', error);
      // Still set workspace for conversation scoping
      this.activeWorkspaceId = workspace.id;
    }

    // Load conversations scoped to this workspace
    await this.loadConversations();

    // Render the workspace list (shows all workspaces for switching)
    await this.renderWorkspaceList();
  }

  /**
   * Handle URL hash changes (browser back/forward or manual hash edits).
   * Switches to the workspace indicated by the new hash.
   */
  private async handleHashChange(): Promise<void> {
    const newWorkspaceId = getWorkspaceIdFromUrl();

    // Same workspace or no workspace — nothing to do
    if (newWorkspaceId === this.activeWorkspaceId) return;

    if (!newWorkspaceId) {
      // Hash was cleared — reset to no workspace
      fileSystemManager.reset();
      this.activeWorkspaceId = null;
      this.elements.folderInfo.innerHTML = '';
      if (this.elements.newWorkspaceBtn) {
        this.elements.newWorkspaceBtn.hidden = true;
      }
      this.elements.fileList.innerHTML = '';
      await this.loadConversations();
      return;
    }

    const workspace = await storageManager.getWorkspace(newWorkspaceId);
    if (!workspace) {
      showToast('Workspace not found', 'error');
      clearWorkspaceIdFromUrl();
      return;
    }

    // Switch to the new workspace
    try {
      const permission = await fileSystemManager.queryHandlePermission(workspace.handle);

      this.activeWorkspaceId = workspace.id;

      if (permission === 'granted') {
        fileSystemManager.setRootHandle(workspace.handle);
        storageManager.updateWorkspaceAccess(workspace.id).catch((err) =>
          console.warn(`Failed to update workspace access time for workspace ${workspace.id}:`, err)
        );
        const observerStarted = await fileSystemManager.startObserving();
        this.updateFolderInfoDisplay(workspace.handle.name, observerStarted);
        await this.refreshFileList();
      } else {
        // Permission not granted — clear directory state but keep workspace scoped
        fileSystemManager.reset();
        this.elements.folderInfo.innerHTML = '';
        this.elements.fileList.innerHTML = '';
      }

      await this.loadConversations();
      await this.renderWorkspaceList();
    } catch (error) {
      console.error('Failed to switch workspace via hash change:', error);
      showToast('Failed to switch workspace', 'error');
    }
  }

  /**
   * Update the folder info display in the sidebar
   */
  private updateFolderInfoDisplay(folderName: string, observerStarted: boolean): void {
    let folderInfoHtml = `<strong>Selected folder:</strong> ${escapeHtml(folderName)}`;
    if (observerStarted && fileSystemManager.isObserving()) {
      folderInfoHtml += ' <span class="live-updates-indicator">(Live updates enabled)</span>';
    }
    this.elements.folderInfo.innerHTML = folderInfoHtml;
  }

  /**
   * Render the workspace list in the sidebar.
   * Shows all workspaces with the active one highlighted.
   * Each item has a copy-link button and a delete button visible on hover.
   */
  private async renderWorkspaceList(): Promise<void> {
    if (!this.elements.workspaceList) return;

    const workspaces = await storageManager.getAllWorkspaces();

    if (workspaces.length === 0) {
      this.elements.workspaceList.hidden = true;
      if (this.elements.newWorkspaceBtn) {
        this.elements.newWorkspaceBtn.hidden = true;
      }
      return;
    }

    if (this.elements.newWorkspaceBtn) {
      this.elements.newWorkspaceBtn.hidden = false;
    }

    const folderSvg =
      '<svg class="workspace-list-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

    const copySvg =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
      '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

    const closeSvg =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    this.elements.workspaceList.innerHTML = workspaces.map((ws) => {
      const isActive = ws.id === this.activeWorkspaceId;
      return (
        `<div class="workspace-list-item${isActive ? ' active' : ''}" data-workspace-id="${escapeHtml(ws.id)}" role="button" tabindex="0" aria-current="${isActive ? 'true' : 'false'}">` +
        folderSvg +
        `<span class="workspace-list-item-name" title="${escapeHtml(ws.name)}">${escapeHtml(ws.name)}</span>` +
        `<button class="workspace-list-item-copy" title="Copy workspace link" aria-label="Copy link for ${escapeHtml(ws.name)}">${copySvg}</button>` +
        `<button class="workspace-list-item-delete" title="Remove workspace" aria-label="Remove workspace ${escapeHtml(ws.name)}">${closeSvg}</button>` +
        `</div>`
      );
    }).join('');

    this.elements.workspaceList.hidden = false;
  }

  /**
   * Switch to a different workspace by ID.
   */
  private async switchWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === this.activeWorkspaceId) return;

    const workspace = await storageManager.getWorkspace(workspaceId);
    if (!workspace) {
      showToast('Workspace not found', 'error');
      return;
    }

    try {
      const permission = await fileSystemManager.queryHandlePermission(workspace.handle);

      this.activeWorkspaceId = workspace.id;
      setWorkspaceIdInUrl(workspace.id);

      if (permission === 'granted') {
        fileSystemManager.setRootHandle(workspace.handle);
        storageManager.updateWorkspaceAccess(workspace.id).catch((err) =>
          console.warn(`Failed to update workspace access time for workspace ${workspace.id}:`, err)
        );
        const observerStarted = await fileSystemManager.startObserving();
        this.updateFolderInfoDisplay(workspace.handle.name, observerStarted);
        await this.refreshFileList();
      } else {
        // Permission not granted — prompt the user to re-select the folder
        fileSystemManager.reset();
        this.elements.folderInfo.innerHTML =
          '<strong>Permission needed</strong> Click "Select Folder" to re-grant access';
        this.elements.fileList.innerHTML = '';
      }

      await this.loadConversations();
      await this.renderWorkspaceList();
    } catch (error) {
      console.error('Failed to switch workspace:', error);
      showToast('Failed to switch workspace', 'error');
    }
  }

  /**
   * Remove a workspace from the list.
   * Does not delete any files — just removes the stored workspace record.
   */
  private async removeWorkspace(workspaceId: string): Promise<void> {
    try {
      const workspace = await storageManager.getWorkspace(workspaceId);
      if (!workspace) return;

      const isActive = workspaceId === this.activeWorkspaceId;

      await storageManager.deleteWorkspace(workspaceId);

      if (isActive) {
        // Switch to the next most recent workspace, or clear state
        const remaining = await storageManager.getAllWorkspaces();
        if (remaining.length > 0) {
          const next = remaining[0]!;
          await this.switchWorkspace(next.id);
        } else {
          // No workspaces left
          this.activeWorkspaceId = null;
          clearWorkspaceIdFromUrl();
          fileSystemManager.reset();
          this.elements.folderInfo.innerHTML = '';
          this.elements.newWorkspaceBtn.hidden = true;
          this.elements.fileList.innerHTML = '';
          await this.loadConversations();
        }
      }

      await this.renderWorkspaceList();
    } catch (error) {
      console.error('Failed to remove workspace:', error);
      showToast('Failed to remove workspace', 'error');
    }
  }

  /**
   * Set up event delegation on the workspace list container.
   * Called once during initialization; handles clicks on dynamically rendered items.
   */
  private initWorkspaceListEvents(): void {
    if (!this.elements.workspaceList) return;

    this.elements.workspaceList.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle copy button click
      const copyBtn = target.closest('.workspace-list-item-copy');
      if (copyBtn) {
        const item = copyBtn.closest('.workspace-list-item') as HTMLElement;
        const workspaceId = item?.dataset.workspaceId;
        if (workspaceId) {
          e.stopPropagation();
          const url = `${window.location.origin}${window.location.pathname}#${workspaceId}`;
          if (!navigator.clipboard) {
            showToast('Clipboard API not available', 'error');
            return;
          }
          navigator.clipboard.writeText(url).then(() => {
            showToast('Workspace link copied', 'success');
          }).catch(() => {
            showToast('Failed to copy link', 'error');
          });
        }
        return;
      }

      // Handle delete button click
      const deleteBtn = target.closest('.workspace-list-item-delete');
      if (deleteBtn) {
        const item = deleteBtn.closest('.workspace-list-item') as HTMLElement;
        const workspaceId = item?.dataset.workspaceId;
        if (workspaceId) {
          e.stopPropagation();
          this.removeWorkspace(workspaceId);
        }
        return;
      }

      // Handle workspace item click (switch)
      const item = target.closest('.workspace-list-item') as HTMLElement;
      if (item?.dataset.workspaceId) {
        this.switchWorkspace(item.dataset.workspaceId);
      }
    });

    // Keyboard support for workspace items
    this.elements.workspaceList.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target as HTMLElement;
        // Don't intercept keyboard events on the copy/delete buttons
        if (target.closest('.workspace-list-item-copy')) return;
        if (target.closest('.workspace-list-item-delete')) return;
        const item = target.closest('.workspace-list-item') as HTMLElement;
        if (item?.dataset.workspaceId) {
          e.preventDefault();
          this.switchWorkspace(item.dataset.workspaceId);
        }
      }
    });
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Workspace navigation — respond to hash changes (browser back/forward, manual edits)
    window.addEventListener('hashchange', () => this.handleHashChange());

    // Workspace list click/keyboard events (event delegation — set up once)
    this.initWorkspaceListEvents();

    // Folder selection
    this.elements.selectFolderBtn.addEventListener('click', () => this.handleSelectFolder());
    if (this.elements.newWorkspaceBtn) {
      this.elements.newWorkspaceBtn.addEventListener('click', () => this.handleSelectFolder());
    }

    // Send prompt
    this.elements.sendBtn.addEventListener('click', () => this.handleSendPrompt());
    this.elements.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendPrompt();
      }
    });

    // Voice input
    this.elements.voiceBtn.addEventListener('click', () => this.toggleVoiceRecognition());

    // Status bar dismiss button
    this.elements.statusDismiss.addEventListener('click', () => this.dismissStatus());

    // Mobile menu toggle
    this.elements.mobileMenuBtn.addEventListener('click', () => this.toggleMobileSidebar());
    this.elements.sidebarOverlay.addEventListener('click', () => this.closeMobileSidebar());

    // Modal controls
    this.elements.infoBtn.addEventListener('click', () => this.openModal('info'));
    this.elements.settingsBtn.addEventListener('click', () => {
      this.openModal('settings');
      this.loadProviderConfigurations(true); // Skip reload, just displaying
    });
    this.elements.toolsBtn.addEventListener('click', () => this.openModal('tools'));

    // Close modals
    this.setupModalCloseHandlers(this.elements.infoModal);
    this.setupModalCloseHandlers(this.elements.settingsModal);
    this.setupModalCloseHandlers(this.elements.toolsModal);
    this.setupModalCloseHandlers(this.elements.providerEditModal);

    // Data share warning modal
    this.elements.dataShareAccept.addEventListener('click', () => this.handleDataShareAccept());
    this.elements.dataShareCancel.addEventListener('click', () => this.handleDataShareCancel());

    // Handle escape key for mobile sidebar (dialog elements handle their own escape)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close mobile sidebar if open
        if (this.elements.sidebar.classList.contains('open')) {
          this.closeMobileSidebar();
        }
      }
    });

    // Prevent escape key from closing the data-share modal (users must explicitly choose)
    this.elements.dataShareModal.addEventListener('cancel', (e) => {
      e.preventDefault();
      // Trigger the cancel action instead
      this.handleDataShareCancel();
    });

    // Provider configuration UI
    this.elements.addProviderBtn.addEventListener('click', () => this.openProviderEditModal());
    this.elements.providerType.addEventListener('change', () => this.updateProviderModelOptions());
    this.elements.providerSaveBtn.addEventListener('click', () => this.saveProviderConfiguration());
    this.elements.providerCancelBtn.addEventListener('click', () => this.closeModal(this.elements.providerEditModal));

    // Permission settings
    this.elements.permissionSelects.forEach((select) => {
      select.addEventListener('change', () => {
        const toolName = select.dataset.tool as ToolName;
        const permission = select.value as 'always' | 'ask' | 'never';
        if (toolName) {
          preferencesManager.setToolPermission(toolName, permission);
        }
      });
    });

    // WASM tool upload
    const wasmUploadInput = document.getElementById('wasm-tool-upload') as HTMLInputElement;
    if (wasmUploadInput) {
      wasmUploadInput.addEventListener('change', (e) => this.handleWasmToolUpload(e));
    }

    // Render WASM tools when tools modal opens
    this.elements.toolsBtn.addEventListener('click', () => {
      this.renderWasmToolsList();
    });

    // Notification settings
    const notificationsCheckbox = document.getElementById('notifications-enabled') as HTMLInputElement;
    if (notificationsCheckbox) {
      this.syncNotificationCheckbox(notificationsCheckbox);
      this.updateNotificationStatus();

      notificationsCheckbox.addEventListener('change', async () => {
        if (notificationsCheckbox.checked) {
          const granted = await notificationManager.enable();
          if (!granted) {
            notificationsCheckbox.checked = false;
          }
        } else {
          notificationManager.disable();
        }
        this.updateNotificationStatus();
      });
    }

    // Conversation tabs
    this.elements.newConversationBtn.addEventListener('click', () => this.createNewConversation());
  }

  /**
   * Sync the notification checkbox with the effective permission state.
   * Disables the checkbox when notifications are unsupported or blocked.
   */
  private syncNotificationCheckbox(checkbox: HTMLInputElement): void {
    if (!notificationManager.isSupported || notificationManager.permissionState === 'denied') {
      checkbox.checked = false;
      checkbox.disabled = true;
    } else {
      checkbox.checked = notificationManager.isEnabled;
      checkbox.disabled = false;
    }
  }

  /**
   * Update the notification status text below the checkbox
   */
  private updateNotificationStatus(): void {
    const statusEl = document.getElementById('notifications-status');
    if (!statusEl) return;

    if (!notificationManager.isSupported) {
      statusEl.textContent = 'Notifications are not supported in this browser.';
      statusEl.className = 'notifications-status denied';
      return;
    }

    const permission = notificationManager.permissionState;
    if (permission === 'denied') {
      statusEl.textContent = 'Notifications are blocked. Allow them in your browser settings to enable.';
      statusEl.className = 'notifications-status denied';
    } else if (notificationManager.isEnabled) {
      statusEl.textContent = 'You will be notified when tasks complete or permission is needed while this tab is in the background.';
      statusEl.className = 'notifications-status';
    } else {
      statusEl.textContent = '';
      statusEl.className = 'notifications-status';
    }
  }

  /**
   * Toggle mobile sidebar
   */
  private toggleMobileSidebar(): void {
    const isOpen = this.elements.sidebar.classList.contains('open');
    if (isOpen) {
      this.closeMobileSidebar();
    } else {
      this.openMobileSidebar();
    }
  }

  /**
   * Open mobile sidebar
   */
  private openMobileSidebar(): void {
    this.elements.sidebar.classList.add('open');
    this.elements.sidebarOverlay.classList.add('active');
  }

  /**
   * Close mobile sidebar
   */
  private closeMobileSidebar(): void {
    this.elements.sidebar.classList.remove('open');
    this.elements.sidebarOverlay.classList.remove('active');
  }

  /**
   * Load conversations from storage
   */
  private async loadConversations(): Promise<void> {
    try {
      const conversations = await storageManager.getConversationsForWorkspace(this.activeWorkspaceId);

      this.conversations.clear();
      this.conversationMessages.clear();
      for (const conv of conversations) {
        this.conversations.set(conv.id, conv);
        // Convert stored messages to ModelMessage format for AI context
        this.conversationMessages.set(conv.id, this.storedToModelMessages(conv.messages));
      }

      // If no conversations exist, create the first one
      if (conversations.length === 0) {
        await this.createNewConversation();
      } else {
        // Switch to the most recently updated conversation
        const mostRecent = conversations[0];
        if (mostRecent) {
          await this.switchConversation(mostRecent.id);
        }
      }

      this.renderTabs();
    } catch (error) {
      console.error('Failed to load conversations:', error);
      showToast('Failed to load conversations', 'error');
      // Create a new conversation as fallback
      await this.createNewConversation();
    }
  }

  /**
   * Initialize the WASM tool manager
   */
  private async initWasmTools(): Promise<void> {
    try {
      await wasmToolManager.init();

      // Load built-in tools if they haven't been loaded yet
      const loadedCount = await wasmToolManager.loadBuiltinTools();
      if (loadedCount > 0) {
        console.log(`Loaded ${loadedCount} built-in WASM tools`);
        // Re-render the tools list in case the modal is already open
        this.renderWasmToolsList();
      }

      // Register pipeable WASM tools into the pipe command registry
      wasmToolManager.registerPipeableTools();

      console.log('WASM tools initialized');
    } catch (error) {
      console.error('Failed to initialize WASM tools:', error);
      // Non-fatal error - app can continue without WASM tools
    }
  }

  /**
   * Render the WASM tools list in the permissions modal, grouped by functional category
   */
  private async renderWasmToolsList(): Promise<void> {
    const wasmToolGroups = document.getElementById('wasm-tool-groups');
    if (!wasmToolGroups) return;

    try {
      const tools = await wasmToolManager.getAllTools();

      if (tools.length === 0) {
        wasmToolGroups.innerHTML = '<p class="wasm-tools-empty">No tools available</p>';
        return;
      }

      // Group tools by category
      const toolsByCategory = new Map<string, StoredWasmTool[]>();
      for (const tool of tools) {
        const category = tool.manifest.category || 'other';
        const existing = toolsByCategory.get(category) ?? [];
        existing.push(tool);
        toolsByCategory.set(category, existing);
      }

      // Sort categories: use preferred display order, then alphabetical for the rest
      const sortedCategories = Array.from(toolsByCategory.keys()).sort((a, b) => {
        const aIndex = CATEGORY_DISPLAY_ORDER.indexOf(a);
        const bIndex = CATEGORY_DISPLAY_ORDER.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });

      // Load saved group states for restoring collapse/expand
      const savedStates = this.loadPermissionGroupStates();

      // Build the category groups
      const fragment = document.createDocumentFragment();

      for (const category of sortedCategories) {
        const categoryTools = toolsByCategory.get(category)!;
        const groupId = `wasm-${category}`;
        const displayName = getCategoryDisplayName(category);

        const details = document.createElement('details');
        details.className = 'permission-group';
        details.dataset.group = groupId;
        details.open = savedStates[groupId] !== undefined ? savedStates[groupId] : true;

        // Listen for toggle events to save state
        details.addEventListener('toggle', () => {
          this.savePermissionGroupState(groupId, details.open);
        });

        const summary = document.createElement('summary');
        summary.className = 'permission-group-header';
        summary.innerHTML = `<svg class="permission-group-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>`;
        const spanLabel = document.createElement('span');
        spanLabel.textContent = displayName;
        summary.appendChild(spanLabel);
        details.appendChild(summary);

        const content = document.createElement('div');
        content.className = 'permission-group-content';

        const toolsList = document.createElement('div');
        toolsList.className = 'wasm-tools-list';

        for (const tool of categoryTools) {
          const toolElement = this.createWasmToolElement(tool);
          toolsList.appendChild(toolElement);
        }

        content.appendChild(toolsList);
        details.appendChild(content);
        fragment.appendChild(details);
      }

      wasmToolGroups.innerHTML = '';
      wasmToolGroups.appendChild(fragment);
    } catch (error) {
      console.error('Failed to render WASM tools list:', error);
      wasmToolGroups.innerHTML = '<p class="wasm-tools-empty">Failed to load tools</p>';
    }
  }

  /**
   * Create a WASM tool element for the permissions list
   */
  private createWasmToolElement(tool: StoredWasmTool): HTMLDivElement {
    const toolElement = document.createElement('div');
    toolElement.className = 'wasm-tool-item';
    toolElement.setAttribute('data-tool-id', tool.id);

    const info = document.createElement('div');
    info.className = 'wasm-tool-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'wasm-tool-name-row';

    const name = document.createElement('span');
    name.className = 'wasm-tool-name';
    name.textContent = tool.manifest.name;
    nameRow.appendChild(name);

    // Show download size badge for lazy-loaded tools that haven't been downloaded
    const needsDownload = !wasmToolManager.isToolDownloaded(tool);
    if (needsDownload) {
      const config = BUILTIN_TOOLS.find(c => c.name === tool.manifest.name);
      if (config?.downloadSize) {
        const badge = document.createElement('span');
        badge.className = 'wasm-tool-download-badge';
        badge.textContent = config.downloadSize;
        badge.title = `Downloading this tool requires ${config.downloadSize}`;
        nameRow.appendChild(badge);
      }
    }

    info.appendChild(nameRow);

    const description = document.createElement('span');
    description.className = 'wasm-tool-description';
    description.textContent = tool.manifest.description;
    description.title = tool.manifest.description; // Full description on hover
    info.appendChild(description);

    const meta = document.createElement('span');
    meta.className = 'wasm-tool-meta';
    const sourceLabel = tool.source === 'builtin' ? 'Built-in' : 'Custom';
    meta.textContent = `v${tool.manifest.version} · ${sourceLabel}`;
    info.appendChild(meta);

    const controls = document.createElement('div');
    controls.className = 'wasm-tool-controls';

    // Enable/disable toggle
    const toggle = document.createElement('button');
    toggle.className = `wasm-tool-toggle ${tool.enabled ? 'enabled' : ''}`;
    toggle.setAttribute('aria-label', tool.enabled ? 'Disable tool' : 'Enable tool');
    toggle.setAttribute('title', tool.enabled ? 'Disable tool' : 'Enable tool');
    toggle.addEventListener('click', () => this.toggleWasmTool(tool.id, !tool.enabled));
    controls.appendChild(toggle);

    // Delete button (only for user-installed tools)
    if (tool.source === 'user') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'wasm-tool-delete';
      deleteBtn.setAttribute('aria-label', 'Delete tool');
      deleteBtn.setAttribute('title', 'Delete tool');
      deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>`;
      deleteBtn.addEventListener('click', () => this.deleteWasmTool(tool.id, tool.manifest.name));
      controls.appendChild(deleteBtn);
    }

    toolElement.appendChild(info);
    toolElement.appendChild(controls);

    return toolElement;
  }

  /**
   * Handle WASM tool ZIP file upload
   */
  private async handleWasmToolUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Reset the input so the same file can be selected again
    input.value = '';

    try {
      this.setStatus('Installing WASM tool...', 'info');
      await wasmToolManager.installTool(file);
      showToast(`Tool installed successfully`, 'success');
      this.setStatus('Tool installed', 'success');

      // Refresh the tools list
      await this.renderWasmToolsList();
    } catch (error) {
      console.error('Failed to install WASM tool:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to install tool: ${message}`, 'error');
      this.setStatus(`Failed to install tool: ${message}`, 'error');
    }
  }

  /**
   * Toggle a WASM tool enabled/disabled.
   * For lazy-loaded tools, enabling triggers a download of the WASM binary.
   */
  private async toggleWasmTool(toolId: string, enabled: boolean): Promise<void> {
    try {
      if (enabled) {
        // Show downloading state for lazy-loaded tools
        const toolElement = document.querySelector(`[data-tool-id="${toolId}"]`);
        const toggle = toolElement?.querySelector('.wasm-tool-toggle');
        const badge = toolElement?.querySelector('.wasm-tool-download-badge');
        if (toggle) {
          toggle.classList.add('downloading');
          const sizeHint = badge?.textContent?.trim() ?? '';
          toggle.setAttribute('aria-label', `Downloading${sizeHint ? ' ' + sizeHint : ''}...`);
        }
        // Hide badge during download to avoid visual clutter
        if (badge instanceof HTMLElement) {
          badge.style.display = 'none';
        }

        try {
          await wasmToolManager.enableTool(toolId);
        } finally {
          // Remove downloading state
          if (toggle) {
            toggle.classList.remove('downloading');
          }
        }
      } else {
        await wasmToolManager.disableTool(toolId);
      }

      // Refresh the tools list
      await this.renderWasmToolsList();
    } catch (error) {
      console.error('Failed to toggle WASM tool:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isDownloadError = message.includes('Failed to download') ||
        message.includes('not a valid WASM') ||
        message.includes('HTTP ');
      const prefix = isDownloadError ? 'Download failed' : 'Failed to update tool';
      showToast(`${prefix}: ${message}`, 'error');
    }
  }

  /**
   * Delete a WASM tool
   */
  private async deleteWasmTool(toolId: string, toolName: string): Promise<void> {
    if (!confirm(`Are you sure you want to delete "${toolName}"?`)) {
      return;
    }

    try {
      await wasmToolManager.uninstallTool(toolId);
      showToast(`Tool "${toolName}" deleted`, 'success');

      // Refresh the tools list
      await this.renderWasmToolsList();
    } catch (error) {
      console.error('Failed to delete WASM tool:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to delete tool: ${message}`, 'error');
    }
  }

  /**
   * Get all available tools (built-in file tools + WASM tools)
   */
  private getAllTools(): Record<string, Tool> {
    const wasmTools = wasmToolManager.getAITools();
    return {
      ...fileTools,
      ...wasmTools,
    };
  }

  // WASM permission requests now flow through the unified requestToolPermission queue.

  /**
   * Convert stored messages to ModelMessage format
   */
  private storedToModelMessages(messages: StoredMessage[]): ModelMessage[] {
    return messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
  }

  /**
   * Create a new conversation
   */
  private async createNewConversation(): Promise<void> {
    try {
      const conversation = await storageManager.createConversation('New Conversation', this.activeWorkspaceId);
      this.conversations.set(conversation.id, conversation);
      this.conversationMessages.set(conversation.id, []);

      await this.switchConversation(conversation.id);
      this.renderTabs();
    } catch (error) {
      console.error('Failed to create conversation:', error);
      showToast('Failed to create conversation', 'error');
    }
  }

  /**
   * Switch to a different conversation
   */
  private async switchConversation(conversationId: string): Promise<void> {
    // If same conversation, do nothing
    if (this.activeConversationId === conversationId) {
      return;
    }

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      console.error('Conversation not found:', conversationId);
      return;
    }

    // Clear unread notification when switching to this conversation
    if (conversation.hasUnread) {
      conversation.hasUnread = false;
      await storageManager.updateConversation(conversationId, { hasUnread: false });
    }

    this.activeConversationId = conversationId;

    // Clear current messages display
    this.elements.messages.innerHTML = '';

    // Reset streaming state
    this.currentText = '';
    this.currentMarkdownIframe = null;
    this.currentMarkdownWrapper = null;
    this.currentToolActivityGroup = null;
    this.toolCallCount = 0;
    this.currentAssistantMessage = null;

    // Render messages from the conversation
    this.renderConversationMessages(conversation);

    // Update tab styling
    this.renderTabs();
  }

  /**
   * Render messages from a conversation
   */
  private renderConversationMessages(conversation: Conversation): void {
    for (const message of conversation.messages) {
      // For assistant messages with tool activity, render the tool activity first
      if (message.role === 'assistant' && message.toolActivity && message.toolActivity.length > 0) {
        this.renderRestoredToolActivity(message.toolActivity);
      }
      this.addMessage(message.role, message.content, { instant: true });
    }
    // Reset the current markdown iframe since we're just rendering history
    this.currentMarkdownIframe = null;
    this.currentMarkdownWrapper = null;
    // Reset tool activity state for history rendering
    this.currentToolActivityGroup = null;
    this.toolCallCount = 0;
    this.currentToolActivity = [];
    this.currentAssistantMessage = null;
  }

  /**
   * Render tool activity restored from storage
   */
  private renderRestoredToolActivity(toolActivity: StoredToolActivity[]): void {
    // Reset tool state for this render
    this.currentToolActivityGroup = null;
    this.toolCallCount = 0;
    this.currentToolActivity = []; // Clear to avoid accumulating restored data

    for (const activity of toolActivity) {
      // Render tool call
      this.addToolCall(activity.toolName, activity.args);

      // Render tool result if present
      if (activity.result !== undefined) {
        this.addRestoredToolResult(activity.toolName, activity.result);
      }
    }

    // Clear tracked activity after rendering (it's already persisted in storage)
    this.currentToolActivity = [];
  }

  /**
   * Add a tool result indicator for restored messages.
   *
   * This helper only updates the DOM and does not mutate `currentToolActivity`
   * itself. During restoration, `renderRestoredToolActivity` still populates
   * `currentToolActivity` via `addToolCall`, and then clears it again after
   * rendering.
   *
   * For results that had cached content (identified by a resultId), the output
   * is promoted to an inline block. Since the cache is ephemeral, restored
   * results show the stored preview or summary instead.
   */
  private addRestoredToolResult(toolName: string, result: unknown): void {
    if (!this.currentToolActivityGroup) return;

    const content = this.currentToolActivityGroup.querySelector('.tool-activity-content');
    if (!content) return;

    // Find the matching tool call item using safe DOM traversal
    const toolItems = content.querySelectorAll<HTMLElement>('.tool-call-item');
    let toolItem: Element | null = null;
    for (const item of toolItems) {
      if (item.dataset.tool === toolName) {
        const status = item.querySelector('.tool-item-status');
        if (status?.classList.contains('pending')) {
          toolItem = item;
          break;
        }
      }
    }

    if (toolItem) {
      // Update the existing tool call item with the result
      const status = toolItem.querySelector('.tool-item-status');
      if (status) {
        status.textContent = 'done';
        status.classList.remove('pending');
        status.classList.add('completed');
      }

      // Check if this was a cached result (has resultId)
      const resultObj = result as Record<string, unknown>;
      const hasResultId = resultObj && typeof resultObj === 'object' && 'resultId' in resultObj;

      if (hasResultId) {
        // Promote to inline block with available data (cache is expired)
        const lineCount = resultObj.lineCount as number | undefined;
        const preview = resultObj.preview as string | undefined;
        const summary = resultObj.summary as string | undefined;
        const displayContent = preview || summary || this.formatToolResultSummary(resultObj);
        this.addInlineToolOutput(toolName, displayContent, lineCount);
      } else {
        // Non-cached result: show inside the tool activity group
        let resultStr: string;
        try {
          resultStr = JSON.stringify(result, null, 2);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          resultStr = 'Error stringifying tool result: ' + errorMessage + '\nRaw result (toString): ' + String(result);
        }

        const resultDetails = document.createElement('details');
        resultDetails.className = 'tool-item-details tool-result-details';

        const summaryEl = document.createElement('summary');
        summaryEl.textContent = 'Result';
        resultDetails.appendChild(summaryEl);

        const resultPre = document.createElement('pre');
        resultPre.className = 'tool-item-result';
        resultPre.textContent = resultStr;
        resultDetails.appendChild(resultPre);

        toolItem.appendChild(resultDetails);
      }
    }
  }

  /**
   * Delete a conversation
   */
  private async deleteConversation(conversationId: string): Promise<void> {
    // Don't delete if it's the only conversation
    if (this.conversations.size <= 1) {
      showToast('Cannot delete the only conversation', 'error');
      return;
    }

    try {
      await storageManager.deleteConversation(conversationId);
      this.conversations.delete(conversationId);
      this.conversationMessages.delete(conversationId);

      // If we deleted the active conversation, switch to another one
      if (this.activeConversationId === conversationId) {
        const remaining = Array.from(this.conversations.keys());
        if (remaining.length > 0 && remaining[0]) {
          await this.switchConversation(remaining[0]);
        }
      }

      this.renderTabs();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      showToast('Failed to delete conversation', 'error');
    }
  }

  /**
   * Render the conversation tabs
   */
  private renderTabs(): void {
    this.elements.tabsContainer.innerHTML = '';

    // Sort conversations by updatedAt (most recent first)
    const sortedConversations = Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);

    for (const conversation of sortedConversations) {
      const tab = this.createTabElement(conversation);
      this.elements.tabsContainer.appendChild(tab);
    }
  }

  /**
   * Create a tab element for a conversation
   * Uses a button for the tab and a separate button for close
   */
  private createTabElement(conversation: Conversation): HTMLElement {
    const isActive = conversation.id === this.activeConversationId;

    // Wrapper div for styling
    const wrapper = document.createElement('div');
    wrapper.className = `conversation-tab${isActive ? ' active' : ''}`;
    wrapper.setAttribute('data-conversation-id', conversation.id);

    // Tab button - the main interactive element
    const tabButton = document.createElement('button');
    tabButton.type = 'button';
    tabButton.className = 'tab-content';
    tabButton.id = `tab-${conversation.id}`;
    tabButton.setAttribute('aria-current', isActive ? 'true' : 'false');

    // Title
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = conversation.title;
    tabButton.appendChild(title);

    // Double-click to edit title
    title.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.startTabTitleEdit(conversation.id, title);
    });

    // Notification indicator (inside tab button, decorative)
    if (conversation.hasUnread && conversation.id !== this.activeConversationId) {
      const badge = document.createElement('span');
      badge.className = 'tab-notification';
      badge.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(badge);
    }

    tabButton.addEventListener('click', () => {
      this.switchConversation(conversation.id);
    });

    wrapper.appendChild(tabButton);

    // Close button (separate)
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tab-close';
    closeBtn.setAttribute('aria-label', `Close ${conversation.title}`);
    closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`;
    closeBtn.addEventListener('click', () => {
      this.deleteConversation(conversation.id);
    });
    wrapper.appendChild(closeBtn);

    return wrapper;
  }

  /**
   * Update tab title based on first message
   */
  private async updateTabTitle(conversationId: string, firstMessage: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.title !== 'New Conversation') {
      return; // Only update if it's still the default title
    }

    // Infer title from first message (take first 30 chars, clean up)
    let title = firstMessage.trim();
    if (title.length > 30) {
      title = title.substring(0, 27) + '...';
    }
    // Remove newlines
    title = title.replace(/\n/g, ' ');

    try {
      const updated = await storageManager.updateConversation(conversationId, { title });
      this.conversations.set(conversationId, updated);
      this.renderTabs();
    } catch (error) {
      console.error('Failed to update tab title:', error);
    }
  }

  /**
   * Start inline editing of a tab title
   */
  private startTabTitleEdit(conversationId: string, titleElement: HTMLElement): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-title-input';
    input.value = conversation.title;
    input.setAttribute('aria-label', 'Edit conversation name');

    // Replace title span with input
    const parent = titleElement.parentElement;
    if (!parent) return;
    parent.replaceChild(input, titleElement);
    input.focus();
    input.select();

    // Prevent tab click from triggering while editing
    const tabButton = parent as HTMLElement;
    const originalClick = tabButton.onclick;
    tabButton.onclick = (e) => e.stopPropagation();

    const finishEdit = async (save: boolean) => {
      // Restore original click handler
      tabButton.onclick = originalClick;

      if (save) {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== conversation.title) {
          await this.renameConversation(conversationId, newTitle);
          return; // renderTabs will recreate the element
        }
      }

      // Restore title span if not saving or no change
      parent.replaceChild(titleElement, input);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(false);
      }
    });

    input.addEventListener('blur', () => {
      finishEdit(true);
    });
  }

  /**
   * Rename a conversation
   */
  private async renameConversation(conversationId: string, newTitle: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    try {
      const updated = await storageManager.updateConversation(conversationId, { title: newTitle });
      this.conversations.set(conversationId, updated);
      this.renderTabs();
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  }

  /**
   * Set unread notification on a conversation tab
   */
  private async setTabNotification(conversationId: string, hasUnread: boolean): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    // Only set notification if this isn't the active conversation
    if (conversationId === this.activeConversationId) {
      return;
    }

    try {
      const updated = await storageManager.updateConversation(conversationId, { hasUnread });
      this.conversations.set(conversationId, updated);
      this.renderTabs();
    } catch (error) {
      console.error('Failed to update tab notification:', error);
    }
  }

  /**
   * Open a modal
   */
  private openModal(type: 'info' | 'settings' | 'tools'): void {
    const modal =
      type === 'info' ? this.elements.infoModal :
      type === 'settings' ? this.elements.settingsModal :
      this.elements.toolsModal;
    this.currentOpenModal = modal;
    modal.showModal();
  }

  /**
   * Close a modal
   */
  private closeModal(modal: HTMLDialogElement): void {
    modal.close();
    if (this.currentOpenModal === modal) {
      this.currentOpenModal = null;
    }
  }

  /**
   * Setup modal close handlers
   */
  private setupModalCloseHandlers(modal: HTMLDialogElement): void {
    const closeBtn = modal.querySelector('.modal-close') as HTMLButtonElement;

    closeBtn?.addEventListener('click', () => this.closeModal(modal));

    // Handle clicks on the dialog backdrop (outside modal-content)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal(modal);
      }
    });

    // Handle dialog close event to update currentOpenModal tracking
    modal.addEventListener('close', () => {
      if (this.currentOpenModal === modal) {
        this.currentOpenModal = null;
      }
    });
  }

  /**
   * Load and display provider configurations
   */
  private async loadProviderConfigurations(isInitialLoad = false): Promise<void> {
    try {
      const configs = await preferencesManager.getAllProviderConfigs();

      // Sync the provider cookie with the current default so the server
      // can set the correct per-provider CSP on the next page load.
      // On initial load, skip the reload check since CSP is already set.
      // On user-initiated changes, reload if provider changed to get new CSP.
      const defaultConfig = configs.find(c => c.isDefault);
      if (defaultConfig) {
        setProviderCookie(defaultConfig.provider, isInitialLoad);
      }

      if (configs.length === 0) {
        this.elements.providersList.innerHTML = `
          <div class="providers-empty">
            <p>No providers configured yet.</p>
            <p>Click "Add Provider" to get started.</p>
          </div>
        `;
        return;
      }

      const fragment = document.createDocumentFragment();

      for (const config of configs) {
        const card = this.createProviderCard(config);
        fragment.appendChild(card);
      }

      this.elements.providersList.innerHTML = '';
      this.elements.providersList.appendChild(fragment);
    } catch (error) {
      console.error('Failed to load provider configurations:', error);
      showToast('Failed to load provider configurations', 'error');
    }
  }

  /**
   * Create a provider card element
   */
  private createProviderCard(config: ProviderConfig): HTMLDivElement {
    const card = document.createElement('div');
    card.className = `provider-card ${config.isDefault ? 'default' : ''}`;

    const providerName = config.provider === 'anthropic' ? 'Anthropic (Claude)' :
                         config.provider === 'openai' ? 'OpenAI (GPT)' :
                         'Google (Gemini)';

    // Safely mask API key
    const maskedKey = config.apiKey && config.apiKey.length > 8
      ? `${config.apiKey.substring(0, 8)}...`
      : config.apiKey
        ? '***...'
        : 'Not set';

    // Create structure using DOM methods to prevent XSS
    const header = document.createElement('div');
    header.className = 'provider-card-header';

    const info = document.createElement('div');
    info.className = 'provider-card-info';

    const nameContainer = document.createElement('div');
    nameContainer.className = 'provider-card-name';
    nameContainer.textContent = config.name; // Safe from XSS

    if (config.isDefault) {
      const badge = document.createElement('span');
      badge.className = 'default-badge';
      badge.textContent = 'Default';
      nameContainer.appendChild(badge);
    }

    const details = document.createElement('div');
    details.className = 'provider-card-details';

    const providerDetail = document.createElement('div');
    providerDetail.className = 'provider-card-detail';
    providerDetail.innerHTML = '<strong>Provider:</strong> ';
    providerDetail.appendChild(document.createTextNode(providerName));

    const modelDetail = document.createElement('div');
    modelDetail.className = 'provider-card-detail';
    modelDetail.innerHTML = '<strong>Model:</strong> ';
    modelDetail.appendChild(document.createTextNode(config.model)); // Safe from XSS

    const keyDetail = document.createElement('div');
    keyDetail.className = 'provider-card-detail';
    keyDetail.innerHTML = '<strong>API Key:</strong> ';
    keyDetail.appendChild(document.createTextNode(maskedKey));

    details.appendChild(providerDetail);
    details.appendChild(modelDetail);
    details.appendChild(keyDetail);

    info.appendChild(nameContainer);
    info.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'provider-card-actions';

    if (!config.isDefault) {
      const setDefaultBtn = document.createElement('button');
      setDefaultBtn.className = 'provider-card-btn set-default';
      setDefaultBtn.textContent = 'Set Default';
      setDefaultBtn.setAttribute('data-id', config.id); // Safe attribute setting
      setDefaultBtn.addEventListener('click', () => this.setDefaultProvider(config.id));
      actions.appendChild(setDefaultBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'provider-card-btn edit';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('data-id', config.id); // Safe attribute setting
    editBtn.addEventListener('click', () => this.openProviderEditModal(config));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'provider-card-btn delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-id', config.id); // Safe attribute setting
    deleteBtn.addEventListener('click', () => this.deleteProvider(config.id));
    actions.appendChild(deleteBtn);

    header.appendChild(info);
    header.appendChild(actions);
    card.appendChild(header);

    return card;
  }

  /**
   * Open the provider edit modal
   */
  private async openProviderEditModal(config?: ProviderConfig): Promise<void> {
    if (config) {
      // Edit mode
      this.currentEditingProviderId = config.id;
      const title = this.elements.providerEditModal.querySelector('#provider-edit-modal-title') as HTMLElement;
      title.textContent = 'Edit Provider';

      this.elements.providerName.value = config.name;
      this.elements.providerType.value = config.provider;
      this.elements.providerApiKey.value = config.apiKey;
      this.elements.providerIsDefault.checked = config.isDefault;

      this.updateProviderModelOptions();
      this.elements.providerModel.value = config.model;
    } else {
      // Add mode
      this.currentEditingProviderId = null;
      const title = this.elements.providerEditModal.querySelector('#provider-edit-modal-title') as HTMLElement;
      title.textContent = 'Add Provider';

      this.elements.providerName.value = '';
      this.elements.providerType.value = 'anthropic';
      this.elements.providerApiKey.value = '';

      // Auto-select as default if this is the first provider
      const existingConfigs = await preferencesManager.getAllProviderConfigs();
      this.elements.providerIsDefault.checked = existingConfigs.length === 0;

      this.updateProviderModelOptions();
    }

    this.updateProviderApiKeyLink();
    this.currentOpenModal = this.elements.providerEditModal;
    this.elements.providerEditModal.showModal();
  }

  /**
   * Update provider model options based on selected provider type
   */
  private updateProviderModelOptions(): void {
    const provider = this.elements.providerType.value as keyof typeof AVAILABLE_MODELS;
    const models = AVAILABLE_MODELS[provider];

    this.elements.providerModel.innerHTML = '';
    models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      this.elements.providerModel.appendChild(option);
    });

    // Explicitly set the first model as selected (don't rely on browser implicit selection)
    if (models.length > 0) {
      this.elements.providerModel.value = models[0]!.id;
    }

    this.updateProviderApiKeyLink();
  }

  /**
   * Update provider API key link based on selected provider type
   */
  private updateProviderApiKeyLink(): void {
    const provider = this.elements.providerType.value as 'anthropic' | 'openai' | 'google';
    const apiKeyUrls = {
      anthropic: 'https://console.anthropic.com/settings/keys',
      openai: 'https://platform.openai.com/api-keys',
      google: 'https://aistudio.google.com/app/apikey',
    };

    this.elements.providerApiKeyLink.href = apiKeyUrls[provider];
  }

  /**
   * Save provider configuration
   */
  private async saveProviderConfiguration(): Promise<void> {
    const name = this.elements.providerName.value.trim();
    const provider = this.elements.providerType.value as 'anthropic' | 'openai' | 'google';
    const apiKey = this.elements.providerApiKey.value.trim();
    const model = this.elements.providerModel.value;
    const isDefault = this.elements.providerIsDefault.checked;

    // Validation
    if (!name) {
      showToast('Please enter a configuration name', 'error');
      return;
    }

    if (!apiKey) {
      showToast('Please enter an API key', 'error');
      return;
    }

    if (!model) {
      showToast('Please select a model', 'error');
      return;
    }

    try {
      if (this.currentEditingProviderId) {
        // Check if we're unsetting the default without a replacement
        const allConfigs = await preferencesManager.getAllProviderConfigs();
        const currentConfig = allConfigs.find(c => c.id === this.currentEditingProviderId);

        if (currentConfig?.isDefault && !isDefault && allConfigs.length > 1) {
          showToast('Cannot unset default. Please set another provider as default first.', 'error');
          return;
        }

        // Update existing
        await preferencesManager.updateProviderConfig(this.currentEditingProviderId, {
          name,
          provider,
          apiKey,
          model,
          isDefault,
        });
        showToast('Provider configuration updated', 'success');
      } else {
        // Add new
        await preferencesManager.addProviderConfig({
          name,
          provider,
          apiKey,
          model,
          isDefault,
        });
        showToast('Provider configuration added', 'success');
      }

      this.closeModal(this.elements.providerEditModal);
      await this.loadProviderConfigurations();
    } catch (error) {
      console.error('Failed to save provider configuration:', error);
      showToast(`Failed to save provider configuration: ${(error as Error).message}`, 'error');
    }
  }

  /**
   * Set a provider as default
   */
  private async setDefaultProvider(id: string): Promise<void> {
    try {
      await preferencesManager.setDefaultProviderConfig(id);
      showToast('Default provider updated', 'success');
      await this.loadProviderConfigurations();
    } catch (error) {
      console.error('Failed to set default provider:', error);
      showToast('Failed to set default provider', 'error');
    }
  }

  /**
   * Delete a provider configuration
   */
  private async deleteProvider(id: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this provider configuration?')) {
      return;
    }

    try {
      await preferencesManager.deleteProviderConfig(id);
      showToast('Provider configuration deleted', 'success');
      await this.loadProviderConfigurations();
    } catch (error) {
      console.error('Failed to delete provider configuration:', error);
      showToast('Failed to delete provider configuration', 'error');
    }
  }

  /**
   * Handle folder selection
   */
  private async handleSelectFolder(): Promise<void> {
    // Check if user has acknowledged the data sharing warning
    if (!preferencesManager.hasAcknowledgedDataShareWarning()) {
      this.pendingFolderSelection = true;
      this.currentOpenModal = this.elements.dataShareModal;
      this.elements.dataShareModal.showModal();

      // Focus management: move focus to the primary accept button for accessibility
      // Use setTimeout to ensure the modal is rendered before focusing
      setTimeout(() => {
        this.elements.dataShareAccept.focus();
      }, 100);

      return;
    }

    await this.performFolderSelection();
  }

  /**
   * Perform the actual folder selection.
   * Creates a new workspace for the selected directory and scopes conversations to it.
   */
  private async performFolderSelection(): Promise<void> {
    try {
      this.setStatus('Selecting folder...', 'info');

      if (!fileSystemManager.isSupported()) {
        this.setStatus('File System Access API is not supported in this browser. Please use Chrome 86+ or Edge 86+.', 'error');
        return;
      }

      // Set up file system observer callback BEFORE directory selection
      fileSystemManager.setChangeCallback((changes) => {
        this.handleFileSystemChanges(changes);
      });

      const handle = await fileSystemManager.selectDirectory();

      // Verify permissions
      const hasPermission = await fileSystemManager.verifyPermission('readwrite');
      if (!hasPermission) {
        this.setStatus('Permission denied to access the directory', 'error');
        return;
      }

      // Reuse an existing workspace if the user re-selects the same directory
      let workspace: Workspace | null = null;
      const existingWorkspaces = await storageManager.getAllWorkspaces();
      for (const ws of existingWorkspaces) {
        try {
          if (await handle.isSameEntry(ws.handle)) {
            workspace = ws;
            break;
          }
        } catch (error) {
          console.warn(`Workspace ${ws.id} has a stale or invalid directory handle; skipping.`, error);
        }
      }
      if (!workspace) {
        workspace = await storageManager.createWorkspace(handle);
      }
      this.activeWorkspaceId = workspace.id;
      setWorkspaceIdInUrl(workspace.id);
      await storageManager.updateWorkspaceAccess(workspace.id);

      // Reassign any orphaned conversations (from before first workspace was created)
      await storageManager.reassignOrphanedConversations(workspace.id);

      // Start observing AFTER permission verification
      const observerStarted = await fileSystemManager.startObserving();

      // Display folder info
      this.updateFolderInfoDisplay(handle.name, observerStarted);

      // List files
      await this.refreshFileList();

      // Reload conversations scoped to the new workspace
      await this.loadConversations();

      // Update workspace list to reflect the new/switched workspace
      await this.renderWorkspaceList();

      this.setStatus('Folder loaded successfully', 'success');

      // Auto-dismiss the status message after 10 seconds
      setTimeout(() => {
        if (this.elements.statusMessage.textContent === 'Folder loaded successfully') {
          this.setStatus('', 'info');
        }
      }, 10000);
    } catch (error) {
      console.error('Failed to select folder:', error);
      this.setStatus(`Failed to select folder: ${(error as Error).message}`, 'error');
    }
  }

  /**
   * Handle data share warning acceptance
   */
  private async handleDataShareAccept(): Promise<void> {
    // Set the flag to remember the user has acknowledged the warning
    preferencesManager.setDataShareWarningAcknowledged(true);

    // Close the modal
    this.closeModal(this.elements.dataShareModal);

    // If there's a pending folder selection, proceed with it
    if (this.pendingFolderSelection) {
      this.pendingFolderSelection = false;
      await this.performFolderSelection();
    }
  }

  /**
   * Handle data share warning cancellation
   */
  private handleDataShareCancel(): void {
    // Close the modal without setting the acknowledgment flag
    this.closeModal(this.elements.dataShareModal);

    // Reset the pending flag
    this.pendingFolderSelection = false;

    // Optionally show a message
    this.setStatus('Folder selection cancelled', 'info');
  }

  /**
   * Refresh the file list
   */
  private async refreshFileList(): Promise<void> {
    try {
      const entries = await fileSystemManager.listFiles();
      this.displayFileList(entries);
    } catch (error) {
      console.error('Failed to list files:', error);
      this.setStatus(`Failed to list files: ${(error as Error).message}`, 'error');
    }
  }

  /**
   * Handle file system changes from the observer
   */
  private async handleFileSystemChanges(changes: FileSystemChangeRecord[]): Promise<void> {
    console.log('UI: File system changes detected, refreshing file list');

    // Show brief notification with improved grammar
    const changeTypes = new Set(changes.map((c) => c.type));
    const typeList = Array.from(changeTypes).join(', ');
    const changeCount = changes.length;
    const fileWord = changeCount === 1 ? 'file' : 'files';

    this.setStatus(`Detected ${changeCount} ${fileWord} ${typeList} - refreshing...`, 'info');

    // Refresh the file list to reflect changes
    await this.refreshFileList();

    // Clear the status after a short delay
    setTimeout(() => {
      this.setStatus('File list updated', 'success');
    }, 500);
  }

  /**
   * Build a tree structure from a flat list of file system entries.
   * Groups files under their parent directories for hierarchical rendering.
   */
  private buildFileTree(entries: FileSystemEntry[]): FileTreeNode[] {
    const dirMap = new Map<string, FileTreeNode>();
    const rootNodes: FileTreeNode[] = [];

    // First pass: create nodes for all directories
    for (const entry of entries) {
      if (entry.kind === 'directory') {
        dirMap.set(entry.path, { entry, children: [] });
      }
    }

    // Second pass: assign each entry to its parent
    for (const entry of entries) {
      const node: FileTreeNode =
        entry.kind === 'directory' ? dirMap.get(entry.path)! : { entry, children: [] };

      const lastSlash = entry.path.lastIndexOf('/');
      if (lastSlash === -1) {
        rootNodes.push(node);
      } else {
        const parentPath = entry.path.substring(0, lastSlash);
        const parentNode = dirMap.get(parentPath);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          // Orphan entry — add to root as fallback
          rootNodes.push(node);
        }
      }
    }

    return rootNodes;
  }

  /**
   * Sort tree nodes: directories first (alphabetically), then files (alphabetically).
   */
  private sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    return [...nodes].sort((a, b) => {
      if (a.entry.kind !== b.entry.kind) {
        return a.entry.kind === 'directory' ? -1 : 1;
      }
      return a.entry.name.localeCompare(b.entry.name);
    });
  }

  /**
   * Render a file tree recursively into a container element.
   * Directories become collapsible <details> elements; files are flat items.
   */
  private renderFileTree(nodes: FileTreeNode[], container: Element, depth: number): void {
    const sorted = this.sortTreeNodes(nodes);
    const indentPx = depth * 16;

    for (const node of sorted) {
      if (node.entry.kind === 'directory') {
        if (node.children.length === 0) {
          // Empty directory — render as a plain item
          const item = document.createElement('div');
          item.className = 'file-item';
          item.style.paddingLeft = `calc(var(--spacing-md) + ${indentPx}px)`;

          const icon = document.createElement('span');
          icon.className = 'file-icon';
          icon.textContent = '📁';

          const name = document.createElement('span');
          name.className = 'file-name';
          name.textContent = node.entry.name;

          item.append(icon, name);
          container.appendChild(item);
        } else {
          // Directory with children — collapsible <details>
          const details = document.createElement('details');
          details.className = 'file-tree-dir';

          const summary = document.createElement('summary');
          summary.className = 'file-tree-dir-header';
          summary.style.paddingLeft = `calc(var(--spacing-md) + ${indentPx}px)`;

          const chevron = document.createElement('span');
          chevron.className = 'file-tree-chevron';
          chevron.textContent = '▶';

          const icon = document.createElement('span');
          icon.className = 'file-icon';
          icon.textContent = '📁';

          const name = document.createElement('span');
          name.className = 'file-name';
          name.textContent = node.entry.name;

          summary.append(chevron, icon, name);
          details.appendChild(summary);

          const content = document.createElement('div');
          content.className = 'file-tree-dir-content';
          this.renderFileTree(node.children, content, depth + 1);
          details.appendChild(content);

          container.appendChild(details);
        }
      } else {
        // File item
        const item = document.createElement('div');
        item.className = 'file-item';
        item.style.paddingLeft = `calc(var(--spacing-md) + ${indentPx}px)`;

        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = '📄';

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = node.entry.name;

        item.append(icon, name);
        container.appendChild(item);
      }
    }
  }

  /**
   * Display file list as an expandable/collapsible directory tree.
   */
  private displayFileList(entries: FileSystemEntry[]): void {
    // Use view transition for file list updates
    withViewTransition(() => {
      this.elements.fileList.innerHTML = '';

      if (entries.length === 0) {
        this.elements.fileList.innerHTML = '<p>No files found in the selected folder.</p>';
        return;
      }

      const tree = this.buildFileTree(entries);
      this.renderFileTree(tree, this.elements.fileList, 0);
    });
  }

  /**
   * Handle send prompt
   */
  private async handleSendPrompt(): Promise<void> {
    // Prevent race condition: check flag before processing
    if (this.isProcessing) {
      return;
    }

    const prompt = this.elements.promptInput.value.trim();
    if (!prompt) return;

    // Ensure we have an active conversation
    if (!this.activeConversationId) {
      await this.createNewConversation();
    }

    const conversationId = this.activeConversationId!;
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      showToast('No active conversation', 'error');
      return;
    }

    // Check for default provider configuration
    const defaultConfig = await preferencesManager.getDefaultProviderConfig();
    if (!defaultConfig) {
      this.setStatus('Please configure a provider in settings first', 'error');
      return;
    }

    if (!fileSystemManager.getRootHandle()) {
      this.setStatus('Please select a folder first', 'error');
      return;
    }

    // Set processing flag immediately to prevent race conditions
    this.isProcessing = true;

    // Disable input while processing
    this.elements.promptInput.disabled = true;
    this.elements.sendBtn.disabled = true;

    // Update tab title if this is the first message
    const isFirstMessage = conversation.messages.length === 0;
    if (isFirstMessage) {
      this.updateTabTitle(conversationId, prompt);
    }

    // Add user message to UI and track it for tool activity positioning
    this.currentUserMessage = this.addMessage('user', prompt);
    this.elements.promptInput.value = '';

    // Save user message to storage and memory
    try {
      await storageManager.addMessageToConversation(conversationId, { role: 'user', content: prompt });
      const messages = this.conversationMessages.get(conversationId) || [];
      messages.push({ role: 'user', content: prompt });
      this.conversationMessages.set(conversationId, messages);
    } catch (error) {
      console.error('Failed to save user message:', error);
    }

    // Prepare for assistant response
    this.currentText = '';
    this.currentMarkdownIframe = null;
    const messageElement = this.addMessage('assistant', '');
    this.currentAssistantMessage = messageElement;

    // Reset tool activity group for new request
    this.currentToolActivityGroup = null;
    this.toolCallCount = 0;
    this.currentToolActivity = [];

    // Clear session permission cache — each AI response starts fresh
    this.sessionApprovedTools.clear();
    this.sessionDeniedTools.clear();

    this.setStatus('Processing...', 'info');

    // Create an AbortController for this request
    this.currentAbortController = new AbortController();

    // Store the conversation ID at the start to check if user switched away
    const startingConversationId = conversationId;

    try {
      // Get conversation messages for context
      const contextMessages = this.conversationMessages.get(conversationId) || [];
      // Remove the last message since we just added it and streamCompletion will add it again
      const messagesForContext = contextMessages.slice(0, -1);

      // Get all tools (built-in + WASM)
      const allTools = this.getAllTools();

      await aiManager.streamCompletion(
        prompt,
        messagesForContext,
        allTools,
        // On text delta
        (text) => {
          this.currentText += text;
          this.markdownUpdatePending = true;
          // Throttle markdown updates using requestAnimationFrame to prevent flickering
          if (!this.markdownUpdateScheduled) {
            this.markdownUpdateScheduled = true;
            requestAnimationFrame(() => {
              // Always reset flags at the start to ensure clean state
              const hasPendingUpdate = this.markdownUpdatePending;
              this.markdownUpdatePending = false;
              this.markdownUpdateScheduled = false;

              if (hasPendingUpdate && this.currentMarkdownIframe) {
                updateMarkdownIframe(this.currentMarkdownIframe, this.currentText);
                // Check for truncation after content update
                if (this.currentMarkdownWrapper) {
                  this.checkAndUpdateTruncation(this.currentMarkdownIframe, this.currentMarkdownWrapper);
                }
              }
            });
          }
        },
        // On tool call
        (toolName, args) => {
          this.addToolCall(toolName, args);
        },
        // On tool result
        (toolName, result) => {
          this.addToolResult(toolName, result);
        },
        // On finish
        async (responseText) => {
          this.setStatus('Response complete', 'success');

          // Notify via native notification if the tab is in the background
          notificationManager.notify('Co-do', 'Your AI task has finished.');

          // Save assistant message to storage (including tool activity if any)
          if (responseText) {
            try {
              // Capture tool activity (make a copy since it may be cleared)
              const toolActivity = this.currentToolActivity.length > 0
                ? [...this.currentToolActivity]
                : undefined;

              await storageManager.addMessageToConversation(startingConversationId, {
                role: 'assistant',
                content: responseText,
                toolActivity,
              });
              const messages = this.conversationMessages.get(startingConversationId) || [];
              messages.push({ role: 'assistant', content: responseText });
              this.conversationMessages.set(startingConversationId, messages);
            } catch (error) {
              console.error('Failed to save assistant message:', error);
            }
          }

          // If user switched away during processing, show notification
          if (this.activeConversationId !== startingConversationId) {
            this.setTabNotification(startingConversationId, true);
          }

          // Refresh file list in case files were modified (with error handling)
          try {
            await this.refreshFileList();
          } catch (refreshError) {
            console.error('Failed to refresh file list:', refreshError);
            // Don't show error to user as this is a background refresh
          }
        },
        // On error
        (error) => {
          // Check if this was an abort
          if (error.name === 'AbortError') {
            const errorMsg = 'Request cancelled by user';
            this.setStatus(errorMsg, 'error');
            this.addMessage('system', errorMsg);
            // Remove the empty assistant message element on cancel
            if (messageElement.textContent === '') {
              messageElement.remove();
            }
          } else {
            const errorMessage = this.getEnhancedErrorMessage(error, defaultConfig.provider);
            this.setStatus(`Error: ${error.message}`, 'error');
            this.addMessage('error', errorMessage);
            showToast(errorMessage, 'error');
          }
        },
        // Abort signal
        this.currentAbortController.signal
      );
    } catch (error) {
      // Check if this was an abort
      if ((error as Error).name === 'AbortError') {
        const errorMsg = 'Request cancelled by user';
        this.setStatus(errorMsg, 'error');
        this.addMessage('system', errorMsg);
      } else {
        const errorMessage = this.getEnhancedErrorMessage(error as Error, defaultConfig.provider);
        this.setStatus(`Error: ${(error as Error).message}`, 'error');
        this.addMessage('error', errorMessage);
        showToast(errorMessage, 'error');
      }
    } finally {
      // Always re-enable UI in finally block to ensure proper cleanup
      this.currentAbortController = null;
      this.currentMarkdownIframe = null;
      this.currentMarkdownWrapper = null;
      this.currentAssistantMessage = null;
      this.isProcessing = false;
      this.elements.promptInput.disabled = false;
      this.elements.sendBtn.disabled = false;
      this.elements.promptInput.focus();

      // Clean up permission system — reject any pending requests from this
      // response and close any open dialog so stale prompts don't linger.
      if (this.permissionBatchTimeout) {
        clearTimeout(this.permissionBatchTimeout);
        this.permissionBatchTimeout = null;
      }
      for (const pending of this.pendingPermissions) {
        pending.resolve(false);
      }
      this.pendingPermissions = [];
      // Resolve promises that were already handed to the open dialog
      for (const active of this.activeDialogPermissions) {
        active.resolve(false);
      }
      this.activeDialogPermissions = [];
      this.isPermissionDialogOpen = false;
      const openPermDialog = document.querySelector('dialog.permission-dialog[open]');
      if (openPermDialog instanceof HTMLDialogElement) {
        openPermDialog.close();
        openPermDialog.remove();
      }

      // Clear session permission cache — decisions only last for one AI response
      this.sessionApprovedTools.clear();
      this.sessionDeniedTools.clear();
    }
  }

  /**
   * Add a message to the chat
   */
  private addMessage(
    role: 'user' | 'assistant' | 'system' | 'error',
    content: string,
    options?: { instant?: boolean }
  ): HTMLDivElement {
    const message = document.createElement('div');
    message.className = `message ${role}`;

    if (role === 'assistant') {
      // Create wrapper for constrained height with expand capability
      const wrapper = document.createElement('div');
      wrapper.className = 'markdown-wrapper';

      // Create a sandboxed iframe for rendering markdown
      const iframe = createMarkdownIframe();
      wrapper.appendChild(iframe);

      // Create expand button
      const expandBtn = document.createElement('button');
      expandBtn.className = 'markdown-expand-btn';
      expandBtn.textContent = 'Show more';
      expandBtn.addEventListener('click', () => {
        const isExpanded = wrapper.classList.toggle('expanded');
        expandBtn.textContent = isExpanded ? 'Show less' : 'Show more';
        // Enable keyboard navigation for scrollable content
        if (isExpanded) {
          wrapper.setAttribute('tabindex', '0');
        } else {
          wrapper.removeAttribute('tabindex');
        }
      });
      wrapper.appendChild(expandBtn);

      message.appendChild(wrapper);
      this.currentMarkdownIframe = iframe;
      this.currentMarkdownWrapper = wrapper;

      // Render initial content if provided
      if (content) {
        updateMarkdownIframe(iframe, content);
        this.checkAndUpdateTruncation(iframe, wrapper);
      }
    } else {
      // For user, system, and error messages, use plain text
      message.textContent = content;
    }

    // Assign unique view transition name to avoid conflicts with concurrent transitions
    const transitionName = generateUniqueTransitionName('message');
    message.style.viewTransitionName = transitionName;

    // Use view transition for adding the message
    withViewTransition(() => {
      this.elements.messages.appendChild(message);
    }).then(() => {
      // Remove the transition name after animation completes
      // Check if element still exists in DOM before modifying
      if (message.isConnected) {
        message.style.viewTransitionName = '';
      }
      // Scroll after transition so layout is finalized
      this.scrollToBottom(options?.instant);
    });

    return message;
  }

  /**
   * Scroll the chat container to the bottom
   */
  private scrollToBottom(instant = false): void {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.elements.chatContainer.scrollTo({
      top: this.elements.chatContainer.scrollHeight,
      behavior: (instant || prefersReducedMotion) ? 'auto' : 'smooth',
    });
  }

  /**
   * Check if content overflows and update truncation state
   */
  private checkAndUpdateTruncation(iframe: HTMLIFrameElement, wrapper: HTMLDivElement): void {
    // Use requestAnimationFrame to wait for iframe to render
    requestAnimationFrame(() => {
      const isTruncated = checkContentOverflow(iframe, this.MARKDOWN_MAX_HEIGHT);
      if (isTruncated) {
        wrapper.classList.add('truncated');
      } else {
        wrapper.classList.remove('truncated');
      }
    });
  }

  /**
   * Get or create the tool activity group for collapsible display
   */
  private getOrCreateToolActivityGroup(): HTMLDivElement {
    if (this.currentToolActivityGroup) {
      return this.currentToolActivityGroup;
    }

    // Create the collapsible tool activity group
    const group = document.createElement('div');
    group.className = 'tool-activity-group';

    // Create header (clickable to expand/collapse)
    const header = document.createElement('div');
    header.className = 'tool-activity-header';
    header.innerHTML = `
      <span class="tool-activity-icon">⚙️</span>
      <span class="tool-activity-summary">Working...</span>
      <span class="tool-activity-toggle">▼</span>
    `;

    // Create content container (collapsible)
    const content = document.createElement('div');
    content.className = 'tool-activity-content';

    // Assign unique id for aria-controls
    const contentId = 'tool-activity-content-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    content.id = contentId;

    // Add accessibility attributes
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-controls', contentId);
    header.setAttribute('aria-expanded', 'false');

    // Toggle expand/collapse on header click
    header.addEventListener('click', () => {
      group.classList.toggle('expanded');
      const isExpanded = group.classList.contains('expanded');
      header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      const toggle = header.querySelector('.tool-activity-toggle');
      if (toggle) {
        toggle.textContent = isExpanded ? '▲' : '▼';
      }
    });

    // Support keyboard interaction (Enter and Space)
    header.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        header.click();
      }
    });

    group.appendChild(header);
    group.appendChild(content);

    // Assign unique view transition name to avoid conflicts with concurrent transitions
    const transitionName = generateUniqueTransitionName('tool-activity');
    group.style.viewTransitionName = transitionName;

    // Use view transition for adding the tool activity group
    withViewTransition(() => {
       if (this.currentUserMessage) {
         this.elements.messages.insertBefore(group, this.currentUserMessage.nextSibling);
         this.currentUserMessage = null; // Reset to avoid stale references in multi-turn conversations
       } else {
         this.elements.messages.appendChild(group);
       } 
    }).then(() => {
      // Remove the transition name after animation completes
      // Check if element still exists in DOM before modifying
      if (group.isConnected) {
        group.style.viewTransitionName = '';
      }
    });

    this.currentToolActivityGroup = group;

    return group;
  }

  /**
   * Update the tool activity group summary
   */
  private updateToolActivitySummary(): void {
    if (!this.currentToolActivityGroup) return;

    const summary = this.currentToolActivityGroup.querySelector('.tool-activity-summary');
    if (summary) {
      const toolWord = this.toolCallCount === 1 ? 'tool' : 'tools';
      summary.textContent = `Using ${this.toolCallCount} ${toolWord}...`;
    }
  }

  /**
   * Add a tool call indicator
   */
  private addToolCall(toolName: string, args: unknown): void {
    const group = this.getOrCreateToolActivityGroup();
    const content = group.querySelector('.tool-activity-content');
    if (!content) return;

    this.toolCallCount++;
    this.updateToolActivitySummary();

    // Track tool activity for persistence
    this.currentToolActivity.push({ toolName, args });

    // Create tool call item
    const toolItem = document.createElement('div');
    toolItem.className = 'tool-activity-item tool-call-item';
    toolItem.setAttribute('data-tool', toolName);
    toolItem.innerHTML = generateToolCallHtml(toolName, args);

    content.appendChild(toolItem);
    this.scrollToBottom();
  }

  /**
   * Add a tool result indicator.
   *
   * Tool output with cached content is promoted to a prominent inline block
   * at the message level (same visual hierarchy as assistant text), rather
   * than being nested inside the collapsible tool activity group.
   */
  private addToolResult(toolName: string, result: unknown): void {
    // Update stored tool activity with result
    // Find the first tool activity entry for this tool that doesn't have a result yet
    const pendingActivity = this.currentToolActivity.find(
      (activity) => activity.toolName === toolName && activity.result === undefined
    );
    if (pendingActivity) {
      pendingActivity.result = result;
    }

    if (!this.currentToolActivityGroup) return;

    const content = this.currentToolActivityGroup.querySelector('.tool-activity-content');
    if (!content) return;

    // Find the matching tool call item using safe DOM traversal (avoid CSS selector injection)
    const toolItems = content.querySelectorAll<HTMLElement>('.tool-call-item');
    // Get the first pending item matching the tool name
    let toolItem: Element | null = null;
    for (const item of toolItems) {
      if (item.dataset.tool === toolName) {
        const status = item.querySelector('.tool-item-status');
        if (status?.classList.contains('pending')) {
          toolItem = item;
          break; // Get the first pending one for this tool
        }
      }
    }

    if (toolItem) {
      // Update the existing tool call item with the result
      const status = toolItem.querySelector('.tool-item-status');
      if (status) {
        status.textContent = 'done';
        status.classList.remove('pending');
        status.classList.add('completed');
      }

      // Check if the result has a resultId (cached content)
      const resultObj = result as Record<string, unknown>;
      const hasResultId = resultObj && typeof resultObj === 'object' && 'resultId' in resultObj;

      if (hasResultId) {
        // Promote cached tool output to an inline block at message level
        const resultId = resultObj.resultId as string;
        const cachedResult = toolResultCache.get(resultId);
        const lineInfo = cachedResult?.metadata.lineCount ?? (resultObj.lineCount as number | undefined);

        if (cachedResult) {
          this.addInlineToolOutput(toolName, cachedResult.fullContent, lineInfo);
        } else {
          // Fallback: show summary if cache expired
          const summaryInfo = this.formatToolResultSummary(resultObj);
          this.addInlineToolOutput(toolName, summaryInfo, lineInfo);
        }
      } else {
        // Non-cached result: keep inside the tool activity group
        const resultStr = serializeToolResultUtil(result);

        const resultDetails = document.createElement('details');
        resultDetails.className = 'tool-item-details tool-result-details';

        const summaryEl = document.createElement('summary');
        summaryEl.textContent = 'Result';
        resultDetails.appendChild(summaryEl);

        const resultPre = document.createElement('pre');
        resultPre.className = 'tool-item-result';
        resultPre.textContent = resultStr;
        resultDetails.appendChild(resultPre);

        toolItem.appendChild(resultDetails);
      }
    }

    this.scrollToBottom();
  }

  /**
   * Create a prominent inline tool output block at the message level.
   *
   * This sits between the compact tool activity group and the assistant's
   * text response, giving tool output the same visual weight as the LLM text.
   */
  private addInlineToolOutput(toolName: string, outputContent: string, lineCount?: number): void {
    const block = document.createElement('div');
    block.className = 'tool-output-block';

    // Header with tool name and line count
    const header = document.createElement('div');
    header.className = 'tool-output-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tool-output-name';
    nameSpan.textContent = toolName;
    header.appendChild(nameSpan);

    if (lineCount !== undefined) {
      const metaSpan = document.createElement('span');
      metaSpan.className = 'tool-output-meta';
      metaSpan.textContent = `${lineCount} lines`;
      header.appendChild(metaSpan);
    }

    block.appendChild(header);

    // Output content
    const pre = document.createElement('pre');
    pre.className = 'tool-output-content';
    pre.textContent = outputContent;
    block.appendChild(pre);

    // Assign unique view transition name
    const transitionName = generateUniqueTransitionName('tool-output');
    block.style.viewTransitionName = transitionName;

    // Insert before the assistant message so output appears between
    // the tool activity group and the LLM's text response
    withViewTransition(() => {
      if (this.currentAssistantMessage && this.currentAssistantMessage.parentNode === this.elements.messages) {
        this.elements.messages.insertBefore(block, this.currentAssistantMessage);
      } else {
        this.elements.messages.appendChild(block);
      }
    }).then(() => {
      if (block.isConnected) {
        block.style.viewTransitionName = '';
      }
    });
  }

  /**
   * Format a tool result summary for display
   */
  private formatToolResultSummary(result: Record<string, unknown>): string {
    return formatToolResultSummaryUtil(result);
  }

  /**
   * Set status message
   */
  private setStatus(message: string, type: 'info' | 'success' | 'error'): void {
    this.elements.statusMessage.textContent = message;
    // Only apply the type class if there's a message to display
    // This prevents showing an empty colored bar
    this.elements.status.className = message ? `status-bar ${type}` : 'status-bar';
  }

  /**
   * Dismiss the status bar
   */
  private dismissStatus(): void {
    this.elements.statusMessage.textContent = '';
    this.elements.status.className = 'status-bar';
  }

  /**
   * Get enhanced error message for API errors
   * Provides helpful context especially for CORS issues with certain providers
   */
  private getEnhancedErrorMessage(error: Error, provider: string): string {
    const message = error.message.toLowerCase();

    // Detect CORS/network errors
    if (message.includes('failed to fetch') || message.includes('network error') || message.includes('cors')) {
      return `Network error connecting to ${provider}. Please check your internet connection and API key.`;
    }

    // Check for API key issues
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
      return `Invalid or missing API key for ${provider}. Please check your API key in settings.`;
    }

    // Check for rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return `Rate limit exceeded for ${provider}. Please wait a moment and try again.`;
    }

    // Default error message
    return `Error: ${error.message}`;
  }

  /**
   * Request permission from user for a tool (with batching and session cache).
   *
   * All permission requests — built-in and WASM — flow through this method.
   * Requests are batched over a short delay, and only one dialog is shown at
   * a time. While a dialog is open, new requests accumulate in the queue and
   * are presented in the next dialog after the current one closes.
   *
   * Session cache: if the user already approved/denied a tool during the
   * current AI response, that decision is reused automatically.
   */
  private async requestToolPermission(toolName: string, args: unknown): Promise<boolean> {
    // Check session cache first — reuse previous decision from this AI response
    if (this.sessionApprovedTools.has(toolName)) return true;
    if (this.sessionDeniedTools.has(toolName)) return false;

    return new Promise((resolve) => {
      // Add to pending permissions queue
      this.pendingPermissions.push({ toolName, args, resolve });

      // If a dialog is already open, just queue — it will be drained when
      // the current dialog closes.
      if (this.isPermissionDialogOpen) return;

      // Clear any existing timeout and batch over a short window
      if (this.permissionBatchTimeout) {
        clearTimeout(this.permissionBatchTimeout);
      }

      this.permissionBatchTimeout = setTimeout(() => {
        this.showBatchPermissionDialog();
      }, this.PERMISSION_BATCH_DELAY);
    });
  }

  /**
   * Close the current permission dialog, release the lock, and drain the
   * queue — if more requests accumulated while this dialog was open, show
   * them in the next (single) dialog.
   */
  private closePermissionDialog(dialog: HTMLDialogElement): void {
    dialog.close();
    dialog.remove();
    this.isPermissionDialogOpen = false;
    this.activeDialogPermissions = [];

    // Drain: if new requests arrived while the dialog was open, show them
    if (this.pendingPermissions.length > 0) {
      // Small delay so resolved promises settle before the next dialog
      this.permissionBatchTimeout = setTimeout(() => {
        this.showBatchPermissionDialog();
      }, this.PERMISSION_BATCH_DELAY);
    }
  }

  /**
   * Build the "Allow for this response" session-cache checkbox.
   */
  private buildSessionCheckbox(): { container: HTMLElement; checkbox: HTMLInputElement } {
    const container = document.createElement('label');
    container.className = 'session-permission-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.className = 'session-permission-checkbox';
    container.appendChild(checkbox);
    container.appendChild(document.createTextNode(' Allow for this response'));
    return { container, checkbox };
  }

  /**
   * Show a permission dialog for all pending tool calls.
   *
   * Only one dialog is ever shown at a time (guarded by
   * `isPermissionDialogOpen`). When closed, `closePermissionDialog`
   * drains any requests that arrived while the dialog was open.
   */
  private showBatchPermissionDialog(): void {
    // Guard: never show two dialogs simultaneously
    if (this.isPermissionDialogOpen) return;

    const allPending = [...this.pendingPermissions];
    this.pendingPermissions = [];
    this.permissionBatchTimeout = null;

    if (allPending.length === 0) return;

    // Auto-resolve items the session cache can handle (from earlier approvals)
    const uncached = allPending.filter(p => {
      if (this.sessionApprovedTools.has(p.toolName)) {
        p.resolve(true);
        return false;
      }
      if (this.sessionDeniedTools.has(p.toolName)) {
        p.resolve(false);
        return false;
      }
      return true;
    });

    if (uncached.length === 0) return;

    // Deduplicate identical tool+args requests so users don't see the
    // same entry repeated. All duplicates share the same decision.
    type PermissionGroup = {
      toolName: string;
      args: unknown;
      resolvers: Array<(value: boolean) => void>;
    };
    const groupMap = new Map<string, PermissionGroup>();
    for (const p of uncached) {
      const key = p.toolName + '\0' + JSON.stringify(p.args);
      const existing = groupMap.get(key);
      if (existing) {
        existing.resolvers.push(p.resolve);
      } else {
        groupMap.set(key, { toolName: p.toolName, args: p.args, resolvers: [p.resolve] });
      }
    }
    const permissions = [...groupMap.values()];

    this.isPermissionDialogOpen = true;
    // Track all raw resolvers so the cleanup code can resolve them
    this.activeDialogPermissions = uncached;

    // Notify user if the tab is in the background
    const notifyBody = permissions.length === 1
      ? `Approve "${permissions[0]!.toolName}" to continue.`
      : `Approve ${permissions.length} actions to continue.`;
    notificationManager.notify('Co-do — Permission Needed', notifyBody, 'codo-permission-request');

    // Single unique permission — use simpler dialog
    if (permissions.length === 1) {
      const group = permissions[0]!;
      this.showSinglePermissionDialog({
        toolName: group.toolName,
        args: group.args,
        resolve: (value: boolean) => {
          for (const r of group.resolvers) r(value);
        },
      });
      return;
    }

    // Multiple permissions — show batch dialog with native <dialog>
    // Use safe DOM methods to prevent XSS
    const dialog = document.createElement('dialog');
    dialog.className = 'permission-dialog batch-permission-dialog';

    const h3 = document.createElement('h3');
    h3.textContent = 'Permission Request';

    const p1 = document.createElement('p');
    p1.textContent = 'The AI wants to perform ';
    const strong = document.createElement('strong');
    strong.textContent = `${permissions.length} actions`;
    p1.appendChild(strong);
    p1.appendChild(document.createTextNode(':'));

    // Build the tool calls list with checkboxes using safe DOM methods
    const batchToolList = document.createElement('div');
    batchToolList.className = 'batch-tool-list';

    const checkboxes: HTMLInputElement[] = [];
    permissions.forEach((p, index) => {
      const item = document.createElement('div');
      item.className = 'batch-tool-item';
      item.dataset.index = String(index);

      const label = document.createElement('label');
      label.className = 'batch-tool-checkbox';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.index = String(index);
      checkboxes.push(checkbox);
      const checkmark = document.createElement('span');
      checkmark.className = 'checkmark';
      label.appendChild(checkbox);
      label.appendChild(checkmark);

      const toolCall = document.createElement('div');
      toolCall.className = 'tool-call';
      const toolName = document.createElement('div');
      toolName.className = 'tool-call-name';
      toolName.textContent = p.toolName;
      const toolArgs = document.createElement('pre');
      toolArgs.className = 'tool-call-args';
      toolArgs.textContent = JSON.stringify(p.args, null, 2);
      toolCall.appendChild(toolName);
      toolCall.appendChild(toolArgs);

      item.appendChild(label);
      item.appendChild(toolCall);
      batchToolList.appendChild(item);
    });

    const selectionControls = document.createElement('div');
    selectionControls.className = 'batch-selection-controls';
    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'select-all-btn';
    selectAllBtn.type = 'button';
    selectAllBtn.textContent = 'Select All';
    const selectNoneBtn = document.createElement('button');
    selectNoneBtn.className = 'select-none-btn';
    selectNoneBtn.type = 'button';
    selectNoneBtn.textContent = 'Select None';
    selectionControls.appendChild(selectAllBtn);
    selectionControls.appendChild(selectNoneBtn);

    // Session-cache checkbox
    const { container: sessionContainer, checkbox: sessionCheckbox } = this.buildSessionCheckbox();

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'permission-dialog-buttons';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = 'Cancel All';
    const approveBtn = document.createElement('button');
    approveBtn.className = 'approve-btn';
    approveBtn.textContent = 'Approve Selected';
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(approveBtn);

    const hintP = document.createElement('p');
    hintP.className = 'permission-hint';
    const small = document.createElement('small');
    small.textContent = 'Check the actions you want to approve. Cancel All will abort the conversation.';
    hintP.appendChild(small);

    dialog.appendChild(h3);
    dialog.appendChild(p1);
    dialog.appendChild(batchToolList);
    dialog.appendChild(selectionControls);
    dialog.appendChild(sessionContainer);
    dialog.appendChild(buttonsDiv);
    dialog.appendChild(hintP);

    // Prevent escape key from closing (user must click a button)
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
    });

    // Attach to body and show as modal
    document.body.appendChild(dialog);
    dialog.showModal();

    // Select all button
    selectAllBtn.addEventListener('click', () => {
      checkboxes.forEach(cb => cb.checked = true);
    });

    // Select none button
    selectNoneBtn.addEventListener('click', () => {
      checkboxes.forEach(cb => cb.checked = false);
    });

    // Handle approve selected
    approveBtn.addEventListener('click', () => {
      const cacheForSession = sessionCheckbox.checked;
      this.closePermissionDialog(dialog);

      // Check which items are selected
      const hasAnyApproved = checkboxes.some(cb => cb.checked);

      if (!hasAnyApproved) {
        // No items selected — abort conversation
        if (this.currentAbortController) {
          this.currentAbortController.abort();
        }
        for (const group of permissions) {
          if (cacheForSession) this.sessionDeniedTools.add(group.toolName);
          for (const r of group.resolvers) r(false);
        }
        return;
      }

      // Resolve each permission group based on checkbox state
      checkboxes.forEach((checkbox, index) => {
        const group = permissions[index];
        if (group) {
          const approved = checkbox.checked;
          if (cacheForSession) {
            if (approved) {
              this.sessionApprovedTools.add(group.toolName);
            } else {
              this.sessionDeniedTools.add(group.toolName);
            }
          }
          for (const r of group.resolvers) r(approved);
        }
      });

      // If any were denied, abort the conversation
      const anyDenied = checkboxes.some(cb => !cb.checked);
      if (anyDenied && this.currentAbortController) {
        this.currentAbortController.abort();
      }
    });

    // Handle cancel all
    cancelBtn.addEventListener('click', () => {
      const cacheForSession = sessionCheckbox.checked;
      this.closePermissionDialog(dialog);
      // Abort the entire conversation
      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }
      for (const group of permissions) {
        if (cacheForSession) this.sessionDeniedTools.add(group.toolName);
        for (const r of group.resolvers) r(false);
      }
    });
  }

  /**
   * Show a single permission dialog (for single requests or single-item batches).
   */
  private showSinglePermissionDialog(permission: { toolName: string; args: unknown; resolve: (value: boolean) => void }): void {
    const { toolName, args, resolve } = permission;

    // Create native dialog element with safe DOM methods to prevent XSS
    const dialog = document.createElement('dialog');
    dialog.className = 'permission-dialog';

    const h3 = document.createElement('h3');
    h3.textContent = 'Permission Request';

    const p1 = document.createElement('p');
    p1.textContent = 'The AI wants to perform the following action:';

    const toolCallDiv = document.createElement('div');
    toolCallDiv.className = 'tool-call';
    const toolNameDiv = document.createElement('div');
    toolNameDiv.className = 'tool-call-name';
    toolNameDiv.textContent = toolName;
    const toolArgsDiv = document.createElement('pre');
    toolArgsDiv.className = 'tool-call-args';
    toolArgsDiv.textContent = JSON.stringify(args, null, 2);
    toolCallDiv.appendChild(toolNameDiv);
    toolCallDiv.appendChild(toolArgsDiv);

    const p2 = document.createElement('p');
    p2.textContent = 'Do you want to allow this action?';

    // Session-cache checkbox
    const { container: sessionContainer, checkbox: sessionCheckbox } = this.buildSessionCheckbox();

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'permission-dialog-buttons';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = 'Cancel';
    const denyBtn = document.createElement('button');
    denyBtn.className = 'deny-btn';
    denyBtn.textContent = 'Deny';
    const approveBtn = document.createElement('button');
    approveBtn.className = 'approve-btn';
    approveBtn.textContent = 'Approve';
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(denyBtn);
    buttonsDiv.appendChild(approveBtn);

    const hintP = document.createElement('p');
    hintP.className = 'permission-hint';
    const small = document.createElement('small');
    small.textContent = 'Cancel: Skip this action silently. Deny: Reject and notify AI. Approve: Allow the action.';
    hintP.appendChild(small);

    dialog.appendChild(h3);
    dialog.appendChild(p1);
    dialog.appendChild(toolCallDiv);
    dialog.appendChild(p2);
    dialog.appendChild(sessionContainer);
    dialog.appendChild(buttonsDiv);
    dialog.appendChild(hintP);

    // Prevent escape key from closing (user must click a button)
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
    });

    // Attach to body and show as modal
    document.body.appendChild(dialog);
    dialog.showModal();

    // Handle approve
    approveBtn.addEventListener('click', () => {
      const cacheForSession = sessionCheckbox.checked;
      this.closePermissionDialog(dialog);
      if (cacheForSession) this.sessionApprovedTools.add(toolName);
      resolve(true);
    });

    // Handle deny (explicit rejection)
    denyBtn.addEventListener('click', () => {
      const cacheForSession = sessionCheckbox.checked;
      this.closePermissionDialog(dialog);
      if (cacheForSession) this.sessionDeniedTools.add(toolName);
      // Abort the entire conversation when user denies
      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }
      resolve(false);
    });

    // Handle cancel (skip action silently, and abort the conversation)
    cancelBtn.addEventListener('click', () => {
      const cacheForSession = sessionCheckbox.checked;
      this.closePermissionDialog(dialog);
      if (cacheForSession) this.sessionDeniedTools.add(toolName);
      // Abort the entire conversation when user cancels
      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }
      resolve(false);
    });
  }

  /**
   * Initialize Web Speech Recognition API
   */
  private initializeSpeechRecognition(): void {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Browser doesn't support speech recognition, hide the button
      this.elements.voiceBtn.style.display = 'none';
      console.log('Speech Recognition API not supported in this browser');
      return;
    }

    // Create recognition instance
    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true; // Keep listening until manually stopped
    recognitionInstance.interimResults = true; // Get results as user speaks
    recognitionInstance.lang = 'en-US'; // Set language (can be made configurable)

    // Handle results
    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript;
        if (transcript && result?.isFinal) {
          finalTranscript += transcript + ' ';
        }
      }

      // Update textarea with transcription
      if (finalTranscript) {
        const currentValue = this.elements.promptInput.value;
        // Add space before new text if there's existing content
        const prefix = currentValue && !currentValue.endsWith(' ') ? ' ' : '';
        this.elements.promptInput.value = currentValue + prefix + finalTranscript;
      }
    };

    // Handle errors
    recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      // Handle 'no-speech' error gracefully - it's a transient timeout
      // Let the auto-restart mechanism in onend handle it
      if (event.error === 'no-speech') {
        return;
      }

      let errorMessage: string;
      switch (event.error) {
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Voice recognition error: ${event.error}`;
      }

      showToast(errorMessage, 'error');
      this.stopVoiceRecognition();

      // Show error state briefly
      this.elements.voiceBtn.classList.add('error');
      setTimeout(() => {
        this.elements.voiceBtn.classList.remove('error');
      }, 2000);
    };

    // Handle end of recognition
    recognitionInstance.onend = () => {
      // If we were recording and it ended unexpectedly, restart it with retry limit
      if (this.isRecording) {
        if (this.recognitionRestartAttempts < this.MAX_RESTART_ATTEMPTS) {
          this.recognitionRestartAttempts++;
          try {
            // Add small delay before restart to prevent rapid fire restarts
            setTimeout(() => {
              if (this.isRecording) {
                this.recognition?.start();
              }
            }, 100);
          } catch (error) {
            console.error('Failed to restart recognition:', error);
            this.stopVoiceRecognition();
            this.recognitionRestartAttempts = 0;
          }
        } else {
          // Max attempts reached, stop recording
          console.warn('Max recognition restart attempts reached');
          showToast('Voice recognition stopped. Click to restart.', 'info');
          this.stopVoiceRecognition();
          this.recognitionRestartAttempts = 0;
        }
      }
    };

    this.recognition = recognitionInstance;
  }

  /**
   * Toggle voice recognition on/off
   */
  private toggleVoiceRecognition(): void {
    if (this.isRecording) {
      this.stopVoiceRecognition();
    } else {
      this.startVoiceRecognition();
    }
  }

  /**
   * Start voice recognition
   */
  private startVoiceRecognition(): void {
    if (!this.recognition) {
      showToast('Speech recognition not available', 'error');
      return;
    }

    // Prevent race condition - check if already recording
    if (this.isRecording) {
      return;
    }

    // Don't allow voice input while AI is processing
    if (this.isProcessing) {
      showToast('Please wait for the current message to complete', 'info');
      return;
    }

    try {
      this.recognition.start();
      this.isRecording = true;
      this.recognitionRestartAttempts = 0; // Reset retry counter
      this.elements.voiceBtn.classList.add('recording');
      this.elements.voiceBtn.setAttribute('aria-label', 'Stop voice input');
      this.elements.voiceBtn.setAttribute('title', 'Stop voice input (recording)');
      showToast('Voice recording started. Speak now...', 'info');
    } catch (error) {
      console.error('Failed to start recognition:', error);
      showToast('Failed to start voice recognition', 'error');
      this.isRecording = false;
    }
  }

  /**
   * Stop voice recognition
   */
  private stopVoiceRecognition(): void {
    if (!this.recognition) {
      return;
    }

    try {
      this.recognition.stop();
      this.isRecording = false;
      this.elements.voiceBtn.classList.remove('recording', 'error');
      this.elements.voiceBtn.setAttribute('aria-label', 'Voice input');
      this.elements.voiceBtn.setAttribute('title', 'Voice input');
    } catch (err) {
      console.error('Failed to stop voice recognition:', err);
    }
  }
}

// End of UIManager class
