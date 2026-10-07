/**
 * Shared domain types used across the extension: content script, background
 * worker, storage layer and UI.
 */

/** Status of a single lesson's summary pipeline. */
export type LessonStatus =
  | 'not_started'
  | 'transcript_captured'
  | 'processing'
  | 'completed'
  | 'failed';

export interface TranscriptSegment {
  /** Source timestamp preserved from the original caption, e.g. "00:08". */
  timestamp: string;
  text: string;
}

export interface Course {
  id: string;
  title: string;
  url: string;
  instructor?: string;
  createdAt: number;
  updatedAt: number;
  totalLessons: number;
  completedLessons: number;
}

export interface Chapter {
  id: string;
  courseId: string;
  title: string;
  order: number;
}

export interface Lesson {
  id: string;
  chapterId: string;
  courseId: string;
  title: string;
  url?: string;
  /** Raw captions, cleaned but not AI-processed. */
  transcript?: string;
  /** Structured segments with source timestamps. */
  transcriptSegments: TranscriptSegment[];
  /** The generated AI study material (editable by the user). */
  summary?: string;
  status: LessonStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export type SummaryStyle = 'detailed' | 'balanced' | 'concise';

/** Language the generated study notes should be written in. */
export type SummaryLanguage = 'id' | 'en' | 'transcript';

export interface SummarizationPreferences {
  style: SummaryStyle;
  language: SummaryLanguage;
  preserveExamples: boolean;
  preserveCode: boolean;
  includeTimestamps: boolean;
  includeLearningObjectives: boolean;
  includeKeyTerms: boolean;
  includePracticalTakeaways: boolean;
}

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'groq'
  | 'custom';

export interface ProviderSettings {
  id: ProviderId;
  /** User-facing label, editable for the custom provider. */
  name: string;
  /** API base URL. Auto-populated for predefined providers. */
  endpoint: string;
  /** API key stored locally only (chrome.storage.local). */
  apiKey: string;
  /** Model identifier. Free-form so providers can change over time. */
  model: string;
}

export interface AppSettings {
  provider: ProviderSettings;
  preferences: SummarizationPreferences;
}

export const DEFAULT_PREFERENCES: SummarizationPreferences = {
  style: 'detailed',
  language: 'id',
  preserveExamples: true,
  preserveCode: true,
  includeTimestamps: false,
  includeLearningObjectives: true,
  includeKeyTerms: true,
  includePracticalTakeaways: true,
};

/** Short label returned by translation of UI terms. */
export const PROVIDER_META: Record<
  ProviderId,
  { label: string; defaultEndpoint: string; defaultModel: string }
> = {
  openai: {
    label: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    label: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  gemini: {
    label: 'Google Gemini',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-1.5-pro',
  },
  openrouter: {
    label: 'OpenRouter',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
  },
  groq: {
    label: 'Groq',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    defaultEndpoint: 'https://api.example.com/v1',
    defaultModel: 'my-model',
  },
};
