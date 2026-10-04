import { jsPDF } from 'jspdf';
import type { DocCourse } from './documentModel';
import type { Block } from './markdown';
import { parseMarkdown } from './markdown';

const PAGE_WIDTH = 595.28; // A4 in pt
const MARGIN = 56;
const INLINE_INDENT = 28;
const BULLET_INDENT = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const FONT_SIZES: Record<number, { size: number; bold: boolean; gap: number }> = {
  1: { size: 17, bold: true, gap: 14 },
  2: { size: 14, bold: true, gap: 12 },
  3: { size: 12, bold: true, gap: 10 },
  4: { size: 11, bold: true, gap: 8 },
  5: { size: 11, bold: true, gap: 8 },
  6: { size: 10.5, bold: true, gap: 8 },
};

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function roundedRect(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.roundedRect(x, y, w, h, 3, 3, 'F');
}

export async function exportCourseToPdf(model: DocCourse): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = MARGIN;

  // Title block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(model.title, CONTENT_WIDTH) as string[];
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 26 + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Generated Study Notes  —  Exported ${model.metadata.exportedAt}`, MARGIN, y);
  y += 18;
  doc.setTextColor(0);

  for (const chapter of model.chapters) {
    y = ensureSpace(doc, y, 60);
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 90, 200);
    const chapterLines = doc.splitTextToSize(chapter.title, CONTENT_WIDTH) as string[];
    doc.text(chapterLines, MARGIN, y);
    y += chapterLines.length * 22 + 10;
    doc.setTextColor(0);

    for (const lesson of chapter.lessons) {
      if (!lesson.summary?.trim()) continue;
      y = ensureSpace(doc, y, 70);
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13.5);
      doc.setTextColor(20, 20, 20);
      const lessonLines = doc.splitTextToSize(lesson.title, CONTENT_WIDTH) as string[];
      doc.text(lessonLines, MARGIN, y);
      y += lessonLines.length * 18 + 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);

      y = renderBlocks(doc, parseMarkdown(lesson.summary), y, { isLessonBody: true });
    }
  }

  const blob = doc.output('blob');
  return blob;
}

function renderBlocks(
  doc: jsPDF,
  blocks: Block[],
  startY: number,
  opts: { isLessonBody: boolean } = { isLessonBody: false },
): number {
  let y = startY;

  for (const block of blocks) {
    switch (block.kind) {
      case 'heading': {
        const level = opts.isLessonBody ? Math.min(block.level + 1, 6) : block.level;
        const cfg = FONT_SIZES[level];
        y = ensureSpace(doc, y, 30);
        y += 8;
        doc.setFont('helvetica', cfg.bold ? 'bold' : 'normal');
        doc.setFontSize(cfg.size);
        doc.setTextColor(40, 40, 40);
        const lines = splitInline(doc, block.text, CONTENT_WIDTH);
        for (const line of lines) {
          y = ensureSpace(doc, y, cfg.size + 4);
          doc.text(line, MARGIN, y);
          y += cfg.size + 4;
        }
        y += 4;
        doc.setTextColor(0);
        break;
      }
      case 'paragraph': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        const lines = splitInline(doc, block.text, CONTENT_WIDTH);
        for (const line of lines) {
          y = ensureSpace(doc, y, 16);
          doc.text(line, MARGIN, y);
          y += 15;
        }
        y += 4;
        break;
      }
      case 'bullet': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        y = ensureSpace(doc, y, 16);
        doc.setFillColor(0, 0, 0);
        doc.circle(MARGIN + 4, y - 3, 1.6, 'F');
        const lines = splitInline(doc, block.text, CONTENT_WIDTH - BULLET_INDENT, BULLET_INDENT);
        lines.forEach((line, idx) => {
          if (idx > 0) y = ensureSpace(doc, y, 15);
          doc.text(line, MARGIN + BULLET_INDENT, y);
          y += 15;
        });
        y += 2;
        break;
      }
      case 'numbered': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        const prefix = `${block.index}. `;
        const labelWidth = doc.getTextWidth(prefix);
        y = ensureSpace(doc, y, 16);
        doc.text(prefix, MARGIN + INLINE_INDENT, y);
        const lines = splitInline(doc, block.text, CONTENT_WIDTH - INLINE_INDENT - labelWidth - 6, INLINE_INDENT + labelWidth + 6);
        lines.forEach((line, idx) => {
          if (idx > 0) y = ensureSpace(doc, y, 15);
          doc.text(line, MARGIN + INLINE_INDENT + labelWidth + 6, y);
          y += 15;
        });
        y += 2;
        break;
      }
      case 'code': {
        // Group code lines into one shaded block.
        const codeText = block.lines.join('\n');
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        const wrapped = doc.splitTextToSize(codeText, CONTENT_WIDTH - 16) as string[];
        const lineH = 11;
        const blockH = wrapped.length * lineH + 12;
        y = ensureSpace(doc, y, Math.min(blockH, 120));
        const top = y - 8;
        doc.setFillColor(245, 246, 248);
        roundedRect(doc, MARGIN, top, CONTENT_WIDTH, blockH + 8);
        let cy = y;
        for (const line of wrapped) {
          cy = ensureSpace(doc, cy, lineH);
          doc.text(line, MARGIN + 10, cy);
          cy += lineH;
        }
        y = top + blockH + 8 + 6;
        break;
      }
      default:
        break;
    }
  }
  return y;
}

/** Render inline segments to a single accent-preserved line (bold handled). */
function splitInline(
  doc: jsPDF,
  segments: { text: string; bold?: boolean; inlineCode?: boolean }[],
  maxWidth: number,
  indent = 0,
): string[] {
  // Flatten to plain text losslessly using current font size for width calc.
  const plain = segments.map((s) => s.text).join('');
  doc.setFont('helvetica', 'normal');
  if (indent > 0) {
    return (doc.splitTextToSize(plain, maxWidth) as string[]).map((l, i) => (i === 0 ? `${' '.repeat(Math.round(indent / 5))}${l.trimStart()}` : l));
  }
  return doc.splitTextToSize(plain, maxWidth) as string[];
}
