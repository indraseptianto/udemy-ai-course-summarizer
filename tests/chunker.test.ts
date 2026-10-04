import { describe, it, expect } from 'vitest';
import { chunkText } from '@/ai/summarizer/chunker';
import { estimateTokens } from '@/utils/tokens';

const LONG_TEXT = Array.from(
  { length: 200 },
  (_, i) => `Sentence number ${i} describing the API request and response cycle in detail.`,
).join(' ');

describe('chunkText', () => {
  it('returns a single chunk for short transcripts', () => {
    const chunks = chunkText('Short transcript.', { maxTokens: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Short transcript.');
  });

  it('returns empty single chunk for empty input', () => {
    const chunks = chunkText('');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('');
  });

  it('splits long transcripts into multiple chunks within token budget', () => {
    const chunks = chunkText(LONG_TEXT, { maxTokens: 100, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(estimateTokens(c.text)).toBeLessThanOrEqual(100 + 20);
    }
  });

  it('keeps every sentence in the concatenated reconstruction', () => {
    const chunks = chunkText(LONG_TEXT, { maxTokens: 80, overlapTokens: 8 });
    const joined = chunks.map((c) => c.text).join(' ');
    for (let i = 0; i < 200; i++) {
      expect(joined).toContain(`Sentence number ${i}`);
    }
  });

  it('carries overlap between adjacent chunks', () => {
    const chunks = chunkText(LONG_TEXT, { maxTokens: 120, overlapTokens: 30 });
    for (let i = 1; i < chunks.length; i++) {
      // The last sentence of the previous chunk should appear in the next.
      const prevWords = chunks[i - 1].text.split(' ').slice(-6).join(' ');
      const nextWords = chunks[i].text.split(' ').slice(0, 6).join(' ');
      const overlap = prevWords.split(' ').filter((w) => nextWords.includes(w)).length;
      expect(overlap).toBeGreaterThan(0);
    }
  });

  it('does not loop infinitely / makes forward progress', () => {
    const chunks = chunkText(LONG_TEXT, { maxTokens: 10, overlapTokens: 100 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
