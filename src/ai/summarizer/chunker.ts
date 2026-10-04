import { estimateTokens } from '@/utils/tokens';

export interface Chunk {
  text: string;
  /** Source character offset ranges (start inclusive, end exclusive). */
  start: number;
  end: number;
  index: number;
}

export interface ChunkOptions {
  /** Max estimated tokens per chunk. */
  maxTokens: number;
  /** Estimated tokens of overlap carried between chunks. */
  overlapTokens: number;
}

const DEFAULT_OPTIONS: ChunkOptions = { maxTokens: 6000, overlapTokens: 200 };

function splitSentences(text: string): string[] {
  // Split on sentence boundaries keeping the boundary punctuation attached.
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Split a transcript into logical chunks that fit a token budget,
 * preserving order and carrying a controlled overlap for context.
 */
export function chunkText(text: string, options: Partial<ChunkOptions> = {}): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const trimmed = text.trim();
  if (!trimmed || estimateTokens(trimmed) <= opts.maxTokens) {
    return [{ text: trimmed, start: 0, end: trimmed.length, index: 0 }];
  }

  const sentences = splitSentences(trimmed);
  const overlapChars = opts.overlapTokens * 4;
  const chunks: Chunk[] = [];
  let cursor = 0;
  const raw = trimmed;

  while (cursor < sentences.length) {
    let lineEnd = cursor;
    let tokenCount = 0;
    // Greedily add sentences until the token budget is reached.
    while (lineEnd < sentences.length) {
      const next = sentences[lineEnd];
      const nextTokens = estimateTokens(next) + 1;
      if (tokenCount + nextTokens > opts.maxTokens && lineEnd > cursor) break;
      tokenCount += nextTokens;
      lineEnd++;
    }
    const chunkStart = cursor;
    const chunkSentences = sentences.slice(cursor, lineEnd);
    const chunkTextStr = chunkSentences.join(' ');

    // Compute character offsets using the first sentence of this chunk.
    const firstSentence = chunkSentences[0] ?? '';
    const from = cursor === 0 ? 0 : findOffset(raw, firstSentence);
    const lastSentence = chunkSentences[chunkSentences.length - 1] ?? '';
    const to = lineEnd < sentences.length ? findOffset(raw, sentences[lineEnd]) : raw.indexOf(lastSentence) + lastSentence.length;
    chunks.push({ text: chunkTextStr, start: from, end: to, index: chunks.length });

    // Advance cursor with OVERLAP: start the next chunk a few sentences earlier.
    let overlapSentences = 0;
    let overlapCount = 0;
    for (let i = chunkSentences.length - 1; i >= 0; i--) {
      overlapCount += estimateTokens(chunkSentences[i]) + 1;
      if (overlapCount > overlapChars / 4) break;
      overlapSentences++;
    }
    const overlap = Math.min(overlapSentences, chunkSentences.length - 1);
    cursor = lineEnd - (overlap > 0 ? overlap : 0);

    // Safety valve: guarantee forward progress.
    if (cursor <= chunkStart) cursor = chunkStart + 1;
    if (cursor >= sentences.length) cursor = sentences.length;
  }

  return chunks;
}

/** Locate the character offset of a sentence value within the source text. */
function findOffset(source: string, sentence: string): number {
  const idx = source.indexOf(sentence);
  return idx === -1 ? source.length : idx;
}
