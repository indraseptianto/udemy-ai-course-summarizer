import { describe, it, expect } from 'vitest';
import { assessExportReadiness, buildCourseDocument } from '@/export/documentModel';
import type { Chapter, Course, Lesson } from '@/shared/types';

function makeCourse(completed: boolean): { course: Course; chapters: Chapter[]; byChapter: Map<string, Lesson[]> } {
  const course: Course = {
    id: 'c1', title: 'Python Masterclass', url: 'udemy.com/course/python',
    createdAt: 1, updatedAt: 1, totalLessons: 2, completedLessons: completed ? 2 : 1,
  };
  const chapter: Chapter = { id: 'ch1', courseId: 'c1', title: 'Intro', order: 0 };
  const lessons: Lesson[] = [
    {
      id: 'l1', chapterId: 'ch1', courseId: 'c1', title: 'Lesson 1',
      transcript: 'x', transcriptSegments: [], status: 'completed', summary: 'A summary.',
      createdAt: 1, updatedAt: 1,
    },
    {
      id: 'l2', chapterId: 'ch1', courseId: 'c1', title: 'Lesson 2',
      transcript: 'y', transcriptSegments: [], status: completed ? 'completed' : 'not_started',
      summary: completed ? 'B summary.' : undefined, createdAt: 1, updatedAt: 1,
    },
  ];
  const byChapter = new Map<string, Lesson[]>([[chapter.id, lessons]]);
  return { course, chapters: [chapter], byChapter };
}

describe('assessExportReadiness', () => {
  it('locks export while lessons are incomplete', () => {
    const { course, chapters, byChapter } = makeCourse(false);
    const r = assessExportReadiness(course, chapters, byChapter);
    expect(r.ready).toBe(false);
    expect(r.reason).toContain('incomplete');
    expect(r.incompleteLessons.length).toBeGreaterThan(0);
  });

  it('locks export while a lesson is processing', () => {
    const { course, chapters, byChapter } = makeCourse(true);
    byChapter.get('ch1')![0].status = 'processing';
    const r = assessExportReadiness(course, chapters, byChapter);
    expect(r.ready).toBe(false);
    expect(r.incompleteLessons.join()).toContain('processing');
  });

  it('locks export while a lesson has failed', () => {
    const { course, chapters, byChapter } = makeCourse(true);
    byChapter.get('ch1')![1].status = 'failed';
    const r = assessExportReadiness(course, chapters, byChapter);
    expect(r.ready).toBe(false);
    expect(r.incompleteLessons.join()).toContain('failed');
  });

  it('locks export when a summary is missing', () => {
    const { course, chapters, byChapter } = makeCourse(true);
    byChapter.get('ch1')![0].summary = '';
    const r = assessExportReadiness(course, chapters, byChapter);
    expect(r.ready).toBe(false);
  });

  it('enables export when all lessons completed with summaries', () => {
    const { course, chapters, byChapter } = makeCourse(true);
    const r = assessExportReadiness(course, chapters, byChapter);
    expect(r.ready).toBe(true);
    expect(r.incompleteLessons).toEqual([]);
  });

  it('reports no lessons when course is empty', () => {
    const course: Course = {
      id: 'c', title: 'Empty', url: 'x', createdAt: 1, updatedAt: 1, totalLessons: 0, completedLessons: 0,
    };
    const r = assessExportReadiness(course, [], new Map());
    expect(r.ready).toBe(false);
    expect(r.reason).toContain('No lessons');
  });
});

describe('buildCourseDocument', () => {
  it('preserves chapter/lesson hierarchy and completed count', () => {
    const { course, chapters, byChapter } = makeCourse(true);
    const doc = buildCourseDocument(course, chapters, byChapter);
    expect(doc.title).toBe('Python Masterclass');
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].lessons).toHaveLength(2);
    expect(doc.metadata.completedLessons).toBe(2);
  });
});
