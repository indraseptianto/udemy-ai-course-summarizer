import { useCallback, useEffect, useState } from 'react';
import type { ActiveLessonInfo } from '@/shared/messages';
import { fetchActiveLesson } from '@/utils/messaging';
import type { LessonRef } from '@/storage/sync';
import {
  ensureLessonForCapture,
  setLessonTranscript,
  setLessonSummary,
} from '@/storage/sync';
import { getLesson, listChapters } from '@/storage/db';
import { rawToSegments } from '@/utils/transcript';
import { loadSettings } from '@/storage/settings';
import { summarizeLessonToCompletion } from '@/utils/summarizeHelpers';
import { StatusBadge, ProgressBar } from '@/components/Progress';
import { MarkdownView } from '@/components/Markdown';
import type { Lesson } from '@/shared/types';

export function CurrentLessonPage() {
  const [info, setInfo] = useState<ActiveLessonInfo | null>(null);
  const [ref, setRef] = useState<LessonRef | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState<'detect' | 'capture' | 'summarize' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedRaw, setPastedRaw] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null);

  const reloadLesson = useCallback(async (lessonId: string) => {
    const l = await getLesson(lessonId);
    if (l) setLesson(l);
  }, []);

  const detect = useCallback(async (capture: boolean) => {
    setBusy('detect');
    setError(null);
    const active = await fetchActiveLesson();
    setInfo(active);
    if (active && active.isUdemyLesson && (capture ? true : active.hasTranscript)) {
      const r = await ensureLessonForCapture(active);
      if (r) {
        setRef(r);
        await reloadLesson(r.lesson.id);
        if (capture) setBusy('capture');
      }
    }
    setBusy(null);
  }, [reloadLesson]);

  useEffect(() => {
    void detect(false);
  }, [detect]);

  async function handlePasteApply() {
    if (!ref) return;
    setError(null);
    const segments = rawToSegments(pastedRaw);
    if (segments.length === 0) {
      setError('No transcript lines detected. Paste caption text (with or without timestamps).');
      return;
    }
    const text = segments.map((s) => s.text).join('\n');
    await setLessonTranscript(ref.lesson.id, segments, text);
    await reloadLesson(ref.lesson.id);
    setPasteOpen(false);
    setPastedRaw('');
  }

  async function handleSummarize() {
    if (!ref) return;
    setError(null);
    setChunkProgress(null);
    const settings = await loadSettings();
    if (!settings.provider.apiKey) {
      setError('No API key configured. Open Settings and configure a provider first.');
      return;
    }
    const chapters = await listChapters(ref.course.id);
    const chapter = chapters.find((c) => c.id === ref.chapter.id);
    setBusy('summarize');
    const res = await summarizeLessonToCompletion(
      ref.lesson.id,
      settings.provider,
      settings.preferences,
      { chapterTitle: chapter?.title, courseTitle: ref.course.title },
      (done, total) => setChunkProgress({ done, total }),
    );
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? 'Summarization failed.');
    } else {
      setDraft(res.summary ?? '');
    }
    await reloadLesson(ref.lesson.id);
  }

  async function handleSaveEdits() {
    if (!ref) return;
    await setLessonSummary(ref.lesson.id, draft, 'completed');
    setEditOpen(false);
    await reloadLesson(ref.lesson.id);
  }

  const lessonTitle = lesson?.title || info?.lessonTitle || 'Current Lesson';
  const courseTitle = ref?.course.title || info?.courseTitle || 'Course';

  return (
    <div>
      <h2>Current Lesson</h2>

      <div className="card mb">
        <div className="row">
          <div className="grow">
            <div className="small muted">{courseTitle}</div>
            <strong>{lessonTitle}</strong>
          </div>
          {lesson && <StatusBadge status={lesson.status} />}
        </div>

        {busy === 'detect' && <p className="muted small mt">Detecting Udemy transcript…</p>}

        {error && <div className="alert error mt">{error}</div>}

        <div className="row mt wrap">
          <button type="button" className="primary" disabled={busy !== null} onClick={() => void detect(true)}>
            🎬 Capture Transcript
          </button>
          <button type="button" disabled={busy !== null} onClick={() => { setPasteOpen((v) => !v); setError(null); }}>
            ⌨️ Paste Transcript
          </button>
          {lesson && lesson.status !== 'completed' && (
            <button
              type="button"
              className="success"
              disabled={busy !== null || !lesson.transcript?.trim()}
              onClick={handleSummarize}
            >
              {busy === 'summarize' ? <span className="spin" /> : '✨ Summarize'}
            </button>
          )}
          {lesson?.status === 'failed' && (
            <button type="button" disabled={busy !== null} onClick={handleSummarize}>
              ⟳ Retry
            </button>
          )}
          {lesson?.summary && (
            <button type="button" disabled={busy !== null} onClick={() => { setDraft(lesson.summary ?? ''); setEditOpen((v) => !v); }}>
              ✏️ Edit Summary
            </button>
          )}
        </div>

        {!info?.isUdemyLesson && (
          <div className="alert warn mt">
            Not on a Udemy lesson page right now. Open a lesson (a URL like
            <span className="mono"> udemy.com/course/…/learn/…</span>) or paste a transcript manually.
          </div>
        )}
      </div>

      {pasteOpen && (
        <div className="card mb">
          <h3>Paste Transcript Manually</h3>
          <textarea
            rows={8}
            placeholder={'[00:01] Welcome to the course.\n[00:04] Today we learn about APIs.'}
            value={pastedRaw}
            onChange={(e) => setPastedRaw(e.target.value)}
          />
          <div className="row mt">
            <button type="button" className="primary" onClick={handlePasteApply} disabled={!pastedRaw.trim()}>
              Apply Transcript
            </button>
            <button type="button" className="ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="row mb wrap" style={{ gap: 8 }}>
        <div className="card grow">
          <h3>Original Transcript {lesson?.transcriptSegments?.length ? `(${lesson.transcriptSegments.length} lines)` : ''}</h3>
          {lesson?.transcript ? (
            <pre style={{ maxHeight: 260, overflow: 'auto' }}>{lesson.transcript}</pre>
          ) : (
            <p className="muted">No transcript captured yet.</p>
          )}
        </div>
        <div className="card grow">
          <h3>AI Summary</h3>
          {chunkProgress && (
            <div className="mb">
              <div className="small muted mb">Summarizing chunk {chunkProgress.done}/{chunkProgress.total}…</div>
              <ProgressBar value={chunkProgress.done / chunkProgress.total} />
            </div>
          )}
          {editOpen ? (
            <>
              <textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="row mt">
                <button type="button" className="success" onClick={handleSaveEdits} disabled={!draft.trim()}>
                  Save Edits
                </button>
                <button type="button" className="ghost" onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : lesson?.summary ? (
            <>
              <MarkdownView markdown={lesson.summary} />
              <button
                className="copy-btn"
                onClick={() => { void navigator.clipboard?.writeText(lesson.summary ?? ''); }}
              >
                Copy summary
              </button>
            </>
          ) : (
            <p className="muted">No summary yet. Capture a transcript and press Summarize.</p>
          )}
        </div>
      </div>
    </div>
  );
}
