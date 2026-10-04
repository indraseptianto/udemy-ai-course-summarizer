import type { ProviderId, ProviderSettings } from '@/shared/types';
import type { AIProvider, ValidationResult } from './types';
import { AIError, classifyHttpError, requestJson } from './types';

export class GeminiProvider implements AIProvider {
  readonly id: ProviderId = 'gemini';

  private url(settings: ProviderSettings, action: 'generateContent' | 'models'): string {
    const base = settings.endpoint.replace(/\/+$/, '');
    const key = encodeURIComponent(settings.apiKey);
    if (action === 'models') {
      return `${base}/models?key=${key}`;
    }
    return `${base}/models/${encodeURIComponent(settings.model)}:generateContent?key=${key}`;
  }

  async validateConnection(settings: ProviderSettings): Promise<ValidationResult> {
    try {
      if (!settings.apiKey) throw new AIError('API key is required.', 'invalid_key');
      if (!settings.endpoint) throw new AIError('API endpoint is required.', 'invalid_endpoint');
      if (!settings.model) throw new AIError('A model name is required.', 'invalid_model');
      const { status } = await requestJson(this.url(settings, 'generateContent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping.' }] }] }),
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

  async listModels(settings: ProviderSettings): Promise<string[]> {
    if (!settings.apiKey) throw new AIError('API key is required.', 'invalid_key');
    const { status, body } = await requestJson(this.url(settings, 'models'), { method: 'GET' });
    if (status !== 200) throw classifyHttpError(status);
    const data = body as { models?: Array<{ name?: string }> };
    if (!Array.isArray(data.models)) return [];
    return data.models
      .map((m) => m.name?.split('/').pop() || '')
      .filter((name) => name && /^gemini-/i.test(name));
  }

  async generateText(prompt: string, settings: ProviderSettings): Promise<string> {
    if (!settings.apiKey) throw new AIError('API key is required.', 'invalid_key');
    if (!settings.endpoint) throw new AIError('API endpoint is required.', 'invalid_endpoint');
    if (!settings.model) throw new AIError('A model name is required.', 'invalid_model');
    const { status, body } = await requestJson(this.url(settings, 'generateContent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    });
    if (status !== 200) throw classifyHttpError(status, JSON.stringify(body));
    const parts = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      .candidates?.[0]?.content?.parts;
    const text = (parts || []).map((p) => p.text || '').join('\n');
    if (!text.trim()) throw new AIError('Malformed AI response: no content returned.', 'unknown');
    return text;
  }
}
