import { captureCurrentLesson, isUdemyLessonPage } from './extractTranscript';
import type { RuntimeMessage } from '@/shared/messages';

/**
 * Content script entry point. Lives on Udemy lesson pages and answers
 * requests from the extension's UI via message passing. It never mutates
 * the Udemy page and never polls aggressively.
 */

const SUPPORTED_ORIGIN = /^https:\/\/(www\.)?udemy\.com\//i;

function respond(message: RuntimeMessage) {
  switch (message.type) {
    case 'PING':
      return { ok: true, data: { alive: true, origin: location.origin } };
    case 'GET_ACTIVE_LESSON':
      if (!isUdemyLessonPage()) {
        return {
          ok: true,
          data: { isUdemyLesson: false, hasTranscript: false, transcriptSegments: [], transcriptText: '' },
        };
      }
      return { ok: true, data: { isUdemyLesson: true, ...captureCurrentLesson() } };
    default:
      return { ok: false, error: 'Unhandled message type in content script.' };
  }
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    if (!SUPPORTED_ORIGIN.test(sender.origin || location.origin)) {
      sendResponse({ ok: false, error: 'Unsupported origin.' });
      return false;
    }
    sendResponse(respond(message));
    return false;
  },
);
