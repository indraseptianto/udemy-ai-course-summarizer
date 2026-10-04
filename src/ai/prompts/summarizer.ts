import type { SummarizationPreferences } from '@/shared/types';

export const SYSTEM_PROMPT =
  'You are a meticulous study assistant that transforms lecture transcripts into ' +
  'clear, structured learning material. You never invent facts.' +
  'You preserve the instructor\u2019s meaning, technical terminology, examples and code exactly.';

export interface SummarizeInput {
  lessonTitle: string;
  chapterTitle?: string;
  courseTitle?: string;
  transcript: string;
  preferences: SummarizationPreferences;
  /** Set when the transcript was chunked and this is one chunk of several. */
  chunk?: { index: number; total: number };
}

const STYLE_GUIDANCE: Record<SummarizationPreferences['style'], string> = {
  detailed:
    'Write in a DETAILED style: thorough explanations, keep important technical nuance, ' +
    'use complete sentences, and preserve every meaningful example, warning and step.',
  balanced:
    'Write in a BALANCED style: concise but complete, capturing all key ideas with ' +
    'brief examples and steps.',
  concise:
    'Write in a CONCISE style: tight bullet points and short paragraphs that still ' +
    'preserve every important technical fact, term and example.',
};

function preferenceFlags(p: SummarizationPreferences): string {
  const on: string[] = [];
  const off: string[] = [];
  const label = (enabled: boolean, name: string) => (enabled ? on : off).push(name);
  label(p.preserveExamples, 'examples');
  label(p.preserveCode, 'code blocks');
  label(p.includeTimestamps, 'source timestamps');
  label(p.includeLearningObjectives, 'learning objectives');
  label(p.includeKeyTerms, 'key terms');
  label(p.includePracticalTakeaways, 'practical takeaways');
  return `- Include: ${on.join(', ') || '(none beyond required sections)'}.\n` +
    (off.length ? `- Omit unless naturally part of the source: ${off.join(', ')}.\n` : '');
}

/**
 * Builds the full prompt sent to the AI provider for a single lesson summary.
 * Keeps source-fidelity rules explicit so the model does not hallucinate.
 */
export function buildSummarizationPrompt(input: SummarizeInput): string {
  const { preferences, chunk } = input;
  const header = `# Lesson: ${input.lessonTitle}` +
    (input.chapterTitle ? `\n# Chapter: ${input.chapterTitle}` : '') +
    (input.courseTitle ? `\n# Course: ${input.courseTitle}` : '');

  const chunkNote = chunk
    ? `\n\n> NOTE: This transcript is PART ${chunk.index + 1} of ${chunk.total}. ` +
      `Produce the structured lesson sections for this part only. ` +
      `At the very end add a short "## Continuation" heading with a 1-line summary ` +
      `of this chunk so the next chunk can build on it.\n`
    : '';

  return `${header}

# Request
Transform the TRANSCRIPT below into structured study notes for this lesson.

# Output structure (use Markdown headings and lists)
Use EXACTLY these sections, in this order. Skip a section ONLY if the transcript provides no material for it:

## Learning Objectives
What the learner should understand after studying this lesson (bullets).

## Core Concepts
The major concepts, explained clearly and logically.

## Detailed Explanation
Walk through the material in logical order. Keep important technical details — do not shorten the notes just to be brief.

## Key Terms
Term — one-line explanation. One row per term.

## Examples
Preserve the instructor\u2019s examples. Use bullet or numbered lists.

## Step-by-Step Process
If the instructor explains a process, present it as numbered steps 1., 2., 3., ...

## Code / Technical Examples
Preserve any code. Use fenced code blocks. Do NOT rewrite code unless it contains a clear error.

## Important Notes
Warnings, caveats, limitations and important observations from the transcript.

## Common Mistakes
ONLY when the transcript actually discusses mistakes or pitfalls. Omit this section otherwise.

## Practical Takeaways
What the learner should be able to apply now.

${preferenceFlags(preferences)}
${STYLE_GUIDANCE[preferences.style]}

# Source fidelity — READ CAREFULLY
- Summarize ONLY what appears in the TRANSCRIPT. Never invent facts, names, numbers, examples, or steps not in the source.
- Preserve technical terminology, formulas, definitions, warnings and exact instructions verbatim where possible.
- Do NOT rewrite code unless it contains a clear error.
- If you add background or clarification NOT present in the transcript, put it under a heading "## Additional Explanation" and label each such item as "(Explanation, not in transcript)".
- Never present external knowledge as if the instructor said it.
- Accuracy > completeness > readability > brevity.
- If a requested section has no source material, write "(Not covered in the transcript)" and move on — do not fabricate.

# Transcript
${'```'}
${input.transcript}
${'```'}
${chunkNote}`;
}

/**
 * Builds the prompt used to combine multiple lesson summaries into one
 * chapter-level overview (Mode B).
 */
export function buildChapterPrompt(input: {
  courseTitle?: string;
  chapterTitle: string;
  lessonSummaries: string[];
  preferences: SummarizationPreferences;
}): string {
  const lessons = input.lessonSummaries
    .map((s, i) => `### Lesson ${i + 1} summary\n\n${s}`)
    .join('\n\n---\n\n');
  return `# Chapter: ${input.chapterTitle}${input.courseTitle ? `\n# Course: ${input.courseTitle}` : ''}

# Request
Combine the individual lesson summaries below into ONE cohesive chapter study guide.
Use this structure:

## Chapter Overview
A short paragraph describing what this chapter covers.

## Learning Objectives
Consolidated bullets.

## Major Concepts
Sections that group related concepts.

## Detailed Explanation
Integrated walkthrough of the chapter\u2019s material.

## Examples
Key examples from the lessons.

## Key Takeaways
The most important things to remember.

${STYLE_GUIDANCE[input.preferences.style]}

# Source fidelity
Synthesize ONLY from the lesson summaries provided. Do not add external facts. If you add background, label it "(Explanation, not in transcript)".
Accuracy > completeness > readability > brevity.

# Lesson Summaries
${lessons}`;
}
