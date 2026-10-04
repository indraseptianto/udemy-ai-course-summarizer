import type { RuntimeMessage, MessageResponse } from '@/shared/messages';

/**
 * Background service worker (MV3). Responsible for:
 *  - routing UI requests to the active tab's content script
 *  - opening the options/full-summarizer page
 * It does not persist course data itself (the UI writes to IndexedDB
 * directly); it only brokers messages and coordinates the active lesson.
 */

const UDEMY_LESSON_RE = /^https:\/\/(www\.)?udemy\.com\/course\/[^/]+\/learn\//i;

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Ask the content script on the active tab for the current lesson. */
async function queryActiveLesson(): Promise<MessageResponse> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return { ok: false, error: 'No active tab found.' };
  }
  if (typeof tab.url !== 'string' || !UDEMY_LESSON_RE.test(tab.url)) {
    return { ok: true, data: { isUdemyLesson: false, hasTranscript: false } };
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_ACTIVE_LESSON' } as RuntimeMessage);
    return { ok: true, data: res };
  } catch {
    // Content script not injected (page loaded before install / not matching).
    return {
      ok: false,
      error: 'Extension content script is not running on this tab. Reload the Udemy tab and try again.',
    };
  }
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'PING':
        return { ok: true, data: { alive: true } };
      case 'GET_ACTIVE_LESSON':
        return await queryActiveLesson();
      case 'OPEN_OPTIONS':
        await chrome.runtime.openOptionsPage();
        return { ok: true };
      case 'OPEN_COURSE_PAGE':
        await chrome.runtime.openOptionsPage();
        return { ok: true, data: { courseId: message.courseId } };
      default:
        return { ok: false, error: 'Unhandled message type.' };
    }
  })()
    .then((data) => sendResponse(data))
    .catch((err) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
  // Keep the message channel open for async handling.
  return true;
});

// Refresh the action badge/title based on the active tab.
chrome.tabs.onActivated.addListener(() => void updateAction());
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.status === 'complete') void updateAction();
});

async function updateAction(): Promise<void> {
  try {
    const tab = await getActiveTab();
    if (!tab?.id || typeof tab.url !== 'string') return;
    const isLesson = UDEMY_LESSON_RE.test(tab.url);
    await chrome.action.setTitle({
      tabId: tab.id,
      title: isLesson
        ? 'Udemy AI Course Summarizer — capture this lesson'
        : 'Open on a Udemy lesson page to capture a transcript',
    });
  } catch {
    /* ignore transient errors */
  }
}
