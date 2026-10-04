import type { ProviderSettings, SummarizationPreferences } from '@/shared/types';
import { getProvider } from '@/ai/providers';
import { buildChapterPrompt, buildSummarizationPrompt, SYSTEM_PROMPT } from '@/ai/prompts/summarizer';
import { chunkText } from './chunker';
import { estimateTokens } from '@/utils/tokens';

export interface SummarizeOptions {
  provider: ProviderSettings;
  preferences: SummarizationPreferences;
  lessonTitle: string;
  chapterTitle?: string;
  courseTitle?: string;
  /** Context window budget for each model call. */
  contextTokens?: number;
  /** Progress callback for chunked processing (0..1). */
  onChunk?: (done: number, total: number) => void;
}

export interface SummarizeResult {
  text: string;
  chunkCount: number;
}

const DEFAULT_CONTEXT_TOKENS = 32_000;
const TOKEN_BUDGET =
  (context: number) => Math.max(2000, Math.floor(context * 0.55));
const OVERLAP = 300;

/**
 * Summarize a single lesson transcript into structured study material.
 * Chunks long transcripts, summarizes each chunk, then combines them.
 */
export async function summarizeLesson(
  transcript: string,
  options: SummarizeOptions,
): Promise<SummarizeResult> {
  const context = options.contextTokens ?? DEFAULT_CONTEXT_TOKENS;
  const provider = getProvider(options.provider.id);
  const chunks = chunkText(transcript, {
    maxTokens: TOKEN_BUDGET(context),
    overlapTokens: OVERLAP,
  });

  if (chunks.length === 1) {
    const prompt = buildSummarizationPrompt({
      lessonTitle: options.lessonTitle,
      chapterTitle: options.chapterTitle,
      courseTitle: options.courseTitle,
      transcript,
      preferences: options.preferences,
    });
    const text = await provider.generateText(prompt, options.provider);
    options.onChunk?.(1, 1);
    return { text, chunkCount: 1 };
  }

  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prompt = buildSummarizationPrompt({
      lessonTitle: options.lessonTitle,
      chapterTitle: options.chapterTitle,
      courseTitle: options.courseTitle,
      transcript: chunk.text,
      preferences: options.preferences,
      chunk: { index: i, total: chunks.length },
    });
    const summary = await provider.generateText(prompt, options.provider);
    chunkSummaries.push(summary);
    options.onChunk?.(i + 1, chunks.length);
  }

  // Combine chunk summaries (each ends with "## Continuation" carryover).
  const combined = chunkSummaries.join('\n\n---\n\n');
  const combinePrompt = [
    `# Lesson: ${options.lessonTitle}`,
    '',
    '# Request',
    'Below are PARTIAL summaries of a single lesson transcript. Merge them into ONE coherent,',
    'de-duplicated set of study notes using the lesson structure (Learning Objectives, Core Concepts,',
    'Detailed Explanation, Key Terms, Examples, Step-by-Step Process, Code / Technical Examples,',
    'Important Notes, Common Mistakes, Practical Takeaways). Remove the "## Continuation" markers.',
    'Preserve all technical detail and examples. Do not invent information.',
    '',
    '# Partial summaries',
    combined,
  ].join('\n');
  const finalText = await provider.generateText(combinePrompt, options.provider);
  options.onChunk?.(chunks.length, chunks.length);
  return { text: finalText, chunkCount: chunks.length };
}

/**
 * Summarize a whole chapter by combining already-generated lesson summaries
 * into a single chapter study guide.
 */
export async function summarizeChapter(options: {
  provider: ProviderSettings;
  preferences: SummarizationPreferences;
  courseTitle?: string;
  chapterTitle: string;
  lessonSummaries: string[];
  onChunk?: (done: number, total: number) => void;
}): Promise<SummarizeResult> {
  const provider = getProvider(options.provider.id);
  const prompt = buildChapterPrompt({
    courseTitle: options.courseTitle,
    chapterTitle: options.chapterTitle,
    lessonSummaries: options.lessonSummaries,
    preferences: options.preferences,
  });
  const text = await provider.generateText(prompt, options.provider);
  options.onChunk?.(1, 1);
  return { text, chunkCount: 1 };
}

/** Estimate of what a transcript will cost in tokens (informational). */
export function estimateTranscriptTokens(transcript: string): number {
  return estimateTokens(transcript);
}

export { SYSTEM_PROMPT };
