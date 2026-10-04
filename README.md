# Udemy AI Course Summarizer

A production-ready **Chrome / Brave browser extension** (Manifest V3) that turns Udemy
course transcripts into structured, easy-to-review study notes using an **AI provider you
configure and control**. Every transcript, summary, and API key is stored locally in your
browser — the extension is a fully client-side study assistant.

It does **not** bypass Udemy DRM, auth, paywalls, anti-bot measures, or private APIs. It only
processes the transcript/caption content that is **already visible to the authenticated user**
in the normal Udemy interface (or content the user pastes manually).

---

## Features

- 🎬 **Capture transcripts** from the currently open Udemy lesson (DOM/content extraction — no
  undocumented Udemy APIs) with a **manual paste** fallback.
- 🧹 **Automatic cleaning & normalization**: removes duplicate lines, UI noise, and unnecessary
  timestamps — while **preserving source timestamps internally** for future "jump to section" /
  "show timestamp" features.
- 🧠 **AI study-note generation** with a pedagogical structure: Learning Objectives → Core
  Concepts → Detailed Explanation → Key Terms → Examples → Step-by-Step Process → Code →
  Important Notes → Common Mistakes → Practical Takeaways.
- 🎯 **Source fidelity**: the model is instructed never to invent content; any added clarification
  is explicitly labeled `## Additional Explanation` (not present in transcript).
- 🔗 **Chunking for long transcripts**: content is split by token budget with controlled overlap,
  each chunk summarized, then combined — never truncated.
- 📚 **Course / chapter / lesson hierarchy** with per-lesson status: Not Started, Transcript
  Captured, Processing, Completed, Failed.
- 💾 **Local persistence** via IndexedDB — close the browser and resume later; nothing is lost.
- 🔁 **Retry system**: failed lessons keep their transcript and prior summaries.
- 📤 **Export lock**: DOCX and PDF export stay disabled until *every* lesson is completed with a
  summary and none are processing/failed.
- 📄 **DOCX export** (`docx`) and **PDF export** (`jsPDF`) producing a real study document with
  chapter/lesson hierarchy, headings, lists, numbered steps, and code blocks.
- ⚙️ **Provider-agnostic configuration**: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, and
  any **Custom OpenAI-compatible** endpoint — with model listing and **real "Test Connection"**
  validation (minimal API call, not a blank-field check).
- 🔒 **Secure credential handling**: API keys live only in `chrome.storage.local`, never logged,
  never committed, never sent to a project server.

---

## Architecture

```
src/
├── ai/
│   ├── providers/          # AIProvider abstraction + OpenAI/Anthropic/Gemini/OpenRouter/Groq/Custom
│   │   ├── types.ts        #   AIProvider interface, AIError, HTTP error classification
│   │   ├── openai-compatible.ts
│   │   ├── anthropic.ts
│   │   ├── gemini.ts
│   │   └── index.ts        #   provider factory
│   ├── prompts/
│   │   └── summarizer.ts   # Dedicated prompt module (not embedded in UI components)
│   └── summarizer/
│       ├── chunker.ts      # Token-budget chunking with controlled overlap
│       └── index.ts        # Lesson/chapter summarization orchestration
├── background/
│   └── background.ts       # MV3 service worker: routes UI ⇄ content-script messaging
├── content/
│   ├── content.ts          # Content script (Udemy page) — never mutates the page
│   └── extractTranscript.ts# DOM-based transcript extraction with paste fallback
├── popup/                  # Toolbar popup (compact status + launch)
├── options/                # Full UI app (Dashboard / Current Lesson / Course / Settings)
├── components/             # MarkdownView, StatusBadge, ProgressBar…
├── pages/                  # DashboardPage, CurrentLessonPage, CoursePage, SettingsPage
├── storage/
│   ├── db.ts               # IndexedDB persistence (courses/chapters/lessons)
│   ├── settings.ts         # chrome.storage.local settings + masked API key
│   └── sync.ts             # Course/chapter/lesson sync helpers
├── export/
│   ├── documentModel.ts    # Neutral doc model + export-lock readiness
│   ├── markdown.ts         # Shared markdown → blocks parser
│   ├── docx.ts             # DOCX exporter
│   ├── pdf.ts              # PDF exporter
│   └── index.ts
├── shared/                 # Domain + message-passing contracts
├── utils/                  # transcript cleaner, token estimator, messaging helpers
└── styles/
```

### Message-passing model

```
Content Script (Udemy page)  ⇄  Background Service Worker  ⇄  Extension UI (popup/options)
```

