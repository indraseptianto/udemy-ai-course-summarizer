import type { ProviderId, ProviderSettings } from '@/shared/types';
import type { AIProvider } from './types';
import { OpenAIProvider, OpenRouterProvider, GroqProvider, CustomProvider } from './openai-compatible';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';

const instances: Record<ProviderId, AIProvider> = {
  openai: new OpenAIProvider(),
  openrouter: new OpenRouterProvider(),
  groq: new GroqProvider(),
  custom: new CustomProvider(),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider(),
};

/** Ordered list of provider ids for building UI dropdowns. */
export const SUPPORTED_PROVIDERS: ProviderId[] = [
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'groq',
  'custom',
];

/** Return the provider implementation for a configured provider id. */
export function getProvider(id: ProviderId): AIProvider {
  const provider = instances[id];
  if (!provider) {
    throw new Error(`Unknown provider: ${String(id)}`);
  }
  return provider;
}

/** Convenience: validate for a full settings object. */
export function validateSettings(settings: ProviderSettings) {
  return getProvider(settings.id).validateConnection(settings);
}

export type { AIProvider, ProviderId, ProviderSettings };
