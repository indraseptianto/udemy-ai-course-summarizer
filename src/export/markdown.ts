/**
 * Minimal Markdown parser tuned for the AI study-note output. Shared by the
 * DOCX and PDF exporters so both render the summary the same way. Only the
 * subset the summarizer emits is supported: ATX headings, unordered lists,
 * ordered lists, fenced code blocks, bold, and inline code.
 */

export type Block =
  | { kind: 'heading'; level: number; text: InlineSegment[] }
  | { kind: 'paragraph'; text: InlineSegment[] }
  | { kind: 'bullet'; text: InlineSegment[] }
  | { kind: 'numbered'; index: number; text: InlineSegment[] }
  | { kind: 'code'; lines: string[] }
  | { kind: 'empty' };

export interface InlineSegment {
  text: string;
  bold?: boolean;
  inlineCode?: boolean;
}

/** Parse inline emphasis: **bold** and `code`. Nested/bold-in-code not handled. */
export function parseInline(raw: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const tokenRe = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(raw)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, m.index) });
    }
    const tok = m[0];
    if (tok.startsWith('**')) {
      segments.push({ text: tok.slice(2, -2), bold: true });
    } else {
      segments.push({ text: tok.slice(1, -1), inlineCode: true });
    }
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex) });
  }
  if (segments.length === 0 && raw) {
    segments.push({ text: raw });
  }
  return segments;
}

const NUMBERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET_RE = /^\s*[-*]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

/** Split a markdown document into renderable blocks. */
export function parseMarkdown(md: string): Block[] {
  if (!md.trim()) return [];
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (/^\s*```/.test(line)) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence (if present)
      blocks.push({ kind: 'code', lines: codeLines });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: Math.min(heading[1].length, 6), text: parseInline(heading[2]) });
      i++;
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      // Consecutive bullets group naturally; each is its own block.
      blocks.push({ kind: 'bullet', text: parseInline(bullet[1]) });
      i++;
      continue;
    }

    const numbered = NUMBERED_RE.exec(line);
    if (numbered) {
      blocks.push({ kind: 'numbered', index: parseInt(numbered[1], 10), text: parseInline(numbered[2]) });
      i++;
      continue;
    }

    if (line.trim() === '') {
      if (blocks.length === 0 || blocks[blocks.length - 1].kind !== 'empty') {
        blocks.push({ kind: 'empty' });
      }
      i++;
      continue;
    }

    // Plain paragraph (may span multiple lines).
    const paraLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*```/.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !BULLET_RE.test(lines[i]) &&
      !NUMBERED_RE.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: 'paragraph', text: parseInline(paraLines.join(' ')) });
  }
  return blocks;
}
