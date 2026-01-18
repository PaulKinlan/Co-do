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
import { toastManager, showToast } from './toasts';
import { ProviderConfig } from './storage';
import { createMarkdownIframe, updateMarkdownIframe, checkContentOverflow } from './markdown';

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
    messages: HTMLDivElement;
    status: HTMLDivElement;
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
  };

  private currentText: string = '';
  private isProcessing: boolean = false;
  private currentOpenModal: HTMLDialogElement | null = null;
  private pendingFolderSelection: boolean = false;

  private currentEditingProviderId: string | null = null;
  private currentAbortController: AbortController | null = null;
  private currentMarkdownIframe: HTMLIFrameElement | null = null;
  private currentMarkdownWrapper: HTMLDivElement | null = null;
  private readonly MARKDOWN_MAX_HEIGHT = 400;

  // Tool activity group for collapsible tool calls display
  private currentToolActivityGroup: HTMLDivElement | null = null;
  private toolCallCount: number = 0;

  // Permission batching system
  private pendingPermissions: Array<{
    toolName: ToolName;
    args: unknown;
    resolve: (value: boolean) => void;
  }> = [];
  private permissionBatchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly PERMISSION_BATCH_DELAY = 50; // ms to wait for additional permission requests

  constructor() {
    // Get all DOM elements
    this.elements = {
      selectFolderBtn: document.getElementById('select-folder-btn') as HTMLButtonElement,
      folderInfo: document.getElementById('folder-info') as HTMLDivElement,
      fileList: document.getElementById('file-list') as HTMLDivElement,
      promptInput: document.getElementById('prompt-input') as HTMLTextAreaElement,
      sendBtn: document.getElementById('send-btn') as HTMLButtonElement,
      messages: document.getElementById('messages') as HTMLDivElement,
      status: document.getElementById('status') as HTMLDivElement,
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
    };

    this.initializeUI();
    this.attachEventListeners();
    this.attemptDirectoryRestoration().catch((error) => {
      console.error('Failed to restore directory:', error);
      showToast('Could not restore previous folder', 'error');
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

    // Set permission callback for tools
    setPermissionCallback(this.requestPermission.bind(this));

    // Load provider configurations (async)
    this.loadProviderConfigurations();
  }

  /**
   * Attempt to restore a previously saved directory handle
   */
  private async attemptDirectoryRestoration(): Promise<void> {
    if (!fileSystemManager.isSupported()) {
      return;
    }

    try {
      // Set up file system observer callback BEFORE restoration
      fileSystemManager.setChangeCallback((changes) => {
        this.handleFileSystemChanges(changes);
      });

      // Check if there's a saved directory first
      const hasSavedDirectory = await fileSystemManager.hasSavedDirectory();
      if (!hasSavedDirectory) {
        return; // No saved directory, nothing to restore
      }

      // Only show status if there's actually something to restore
      this.setStatus('Checking for previous directory...', 'info');

      const restored = await fileSystemManager.restoreDirectory();

      if (restored) {
        const handle = fileSystemManager.getRootHandle();
        if (!handle) {
          this.setStatus('', 'info');
          return;
        }

        // Start observing
        const observerStarted = await fileSystemManager.startObserving();

        // Display folder info
        let folderInfoHtml = `<strong>Selected folder:</strong> ${handle.name}`;

        if (observerStarted && fileSystemManager.isObserving()) {
          folderInfoHtml += ' <span class="live-updates-indicator">(Live updates enabled)</span>';
        }

        this.elements.folderInfo.innerHTML = folderInfoHtml;

        // List files
        await this.refreshFileList();

        this.setStatus('Folder restored successfully', 'success');
        showToast('Previous folder restored', 'success');

        // Auto-dismiss the status message after 10 seconds
        setTimeout(() => {
          // Only clear if the status is still showing the restore message
          if (this.elements.status.textContent === 'Folder restored successfully') {
            this.setStatus('', 'info');
          }
        }, 10000);
      } else {
        // Restoration failed (likely permission denied)
        this.setStatus('', 'info');
      }
    } catch (error) {
      console.error('Failed to restore directory:', error);
      this.setStatus('', 'info');
    }
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Folder selection
    this.elements.selectFolderBtn.addEventListener('click', () => this.handleSelectFolder());

    // Send prompt
    this.elements.sendBtn.addEventListener('click', () => this.handleSendPrompt());
    this.elements.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendPrompt();
      }
    });

    // Mobile menu toggle
    this.elements.mobileMenuBtn.addEventListener('click', () => this.toggleMobileSidebar());
    this.elements.sidebarOverlay.addEventListener('click', () => this.closeMobileSidebar());

    // Modal controls
    this.elements.infoBtn.addEventListener('click', () => this.openModal('info'));
    this.elements.settingsBtn.addEventListener('click', () => {
      this.openModal('settings');
      this.loadProviderConfigurations();
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
  private async loadProviderConfigurations(): Promise<void> {
    try {
      const configs = await preferencesManager.getAllProviderConfigs();

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
  private openProviderEditModal(config?: ProviderConfig): void {
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
      this.elements.providerIsDefault.checked = false;

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
   * Perform the actual folder selection
   */
  private async performFolderSelection(): Promise<void> {
    try {
      this.setStatus('Selecting folder...', 'info');

      if (!fileSystemManager.isSupported()) {
        const errorMsg = 'File System Access API is not supported in this browser. Please use Chrome 86+ or Edge 86+.';
        this.setStatus(errorMsg, 'error');
        showToast(errorMsg, 'error');
        return;
      }

      // Set up file system observer callback BEFORE directory selection
      // to avoid missing any early change events
      fileSystemManager.setChangeCallback((changes) => {
        this.handleFileSystemChanges(changes);
      });

      const handle = await fileSystemManager.selectDirectory();

      // Verify permissions
      const hasPermission = await fileSystemManager.verifyPermission('readwrite');
      if (!hasPermission) {
        const errorMsg = 'Permission denied to access the directory';
        this.setStatus(errorMsg, 'error');
        showToast(errorMsg, 'error');
        return;
      }

      // Start observing AFTER permission verification
      const observerStarted = await fileSystemManager.startObserving();

      // Display folder info
      let folderInfoHtml = `<strong>Selected folder:</strong> ${handle.name}`;

      // Add observer status indicator only if observer actually started successfully
      if (observerStarted && fileSystemManager.isObserving()) {
        folderInfoHtml += ' <span class="live-updates-indicator">(Live updates enabled)</span>';
      }

      this.elements.folderInfo.innerHTML = folderInfoHtml;

      // List files
      await this.refreshFileList();

      this.setStatus('Folder loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to select folder:', error);
      const errorMsg = `Failed to select folder: ${(error as Error).message}`;
      this.setStatus(errorMsg, 'error');
      showToast(errorMsg, 'error');
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
      const errorMsg = `Failed to list files: ${(error as Error).message}`;
      this.setStatus(errorMsg, 'error');
      showToast(errorMsg, 'error');
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
   * Display file list
   */
  private displayFileList(entries: FileSystemEntry[]): void {
    this.elements.fileList.innerHTML = '';

    if (entries.length === 0) {
      this.elements.fileList.innerHTML = '<p>No files found in the selected folder.</p>';
      return;
    }

    const files = entries.filter((e) => e.kind === 'file');
    const directories = entries.filter((e) => e.kind === 'directory');

    // Group by type
    const fragment = document.createDocumentFragment();

    // Directories first
    directories.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `
        <span class="file-icon">📁</span>
        <span class="file-name">${entry.path}</span>
      `;
      fragment.appendChild(item);
    });

    // Then files
    files.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `
        <span class="file-icon">📄</span>
        <span class="file-name">${entry.path}</span>
      `;
      fragment.appendChild(item);
    });

    this.elements.fileList.appendChild(fragment);
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

    // Check for default provider configuration
    const defaultConfig = await preferencesManager.getDefaultProviderConfig();
    if (!defaultConfig) {
      const errorMsg = 'Please configure a provider in settings first';
      this.setStatus(errorMsg, 'error');
      showToast(errorMsg, 'error');
      return;
    }

    if (!fileSystemManager.getRootHandle()) {
      const errorMsg = 'Please select a folder first';
      this.setStatus(errorMsg, 'error');
      showToast(errorMsg, 'error');
      return;
    }

    // Set processing flag immediately to prevent race conditions
    this.isProcessing = true;

    // Disable input while processing
    this.elements.promptInput.disabled = true;
    this.elements.sendBtn.disabled = true;

    // Add user message
    this.addMessage('user', prompt);
    this.elements.promptInput.value = '';

    // Prepare for assistant response
    this.currentText = '';
    this.currentMarkdownIframe = null;
    const messageElement = this.addMessage('assistant', '');

    // Reset tool activity group for new request
    this.currentToolActivityGroup = null;
    this.toolCallCount = 0;

    this.setStatus('Processing...', 'info');

    // Create an AbortController for this request
    this.currentAbortController = new AbortController();

    try {
      await aiManager.streamCompletion(
        prompt,
        fileTools,
        // On text delta
        (text) => {
          this.currentText += text;
          // Update the markdown iframe with the accumulated text
          if (this.currentMarkdownIframe) {
            updateMarkdownIframe(this.currentMarkdownIframe, this.currentText);
            // Check for truncation after content update
            if (this.currentMarkdownWrapper) {
              this.checkAndUpdateTruncation(this.currentMarkdownIframe, this.currentMarkdownWrapper);
            }
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
        async () => {
          this.setStatus('Response complete', 'success');

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
      this.isProcessing = false;
      this.elements.promptInput.disabled = false;
      this.elements.sendBtn.disabled = false;
      this.elements.promptInput.focus();
    }
  }

  /**
   * Add a message to the chat
   */
  private addMessage(
    role: 'user' | 'assistant' | 'system' | 'error',
    content: string
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

    this.elements.messages.appendChild(message);
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    return message;
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

    this.elements.messages.appendChild(group);
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

    // Create tool call item
    const toolItem = document.createElement('div');
    toolItem.className = 'tool-activity-item tool-call-item';
    toolItem.setAttribute('data-tool', toolName);

    // Format args nicely, truncating if too long
    let argsStr: string;
    try {
      argsStr = JSON.stringify(args, null, 2);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      argsStr = `[Unable to display arguments: ${message}]`;
    }
    const truncatedArgs = argsStr.length > 500 ? argsStr.substring(0, 500) + '...' : argsStr;

    toolItem.innerHTML = `
      <div class="tool-item-header">
        <span class="tool-item-icon">🔧</span>
        <span class="tool-item-name">${this.escapeHtml(toolName)}</span>
        <span class="tool-item-status pending">calling...</span>
      </div>
      <details class="tool-item-details">
        <summary>Arguments</summary>
        <pre class="tool-item-args">${this.escapeHtml(truncatedArgs)}</pre>
      </details>
    `;

    content.appendChild(toolItem);
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }

  /**
   * Add a tool result indicator
   */
  private addToolResult(toolName: string, result: unknown): void {
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

      // Add result details with error handling for JSON.stringify
      let resultStr: string;
      try {
        resultStr = JSON.stringify(result, null, 2);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        resultStr = 'Error stringifying tool result: ' + errorMessage + '\nRaw result (toString): ' + String(result);
      }
      const truncatedResult = resultStr.length > 500 ? resultStr.substring(0, 500) + '...' : resultStr;

      const resultDetails = document.createElement('details');
      resultDetails.className = 'tool-item-details tool-result-details';
      resultDetails.innerHTML = `
        <summary>Result</summary>
        <pre class="tool-item-result">${this.escapeHtml(truncatedResult)}</pre>
      `;
      toolItem.appendChild(resultDetails);
    }

    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Set status message
   */
  private setStatus(message: string, type: 'info' | 'success' | 'error'): void {
    this.elements.status.textContent = message;
    this.elements.status.className = `status-bar ${type}`;
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
   * Request permission from user for a tool (with batching support)
   * When multiple tool calls come in rapid succession, they are batched into a single dialog
   */
  private async requestPermission(toolName: ToolName, args: unknown): Promise<boolean> {
    return new Promise((resolve) => {
      // Add to pending permissions queue
      this.pendingPermissions.push({ toolName, args, resolve });

      // Clear any existing timeout
      if (this.permissionBatchTimeout) {
        clearTimeout(this.permissionBatchTimeout);
      }

      // Set a short timeout to batch multiple requests
      this.permissionBatchTimeout = setTimeout(() => {
        this.showBatchPermissionDialog();
      }, this.PERMISSION_BATCH_DELAY);
    });
  }

  /**
   * Show a batch permission dialog for all pending tool calls
   */
  private showBatchPermissionDialog(): void {
    const permissions = [...this.pendingPermissions];
    this.pendingPermissions = [];
    this.permissionBatchTimeout = null;

    if (permissions.length === 0) return;

    // Single permission - use simpler dialog
    if (permissions.length === 1) {
      const singlePermission = permissions[0];
      if (singlePermission) {
        this.showSinglePermissionDialog(singlePermission);
      }
      return;
    }

    // Multiple permissions - show batch dialog with native <dialog>
    const dialog = document.createElement('dialog');
    dialog.className = 'permission-dialog batch-permission-dialog';

    // Build the tool calls list with checkboxes
    const toolCallsHtml = permissions.map((p, index) => `
      <div class="batch-tool-item" data-index="${index}">
        <label class="batch-tool-checkbox">
          <input type="checkbox" checked data-index="${index}">
          <span class="checkmark"></span>
        </label>
        <div class="tool-call">
          <div class="tool-call-name">${p.toolName}</div>
          <div class="tool-call-args">${JSON.stringify(p.args, null, 2)}</div>
        </div>
      </div>
    `).join('');

    dialog.innerHTML = `
      <h3>Permission Request</h3>
      <p>The AI wants to perform <strong>${permissions.length} actions</strong>:</p>
      <div class="batch-tool-list">
        ${toolCallsHtml}
      </div>
      <div class="batch-selection-controls">
        <button class="select-all-btn" type="button">Select All</button>
        <button class="select-none-btn" type="button">Select None</button>
      </div>
      <div class="permission-dialog-buttons">
        <button class="cancel-btn">Cancel All</button>
        <button class="approve-btn">Approve Selected</button>
      </div>
      <p class="permission-hint">
        <small>Check the actions you want to approve. Cancel All will abort the conversation.</small>
      </p>
    `;

    // Helper to close dialog
    const closeDialog = () => {
      dialog.close();
      dialog.remove();
    };

    // Prevent escape key from closing (user must click a button)
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
    });

    // Attach to body and show as modal
    document.body.appendChild(dialog);
    dialog.showModal();

    // Get checkbox elements
    const checkboxes = dialog.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;

    // Select all button
    const selectAllBtn = dialog.querySelector('.select-all-btn') as HTMLButtonElement;
    selectAllBtn.addEventListener('click', () => {
      checkboxes.forEach(cb => cb.checked = true);
    });

    // Select none button
    const selectNoneBtn = dialog.querySelector('.select-none-btn') as HTMLButtonElement;
    selectNoneBtn.addEventListener('click', () => {
      checkboxes.forEach(cb => cb.checked = false);
    });

    // Handle approve selected
    const approveBtn = dialog.querySelector('.approve-btn') as HTMLButtonElement;
    approveBtn.addEventListener('click', () => {
      closeDialog();

      // Check which items are selected
      const hasAnyApproved = Array.from(checkboxes).some(cb => cb.checked);

      if (!hasAnyApproved) {
        // No items selected - abort conversation
        if (this.currentAbortController) {
          this.currentAbortController.abort();
        }
        permissions.forEach(p => p.resolve(false));
        return;
      }

      // Resolve each permission based on checkbox state
      checkboxes.forEach((checkbox, index) => {
        const permission = permissions[index];
        if (permission) {
          permission.resolve(checkbox.checked);
        }
      });

      // If any were denied, abort the conversation
      const anyDenied = Array.from(checkboxes).some(cb => !cb.checked);
      if (anyDenied && this.currentAbortController) {
        this.currentAbortController.abort();
      }
    });

    // Handle cancel all
    const cancelBtn = dialog.querySelector('.cancel-btn') as HTMLButtonElement;
    cancelBtn.addEventListener('click', () => {
      closeDialog();
      // Abort the entire conversation
      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }
      permissions.forEach(p => p.resolve(false));
    });
  }

  /**
   * Show a single permission dialog (original behavior for single requests)
   */
  private showSinglePermissionDialog(permission: { toolName: ToolName; args: unknown; resolve: (value: boolean) => void }): void {
    const { toolName, args, resolve } = permission;

    // Create native dialog element
    const dialog = document.createElement('dialog');
    dialog.className = 'permission-dialog';
    dialog.innerHTML = `
      <h3>Permission Request</h3>
      <p>The AI wants to perform the following action:</p>
      <div class="tool-call">
        <div class="tool-call-name">${toolName}</div>
        <div class="tool-call-args">${JSON.stringify(args, null, 2)}</div>
      </div>
      <p>Do you want to allow this action?</p>
      <div class="permission-dialog-buttons">
        <button class="cancel-btn">Cancel</button>
        <button class="deny-btn">Deny</button>
        <button class="approve-btn">Approve</button>
      </div>
      <p class="permission-hint">
        <small>Cancel: Skip this action silently. Deny: Reject and notify AI. Approve: Allow the action.</small>
      </p>
    `;

    // Helper to close dialog
    const closeDialog = () => {
      dialog.close();
      dialog.remove();
    };

    // Prevent escape key from closing (user must click a button)
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
    });

    // Attach to body and show as modal
    document.body.appendChild(dialog);
    dialog.showModal();

    // Handle approve
    const approveBtn = dialog.querySelector('.approve-btn') as HTMLButtonElement;
    approveBtn.addEventListener('click', () => {
      closeDialog();
      resolve(true);
    });

    // Handle deny (explicit rejection)
    const denyBtn = dialog.querySelector('.deny-btn') as HTMLButtonElement;
    denyBtn.addEventListener('click', () => {
      closeDialog();
      // Abort the entire conversation when user denies
      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }
      resolve(false);
    });

    // Handle cancel (skip action silently, and abort the conversation)
    const cancelBtn = dialog.querySelector('.cancel-btn') as HTMLButtonElement;
    cancelBtn.addEventListener('click', () => {
      closeDialog();
      // Abort the entire conversation when user cancels
      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }
      resolve(false);
    });
  }
}
