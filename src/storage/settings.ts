import type { AppSettings, ProviderId } from '@/shared/types';
import { DEFAULT_PREFERENCES, PROVIDER_META } from '@/shared/types';

const SETTINGS_KEY = 'appSettings';

const DEFAULTS: AppSettings = {
  provider: {
    id: 'openai',
    name: PROVIDER_META.openai.label,
    endpoint: PROVIDER_META.openai.defaultEndpoint,
    apiKey: '',
    model: PROVIDER_META.openai.defaultModel,
  },
  preferences: DEFAULT_PREFERENCES,
};

/**
 * Settings + API key persistence. Stored exclusively in chrome.storage.local,
 * which stays in the user's browser profile and is never sent anywhere.
 */
export async function loadSettings(): Promise<AppSettings> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const raw = await chrome.storage.local.get(SETTINGS_KEY);
    const stored = raw[SETTINGS_KEY] as Partial<AppSettings> | undefined;
    return mergeSettings(stored);
  }
  // Non-extension fallback (e.g. tests / local preview).
  return DEFAULTS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }
}

export async function clearApiKey(): Promise<void> {
  const settings = await loadSettings();
  settings.provider.apiKey = '';
  await saveSettings(settings);
}

/** Reset a provider preset while preserving the API key across switches where sensible. */
export async function applyProviderPreset(
  id: ProviderId,
  prevProvider?: { endpoint?: string; apiKey?: string; model?: string },
): Promise<AppSettings> {
  const meta = PROVIDER_META[id];
  const settings = await loadSettings();
  settings.provider.id = id;
  settings.provider.name = meta.label;
  settings.provider.endpoint = meta.defaultEndpoint;
  settings.provider.model = meta.defaultModel;
  // Predefined providers share OpenAI's schema; keep the key/model across those.
  const openaiLike: ProviderId[] = ['openai', 'openrouter', 'groq', 'custom'];
  if (prevProvider && id === 'custom') {
    settings.provider.apiKey = prevProvider.apiKey ?? '';
  } else if (openaiLike.includes(id) && prevProvider) {
    // preserve
  } else {
    settings.provider.apiKey = '';
  }
  await saveSettings(settings);
  return settings;
}

function mergeSettings(stored?: Partial<AppSettings>): AppSettings {
  const base = structuredClone(DEFAULTS);
  if (!stored) return base;
  const p = stored.provider;
  if (p) {
    const meta = PROVIDER_META[p.id] ?? PROVIDER_META.openai;
    base.provider = {
      id: p.id ?? 'openai',
      name: p.name ?? meta.label,
      endpoint: p.endpoint ?? meta.defaultEndpoint,
      apiKey: p.apiKey ?? '',
      model: p.model ?? meta.defaultModel,
    };
  }
  if (stored.preferences) {
    base.preferences = { ...DEFAULT_PREFERENCES, ...stored.preferences };
  }
  return base;
}
