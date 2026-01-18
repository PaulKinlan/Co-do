/**
 * AI SDK Integration
 * Handles communication with various AI providers
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Tool, streamText, ModelMessage, StepResult, LanguageModel, stepCountIs } from 'ai';
import { preferencesManager } from './preferences';


export type AIProvider = 'anthropic' | 'openai' | 'google';

export interface ModelConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export const AVAILABLE_MODELS = {
  anthropic: [
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-sonnet-3-5-20241022', name: 'Claude 3.5 Sonnet' },
  ],
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'o4-mini', name: 'o4-mini (Reasoning)' },
    { id: 'o3-mini', name: 'o3-mini (Reasoning)' },
    { id: 'gpt-4o', name: 'GPT-4o (Legacy)' },
  ],
  google: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Retiring Soon)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Legacy)' },
  ],
};

export class AIManager {
  private messages: ModelMessage[] = [];

  /**
   * Get the provider instance based on configuration
   */
  private getProvider(config: ModelConfig): LanguageModel {
    switch (config.provider) {
      case 'anthropic': {
        const client = createAnthropic({
          apiKey: config.apiKey,
          headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
        });
        return client(config.model) as unknown as LanguageModel;
      }
      case 'openai': {
        const client = createOpenAI({
          apiKey: config.apiKey,
        });
        return client(config.model) as unknown as LanguageModel;
      }
      case 'google': {
        const client = createGoogleGenerativeAI({
          apiKey: config.apiKey,
        });
        return client(config.model) as unknown as LanguageModel;
      }
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(message: ModelMessage): void {
    this.messages.push(message);
  }

  /**
   * Get conversation history
   */
  getMessages(): ModelMessage[] {
    return [...this.messages];
  }

  /**
   * Clear conversation history
   */
  clearMessages(): void {
    this.messages = [];
  }

  /**
   * Stream a completion from the AI
   */
  async streamCompletion(
    userMessage: string,
    tools: Record<string, Tool>,
    onTextDelta: (text: string) => void,
    onToolCall: (toolName: string, args: unknown) => void,
    onToolResult: (toolName: string, result: unknown) => void,
    onFinish: () => void,
    onError: (error: Error) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    try {
      // Get the default provider configuration
      const providerConfig = await preferencesManager.getDefaultProviderConfig();

      if (!providerConfig) {
        throw new Error('No provider configuration found. Please add a provider in settings.');
      }

      const config: ModelConfig = {
        provider: providerConfig.provider,
        model: providerConfig.model,
        apiKey: providerConfig.apiKey,
      };

      if (!config.apiKey) {
        throw new Error('API key not configured');
      }

      // Add user message to history
      this.addMessage({
        role: 'user',
        content: userMessage,
      });

      const provider = this.getProvider(config);

      const result = streamText({
        model: provider,
        messages: this.messages,
        tools,
        stopWhen: stepCountIs(10), // Allow up to 10 steps with tool calls
        abortSignal,
        onStepFinish: (step: StepResult<Record<string, Tool>>) => {
          // Handle tool calls for each step
          if (step.toolCalls) {
            for (const toolCall of step.toolCalls) {
              onToolCall(toolCall.toolName, toolCall.input);
            }
          }
          if (step.toolResults) {
            for (const toolResult of step.toolResults) {
              onToolResult(toolResult.toolName, toolResult.output);
            }
          }
        },
      });

      // Handle text deltas
      for await (const delta of result.textStream) {
        onTextDelta(delta);
      }

      // Wait for completion
      const completion = await result;
      const finalText = await completion.text;

      // Add assistant message to history
      if (finalText) {
        this.addMessage({
          role: 'assistant',
          content: finalText,
        });
      }

      onFinish();
    } catch (error) {
      const err = error as Error;

      // If this is an abort error, remove the user message from history
      // to prevent consecutive user messages in the conversation
      if (err.name === 'AbortError') {
        this.messages.pop();
      }

      onError(err);
    }
  }

  /**
   * Validate API key format for a provider
   */
  validateApiKey(provider: AIProvider, apiKey: string): boolean {
    if (!apiKey) return false;

    switch (provider) {
      case 'anthropic':
        return apiKey.startsWith('sk-ant-');
      case 'openai':
        return apiKey.startsWith('sk-');
      case 'google':
        return apiKey.length > 20; // Google API keys are typically longer
      default:
        return false;
    }
  }

  /**
   * Get system prompt for the AI
   */
  getSystemPrompt(): string {
    return `You are an AI assistant that helps users manage their files using the File System Access API.

You have access to the following tools to interact with the user's file system:
- open_file: Read the contents of a file
- create_file: Create a new file with specified content
- write_file: Write or update content in an existing file
- rename_file: Rename a file
- move_file: Move a file to a different location
- delete_file: Delete a file (use with caution)

Important guidelines:
1. Always confirm destructive operations (delete, overwrite) before executing
2. Be careful with file paths - use the exact paths provided by the user
3. When reading files, summarize the content unless asked for full details
4. When making changes, explain what you're doing and why
5. If you're unsure about a file operation, ask for clarification
6. Respect the user's permission settings for each tool

The user has selected a folder, and you can work with any files within that folder and its subfolders.`;
  }
}

// Export a singleton instance
export const aiManager = new AIManager();
