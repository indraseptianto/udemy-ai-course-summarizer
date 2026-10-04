import { useEffect, useState } from 'react';
import type { Course } from '@/shared/types';
import { listCourses } from '@/storage/db';
import { loadSettings } from '@/storage/settings';
import { ProgressBar, StatusBadge } from '@/components/Progress';
import type { AppSettings } from '@/shared/types';

export function DashboardPage({ onNavigate }: { onNavigate: (page: string, courseId?: string) => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [current, setCurrent] = useState<Course | null>(null);

  useEffect(() => {
    (async () => {
      const list = await listCourses();
      setCourses(list);
      if (list.length > 0) setCurrent(list[0]);
      setSettings(await loadSettings());
    })();
  }, []);

  const pct = current && current.totalLessons > 0
    ? current.completedLessons / current.totalLessons
    : 0;

  return (
    <div>
      <h2>Dashboard</h2>

      {!current && (
        <div className="card">
          <h3>Get started</h3>
          <p className="muted">
            Open a Udemy lesson, then use <strong>Current Lesson</strong> → <em>Capture Transcript</em>,
            or configure your AI provider in <strong>Settings</strong> first.
          </p>
          <div className="row">
            <button type="button" className="primary" onClick={() => onNavigate('current')}>Go to Current Lesson</button>
            <button type="button" onClick={() => onNavigate('settings')}>Settings</button>
          </div>
        </div>
      )}

      {current && (
        <div className="card mb">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{current.title}</h3>
            <button type="button" className="ghost" onClick={() => onNavigate('course', current.id)}>
              View Course →
            </button>
          </div>
          <div className="mt">
            <ProgressBar value={pct} />
            <div className="small muted mt">
              {current.completedLessons} / {current.totalLessons} lessons •{' '}
              {current.totalLessons - current.completedLessons} remaining
            </div>
          </div>
          <div className="row mt wrap">
            <button type="button" className="primary" onClick={() => onNavigate('current')}>▶ Continue</button>
            <button type="button" onClick={() => onNavigate('course', current.id)}>Course Overview</button>
            <button type="button" onClick={() => onNavigate('settings')}>Settings</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Configuration</h3>
        {settings ? (
          <div className="small">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">AI Provider</span>
              <span>{settings.provider.name || settings.provider.id}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Model</span>
              <span className="mono">{settings.provider.model || '—'}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">API Key</span>
              <span>{settings.provider.apiKey ? '✓ configured' : '⚠ not set'}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Summary style</span>
              <span>{settings.preferences.style}</span>
            </div>
          </div>
        ) : (
          <p className="muted small">Loading…</p>
        )}
      </div>

      {courses.length > 1 && (
        <div className="card mt">
          <h3>All Courses</h3>
          <div className="row wrap">
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                className={c.id === current?.id ? 'primary' : ''}
                onClick={() => { setCurrent(c); onNavigate('course', c.id); }}
              >
                {c.title} · {c.completedLessons}/{c.totalLessons}
              </button>
            ))}
          </div>
        </div>
      )}
      {current && (
        <span style={{ display: 'none' }}><StatusBadge status="completed" /></span>
      )}
    </div>
  );
}
