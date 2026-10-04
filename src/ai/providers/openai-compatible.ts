import type { ProviderId, ProviderSettings } from '@/shared/types';
import type { AIProvider, ValidationResult } from './types';
import { AIError, classifyHttpError, requestJson } from './types';

function assertConfigured(settings: ProviderSettings): void {
  if (!settings.apiKey) {
    throw new AIError('API key is required.', 'invalid_key');
  }
  if (!settings.endpoint) {
    throw new AIError('API endpoint is required.', 'invalid_endpoint');
  }
  if (!settings.model) {
    throw new AIError('A model name is required.', 'invalid_model');
  }
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path;
}

function extractErrorFromBody(body: unknown, fallback: string): string {
  if (typeof body === 'string') return body.slice(0, 300);
  if (body && typeof body === 'object') {
    const any = body as Record<string, unknown>;
    if (any.error && typeof any.error === 'object') {
      const e = any.error as Record<string, unknown>;
      if (typeof e.message === 'string') return e.message;
    }
    if (typeof any.message === 'string') return any.message;
    if (any.error && typeof any.error === 'string') return any.error;
  }
  return fallback;
}

/**
 * Shared implementation for every OpenAI-compatible provider
 * (OpenAI, OpenRouter, Groq, and arbitrary custom endpoints).
 */
export abstract class OpenAICompatibleProvider implements AIProvider {
  abstract readonly id: ProviderId;

  protected chatPath = '/chat/completions';
  protected modelsPath = '/models';
  protected systemMsg = 'You are a meticulous study assistant.';

  async validateConnection(settings: ProviderSettings): Promise<ValidationResult> {
    try {
      assertConfigured(settings);
      // Minimal call: a tiny chat completion exercises key + model + endpoint.
      const { status, body } = await requestJson(joinUrl(settings.endpoint, this.chatPath), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: 'user', content: 'Ping.' }],
          max_tokens: 5,
        }),
      });
      if (status !== 200) {
        throw classifyHttpError(status);
      }
      const choices = (body as { choices?: Array<{ message?: { content?: string } }> }).choices;
      if (!choices || choices.length === 0) {
        return { ok: false, status: 'unknown', message: 'Provider returned an unexpected response.' };
      }
      return {
        ok: true,
        status: 'success',
        provider: settings.name,
        model: settings.model,
        message: 'Connection successful. API key accepted.',
      };
    } catch (err) {
      if (err instanceof AIError) {
        return { ok: false, status: err.status, message: err.message };
      }
      return {
        ok: false,
        status: 'unknown',
        message: err instanceof Error ? err.message : 'Unable to validate configuration.',
      };
    }
  }

  async listModels(settings: ProviderSettings): Promise<string[]> {
    assertConfigured(settings);
    const { status, body } = await requestJson(joinUrl(settings.endpoint, this.modelsPath), {
      method: 'GET',
      headers: { Authorization: `Bearer ${settings.apiKey}` },
    });
    if (status !== 200) throw classifyHttpError(status);
    const data = body as { data?: Array<{ id?: string }> };
    if (!Array.isArray(data.data)) return [];
    return data.data.map((m) => m.id).filter((id): id is string => typeof id === 'string');
  }

  async generateText(prompt: string, settings: ProviderSettings): Promise<string> {
    assertConfigured(settings);
    const { status, body } = await requestJson(joinUrl(settings.endpoint, this.chatPath), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: this.systemMsg },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (status !== 200) {
      const text = JSON.stringify(body);
      throw classifyHttpError(status, text);
    }
    const content = (body as {
      choices?: Array<{ message?: { content?: string } }>;
    }).choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new AIError('Malformed AI response: no content returned.', 'unknown');
    }
    return content;
  }
}

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = 'openai';
}
export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = 'openrouter';
  protected modelsPath = '/models';
}
export class GroqProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = 'groq';
}
export class CustomProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = 'custom';
}

export { assertConfigured, joinUrl, extractErrorFromBody };
