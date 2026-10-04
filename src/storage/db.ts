import type { Chapter, Course, Lesson, LessonStatus } from '@/shared/types';

/**
 * IndexedDB persistence layer for course/chapter/lesson data.
 * Uses a tiny promisified wrapper over the native IndexedDB API —
 * no database dependency required in the extension bundle.
 */

const DB_NAME = 'udemy-summarizer';
const DB_VERSION = 1;

const STORES = ['courses', 'chapters', 'lessons'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = fn(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}
export async function get<T>(store: StoreName, id: string): Promise<T | undefined> {
  return tx<T>(store, 'readonly', (s) => s.get(id) as IDBRequest<T>);
}
export async function put<T>(store: StoreName, value: T): Promise<IDBValidKey> {
  return tx<IDBValidKey>(store, 'readwrite', (s) => s.put(value) as IDBRequest<IDBValidKey>);
}
export async function remove(store: StoreName, id: string): Promise<undefined> {
  return tx<undefined>(store, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ----------------------------- Courses ----------------------------- */

export async function listCourses(): Promise<Course[]> {
  const courses = await getAll<Course>('courses');
  return courses.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
}
export async function getCourse(id: string): Promise<Course | undefined> {
  return get<Course>('courses', id);
}
export async function saveCourse(data: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'totalLessons' | 'completedLessons'> & Partial<Pick<Course, 'id'>>): Promise<Course> {
  const now = Date.now();
  const existing = data.id ? await getCourse(data.id) : undefined;
  const course: Course = {
    id: data.id ?? uid('course'),
    title: data.title,
    url: data.url,
    instructor: data.instructor,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    totalLessons: existing?.totalLessons ?? 0,
    completedLessons: existing?.completedLessons ?? 0,
  };
  await put('courses', course);
  return course;
}

/* ----------------------------- Chapters ---------------------------- */

export async function listChapters(courseId: string): Promise<Chapter[]> {
  const all = await getAll<Chapter>('chapters');
  return all
    .filter((c) => c.courseId === courseId)
    .sort((a, b) => a.order - b.order);
}
export async function saveChapter(data: Omit<Chapter, 'id' | 'order'> & Partial<Pick<Chapter, 'id'>>, order: number): Promise<Chapter> {
  const existing = data.id ? await get<Chapter>('chapters', data.id) : undefined;
  const chapter: Chapter = {
    id: data.id ?? uid('chapter'),
    courseId: data.courseId,
    title: data.title,
    order: existing?.order ?? order,
  };
  await put('chapters', chapter);
  return chapter;
}

/* ----------------------------- Lessons ------------------------------ */

export async function listLessons(chapterId?: string): Promise<Lesson[]> {
  const all = await getAll<Lesson>('lessons');
  return chapterId ? all.filter((l) => l.chapterId === chapterId) : all;
}
export async function getLesson(id: string): Promise<Lesson | undefined> {
  return get<Lesson>('lessons', id);
}
export async function saveLesson(
  data: Partial<Lesson> & { id?: string; chapterId: string; courseId: string; title: string },
): Promise<Lesson> {
  const existing = data.id ? await getLesson(data.id) : undefined;
  const now = Date.now();
  const lesson: Lesson = {
    id: data.id ?? uid('lesson'),
    chapterId: data.chapterId,
    courseId: data.courseId,
    title: data.title,
    url: data.url,
    transcript: data.transcript,
    transcriptSegments: data.transcriptSegments ?? [],
    summary: data.summary,
    status: data.status ?? existing?.status ?? 'not_started',
    error: data.error ?? existing?.error,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await put('lessons', lesson);
  return lesson;
}

export async function setLessonStatus(id: string, status: LessonStatus, error?: string): Promise<void> {
  const lesson = await getLesson(id);
  if (lesson) {
    lesson.status = status;
    lesson.error = error;
    lesson.updatedAt = Date.now();
    await put('lessons', lesson);
  }
}

/** Recompute and persist a course's completion counters from its lessons. */
export async function recomputeCourseProgress(courseId: string): Promise<Course | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  const chapters = await listChapters(courseId);
  const lessons = (await Promise.all(chapters.map((c) => listLessons(c.id)))).flat();
  const total = lessons.length;
  const completed = lessons.filter((l) => l.status === 'completed').length;
  course.totalLessons = total;
  course.completedLessons = completed;
  course.updatedAt = Date.now();
  await put('courses', course);
  return course;
}

export async function deleteCourse(courseId: string): Promise<void> {
  const chapters = await listChapters(courseId);
  for (const c of chapters) {
    const lessons = await listLessons(c.id);
    for (const l of lessons) await remove('lessons', l.id);
    await remove('chapters', c.id);
  }
  await remove('courses', courseId);
}

export { uid };
