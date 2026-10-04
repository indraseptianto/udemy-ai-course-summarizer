import type { ProviderSettings, SummarizationPreferences } from '@/shared/types';
import { summarizeLesson } from '@/ai/summarizer';
import { getLesson } from '@/storage/db';
import { markLessonStatus, setLessonSummary } from '@/storage/sync';
import { recomputeCourseProgress } from '@/storage/db';

export interface SummarizeOutcome {
  ok: boolean;
  lessonId: string;
  summary?: string;
  error?: string;
}

/**
 * Run the full summarization pipeline for one lesson and persist the result.
 * Transcript is preserved on failure; the lesson is marked 'failed' (never
 * wiped) so it can be retried.
 */
export async function summarizeLessonToCompletion(
  lessonId: string,
  provider: ProviderSettings,
  preferences: SummarizationPreferences,
  titleParts: { chapterTitle?: string; courseTitle?: string } = {},
  onChunk?: (done: number, total: number) => void,
): Promise<SummarizeOutcome> {
  const lesson = await getLesson(lessonId);
  if (!lesson) return { ok: false, lessonId, error: 'Lesson not found.' };
  const transcript = lesson.transcript?.trim();
  if (!transcript) {
    await markLessonStatus(lessonId, 'failed', 'No transcript available to summarize.');
    return { ok: false, lessonId, error: 'No transcript available. Capture or paste one first.' };
  }

  try {
    await markLessonStatus(lessonId, 'processing');
    const result = await summarizeLesson(transcript, {
      provider,
      preferences,
      lessonTitle: lesson.title,
      chapterTitle: titleParts.chapterTitle,
      courseTitle: titleParts.courseTitle,
      onChunk,
    });
    await setLessonSummary(lessonId, result.text, 'completed');
    await recomputeCourseProgress(lesson.courseId);
    return { ok: true, lessonId, summary: result.text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markLessonStatus(lessonId, 'failed', message);
    await recomputeCourseProgress(lesson.courseId);
    return { ok: false, lessonId, error: message };
  }
}
