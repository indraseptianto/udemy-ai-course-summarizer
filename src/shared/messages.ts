import type { TranscriptSegment } from '@/shared/types';

/**
 * Message contract between the content script, background service worker,
 * and extension UI (popup / options). Keeping this in one place avoids
 * drift between the three contexts.
 */

export type RuntimeMessage =
  | { type: 'PING' }
  | { type: 'GET_ACTIVE_LESSON'; tabId?: number }
  | {
      type: 'CAPTURE_RESULT';
      payload: {
        url: string;
        courseTitle: string;
        lessonTitle: string;
        segments: TranscriptSegment[];
        transcriptText: string;
        source: 'auto' | 'manual';
      };
    }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'OPEN_COURSE_PAGE'; courseId: string };

export interface ActiveLessonInfo {
  isUdemyLesson: boolean;
  url?: string;
  courseTitle?: string;
  sectionTitle?: string;
  lessonTitle?: string;
  hasTranscript: boolean;
  transcriptSegments: TranscriptSegment[];
  transcriptText: string;
}

/** Response shape guarantee for every handled message. */
export interface MessageResponse {
  ok: boolean;
  error?: string;
  data?: unknown;
}
