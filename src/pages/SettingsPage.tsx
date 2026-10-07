import { useEffect, useState } from 'react';
import type {
  AppSettings,
  ProviderId,
  ProviderSettings,
  SummarizationPreferences,
  SummaryLanguage,
  SummaryStyle,
} from '@/shared/types';
import { PROVIDER_META } from '@/shared/types';
import { loadSettings, saveSettings, applyProviderPreset } from '@/storage/settings';
import { getProvider, SUPPORTED_PROVIDERS } from '@/ai/providers';
import type { ValidationResult } from '@/ai/providers/types';

type Status = 'idle' | 'testing' | 'listing';

export function SettingsPage({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  if (!settings) return <p className="muted">Loading settings…</p>;

  const provider = settings.provider;
  const prefs = settings.preferences;

  function updateProvider(patch: Partial<ProviderSettings>) {
    setSettings((prev) =>
      prev ? { ...prev, provider: { ...prev.provider, ...patch } } : prev,
    );
    setValidation(null);
  }
  function updatePrefs(patch: Partial<SummarizationPreferences>) {
    setSettings((prev) =>
      prev ? { ...prev, preferences: { ...prev.preferences, ...patch } } : prev,
    );
  }

  async function onProviderChange(id: ProviderId) {
    const prev = { ...provider };
    setSettings(null);
    const next = await applyProviderPreset(id, prev);
    setSettings(next);
    setValidation(null);
  }

  async function testConnection() {
    setStatus('testing');
    setValidation(null);
    const result = await getProvider(provider.id).validateConnection(provider);
    setValidation(result);
    setStatus('idle');
  }

  async function listModels() {
    setStatus('listing');
    setMessage(null);
    try {
      const list = await getProvider(provider.id).listModels(provider);
      setModels(list);
      if (list.length === 0) {
        setMessage({ kind: 'error', text: 'Model list is empty or unavailable for this provider.' });
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
      setModels([]);
    } finally {
      setStatus('idle');
    }
  }

  async function save() {
    await saveSettings({ provider, preferences: prefs });
    setMessage({ kind: 'success', text: 'Settings saved. Your API key is stored locally in this browser.' });
    onSaved?.();
  }

  const isCustom = provider.id === 'custom';

  return (
    <div>
      <h2>Settings</h2>

      <div className="card mb">
        <h3>AI Provider</h3>

        <div className="field">
          <label>Provider</label>
          <select value={provider.id} onChange={(e) => onProviderChange(e.target.value as ProviderId)}>
            {SUPPORTED_PROVIDERS.map((id) => (
              <option key={id} value={id}>
                {PROVIDER_META[id].label}
              </option>
            ))}
          </select>
        </div>

        {isCustom && (
          <div className="field">
            <label>Provider Name</label>
            <input
              value={provider.name}
              onChange={(e) => updateProvider({ name: e.target.value })}
              placeholder="My provider"
            />
          </div>
        )}

        <div className="field">
          <label>API Endpoint (base URL)</label>
          <input
            className="mono"
            value={provider.endpoint}
            onChange={(e) => updateProvider({ endpoint: e.target.value })}
            placeholder="https://api.example.com/v1"
          />
        </div>

        <div className="field">
          <label>API Key</label>
          <div className="row">
            <input
              className="grow mono"
              type={showKey ? 'text' : 'password'}
              value={provider.apiKey}
              onChange={(e) => updateProvider({ apiKey: e.target.value })}
              placeholder="sk-…"
              autoComplete="off"
            />
            <button type="button" className="ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="muted small mt" style={{ marginBottom: 0 }}>
            🔒 Your API key is stored locally in this browser extension and used to communicate
            directly with the selected AI provider. It is never uploaded to the extension developer
            or any project server.
          </p>
        </div>

        <div className="field">
          <label>Model</label>
          <div className="row">
            <input
              className="grow mono"
              value={provider.model}
              onChange={(e) => updateProvider({ model: e.target.value })}
              placeholder="gpt-4o-mini"
              list="model-suggestions"
            />
            <button type="button" onClick={listModels} disabled={status === 'listing'}>
              {status === 'listing' ? <span className="spin" /> : 'Refresh models'}
            </button>
          </div>
          {models.length > 0 && (
            <div className="wrap row mt">
              {models.slice(0, 40).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="ghost small"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => updateProvider({ model: m })}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <datalist id="model-suggestions" />
        </div>

        <div className="row mt">
          <button type="button" className="primary" onClick={testConnection} disabled={status === 'testing'}>
            {status === 'testing' ? <span className="spin" /> : 'Test Connection'}
          </button>
          <button type="button" className="success" onClick={save}>
            Save
          </button>
        </div>

        {validation && (
          <div className={`alert ${validation.ok ? 'success' : 'error'} mt`}>
            {validation.ok ? '✓ ' : '✕ '}
            {validation.message}
            {validation.provider && !validation.ok && (
              <div className="small muted mt">Provider: {validation.provider}</div>
            )}
          </div>
        )}
      </div>

      <div className="card mb">
        <h3>Summarization Style</h3>
        <div className="field">
          <label>Default style</label>
          <select
            value={settings.preferences.style}
            onChange={(e) => updatePrefs({ style: e.target.value as SummaryStyle })}
          >
            <option value="detailed">Detailed</option>
            <option value="balanced">Balanced</option>
            <option value="concise">Concise</option>
          </select>
        </div>
        <div className="field">
          <label>Bahasa ringkasan (summary language)</label>
          <select
            value={settings.preferences.language}
            onChange={(e) => updatePrefs({ language: e.target.value as SummaryLanguage })}
          >
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
            <option value="transcript">Ikuti bahasa transkrip</option>
          </select>
        </div>
        <div className="field">
          <label>Include in generated notes</label>
          {(
            [
              ['preserveExamples', 'Preserve examples'],
              ['preserveCode', 'Preserve code'],
              ['includeLearningObjectives', 'Include learning objectives'],
              ['includeKeyTerms', 'Include key terms'],
              ['includePracticalTakeaways', 'Include practical takeaways'],
              ['includeTimestamps', 'Include source timestamps'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={settings.preferences[key]}
                onChange={(e) => updatePrefs({ [key]: e.target.checked })}
                style={{ width: 'auto' }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {message && (
        <div className={`alert ${message.kind === 'success' ? 'success' : 'error'}`}>{message.text}</div>
      )}
    </div>
  );
}
