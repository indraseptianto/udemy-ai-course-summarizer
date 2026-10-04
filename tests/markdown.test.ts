import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseInline } from '@/export/markdown';

describe('parseMarkdown', () => {
  it('parses headings, bullets, numbered lists and code blocks', () => {
    const blocks = parseMarkdown(
      [
        '## Core Concepts',
        '- API: application programming interface',
        '- HTTP is a protocol',
        '1. Send a request',
        '2. Receive a response',
        '```',
        'const x = 1;',
        '```',
        'A closing paragraph.',
      ].join('\n'),
    );
    const kinds = blocks.map((b) => b.kind);
    expect(kinds).toContain('heading');
    expect(kinds).toContain('bullet');
    expect(kinds).toContain('numbered');
    const code = blocks.find((b) => b.kind === 'code');
    expect(code).toBeDefined();
    if (code && code.kind === 'code') {
      expect(code.lines).toEqual(['const x = 1;']);
    }
  });

  it('coalesces multi-line paragraphs', () => {
    const blocks = parseMarkdown('First line\nsecond line\n\nNext paragraph.');
    const paras = blocks.filter((b) => b.kind === 'paragraph');
    expect(paras).toHaveLength(2);
  });

  it('handles empty document', () => {
    expect(parseMarkdown('')).toEqual([]);
  });
});

describe('parseInline', () => {
  it('parses bold and inline code', () => {
    const segs = parseInline('Use **GET** and `fetch` here');
    expect(segs.some((s) => s.bold && s.text === 'GET')).toBe(true);
    expect(segs.some((s) => s.inlineCode && s.text === 'fetch')).toBe(true);
  });

  it('returns plain text when no markers', () => {
    expect(parseInline('just text')[0].text).toBe('just text');
  });
});
