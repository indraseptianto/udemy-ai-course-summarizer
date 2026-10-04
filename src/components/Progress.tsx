import type { LessonStatus } from '@/shared/types';

const LABELS: Record<LessonStatus, string> = {
  not_started: 'Not Started',
  transcript_captured: 'Transcript',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

export function StatusBadge({ status }: { status: LessonStatus }) {
  return <span className={`badge ${status}`}>{LABELS[status] ?? status}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="row" style={{ gap: 12 }}>
      <div className="progress-track grow" style={{ height: 12 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="small mono">{pct}%</span>
    </div>
  );
}
