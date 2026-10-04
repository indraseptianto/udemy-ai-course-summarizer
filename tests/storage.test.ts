import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveCourse,
  saveChapter,
  saveLesson,
  getCourse,
  getLesson,
  listCourses,
  listChapters,
  listLessons,
  recomputeCourseProgress,
  deleteCourse,
} from '@/storage/db';
import type { Lesson } from '@/shared/types';

function flush(db: IDBDatabase) {
  return new Promise<void>((resolve) => {
    const tx = db.transaction(['courses', 'chapters', 'lessons'], 'readwrite');
    tx.objectStore('courses').clear();
    tx.objectStore('chapters').clear();
    tx.objectStore('lessons').clear();
    tx.oncomplete = () => resolve();
  });
}

beforeEach(async () => {
  const req = indexedDB.open('udemy-summarizer', 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    for (const name of ['courses', 'chapters', 'lessons']) {
      if (!db.objectStoreNames.contains(name)) {
        db.createObjectStore(name, { keyPath: 'id' });
      }
    }
  };
  const db = await new Promise<IDBDatabase>((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  await flush(db);
  db.close();
});

describe('storage', () => {
  it('saves and restores a course', async () => {
    const c = await saveCourse({ title: 'Course A', url: 'udemy.com/course/a' });
    const restored = await getCourse(c.id);
    expect(restored?.title).toBe('Course A');
    const [listed] = await listCourses();
    expect(listed.title).toBe('Course A');
  });

  it('saves a chapter under a course in order', async () => {
    const c = await saveCourse({ title: 'C', url: 'u' });
    await saveChapter({ courseId: c.id, title: 'Ch2' }, 0);
    await saveChapter({ courseId: c.id, title: 'Ch1' }, 1);
    const chapters = await listChapters(c.id);
    expect(chapters.map((x) => x.title)).toEqual(['Ch2', 'Ch1']);
  });

  it('saves a lesson and updates its summary', async () => {
    const c = await saveCourse({ title: 'C', url: 'u' });
    const ch = await saveChapter({ courseId: c.id, title: 'Ch' }, 0);
    const l = await saveLesson({
      chapterId: ch.id, courseId: c.id, title: 'Lesson',
      transcriptSegments: [{ timestamp: '00:01', text: 'hi' }],
      status: 'transcript_captured',
    });
    expect(l.status).toBe('transcript_captured');

    const updated = await saveLesson({
      id: l.id, chapterId: ch.id, courseId: c.id, title: 'Lesson',
      transcriptSegments: l.transcriptSegments, summary: 'Final summary', status: 'completed',
    });
    expect(updated.status).toBe('completed');
    const reloaded = await getLesson(l.id);
    expect(reloaded?.summary).toBe('Final summary');
  });

  it('recomputes course progress from lesson statuses', async () => {
    const c = await saveCourse({ title: 'C', url: 'u' });
    const ch = await saveChapter({ courseId: c.id, title: 'Ch' }, 0);
    const mk = (title: string, status: Lesson['status']) =>
      saveLesson({ chapterId: ch.id, courseId: c.id, title, transcriptSegments: [], status });
    await mk('a', 'completed');
    await mk('b', 'completed');
    await mk('c', 'not_started');
    const course = await recomputeCourseProgress(c.id);
    expect(course?.totalLessons).toBe(3);
    expect(course?.completedLessons).toBe(2);
  });

  it('deletes a course cascade', async () => {
    const c = await saveCourse({ title: 'C', url: 'u' });
    const ch = await saveChapter({ courseId: c.id, title: 'Ch' }, 0);
    await saveLesson({ chapterId: ch.id, courseId: c.id, title: 'L', transcriptSegments: [] });
    await deleteCourse(c.id);
    expect(await getCourse(c.id)).toBeUndefined();
    expect(await listChapters(c.id)).toHaveLength(0);
    expect(await listLessons(ch.id)).toHaveLength(0);
  });
});
