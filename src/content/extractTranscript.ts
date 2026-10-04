import type { TranscriptSegment } from '@/shared/types';
import { rawToSegments } from '@/utils/transcript';

/**
 * Extract the currently-rendered transcript from the Udemy lesson page using
 * DOM/content extraction only — no undocumented Udemy API, no bypassing of
 * access controls. If Udemy has not rendered the transcript panel, we return
 * an empty result and the extension offers manual paste instead.
 */

/**
 * Selector strategies across Udemy's evolving DOM. The transcript cue is the
 * core primitive: each cue holds a timestamp and a line of caption text.
 */
const CUE_SELECTORS = [
  '[data-purpose="transcript-cue"]',
  '.transcript--transcript-cue',
  '.transcript-module--transcript-cue',
];

const CUE_TEXT_SELECTORS = [
  '[data-purpose="transcript-cue-display"]',
  '.transcript--transcript-cue-display',
  'span[class*="transcript-cue-display"]',
];

const CUE_TIMESTAMP_SELECTORS = [
  '[data-purpose="transcript-cue-time"]',
  'span[class*="cue-time"]',
];

function parseMeta(name: string): string | undefined {
  const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  const content = el?.getAttribute('content');
  return content ? content.trim() : undefined;
}

function titleParts(): { lessonTitle?: string; courseTitle?: string } {
  // Udemy format is typically "Lesson title | Course title | Udemy"
  const raw = document.title || '';
  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);
  const lessonTitle = parts[0];
  const courseTitle = parts.filter((p) => !/udemy/i.test(p))[1] ?? parts[1];
  return {
    lessonTitle: lessonTitle && !/udemy/i.test(lessonTitle) ? lessonTitle : undefined,
    courseTitle,
  };
}

function findElements(selectors: string[]): Element[] {
  for (const sel of selectors) {
    const found = Array.from(document.querySelectorAll(sel));
    if (found.length > 0) return found;
  }
  return [];
}

function cueText(cue: Element): string {
  for (const sel of CUE_TEXT_SELECTORS) {
    const el = cue.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  // Fallback: timestamp is usually the first inline element; drop it.
  const clone = cue.cloneNode(true) as HTMLElement;
  for (const sel of CUE_TIMESTAMP_SELECTORS) {
    clone.querySelector(sel)?.remove();
  }
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

function cueTimestamp(cue: Element): string {
  for (const sel of CUE_TIMESTAMP_SELECTORS) {
    const el = cue.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t) return t;
  }
  return '';
}

/** Extract transcript segments from the live DOM. */
export function extractTranscriptFromDom(): {
  segments: TranscriptSegment[];
  text: string;
  found: boolean;
} {
  const cues = findElements(CUE_SELECTORS);
  if (cues.length === 0) {
    // No cues: maybe the panel is closed or captions are unavailable.
    return { segments: [], text: '', found: false };
  }
  const segments: TranscriptSegment[] = [];
  const seen = new Set<string>();
  for (const cue of cues) {
    const text = cueText(cue);
    const timestamp = cueTimestamp(cue);
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    segments.push({ timestamp, text: normalized });
  }
  const text = segments.map((s) => s.text).join('\n');
  return { segments, text, found: segments.length > 0 };
}

/** Detect whether the current page is a Udemy course lesson. */
export function isUdemyLessonPage(): boolean {
  const url = location.href;
  return /^https:\/\/(www\.)?udemy\.com\/course\/[^/]+\/learn\//i.test(url);
}

/** Extract course / section / lesson titles from the rendered page. */
export function extractLessonMetadata(): {
  url: string;
  courseTitle?: string;
  sectionTitle?: string;
  lessonTitle?: string;
} {
  const url = location.href;
  const { lessonTitle, courseTitle } = titleParts();
  // Breadcrumb: [data-purpose="curriculum-item-metadata"] or nav items.
  const navItems = Array.from(
    document.querySelectorAll(
      '[data-purpose="curriculum-item-metadata"], .udemy-ellipsis, [data-purpose="curriculum-section-header-title"]',
    ),
  )
    .map((el) => el.textContent?.trim())
    .filter(Boolean);
  const sectionTitle =
    navItems.find((t) => t && t.length < 120) ??
    parseMeta('og:description');

  return {
    url,
    courseTitle: courseTitle || undefined,
    sectionTitle,
    lessonTitle: lessonTitle || undefined,
  };
}

/** Compose the full lesson info payload used by the extension. */
export function captureCurrentLesson() {
  const meta = extractLessonMetadata();
  const { segments, text, found } = extractTranscriptFromDom();
  return {
    url: meta.url,
    courseTitle: meta.courseTitle,
    sectionTitle: meta.sectionTitle,
    lessonTitle: meta.lessonTitle,
    hasTranscript: found,
    transcriptSegments: found ? segments : [],
    transcriptText: found ? text : '',
  };
}

/** Fallback path: normalize pasted raw transcript text into segments. */
export function normalizeManualTranscript(raw: string) {
  return rawToSegments(raw);
}
