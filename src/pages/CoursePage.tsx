import { useCallback, useEffect, useState } from 'react';
import type { Chapter, Course, Lesson } from '@/shared/types';
import { listCourses, listChapters, listLessons, recomputeCourseProgress } from '@/storage/db';
import { loadSettings } from '@/storage/settings';
import { summarizeLessonToCompletion } from '@/utils/summarizeHelpers';
import { StatusBadge, ProgressBar } from '@/components/Progress';
import {
  assessExportReadiness,
  buildCourseDocument,
  exportCourseToDocx,
  exportCourseToPdf,
  downloadBlob,
} from '@/export';
import type { DocCourse } from '@/export/documentModel';

type CourseData = {
  course: Course;
  chapters: Chapter[];
  lessonsByChapter: Map<string, Lesson[]>;
};

export function CoursePage({ selectedCourseId }: { selectedCourseId?: string | null }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string | null>(selectedCourseId ?? null);
  const [data, setData] = useState<CourseData | null>(null);
  const [busy, setBusy] = useState<null | 'export' | 'summarizing'>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    const list = await listCourses();
    setCourses(list);
    if (list.length > 0 && (courseId === null || !list.some((c) => c.id === courseId))) {
      setCourseId(list[0].id);
    }
  }, [courseId]);

  useEffect(() => { void loadCourses(); }, [loadCourses]);

  useEffect(() => {
    if (!courseId) { setData(null); return; }
    (async () => {
      const course = await (await import('@/storage/db')).getCourse(courseId);
      if (!course) return;
      const chapters = await listChapters(courseId);
      const lessonsByChapter = new Map<string, Lesson[]>();
      for (const ch of chapters) {
        lessonsByChapter.set(ch.id, await listLessons(ch.id));
      }
      setData({ course, chapters, lessonsByChapter });
    })();
  }, [courseId]);

  async function refresh() {
    if (!courseId) return;
    const chapters = await listChapters(courseId);
    const lessonMap = new Map<string, Lesson[]>();
    for (const ch of chapters) lessonMap.set(ch.id, await listLessons(ch.id));
    const course = await recomputeCourseProgress(courseId);
    if (course) {
      setData({ course, chapters, lessonsByChapter: lessonMap });
      setCourseId((c) => c);
    }
  }

  async function handleRemaining() {
    if (!data) return;
    setError(null);
    const settings = await loadSettings();
    if (!settings.provider.apiKey) {
      setError('No API key configured. Open Settings first.');
      return;
    }
    const targets: Lesson[] = [];
    for (const ch of data.chapters) {
      for (const l of data.lessonsByChapter.get(ch.id) ?? []) {
        const needsWork =
          l.status !== 'completed' &&
          (l.transcript?.trim() || l.transcriptSegments.length > 0);
        if (needsWork) targets.push(l);
      }
    }
    if (targets.length === 0) {
      setError('No lessons remaining to summarize.');
      return;
    }
    setBusy('summarizing');
    setProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      await summarizeLessonToCompletion(
        targets[i].id,
        settings.provider,
        settings.preferences,
        { courseTitle: data.course.title },
      );
      setProgress({ done: i + 1, total: targets.length });
    }
    setBusy(null);
    await refresh();
  }

  async function handleExport(format: 'docx' | 'pdf') {
    if (!data || busy) return;
    const readiness = assessExportReadiness(data.course, data.chapters, data.lessonsByChapter);
    if (!readiness.ready) {
      setError(readiness.reason ?? 'Export is locked.');
      return;
    }
    setBusy('export');
    setError(null);
    const model: DocCourse = buildCourseDocument(data.course, data.chapters, data.lessonsByChapter);
    try {
      const blob = format === 'docx'
        ? await exportCourseToDocx(model)
        : await exportCourseToPdf(model);
      const safeTitle = (data.course.title || 'course').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');
      downloadBlob(blob, `${safeTitle}-study-notes.${format}`);
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  if (courses.length === 0) {
    return (
      <div>
        <h2>Course</h2>
        <div className="alert warn">No courses yet. Open a Udemy lesson and capture a transcript to begin.</div>
      </div>
    );
  }

  const readiness = data
    ? assessExportReadiness(data.course, data.chapters, data.lessonsByChapter)
    : { ready: false, reason: '', incompleteLessons: [] as string[] };
  const pct = data && data.course.totalLessons > 0
    ? data.course.completedLessons / data.course.totalLessons
    : 0;

  return (
    <div>
      <h2>Course</h2>

      <div className="card mb">
        <div className="row wrap" style={{ gap: 12 }}>
          <div className="grow">
            <label>Course</label>
            <select value={courseId ?? ''} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>
        {data && (
          <>
            <div className="row mt" style={{ gap: 14 }}>
              <div className="grow">
                <ProgressBar value={pct} />
                <div className="small muted mt">
                  {data.course.completedLessons} / {data.course.totalLessons} lessons completed
                </div>
              </div>
            </div>
            <div className="row mt wrap">
              <button type="button" className="primary" disabled={busy !== null} onClick={handleRemaining}>
                {busy === 'summarizing' ? <span className="spin" /> : 'Summarize Remaining'}
              </button>
              <button
                type="button"
                disabled={!readiness.ready || busy !== null}
                title={readiness.ready ? 'Export DOCX' : readiness.reason}
                onClick={() => handleExport('docx')}
              >
                📄 Export DOCX
              </button>
              <button
                type="button"
                disabled={!readiness.ready || busy !== null}
                title={readiness.ready ? 'Export PDF' : readiness.reason}
                onClick={() => handleExport('pdf')}
              >
                📑 Export PDF
              </button>
            </div>
            <div className="small muted mt">
              {busy === 'summarizing' && progress && `Summarizing: ${progress.done}/${progress.total}`}
              {!readiness.ready && readiness.reason && (
                <div className="alert warn" style={{ margin: '8px 0 0' }}>
                  🔒 Export locked — {readiness.reason}
                </div>
              )}
              {readiness.ready && (
                <div className="alert success" style={{ margin: '8px 0 0' }}>✓ Course ready for export.</div>
              )}
            </div>
          </>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      {data && (
        <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
          {data.chapters.map((ch) => {
            const lessons = data.lessonsByChapter.get(ch.id) ?? [];
            return (
              <div key={ch.id} className="card grow">
                <h3>{ch.title}</h3>
                {lessons.length === 0 && <p className="muted small">No lessons.</p>}
                {lessons.map((l) => (
                  <div key={l.id} className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
                    <div className="title grow">{l.title}</div>
                    <StatusBadge status={l.status} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
