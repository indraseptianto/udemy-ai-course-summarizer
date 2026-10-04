import type { ActiveLessonInfo } from '@/shared/messages';
import type { Chapter, Course, Lesson, LessonStatus } from '@/shared/types';
import {
  getLesson,
  listChapters,
  listCourses,
  listLessons,
  saveChapter,
  saveCourse,
  saveLesson,
} from '@/storage/db';

export interface LessonRef {
  course: Course;
  chapter: Chapter;
  lesson: Lesson;
  isNew: boolean;
}

/** Compare course URLs by their base course path (ignore lesson path). */
function courseBaseOf(url: string): string {
  const m = /^https:\/\/(www\.)?udemy\.com\/course\/([^/]+)/i.exec(url);
  return m ? `udemy.com/course/${m[2]}` : url;
}

/**
 * Find or create the course/chapter/lesson hierarchy for a captured lesson.
 * Everything lives in IndexedDB.
 */
export async function ensureLessonForCapture(info: ActiveLessonInfo): Promise<LessonRef | null> {
  if (!info.isUdemyLesson || !info.url) return null;

  const base = courseBaseOf(info.url);
  const courses = await listCourses();
  let course = courses.find((c) => courseBaseOf(c.url) === base);

  if (!course) {
    course = await saveCourse({
      title: info.courseTitle || 'Untitled Course',
      url: base,
      instructor: undefined,
    });
  }

  const chapterTitle = info.sectionTitle || 'General';
  const chapters = await listChapters(course.id);
  let chapter = chapters.find((c) => c.title === chapterTitle);
  if (!chapter) {
    chapter = await saveChapter({ courseId: course.id, title: chapterTitle }, chapters.length);
  }

  const lessons = await listLessons(chapter.id);
  let lesson = lessons.find((l) => l.url === info.url);

  // Update an existing lesson's metadata/transcript, or create a new one.
  if (lesson) {
    lesson = await saveLesson({
      id: lesson.id,
      chapterId: lesson.chapterId,
      courseId: lesson.courseId,
      title: info.lessonTitle || lesson.title,
      url: info.url,
      transcriptSegments: info.transcriptSegments,
      transcript: info.transcriptText !== '' ? info.transcriptText : lesson.transcript,
      status: lessonTranscriptEmpty(lesson) ? ('transcript_captured' as LessonStatus) : lesson.status,
    });
    return { course, chapter, lesson, isNew: false };
  }

  lesson = await saveLesson({
    chapterId: chapter.id,
    courseId: course.id,
    title: info.lessonTitle || 'Untitled Lesson',
    url: info.url,
    transcriptSegments: info.transcriptSegments,
    transcript: info.transcriptText !== '' ? info.transcriptText : undefined,
    status: 'transcript_captured' as LessonStatus,
  });
  return { course, chapter, lesson, isNew: true };
}

function lessonTranscriptEmpty(lesson: Lesson): boolean {
  return (!lesson.transcript || lesson.transcript.trim() === '') && lesson.transcriptSegments.length === 0;
}

/** Update a lesson's transcript and mark it captured. */
export async function setLessonTranscript(
  lessonId: string,
  segments: Lesson['transcriptSegments'],
  transcript: string,
): Promise<void> {
  const lesson = await getLesson(lessonId);
  if (!lesson) return;
  await saveLesson({
    id: lesson.id,
    chapterId: lesson.chapterId,
    courseId: lesson.courseId,
    title: lesson.title,
    url: lesson.url,
    transcriptSegments: segments,
    transcript,
    summary: lesson.summary,
    status: 'transcript_captured',
    error: undefined,
  });
}

/** Update a summary and mark the lesson completed (or restore failed status). */
export async function setLessonSummary(
  lessonId: string,
  summary: string,
  status: LessonStatus = 'completed',
): Promise<void> {
  const lesson = await getLesson(lessonId);
  if (!lesson) return;
  await saveLesson({
    id: lesson.id,
    chapterId: lesson.chapterId,
    courseId: lesson.courseId,
    title: lesson.title,
    url: lesson.url,
    transcript: lesson.transcript,
    transcriptSegments: lesson.transcriptSegments,
    summary,
    status,
    error: status === 'failed' ? 'Summarization failed. Retry the lesson.' : undefined,
  });
}

export async function markLessonStatus(lessonId: string, status: LessonStatus, error?: string): Promise<void> {
  const lesson = await getLesson(lessonId);
  if (!lesson) return;
  await saveLesson({
    id: lesson.id,
    chapterId: lesson.chapterId,
    courseId: lesson.courseId,
    title: lesson.title,
    url: lesson.url,
    transcript: lesson.transcript,
    transcriptSegments: lesson.transcriptSegments,
    summary: lesson.summary,
    status,
    error,
  });
}
