import type { TranscriptSegment } from '@/shared/types';

/**
 * Normalization + parsing for raw transcripts captured from Udemy or pasted
 * manually. Pure functions so they can be unit tested in isolation.
 */

/** Timestamps like "00:08", "[00:08]", "1:23", "[1:23]". */
const TIMESTAMP_RE = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*/;

export interface CaptionLine {
  timestamp: string;
  text: string;
}

/**
 * Parse raw caption text into lines. Handles:
 *  - lines prefixed with a timestamp like "[00:08] text" or "00:08 text"
 *  - consecutive fragment lines that continue the previous cue (drop repeat)
 */
export function parseCaptionLines(raw: string): CaptionLine[] {
  const lines = raw.split(/\r?\n/);
  const result: CaptionLine[] = [];
  for (const rawLine of lines) {
    const m = TIMESTAMP_RE.exec(rawLine);
    if (m) {
      const timestamp = m[1];
      const text = rawLine.slice(m[0].length).trim();
      if (text) {
        result.push({ timestamp, text });
      }
    } else {
      const text = rawLine.trim();
      if (text) {
        // Untimestamped standalone line: try to attach to previous cue as a
        // continuation, otherwise treat as its own segment with no timestamp.
        const last = result[result.length - 1];
        if (last && last.text.endsWith('.')) {
          result.push({ timestamp: last.timestamp, text });
        } else if (last) {
          last.text = `${last.text} ${text}`;
        } else {
          result.push({ timestamp: '', text });
        }
      }
    }
  }
  return result;
}

function isRepeat(prev: string, next: string): boolean {
  // Exact duplicate or the previous text is fully contained at the start.
  if (prev === next) return true;
  if (next.length > 12 && prev.length > 12 && next.startsWith(prev)) return true;
  return false;
}

/**
 * Clean already-parsed lines: drop near-duplicate consecutive cues, collapse
 * whitespace, and remove obvious UI/housekeeping lines.
 */
export function cleanCaptionLines(lines: CaptionLine[]): CaptionLine[] {
  const uiNoise = /^(\[(musica|music|applause|laughter)\]|©\s|www\.|subscribe|sponsored)/i;
  const out: CaptionLine[] = [];
  for (const line of lines) {
    if (uiNoise.test(line.text)) continue;
    const text = line.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const textLC = text.toLowerCase();
    if (isRepeat(out[out.length - 1]?.text.toLowerCase() ?? '', textLC)) continue;
    out.push({ timestamp: line.timestamp, text });
  }
  return out;
}

/**
 * Convert cleaned lines into the structured transcript segments stored on a
 * lesson, preserving source timestamps.
 */
export function linesToSegments(lines: CaptionLine[]): TranscriptSegment[] {
  return cleanCaptionLines(lines).map((l) => ({ timestamp: l.timestamp, text: l.text }));
}

/**
 * Join cleaned lines into a single plain-text transcript for AI processing.
 */
export function linesToPlainText(lines: CaptionLine[]): string {
  return cleanCaptionLines(lines)
    .map((l) => l.text)
    .join('\n');
}

/** One-stop: raw caption text -> structured segments. */
export function rawToSegments(raw: string): TranscriptSegment[] {
  return linesToSegments(parseCaptionLines(raw));
}

/** One-stop: raw caption text -> normalized plain text. */
export function normalizeTranscript(raw: string): string {
  return linesToPlainText(parseCaptionLines(raw));
}
