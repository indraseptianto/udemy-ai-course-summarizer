import { useEffect, useState } from 'react';
import '@/styles/app.css';
import type { ActiveLessonInfo } from '@/shared/messages';
import { fetchActiveLesson } from '@/utils/messaging';

/** Compact toolbar popup: shows the active lesson and launches the full UI. */
export function PopupApp() {
  const [info, setInfo] = useState<ActiveLessonInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const active = await fetchActiveLesson();
    setInfo(active);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  function openSummarizer() {
    void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  }

  return (
    <div style={{ width: 300, padding: 14 }}>
      <h1 style={{ fontSize: 15, margin: '0 0 10px' }}>Udemy AI Course Summarizer</h1>

      {loading ? (
        <p className="muted small">Detecting current tab…</p>
      ) : info?.isUdemyLesson ? (
        <div className="card" style={{ padding: 12 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>{info.courseTitle ?? 'Course'}</div>
          <strong style={{ fontSize: 13 }}>{info.lessonTitle ?? 'Lesson'}</strong>
          <div className="mt">
            <span className={`badge ${info.hasTranscript ? 'captured' : 'pending'}`}>
              {info.hasTranscript ? `Transcript · ${info.transcriptSegments.length} lines` : 'No transcript detected'}
            </span>
          </div>
          {info.hasTranscript && (
            <p className="small muted mt" style={{ marginBottom: 8 }}>
              Transcript found in the transcript panel.
            </p>
          )}
          {!info.hasTranscript && (
            <p className="small muted mt" style={{ marginBottom: 8 }}>
              Open the Udemy transcript panel, then use Capture, or paste manually in the app.
            </p>
          )}
        </div>
      ) : (
        <div className="alert warn" style={{ margin: '6px 0' }}>
          Open a Udemy lesson page (udemy.com/course/…/learn/…) to capture a transcript.
        </div>
      )}

      <div className="row mt" style={{ marginTop: 14 }}>
        <button type="button" className="primary grow" onClick={openSummarizer}>
          Open AI Course Summarizer
        </button>
      </div>
      <button
        type="button"
        className="ghost"
        style={{ width: '100%', marginTop: 6, fontSize: 12 }}
        onClick={() => void refresh()}
      >
        ↻ Refresh
      </button>
    </div>
  );
}
