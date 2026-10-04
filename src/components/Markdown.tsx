import type { ReactNode } from 'react';
import type { InlineSegment } from '@/export/markdown';
import { parseMarkdown } from '@/export/markdown';

/** Render inline segments (bold/code) to React nodes. */
export function Inline({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.inlineCode ? (
          <code key={i}>{s.text}</code>
        ) : s.bold ? (
          <strong key={i}>{s.text}</strong>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** Render a markdown summary string to a static read-only view. */
export function MarkdownView({ markdown }: { markdown: string }) {
  if (!markdown?.trim()) return <p className="muted">No summary yet.</p>;
  const blocks = parseMarkdown(markdown);
  // Group consecutive list items for clean <ul>/<ol>.
  const groups: ReactNode[] = [];
  let listBuffer: ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const flush = () => {
    if (listBuffer.length > 0 && listType) {
      const ListTag = listType;
      groups.push(<ListTag key={groups.length}>{listBuffer}</ListTag>);
      listBuffer = [];
      listType = null;
    }
  };
  for (const b of blocks) {
    if (b.kind === 'bullet') {
      if (listType !== 'ul') flush();
      listType = 'ul';
      listBuffer.push(<li key={listBuffer.length}><Inline segments={b.text} /></li>);
    } else if (b.kind === 'numbered') {
      if (listType !== 'ol') flush();
      listType = 'ol';
      listBuffer.push(<li key={listBuffer.length}><Inline segments={b.text} /></li>);
    } else {
      flush();
      groups.push(renderSingle(b));
    }
  }
  flush();
  return <div className="markdown-view">{groups}</div>;
}

function renderSingle(b: ReturnType<typeof parseMarkdown>[number]): ReactNode {
  switch (b.kind) {
    case 'heading': {
      const Tag = `h${Math.min(b.level, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return <Tag><Inline segments={b.text} /></Tag>;
    }
    case 'paragraph':
      return <p><Inline segments={b.text} /></p>;
    case 'code':
      return (
        <pre>
          {b.lines.map((l, j) => (
            <div key={j}>{l}</div>
          ))}
        </pre>
      );
    default:
      return null;
  }
}
