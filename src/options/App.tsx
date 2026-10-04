import { useEffect, useState } from 'react';
import '@/styles/app.css';
import { DashboardPage } from '@/pages/DashboardPage';
import { CurrentLessonPage } from '@/pages/CurrentLessonPage';
import { CoursePage } from '@/pages/CoursePage';
import { SettingsPage } from '@/pages/SettingsPage';

type Page = 'dashboard' | 'current' | 'course' | 'settings';

export function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [courseId, setCourseId] = useState<string | null>(null);

  // Support navigation requests from the popup / background.
  useEffect(() => {
    const handler = (message: { type?: string; courseId?: string }) => {
      if (message?.type === 'OPEN_COURSE_PAGE') {
        if (message.courseId) setCourseId(message.courseId);
        setPage('course');
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  function navigate(next: string, cid?: string) {
    if (cid) setCourseId(cid);
    setPage(next as Page);
  }

  return (
    <div className="layout">
      <header className="app-header">
        <h1>Udemy AI Course Summarizer</h1>
        <div>
          <button type="button" className="ghost small" onClick={() => navigate('settings')}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      <nav className="nav mb" style={{ marginBottom: 20 }}>
        {(
          [
            ['dashboard', 'Dashboard'],
            ['current', 'Current Lesson'],
            ['course', 'Course'],
            ['settings', 'Settings'],
          ] as [Page, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`navlink ${page === id ? 'active' : ''}`}
            onClick={() => navigate(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {page === 'current' && <CurrentLessonPage />}
      {page === 'course' && <CoursePage key={courseId ?? 'all'} selectedCourseId={courseId} />}
      {page === 'settings' && <SettingsPage />}
    </div>
  );
}
