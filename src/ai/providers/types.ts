import type { ProviderId, ProviderSettings } from '@/shared/types';

/**
 * A minimal request shape shared by OpenAI-compatible providers.
 * Excluded entirely to keep this module free of UI concerns.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ValidationStatus =
  | 'success'
  | 'invalid_key'
  | 'invalid_model'
  | 'invalid_endpoint'
  | 'rate_limited'
  | 'unknown';

export interface ValidationResult {
  ok: boolean;
  status: ValidationStatus;
  provider?: string;
  model?: string;
  message: string;
}

/** Error thrown by a provider that already knows its classification. */
export class AIError extends Error {
  readonly status: ValidationStatus;
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    status: ValidationStatus = 'unknown',
    opts: { statusCode?: number; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.statusCode = opts.statusCode;
    this.retryable = opts.retryable ?? false;
  }
}

/**
 * Contract every provider implements. The UI only ever depends on this
 * interface, so adding a provider never requires touching components.
 */
export interface AIProvider {
  readonly id: ProviderId;
  validateConnection(settings: ProviderSettings): Promise<ValidationResult>;
  listModels(settings: ProviderSettings): Promise<string[]>;
  generateText(prompt: string, settings: ProviderSettings): Promise<string>;
}

/**
 * Classify an HTTP response/error into a stable ValidationStatus so the UI can
 * show an actionable message. Never echoes the API key.
 */
export function classifyHttpError(status: number, bodyText?: string): AIError {
  switch (status) {
    case 401:
    case 403:
      return new AIError(
        'Authentication failed: the API key was rejected by the provider.',
        'invalid_key',
        { statusCode: status, retryable: false },
      );
    case 404:
      return new AIError(
        'The requested model was not found for this account / endpoint.',
        'invalid_model',
        { statusCode: status, retryable: false },
      );
    case 429:
      return new AIError(
        'Provider rate limit reached. Please wait and retry.',
        'rate_limited',
        { statusCode: status, retryable: true },
      );
    case 400:
      if (/model|not found|does not exist/i.test(bodyText || '')) {
        return new AIError('The selected model is unavailable.', 'invalid_model', {
          statusCode: status,
          retryable: false,
        });
      }
      if (/context|length|maximum/i.test(bodyText || '')) {
        return new AIError(
          'The transcript exceeded the model context window. The extension chunks content, but the model/provider may limit output length.',
          'unknown',
          { statusCode: status, retryable: true },
        );
      }
      return new AIError('Invalid request sent to the provider.', 'unknown', {
        statusCode: status,
        retryable: false,
      });
    case 408:
    case 502:
    case 503:
    case 504:
      return new AIError('The provider is temporarily unavailable. Please retry.', 'unknown', {
        statusCode: status,
        retryable: true,
      });
    case 0:
      return new AIError('Unable to reach the API endpoint (network / CORS error).', 'invalid_endpoint', {
        statusCode: 0,
        retryable: true,
      });
    default:
      if (bodyText && /connection|resolve|ECONN|failed to fetch/i.test(bodyText)) {
        return new AIError('Unable to connect to the configured API endpoint.', 'invalid_endpoint', {
          statusCode: status,
          retryable: true,
        });
      }
      return new AIError(`Provider returned an unexpected error (HTTP ${status || 'unknown'}).`, 'unknown', {
        statusCode: status,
        retryable: false,
      });
  }
}

/**
 * Perform a fetch with a timeout and classify failures. `signal` is optional
 * and provided by the caller when a preset timeout is desired.
 */
export async function requestJson(
  url: string,
  init: RequestInit,
  timeoutMs = 60_000,
): Promise<{ status: number; body: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = text;
    }
    if (!res.ok) {
      throw classifyHttpError(res.status, text);
    }
    return { status: res.status, body, text };
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('Request timed out. Please try again.', 'unknown', { retryable: true });
    }
    if (err instanceof TypeError && /fetch/i.test(err.message)) {
      throw new AIError('Unable to reach the API endpoint (network / CORS error).', 'invalid_endpoint', {
        retryable: true,
      });
    }
    throw new AIError(err instanceof Error ? err.message : 'Unknown network error.', 'unknown', {
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

export { type ProviderId, type ProviderSettings };
