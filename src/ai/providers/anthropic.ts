import type { ProviderId, ProviderSettings } from '@/shared/types';
import type { AIProvider, ValidationResult } from './types';
import { AIError, classifyHttpError, requestJson } from './types';

export class AnthropicProvider implements AIProvider {
  readonly id: ProviderId = 'anthropic';
  private path = '/messages';

  async validateConnection(settings: ProviderSettings): Promise<ValidationResult> {
    try {
      if (!settings.apiKey) throw new AIError('API key is required.', 'invalid_key');
      if (!settings.endpoint) throw new AIError('API endpoint is required.', 'invalid_endpoint');
      if (!settings.model) throw new AIError('A model name is required.', 'invalid_model');
      const { status } = await requestJson(settings.endpoint.replace(/\/+$/, '') + this.path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: 8,
          messages: [{ role: 'user', content: 'Ping.' }],
        }),
      });
      if (status !== 200) throw classifyHttpError(status);
      return {
        ok: true,
        status: 'success',
        provider: settings.name,
        model: settings.model,
        message: 'Connection successful. API key accepted.',
      };
    } catch (err) {
      if (err instanceof AIError) return { ok: false, status: err.status, message: err.message };
      return { ok: false, status: 'unknown', message: err instanceof Error ? err.message : 'Unable to validate configuration.' };
    }
  }

  async listModels(_settings: ProviderSettings): Promise<string[]> {
    // Anthropic does not expose an unauthenticated-friendly public model
    // listing endpoint, so we return a curated, current set.
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  async generateText(prompt: string, settings: ProviderSettings): Promise<string> {
    if (!settings.apiKey) throw new AIError('API key is required.', 'invalid_key');
    if (!settings.endpoint) throw new AIError('API endpoint is required.', 'invalid_endpoint');
    if (!settings.model) throw new AIError('A model name is required.', 'invalid_model');
    const { status, body } = await requestJson(settings.endpoint.replace(/\/+$/, '') + this.path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 8192,
        system: 'You are a meticulous study assistant.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (status !== 200) throw classifyHttpError(status, JSON.stringify(body));
    const text = (body as { content?: Array<{ type?: string; text?: string }> }).content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('\n');
    if (!text || text.trim() === '') {
      throw new AIError('Malformed AI response: no content returned.', 'unknown');
    }
    return text;
  }
}
