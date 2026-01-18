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
    infoModal: HTMLElement;
    settingsModal: HTMLElement;
    toolsModal: HTMLElement;
    dataShareModal: HTMLElement;
    dataShareAccept: HTMLButtonElement;
    dataShareCancel: HTMLButtonElement;
    mobileMenuBtn: HTMLButtonElement;
    sidebar: HTMLElement;
    sidebarOverlay: HTMLDivElement;
    // Provider configuration elements
    providersList: HTMLDivElement;
    addProviderBtn: HTMLButtonElement;
    providerEditModal: HTMLElement;
    providerName: HTMLInputElement;
    providerType: HTMLSelectElement;
    providerApiKey: HTMLInputElement;
    providerApiKeyLink: HTMLAnchorElement;
    providerModel: HTMLSelectElement;
    providerIsDefault: HTMLInputElement;
    providerSaveBtn: HTMLButtonElement;
    providerCancelBtn: HTMLButtonElement;
    providerCorsWarning: HTMLDivElement;
  };

  private currentText: string = '';
  private isProcessing: boolean = false;
  private currentOpenModal: HTMLElement | null = null;
  private pendingFolderSelection: boolean = false;

  private currentEditingProviderId: string | null = null;
  private currentAbortController: AbortController | null = null;

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
      infoModal: document.getElementById('info-modal') as HTMLElement,
      settingsModal: document.getElementById('settings-modal') as HTMLElement,
      toolsModal: document.getElementById('tools-modal') as HTMLElement,
      dataShareModal: document.getElementById('data-share-modal') as HTMLElement,
      dataShareAccept: document.getElementById('data-share-accept') as HTMLButtonElement,
      dataShareCancel: document.getElementById('data-share-cancel') as HTMLButtonElement,
      mobileMenuBtn: document.getElementById('mobile-menu-btn') as HTMLButtonElement,
      sidebar: document.getElementById('sidebar') as HTMLElement,
      sidebarOverlay: document.getElementById('sidebar-overlay') as HTMLDivElement,
      // Provider configuration elements
      providersList: document.getElementById('providers-list') as HTMLDivElement,
      addProviderBtn: document.getElementById('add-provider-btn') as HTMLButtonElement,
      providerEditModal: document.getElementById('provider-edit-modal') as HTMLElement,
      providerName: document.getElementById('provider-name') as HTMLInputElement,
      providerType: document.getElementById('provider-type') as HTMLSelectElement,
      providerApiKey: document.getElementById('provider-api-key') as HTMLInputElement,
      providerApiKeyLink: document.getElementById('provider-api-key-link') as HTMLAnchorElement,
      providerModel: document.getElementById('provider-model') as HTMLSelectElement,
      providerIsDefault: document.getElementById('provider-is-default') as HTMLInputElement,
      providerSaveBtn: document.getElementById('provider-save-btn') as HTMLButtonElement,
      providerCancelBtn: document.getElementById('provider-cancel-btn') as HTMLButtonElement,
      providerCorsWarning: document.getElementById('provider-cors-warning') as HTMLDivElement,
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

    // Global escape key handler (fixes multiple event listeners issue)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Don't allow closing the critical data share modal with Escape
        if (this.currentOpenModal === this.elements.dataShareModal) {
          // Instead, trigger the cancel action
          this.handleDataShareCancel();
          return;
        }
        // Close open modal if any
        if (this.currentOpenModal && !this.currentOpenModal.hasAttribute('hidden')) {
          this.closeModal(this.currentOpenModal);
        }
        // Close mobile sidebar if open
        if (this.elements.sidebar.classList.contains('open')) {
          this.closeMobileSidebar();
        }
      }
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
    modal.removeAttribute('hidden');
  }

  /**
   * Close a modal
   */
  private closeModal(modal: HTMLElement): void {
    modal.setAttribute('hidden', '');
    if (this.currentOpenModal === modal) {
      this.currentOpenModal = null;
    }
  }

  /**
   * Setup modal close handlers
   */
  private setupModalCloseHandlers(modal: HTMLElement): void {
    const closeBtn = modal.querySelector('.modal-close') as HTMLButtonElement;
    const overlay = modal.querySelector('.modal-overlay') as HTMLDivElement;

    closeBtn?.addEventListener('click', () => this.closeModal(modal));
    overlay?.addEventListener('click', () => this.closeModal(modal));

    // Note: Escape key handling is now done globally in attachEventListeners()
    // to prevent multiple event listeners
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
    this.elements.providerEditModal.removeAttribute('hidden');
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

    // Update CORS warning visibility
    this.updateProviderCorsWarning();
  }

  /**
   * Update CORS warning visibility based on selected provider
   */
  private updateProviderCorsWarning(): void {
    const provider = this.elements.providerType.value;
    if (provider === 'anthropic') {
      this.elements.providerCorsWarning.removeAttribute('hidden');
    } else {
      this.elements.providerCorsWarning.setAttribute('hidden', '');
    }
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
      this.elements.dataShareModal.removeAttribute('hidden');

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
    const messageElement = this.addMessage('assistant', '');

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
          messageElement.textContent = this.currentText;
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
    message.textContent = content;
    this.elements.messages.appendChild(message);
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    return message;
  }

  /**
   * Add a tool call indicator
   */
  private addToolCall(toolName: string, args: unknown): void {
    const toolCall = document.createElement('div');
    toolCall.className = 'tool-call';
    toolCall.innerHTML = `
      <div class="tool-call-name">🔧 ${toolName}</div>
      <div class="tool-call-args">${JSON.stringify(args, null, 2)}</div>
    `;
    this.elements.messages.appendChild(toolCall);
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }

  /**
   * Add a tool result indicator
   */
  private addToolResult(toolName: string, result: unknown): void {
    const toolResult = document.createElement('div');
    toolResult.className = 'tool-call';
    toolResult.innerHTML = `
      <div class="tool-call-name">✅ ${toolName} result</div>
      <div class="tool-call-args">${JSON.stringify(result, null, 2)}</div>
    `;
    this.elements.messages.appendChild(toolResult);
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
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
      if (provider === 'anthropic') {
        return 'Anthropic API does not support browser requests (CORS). Please use Google Gemini or OpenAI instead, or deploy behind a proxy server.';
      }
      if (provider === 'openai') {
        return 'OpenAI API request failed. This may be a CORS issue or network problem. Check your API key and try again.';
      }
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
   * Request permission from user for a tool
   */
  private async requestPermission(toolName: ToolName, args: unknown): Promise<boolean> {
    return new Promise((resolve) => {
      // Create overlay (non-dismissible - user must click a button)
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';

      // Create dialog
      const dialog = document.createElement('div');
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
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
      };

      // Attach to body
      document.body.appendChild(overlay);
      document.body.appendChild(dialog);

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

      // Overlay click no longer dismisses - user must choose an option explicitly
      // This prevents accidental dismissals and makes the UX clearer
    });
  }
}
