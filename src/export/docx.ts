import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  TextRun,
  convertInchesToTwip,
} from 'docx';
import type { DocCourse } from './documentModel';
import type { Block, InlineSegment } from './markdown';
import { parseMarkdown } from './markdown';

const CODE_FONT = 'Consolas';
const BODY_FONT = 'Calibri';

function runsForInline(segments: InlineSegment[], base: { size?: number; color?: string } = {}): TextRun[] {
  return segments.map((seg) =>
    new TextRun({
      text: seg.text,
      bold: seg.bold,
      font: seg.inlineCode ? CODE_FONT : BODY_FONT,
      size: base.size ?? 22,
      color: base.color,
      highlight: seg.inlineCode ? 'lightGray' : undefined,
    }),
  );
}

type HeadingValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

function headingToLevel(level: number): HeadingValue {
  switch (level) {
    case 1: return HeadingLevel.HEADING_1;
    case 2: return HeadingLevel.HEADING_2;
    case 3: return HeadingLevel.HEADING_3;
    case 4: return HeadingLevel.HEADING_4;
    case 5: return HeadingLevel.HEADING_5;
    default: return HeadingLevel.HEADING_6;
  }
}

export function blocksToDocxParagraphs(blocks: Block[], isLessonBody = false): Paragraph[] {
  const out: Paragraph[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
        out.push(
          new Paragraph({
            heading: headingToLevel(block.level + (isLessonBody ? 1 : 0)),
            children: runsForInline(block.text, { size: 28 }),
            spacing: { before: 200, after: 100 },
          }),
        );
        break;
      case 'paragraph':
        out.push(
          new Paragraph({
            children: runsForInline(block.text),
            spacing: { after: 120 },
          }),
        );
        break;
      case 'bullet':
        out.push(
          new Paragraph({
            bullet: { level: 0 },
            children: runsForInline(block.text),
            spacing: { after: 60 },
          }),
        );
        break;
      case 'numbered':
        out.push(
          new Paragraph({
            numbering: { reference: 'steps', level: 0 },
            children: runsForInline(block.text),
            spacing: { after: 60 },
          }),
        );
        break;
      case 'code':
        out.push(
          new Paragraph({
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F3F5' },
            border: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
            },
            children: block.lines.map(
              (line) =>
                new TextRun({
                  text: line,
                  font: CODE_FONT,
                  size: 20,
                  break: line === block.lines[block.lines.length - 1] ? undefined : 1,
                }),
            ),
            spacing: { before: 100, after: 100 },
          }),
        );
        break;
      default:
        break;
    }
  }
  return out;
}

function buildCourseDoc(model: DocCourse): Document {
  const items: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: model.title, bold: true, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Generated Study Notes', size: 24, color: '666666' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Exported ${model.metadata.exportedAt}`, size: 20, color: '888888' })],
    }),
    new Paragraph({ children: [new TextRun({ text: '', size: 10 })] }),
  ];

  model.chapters.forEach((chapter, ci) => {
    if (ci > 0) items.push(new Paragraph({ children: [new PageBreak()] }));
    items.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: chapter.title, bold: true, size: 32 })],
      }),
    );
    chapter.lessons.forEach((lesson) => {
      if (!lesson.summary?.trim()) return;
      items.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: lesson.title, bold: true, size: 28 })],
        }),
      );
      items.push(...blocksToDocxParagraphs(parseMarkdown(lesson.summary), true));
    });
  });

  return new Document({
    numbering: {
      config: [
        {
          reference: 'steps',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(0.6), hanging: convertInchesToTwip(0.25) } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: items,
      },
    ],
  });
}

export async function exportCourseToDocx(model: DocCourse): Promise<Blob> {
  const doc = buildCourseDoc(model);
  return await Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
