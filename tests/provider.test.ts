import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyHttpError, AIError } from '@/ai/providers/types';
import { getProvider } from '@/ai/providers';
import type { ProviderSettings } from '@/shared/types';

const BASE: ProviderSettings = {
  id: 'openai',
  name: 'OpenAI',
  endpoint: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
};

function mockFetchResponse(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      json: () => Promise.resolve(body),
    }),
  );
}

describe('classifyHttpError', () => {
  it('classifies 401 as invalid_key', () => {
    const err = classifyHttpError(401);
    expect(err.status).toBe('invalid_key');
    expect(err).toBeInstanceOf(AIError);
  });
  it('classifies 429 as rate_limited', () => {
    expect(classifyHttpError(429).status).toBe('rate_limited');
  });
  it('classifies 404 as invalid_model', () => {
    expect(classifyHttpError(404).status).toBe('invalid_model');
  });
  it('classifies 400 with model text as invalid_model', () => {
    expect(classifyHttpError(400, 'model not found').status).toBe('invalid_model');
  });
  it('classifies 503 as unknown retryable', () => {
    const err = classifyHttpError(503);
    expect(err.status).toBe('unknown');
    expect(err.retryable).toBe(true);
  });
  it('never exposes the api key in the message', () => {
    const err = classifyHttpError(401);
    expect(err.message).not.toContain('sk-test');
  });
});

describe('OpenAI-compatible provider connection', () => {
  const provider = getProvider('openai');

  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => vi.restoreAllMocks());

  it('returns success with a valid response', async () => {
    mockFetchResponse(200, { choices: [{ message: { content: 'pong' } }] });
    const res = await provider.validateConnection(BASE);
    expect(res.ok).toBe(true);
    expect(res.status).toBe('success');
  });

  it('detects an invalid API key', async () => {
    mockFetchResponse(401, { error: { message: 'Incorrect API key' } });
    const res = await provider.validateConnection(BASE);
    expect(res.ok).toBe(false);
    expect(res.status).toBe('invalid_key');
  });

  it('detects an invalid model', async () => {
    mockFetchResponse(400, { error: { message: 'The model does not exist' } });
    const res = await provider.validateConnection(BASE);
    expect(res.ok).toBe(false);
    expect(res.status).toBe('invalid_model');
  });

  it('detects rate limiting', async () => {
    mockFetchResponse(429, {});
    const res = await provider.validateConnection(BASE);
    expect(res.status).toBe('rate_limited');
  });

  it('reports missing key without a network call', async () => {
    mockFetchResponse(200, { choices: [{ message: { content: 'pong' } }] });
    const res = await provider.validateConnection({ ...BASE, apiKey: '' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe('invalid_key');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles network failure as endpoint error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const res = await provider.validateConnection(BASE);
    expect(res.ok).toBe(false);
    expect(['invalid_endpoint', 'unknown']).toContain(res.status);
  });
});
