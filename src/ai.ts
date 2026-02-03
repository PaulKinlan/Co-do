/**
 * AI SDK Integration
 * Handles communication with various AI providers
 *
 * Provider SDKs are loaded via dynamic import() so that only the selected
 * provider's code is fetched.  Vite automatically code-splits each dynamic
 * import into a separate chunk.  This pairs with the dynamic per-provider CSP
 * to reduce the application's surface area.  See docs/models-csp-report.md.
 */

import { Tool, streamText, ModelMessage, StepResult, LanguageModel, stepCountIs } from 'ai';
import { preferencesManager } from './preferences';
import { skillsManager } from './skills';


export type AIProvider = 'anthropic' | 'openai' | 'google' | 'openrouter';

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
  openrouter: [
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    { id: 'mistralai/mistral-large', name: 'Mistral Large' },
  ],
};

export class AIManager {
  /**
   * Get the provider instance based on configuration.
   *
   * Each SDK package is loaded via dynamic import() so that Vite creates a
   * separate chunk per provider.  Only the chunk for the active provider is
   * ever fetched by the browser.  This is a defense-in-depth measure that
   * complements the dynamic per-provider CSP.
   */
  private async getProvider(config: ModelConfig): Promise<LanguageModel> {
    switch (config.provider) {
      case 'anthropic': {
        const { createAnthropic } = await import('@ai-sdk/anthropic');
        const client = createAnthropic({
          apiKey: config.apiKey,
          headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
        });
        return client(config.model) as unknown as LanguageModel;
      }
      case 'openai': {
        const { createOpenAI } = await import('@ai-sdk/openai');
        const client = createOpenAI({
          apiKey: config.apiKey,
        });
        return client(config.model) as unknown as LanguageModel;
      }
      case 'google': {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const client = createGoogleGenerativeAI({
          apiKey: config.apiKey,
        });
        return client(config.model) as unknown as LanguageModel;
      }
      case 'openrouter': {
        const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
        const client = createOpenRouter({
          apiKey: config.apiKey,
        });
        return client(config.model) as unknown as LanguageModel;
      }
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Stream a completion from the AI
   * Messages are passed in from the caller (managed per-conversation)
   */
  async streamCompletion(
    userMessage: string,
    conversationMessages: ModelMessage[],
    tools: Record<string, Tool>,
    onTextDelta: (text: string) => void,
    onToolCall: (toolName: string, args: unknown) => void,
    onToolResult: (toolName: string, result: unknown) => void,
    onFinish: (responseText: string) => void,
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

      // Build messages array with user message appended
      const messages: ModelMessage[] = [
        ...conversationMessages,
        { role: 'user', content: userMessage },
      ];

      const provider = await this.getProvider(config);

      const result = streamText({
        model: provider,
        system: this.getSystemPrompt(),
        messages,
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

      // Pass the final text to onFinish so caller can store it
      onFinish(finalText || '');
    } catch (error) {
      const err = error as Error;
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
      case 'openrouter':
        return apiKey.startsWith('sk-or-');
      default:
        return false;
    }
  }

  /**
   * Get system prompt for the AI
   */
  getSystemPrompt(): string {
    // Build skill discovery section (progressive disclosure: names + descriptions only)
    let skillsSection = '';
    try {
      const modelVisible = skillsManager.getModelVisible();
      if (modelVisible.length > 0) {
        const skillLines = modelVisible.map(s => {
          const hint = s.argumentHint ? ` (args: ${s.argumentHint})` : '';
          return `  - ${s.name}${hint}: ${s.description.split('\n')[0]}`;
        });
        skillsSection = `

AVAILABLE SKILLS:
The workspace has reusable skills (SKILL.md workflows) you can run with the run_skill tool.
If the user's request matches a skill, suggest running it. Use list_skills to see full details.
${skillLines.join('\n')}`;
      }
    } catch {
      // Skills may not be initialized yet — skip
    }

    return `You are an AI assistant that helps users manage their files using the File System Access API.

You have access to tools to interact with the user's file system, including:
- open_file / cat: Display file contents to the user (returns a summary to you)
- read_file_content: Get actual file content when you need to analyze or process it
- create_file: Create a new file with specified content
- write_file: Write or update content in an existing file (full overwrite)
- edit_file: Efficiently edit a file using search/replace or line-based operations (preferred for targeted changes — shows a unified diff)
- rename_file / move_file: Rename or move a file
- delete_file: Delete a file (use with caution)
- list_files: List files in the directory
- pipe: Chain commands together (grep, sort, uniq, head, tail, wc, cat, read_file, write_file)
- WASM tools: grep, sort, uniq, head, tail, wc, diff, tree, and more

SKILL TOOLS:
- make_skill: Create a reusable workflow as a SKILL.md file in .skills/
- run_skill: Run a saved skill by name with arguments ($ARGUMENTS, $0, $1 substitution)
- list_skills: List available skills from .skills/ and .claude/skills/ directories
- import_skill: Import a skill from another location into .skills/

When the user describes a multi-step workflow they may want to reuse, suggest saving it as a skill with make_skill.
When running a skill (run_skill), follow the returned instructions step by step.
${skillsSection}

IMPORTANT - Prefer edit_file over write_file:
- Use edit_file for making targeted changes to existing files (search/replace or line-based edits)
- edit_file shows a unified diff of exactly what changed, making changes transparent
- Only use write_file when you need to completely replace the entire file content
- edit_file supports dry_run mode to preview changes before applying them

IMPORTANT - Context-efficient tool usage:
- Tools like open_file, cat, and all WASM tools display full output to the USER but return only a SUMMARY and short preview to you
- This keeps our conversation efficient and avoids context bloat
- Do NOT repeat or describe tool output back to the user — they already see the full result in the UI
- If you need to actually analyze or work with file content (e.g., find specific code, extract data), use read_file_content
- Use the pipe tool to chain commands (grep, sort, head, tail, etc.) for efficient text processing

Guidelines:
1. Always confirm destructive operations (delete, overwrite) before executing
2. Be careful with file paths - use the exact paths provided by the user
3. The user sees full file contents automatically - don't repeat large content back to them
4. When making changes, explain what you're doing and why
5. If you're unsure about a file operation, ask for clarification
6. Respect the user's permission settings for each tool

The user has selected a folder, and you can work with any files within that folder and its subfolders.`;
  }
}

// Export a singleton instance
export const aiManager = new AIManager();
