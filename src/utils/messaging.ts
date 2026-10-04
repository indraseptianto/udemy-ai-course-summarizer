import type { ActiveLessonInfo } from '@/shared/messages';

/** Send a message to the background and get a normalized response. */
export async function sendToBackground<T>(
  message: unknown,
): Promise<{ ok: boolean; error?: string; data?: T }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response as { ok: boolean; error?: string; data?: T });
    });
  });
}

/** Query the active Udemy tab's content script for the current lesson. */
export async function fetchActiveLesson(): Promise<ActiveLessonInfo | null> {
  const res = await sendToBackground<ActiveLessonInfo>({ type: 'GET_ACTIVE_LESSON' });
  if (!res.ok || !res.data) return null;
  return res.data;
}
