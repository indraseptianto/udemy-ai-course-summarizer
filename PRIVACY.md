# Privacy Policy — Udemy AI Course Summarizer

This extension is designed so that **your data stays on your device** and goes only where you
explicitly direct it.

## What data is collected?

- **Nothing is collected by the extension developer.** There is no analytics, no telemetry, no
  beacon, and no project-owned backend.
- The extension processes the transcript of the **currently open Udemy lesson** (or text you paste
  manually). This is done entirely in your browser.

## Where does data go?

- **Transcripts** are sent from your browser directly to the **AI provider you configure**
  (OpenAI, Anthropic, Gemini, OpenRouter, Groq, or a custom endpoint), only when you press
  **Summarize**. They are not sent anywhere else.
- **API keys** are stored locally with `chrome.storage.local` and are used only to call your
  chosen provider. They are **never** sent to, or readable by, the extension developer, and they are
  **never** included in logs, analytics, or any external request other than the provider call.
- **Course data, transcripts, and summaries** are stored locally in **IndexedDB** within your
  browser profile and never leave your device except for the provider summarization call you trigger.

## What is NOT done

- ❌ No bypassing of Udemy DRM, authentication, paywalls, anti-bot protections, or private APIs.
- ❌ No uploading of course data to a project-owned server.
- ❌ No "Test Connection" that leaks your key — validation returns only success/error classification
  and never echoes the key.

## Journey of your data

1. You capture/paste a transcript → stored locally.
2. You press Summarize → the transcript is chunked locally and sent to **your** AI provider.
3. The summary returns and is stored locally (editable by you).
4. You export to DOCX/PDF → generated locally and downloaded to your machine.

## Your controls

- You can clear your API key anytime from Settings.
- Removing the extension removes its locally stored data.
- Because the key is yours and calls go directly to your provider, usage is governed by that
  provider's terms — all under your own account and billing.

*Last updated: 2026.*
