import type { Chapter, Course, Lesson } from '@/shared/types';

/**
 * Neutral document model shared by both the DOCX and PDF exporters so the
 * export layout logic lives in one place, not duplicated per format.
 */
export interface DocLesson {
  title: string;
  status: string;
  summary: string;
}
export interface DocChapter {
  title: string;
  lessons: DocLesson[];
}
export interface DocCourse {
  title: string;
  url?: string;
  generatedAt: string;
  chapters: DocChapter[];
  metadata: {
    totalLessons: number;
    completedLessons: number;
    exportedAt: string;
  };
}

export function buildCourseDocument(
  course: Course,
  chapters: Chapter[],
  lessonsByChapter: Map<string, Lesson[]>,
): DocCourse {
  const chaptersDoc: DocChapter[] = chapters.map((chapter) => {
    const lessons = lessonsByChapter.get(chapter.id) ?? [];
    return {
      title: chapter.title,
      lessons: lessons.map((l) => ({
        title: l.title || 'Untitled lesson',
        status: l.status,
        summary: l.summary ?? '',
      })),
    };
  });
  return {
    title: course.title || 'Untitled course',
    url: course.url,
    generatedAt: new Date().toISOString(),
    chapters: chaptersDoc,
    metadata: {
      totalLessons: course.totalLessons,
      completedLessons: course.completedLessons,
      exportedAt: new Date().toLocaleString(),
    },
  };
}

export interface ExportReadiness {
  ready: boolean;
  reason?: string;
  incompleteLessons: string[];
}

/**
 * Export lock: exporting is permitted only when every lesson is completed
 * with a non-empty summary, none are processing, and none have failed.
 */
export function assessExportReadiness(
  course: Course,
  chapters: Chapter[],
  lessonsByChapter: Map<string, Lesson[]>,
): ExportReadiness {
  const incomplete: string[] = [];
  for (const chapter of chapters) {
    const lessons = lessonsByChapter.get(chapter.id) ?? [];
    for (const lesson of lessons) {
      if (lesson.status === 'processing') {
        incomplete.push(`${lesson.title} (processing)`);
      } else if (lesson.status === 'failed') {
        incomplete.push(`${lesson.title} (failed)`);
      } else if (lesson.status !== 'completed' || !lesson.summary?.trim()) {
        incomplete.push(lesson.title);
      }
    }
  }
  if (incomplete.length === 0 && course.totalLessons > 0) {
    return { ready: true, incompleteLessons: [] };
  }
  if (course.totalLessons === 0) {
    return {
      ready: false,
      reason: 'No lessons have been added to this course yet.',
      incompleteLessons: [],
    };
  }
  const reason =
    incomplete.length === 1
      ? `${incomplete.length} lesson is still incomplete.`
      : `${incomplete.length} lessons are still incomplete.`;
  return { ready: false, reason, incompleteLessons: incomplete };
}
