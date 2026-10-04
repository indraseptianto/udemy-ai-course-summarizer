import { describe, it, expect } from 'vitest';
import { exportCourseToDocx } from '@/export/docx';
import { exportCourseToPdf } from '@/export/pdf';
import { buildCourseDocument } from '@/export/documentModel';
import type { Chapter, Course, Lesson } from '@/shared/types';

function sampleDocCourse() {
  const course: Course = {
    id: 'c1', title: 'Build Automation Course', url: 'udemy.com/course/build',
    createdAt: 1, updatedAt: 1, totalLessons: 2, completedLessons: 2,
  };
  const chapter: Chapter = { id: 'ch1', courseId: 'c1', title: 'Introduction', order: 0 };
  const lesson: Lesson = {
    id: 'l1', chapterId: 'ch1', courseId: 'c1', title: 'Getting Started',
    transcript: 'hi', transcriptSegments: [], status: 'completed',
    summary: [
      '## Learning Objectives',
      '- Understand how builds work',
      '## Core Concepts',
      'A build is a pipeline.',
      '## Code / Technical Examples',
      '```',
      'npm run build',
      '```',
    ].join('\n'),
    createdAt: 1, updatedAt: 1,
  };
  const byChapter = new Map<string, Lesson[]>([[chapter.id, [lesson]]]);
  return buildCourseDocument(course, [chapter], byChapter);
}

describe('export artifact generation', () => {
  it('generates a non-trivial DOCX blob', async () => {
    const blob = await exportCourseToDocx(sampleDocCourse());
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain('openxmlformats-officedocument.wordprocessingml.document');
  });

  it('generates a non-trivial PDF blob', async () => {
    const blob = await exportCourseToPdf(sampleDocCourse());
    expect(blob.size).toBeGreaterThan(500);
    expect(blob.type).toContain('pdf');
  });
});
