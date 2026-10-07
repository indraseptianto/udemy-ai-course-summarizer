import { useCallback, useEffect, useState } from 'react';
import type { ActiveLessonInfo } from '@/shared/messages';
import { fetchActiveLesson, openUrlInTab } from '@/utils/messaging';
import type { LessonRef } from '@/storage/sync';
import {
  ensureLessonForCapture,
  setLessonTranscript,
  setLessonSummary,
  markLessonStatus,
} from '@/storage/sync';
import { getLesson, listChapters, listLessons, recomputeCourseProgress } from '@/storage/db';
import { rawToSegments } from '@/utils/transcript';
import { loadSettings } from '@/storage/settings';
import { summarizeLesson } from '@/ai/summarizer';
import { StatusBadge, ProgressBar } from '@/components/Progress';
import { MarkdownView } from '@/components/Markdown';
import type { Chapter, Lesson } from '@/shared/types';

interface OrderedLesson {
  chapter: Chapter;
  lesson: Lesson;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function CurrentLessonPage() {
  const [info, setInfo] = useState<ActiveLessonInfo | null>(null);
  const [ref, setRef] = useState<LessonRef | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState<'detect' | 'capture' | 'summarize' | 'navigate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedRaw, setPastedRaw] = useState('');
  const [draft, setDraft] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null);
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null);

  const reloadLesson = useCallback(async (lessonId: string) => {
    const l = await getLesson(lessonId);
    if (l) setLesson(l);
  }, []);

  /** Build the ordered lesson list for the whole course to find "next". */
  const loadOrdered = useCallback(async (courseId: string, currentLessonId: string) => {
    const chapters = await listChapters(courseId);
    const ordered: OrderedLesson[] = [];
    for (const ch of chapters) {
      const lessons = await listLessons(ch.id);
      for (const l of lessons) ordered.push({ chapter: ch, lesson: l });
    }
    const idx = ordered.findIndex((o) => o.lesson.id === currentLessonId);
    setNextLesson(idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].lesson : null);
  }, []);

  const detect = useCallback(
    async (capture: boolean) => {
      setBusy('detect');
      setError(null);
      const active = await fetchActiveLesson();
      setInfo(active);
      if (active && active.isUdemyLesson && (capture ? true : active.hasTranscript)) {
        const r = await ensureLessonForCapture(active);
        if (r) {
          setRef(r);
          await reloadLesson(r.lesson.id);
          await loadOrdered(r.course.id, r.lesson.id);
          if (capture) setBusy('capture');
        }
      }
      setBusy(null);
    },
    [reloadLesson, loadOrdered],
  );

  useEffect(() => {
    void detect(false);
  }, [detect]);

  async function handlePasteApply() {
    if (!ref) return;
    setError(null);
    const segments = rawToSegments(pastedRaw);
    if (segments.length === 0) {
      setError('Tidak ada baris transkrip terdeteksi. Tempel teks caption (dengan/tanpa timestamp).');
      return;
    }
    const text = segments.map((s) => s.text).join('\n');
    await setLessonTranscript(ref.lesson.id, segments, text);
    await reloadLesson(ref.lesson.id);
    setPasteOpen(false);
    setPastedRaw('');
  }

  async function handleGenerate() {
    if (!ref) return;
    setError(null);
    setChunkProgress(null);
    const settings = await loadSettings();
    if (!settings.provider.apiKey) {
      setError('API key belum diisi. Buka Settings dan konfigurasi provider dulu.');
      return;
    }
    const text = (lesson?.transcript ?? '').trim();
    if (!text) {
      setError('Transkrip masih kosong. Capture atau tempel transkrip dulu.');
      return;
    }
    const chapters = await listChapters(ref.course.id);
    const chapter = chapters.find((c) => c.id === ref.chapter.id);
    setBusy('summarize');
    await markLessonStatus(ref.lesson.id, 'processing');
    try {
      const result = await summarizeLesson(text, {
        provider: settings.provider,
        preferences: settings.preferences,
        lessonTitle: ref.lesson.title,
        chapterTitle: chapter?.title,
        courseTitle: ref.course.title,
        onChunk: (done, total) => setChunkProgress({ done, total }),
      });
      setDraft(result.text);
      setShowDraft(true);
      setEditMode(false);
      await markLessonStatus(ref.lesson.id, 'transcript_captured');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markLessonStatus(ref.lesson.id, 'failed', message);
      setError(`Gagal generate ringkasan: ${message}`);
    } finally {
      setBusy(null);
    }
    await reloadLesson(ref.lesson.id);
    await recomputeCourseProgress(ref.course.id);
  }

  async function handleSave() {
    if (!ref || !draft.trim()) return;
    setError(null);
    await setLessonSummary(ref.lesson.id, draft, 'completed');
    await recomputeCourseProgress(ref.course.id);
    setShowDraft(false);
    await reloadLesson(ref.lesson.id);
  }

  async function handleNext() {
    if (!nextLesson?.url) return;
    setError(null);
    setBusy('navigate');
    await openUrlInTab(nextLesson.url);
    // Wait for the tab to land on the next lesson, polling until detected.
    const target = nextLesson.url;
    for (let i = 0; i < 14; i++) {
      await sleep(1200);
      const active = await fetchActiveLesson();
      if (active?.url === target) {
        const r = await ensureLessonForCapture(active);
        if (r) {
          setRef(r);
          await reloadLesson(r.lesson.id);
          await loadOrdered(r.course.id, r.lesson.id);
        }
        break;
      }
    }
    setBusy(null);
  }

  const lessonTitle = lesson?.title || info?.lessonTitle || 'Materi saat ini';
  const courseTitle = ref?.course.title || info?.courseTitle || 'Kursus';

  return (
    <div>
      <div className="card lesson-hero">
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="small muted">{courseTitle}</div>
            <h2 style={{ margin: '4px 0 0' }}>{lessonTitle}</h2>
          </div>
          {lesson && <StatusBadge status={lesson.status} />}
        </div>

        {busy === 'detect' && <p className="muted small mt">Mendeteksi transkrip Udemy…</p>}

        {error && <div className="alert error mt">{error}</div>}

        <div className="row mt wrap" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="primary"
            disabled={busy !== null}
            onClick={() => void detect(true)}
            title="Ambil transkrip dari materi yang sedang dibuka"
          >
            🎬 Capture Transkrip
          </button>
          <button type="button" disabled={busy !== null} onClick={() => { setPasteOpen((v) => !v); setError(null); }}>
            ⌨️ Tempel Transkrip
          </button>
          <button
            type="button"
            className="success"
            disabled={busy !== null || !lesson?.transcript?.trim()}
            onClick={handleGenerate}
            title="Buat ringkasan belajar (bahasa Indonesia)"
          >
            {busy === 'summarize' ? <span className="spin" /> : '✨ Generate Ringkasan (ID)'}
          </button>
          {showDraft && (
            <button
              type="button"
              className="primary"
              disabled={busy !== null || !draft.trim()}
              onClick={handleSave}
            >
              💾 Simpan
            </button>
          )}
          {lesson?.status === 'failed' && (
            <button type="button" disabled={busy !== null} onClick={handleGenerate}>
              ⟳ Coba Lagi
            </button>
          )}
          <button
            type="button"
            className="ghost next-materi"
            disabled={busy !== null || !nextLesson?.url}
            onClick={handleNext}
            title={nextLesson ? `Lanjut ke: ${nextLesson.title}` : 'Tidak ada materi berikutnya di kursus ini'}
          >
            {busy === 'navigate' ? <span className="spin" /> : 'Next Materi →'}
          </button>
        </div>

        {busy === 'navigate' && (
          <p className="muted small mt">
            Membuka materi berikutnya… <em>{nextLesson?.title}</em>
          </p>
        )}

        {!info?.isUdemyLesson && (
          <div className="alert warn mt">
            Belum ada materi Udemy yang terbuka. Buka satu lesson (URL{' '}
            <span className="mono">udemy.com/course/…/learn/…</span>) atau tempel transkrip manual.
          </div>
        )}
      </div>

      {pasteOpen && (
        <div className="card mb">
          <h3>Tempel Transkrip Manual</h3>
          <textarea
            rows={7}
            placeholder={'[00:01] Welcome to the course.\n[00:04] Today we learn about APIs.'}
            value={pastedRaw}
            onChange={(e) => setPastedRaw(e.target.value)}
          />
          <div className="row mt">
            <button type="button" className="primary" onClick={handlePasteApply} disabled={!pastedRaw.trim()}>
              Terapkan Transkrip
            </button>
            <button type="button" className="ghost" onClick={() => setPasteOpen(false)}>
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="row lesson-cols">
        <div className="card grow">
          <h3>
            Transkrip Asli {lesson?.transcriptSegments?.length ? `(${lesson.transcriptSegments.length} baris)` : ''}
          </h3>
          {lesson?.transcript ? (
            <pre className="transcript-box">{lesson.transcript}</pre>
          ) : (
            <p className="muted">Belum ada transkrip. Tekan Capture atau Tempel.</p>
          )}
          {lesson?.transcript && (
            <button
              className="copy-btn"
              onClick={() => void navigator.clipboard?.writeText(lesson?.transcript ?? '')}
            >
              Salin transkrip
            </button>
          )}
        </div>

        <div className="card grow">
          <h3>Ringkasan AI</h3>
          {chunkProgress && (
            <div className="mb">
              <div className="small muted mb">Meringkas bagian {chunkProgress.done}/{chunkProgress.total}…</div>
              <ProgressBar value={chunkProgress.done / chunkProgress.total} />
            </div>
          )}

          {showDraft ? (
            <div className="draft-area">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small muted">Klik <strong>Simpan</strong> untuk menyimpan hasil.</span>
                <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={editMode}
                    onChange={(e) => setEditMode(e.target.checked)}
                  />
                  Mode edit
                </label>
              </div>
              {editMode ? (
                <textarea rows={14} className="summary-edit" value={draft} onChange={(e) => setDraft(e.target.value)} />
              ) : (
                <div className="summary-preview">
                  <MarkdownView markdown={draft} />
                </div>
              )}
            </div>
          ) : lesson?.summary ? (
            <div className="draft-area">
              <MarkdownView markdown={lesson.summary} />
              <button
                className="copy-btn mt"
                onClick={() => void navigator.clipboard?.writeText(lesson?.summary ?? '')}
              >
                Salin ringkasan
              </button>
            </div>
          ) : (
            <p className="muted">
              Belum ada ringkasan. Tekan <strong>Generate Ringkasan</strong> untuk membuat catatan belajar
              berbahasa Indonesia.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
