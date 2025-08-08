import { query } from '@anthropic-ai/claude-code';
import { SYSTEM_PROMPT } from './prompts';
class MessageRenderer {
    static renderAssistantMessage(message) {
        const content = message.message.content;
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content
                .map(block => {
                if (block.type === 'text') {
                    return block.text;
                }
                if (block.type === 'tool_use') {
                    return `Using '${block.name}' tool...`;
                }
                return `[${block.type}] ${JSON.stringify(block)}`;
            })
                .join('\n');
        }
        return JSON.stringify(content);
    }
    static renderUserMessage(message) {
        const content = message.message.content;
        if (typeof content === 'string') {
            return `User: ${content}`;
        }
        if (Array.isArray(content)) {
            return content
                .map(block => {
                if (block.type === 'text') {
                    return `User: ${block.text}`;
                }
                if (block.type === 'tool_result') {
                    return `done.`;
                }
                return `[User ${block.type}] ${JSON.stringify(block)}`;
            })
                .join('\n');
        }
        return `User: ${JSON.stringify(content)}`;
    }
    static renderResultMessage(message) {
        if (message.subtype === 'success') {
            return [
                `✅ Task completed successfully`,
                `Duration: ${message.duration_ms}ms`,
                `API Duration: ${message.duration_api_ms}ms`,
                `Turns: ${message.num_turns}`,
                `Cost: $${message.total_cost_usd.toFixed(4)}`,
                `Tokens: ${message.usage.input_tokens} input + ${message.usage.output_tokens} output`,
            ].filter(Boolean).join('\n');
        }
        return [
            `❌ Task failed: ${message.subtype}`,
            `Duration: ${message.duration_ms}ms`,
            `API Duration: ${message.duration_api_ms}ms`,
            `Turns: ${message.num_turns}`,
            `Cost: $${message.total_cost_usd.toFixed(4)}`,
            `Tokens: ${message.usage.input_tokens} input + ${message.usage.output_tokens} output`
        ].join('\n');
    }
    static renderSystemMessage(message) {
        return [
            `🔧 System initialized`,
            `Model: ${message.model}`,
            `Working Directory: ${message.cwd}`,
        ].filter(Boolean).join('\n');
    }
    static renderMessage(message) {
        switch (message.type) {
            case 'assistant':
                return this.renderAssistantMessage(message);
            case 'user':
                return this.renderUserMessage(message);
            case 'result':
                return this.renderResultMessage(message);
            case 'system':
                return this.renderSystemMessage(message);
            default:
                return `[Unknown message type] ${JSON.stringify(message)}`;
        }
    }
}
export class ClaudeService {
    static async executePrompt(prompt, options = {}) {
        try {
            const abortController = options.abortController || new AbortController();
            for await (const message of query({
                prompt,
                options: {
                    // maxTurns: 3,
                    abortController,
                    customSystemPrompt: SYSTEM_PROMPT,
                    permissionMode: 'bypassPermissions'
                },
            })) {
                const renderedMessage = MessageRenderer.renderMessage(message);
                if (options.onMessage) {
                    options.onMessage(renderedMessage);
                }
            }
            return {
                success: true
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    static renderMessage(message) {
        return MessageRenderer.renderMessage(message);
    }
}
