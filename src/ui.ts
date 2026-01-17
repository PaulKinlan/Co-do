/**
 * UI Components and Interactions
 */

import { fileSystemManager, FileSystemEntry } from './fileSystem';
import { preferencesManager, ToolName } from './preferences';
import { aiManager, AVAILABLE_MODELS } from './ai';
import { fileTools, setPermissionCallback } from './tools';

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
    aiProvider: HTMLSelectElement;
    apiKey: HTMLInputElement;
    model: HTMLSelectElement;
    permissionSelects: NodeListOf<HTMLSelectElement>;
  };

  private currentText: string = '';
  private isProcessing: boolean = false;

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
      aiProvider: document.getElementById('ai-provider') as HTMLSelectElement,
      apiKey: document.getElementById('api-key') as HTMLInputElement,
      model: document.getElementById('model') as HTMLSelectElement,
      permissionSelects: document.querySelectorAll('.permission-select'),
    };

    this.initializeUI();
    this.attachEventListeners();
  }

  /**
   * Initialize UI with saved preferences
   */
  private initializeUI(): void {
    // Load saved preferences
    this.elements.aiProvider.value = preferencesManager.getAiProvider();
    this.elements.apiKey.value = preferencesManager.getApiKey();

    // Update model dropdown
    this.updateModelOptions();
    this.elements.model.value = preferencesManager.getModel();

    // Load permission settings
    this.elements.permissionSelects.forEach((select) => {
      const toolName = select.dataset.tool as ToolName;
      if (toolName) {
        select.value = preferencesManager.getToolPermission(toolName);
      }
    });

    // Set permission callback for tools
    setPermissionCallback(this.requestPermission.bind(this));
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

    // Provider selection
    this.elements.aiProvider.addEventListener('change', () => {
      const provider = this.elements.aiProvider.value as 'anthropic' | 'openai' | 'google';
      preferencesManager.setAiProvider(provider);
      this.updateModelOptions();
    });

    // API key
    this.elements.apiKey.addEventListener('change', () => {
      preferencesManager.setApiKey(this.elements.apiKey.value);
    });

    // Model selection
    this.elements.model.addEventListener('change', () => {
      preferencesManager.setModel(this.elements.model.value);
    });

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
   * Update model options based on selected provider
   */
  private updateModelOptions(): void {
    const provider = this.elements.aiProvider.value as keyof typeof AVAILABLE_MODELS;
    const models = AVAILABLE_MODELS[provider];

    this.elements.model.innerHTML = '';
    models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      this.elements.model.appendChild(option);
    });

    // Set first model as default if current model is not available
    if (models.length > 0) {
      const currentModel = preferencesManager.getModel();
      const modelExists = models.some((m) => m.id === currentModel);
      if (!modelExists) {
        this.elements.model.value = models[0]!.id;
        preferencesManager.setModel(models[0]!.id);
      }
    }
  }

  /**
   * Handle folder selection
   */
  private async handleSelectFolder(): Promise<void> {
    try {
      this.setStatus('Selecting folder...', 'info');

      if (!fileSystemManager.isSupported()) {
        this.setStatus(
          'File System Access API is not supported in this browser. Please use Chrome 86+ or Edge 86+.',
          'error'
        );
        return;
      }

      const handle = await fileSystemManager.selectDirectory();

      // Verify permissions
      const hasPermission = await fileSystemManager.verifyPermission('readwrite');
      if (!hasPermission) {
        this.setStatus('Permission denied to access the directory', 'error');
        return;
      }

      // Display folder info
      this.elements.folderInfo.innerHTML = `<strong>Selected folder:</strong> ${handle.name}`;

      // List files
      await this.refreshFileList();

      this.setStatus('Folder loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to select folder:', error);
      this.setStatus(`Failed to select folder: ${(error as Error).message}`, 'error');
    }
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

    const apiKey = preferencesManager.getApiKey();
    if (!apiKey) {
      this.setStatus('Please enter an API key first', 'error');
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

    // Add user message
    this.addMessage('user', prompt);
    this.elements.promptInput.value = '';

    // Prepare for assistant response
    this.currentText = '';
    const messageElement = this.addMessage('assistant', '');

    this.setStatus('Processing...', 'info');

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
          this.setStatus(`Error: ${error.message}`, 'error');
          this.addMessage('error', `Error: ${error.message}`);
        }
      );
    } catch (error) {
      this.setStatus(`Error: ${(error as Error).message}`, 'error');
    } finally {
      // Always re-enable UI in finally block to ensure proper cleanup
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
    this.elements.status.className = type;
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
        resolve(false);
      });

      // Handle cancel (skip action silently, treated same as deny)
      const cancelBtn = dialog.querySelector('.cancel-btn') as HTMLButtonElement;
      cancelBtn.addEventListener('click', () => {
        closeDialog();
        resolve(false);
      });

      // Overlay click no longer dismisses - user must choose an option explicitly
      // This prevents accidental dismissals and makes the UX clearer
    });
  }
}