The content script never talks to IndexedDB directly (it runs on Udemy's origin). It extracts
transcript data and returns it over `chrome.runtime` messages. The UI (options page) owns
IndexedDB, AI calls, and export.

### Storage

- **IndexedDB** (`udemy-summarizer`): `courses`, `chapters`, `lessons` — larger course data.
- **`chrome.storage.local`**: settings + provider config (API key included, masked in the UI).
  MongoDB-style entities are avoided; data is normalized (no redundant duplication).

---

## Permissions & privacy

The extension requests the **minimum** permissions:

| Permission | Why |
|---|---|
| `storage` | Save settings/API key (chrome.storage.local) and IndexedDB-backed data |
| `tabs` | Query the active tab to detect a Udemy lesson and message it |
| `host_permissions` (`https://*.udemy.com/*`) | Inject the content script **only** on Udemy — no `<all_urls>` |
| `web_accessible_resources` | Bundle assets for the popup/options pages |

Everything is **client-side**. Full details in [`PRIVACY.md`](./PRIVACY.md).

---

## Installation

### Load the unpacked extension

**Build once:**

```bash
npm install
npm run build
```

The loadable extension is in **`dist/`**.

**Chrome**

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

**Brave**

1. Open `brave://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

---

## Development

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server (HMR for UI components)
npm run build      # production build → dist/  (icons + manifest included)
npm run test       # run the Vitest suite
npm run lint       # ESLint over src/ and tests/
npm run typecheck  # tsc --noEmit
```

> `npm run dev` is best for iterating on the React UI. For full extension behavior (content script
> + background + IndexedDB), rebuild with `npm run build` and reload the unpacked extension.

### Verifying a fresh build

```bash
npm run build && npm run test && npm run lint && npm run typecheck
```

---

## Configuration (AI provider)

Open the extension's **Settings** page:

1. **Provider** — OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, or **Custom** (OpenAI-compatible).
2. **API Endpoint** — auto-populated for the predefined providers; enter your own base URL for Custom
   (e.g. `https://api.example.com/v1`).
3. **API Key** — masked with a **Show** toggle. Stored only in `chrome.storage.local` on your machine.
4. **Model** — type a model name or use **Refresh models** to fetch a current list where the provider
   supports it (OpenAI/Groq/OpenRouter/Gemini).
5. **Test Connection** — performs a real minimal API request and reports:
   - ✓ Connection successful / model accepted
   - ✕ Authentication failed (key rejected)
   - ✕ Model unavailable
   - ⚠ Rate limit / endpoint unavailable / unknown — with useful detail (never the key).

Then configure **Summarization style** (Detailed / Balanced / Concise) and which sections to include.

> Your API key is stored locally in this browser extension and is used to communicate **directly**
> with the selected AI provider. It is never sent to the extension developer.

---

## Supported providers

| Provider | Endpoint (default) | Model listing |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | ✅ |
| Anthropic | `https://api.anthropic.com/v1` | curated list |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | ✅ |
| OpenRouter | `https://openrouter.ai/api/v1` | ✅ |
| Groq | `https://api.groq.com/openai/v1` | ✅ |
| Custom (OpenAI-compatible) | user-defined | ✅ |

All providers implement the same `AIProvider` interface (`validateConnection`, `listModels`,
`generateText`), so adding a provider never requires touching the UI.

---

## How it works (workflow)

1. Open a Udemy lesson → the popup shows detected course/lesson and transcript availability.
2. **Capture Transcript** extracts the visible transcript from the page (selectors for the
   transcript cue). If extraction fails, use **Paste Transcript**.
3. The transcript is cleaned/normalized; source timestamps are preserved internally.
4. **Summarize** chunks (if needed) and calls your provider to generate structured study notes.
5. The summary is saved and can be **edited** before finalizing.
6. All lessons are tracked by status and persisted locally — resume anytime.
7. When every lesson is **Completed**, **Export DOCX** and **Export PDF** unlock.

---

## Export lock

Export buttons remain disabled until:
- every lesson has a non-empty summary,
- no lesson is processing,
- no lesson has failed.

The UI shows a reason ("3 lessons are still incomplete.") or "✓ Course ready for export."

---

## Limitations

- **Transcript availability depends on Udemy's UI.** If Udemy does not render the transcript panel
  (captions disabled/no transcript for the lecture), auto-capture returns nothing and you must **paste
  manually**. We rely on DOM selectors, which may need updating if Udemy changes its markup.
- Model/context limits are handled by chunking, but a provider's own output-cap limit may still cap
  very long summaries.
- AI-generated material is a study aid: keep **source fidelity** in mind and verify critical details.
- CORS: provider requests are made directly from the extension UI/service-worker context; providers
  that block cross-origin calls from extensions will fail the **Test Connection**.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Not on a Udemy lesson page" | Open a URL like `udemy.com/course/…/learn/…`. |
| "Content script is not running" | Reload the Udemy tab after installing the extension. |
| No transcript detected | Open Udemy's transcript panel, then **Capture** again — or **Paste manually**. |
| Test Connection → endpoint error | Check the base URL; ensure the provider allows extension/CORS calls. |
| Test Connection → auth failed | Verify the API key; confirm billing/quota on the provider. |
| Model unavailable | Use **Refresh models** or type an existing model id for your account. |
| Rate limited | Wait and retry; the retry system preserves your transcript. |
| Context-length error | Chunking handles this; if it persists, the provider max-output limit may be low. |
| Export stays locked | Complete every lesson or fix failed lessons before exporting. |

---

## Roadmap

- Show source timestamps and "jump to section" in Udemy for each summary line.
- Chapter-level summary (Mode B) generation button per chapter.
- Optional browser-sync / backup export of course data.
- Streaming progress for long summarizations.
- Additional export formats (Markdown, HTML).

---

## License

MIT — see [`LICENSE`](./LICENSE).
