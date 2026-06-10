# Integrating KenBot into a host app — instructions for Claude Code

You are working in one of Ken's host apps (Vite + React 19 + TypeScript +
Tailwind v4 frontend, Django 5.2 + DRF backend, deployed on Ken's own domain).
Your job: add KenBot — Ken's animated, talking help character — to this app.

Work in two stages and STOP for Ken's review after each:
**Stage 1 = chat working (text-only). Stage 2 = voice.**

## What KenBot is

A floating cartoon Ken (package `sherpa-kenbot`, repo
https://github.com/klill6506/sherpa-kenbot) who sits in a corner, opens a chat
bubble when clicked, answers questions through THIS app's AI backend, and
speaks answers in Ken's cloned ElevenLabs voice with lip sync. The package
holds no API keys and talks to no AI service itself — wiring those is your job
here. Read the package README for the full prop list.

## Pre-flight checks (do these first)

1. `react` and `react-dom` must be **v19** in this app. If not, STOP and tell Ken.
2. Find this app's existing AI help backend (look for chat/help/assistant
   endpoints in the Django urls). If the app has NONE, STOP and ask Ken what
   should answer KenBot's questions here.
3. Note how the frontend authenticates to the API (session+CSRF? token?).
   Look at how the app's existing fetch calls attach credentials.

## Stage 1 — install + chat (text-only)

1. `npm install github:klill6506/sherpa-kenbot`
   (the package builds itself on install; takes a few extra seconds)

2. Mount him ONCE, in a component that stays mounted wherever Ken wants help
   available. Default to the app's root layout unless Ken said "help screen
   only". Never render two KenBots at once.

   ```tsx
   import { KenBot } from 'sherpa-kenbot';
   import 'sherpa-kenbot/styles.css';

   <KenBot
     name="Ken"
     greeting="Hi! I'm Ken. Ask me anything about <this app>."
     onAsk={askHelpBackend}
   />
   ```

3. Wire `onAsk` to the app's existing help backend. PREFER `onAsk` (a
   function) over the `askEndpoint` prop, because the app's own fetch
   utilities already handle auth headers/CSRF correctly:

   ```tsx
   import type { KenBotMessage } from 'sherpa-kenbot';

   // Shape A: backend returns a whole answer
   async function askHelpBackend(message: string, history: KenBotMessage[]) {
     const res = await apiFetch('/api/assistant/', {   // ← this app's util
       method: 'POST',
       body: JSON.stringify({ message, history }),
     });
     const data = await res.json();
     return data.answer;                               // ← adapt to its shape
   }

   // Shape B: backend streams text — yield chunks instead
   async function* askHelpBackend(message: string, history: KenBotMessage[]) {
     const res = await apiFetch('/api/assistant/', { ... });
     const reader = res.body.getReader();
     const dec = new TextDecoder();
     while (true) {
       const { done, value } = await reader.read();
       if (done) break;
       yield dec.decode(value, { stream: true });
     }
   }
   ```

   `history` is the session's prior `{role, content}` messages — pass it to
   the backend if it supports conversation context, otherwise drop it.

4. Verify in the browser: click him → bubble opens → ask a question → typing
   dots while waiting → answer streams/appears → he does the talking
   animation. Backend failures must show his polite fallback text, never a
   raw error.

5. **STOP. Show Ken. Get approval before Stage 2.**

## Stage 2 — voice (ElevenLabs via Django proxy)

1. Copy the reference proxy from the sherpa-kenbot repo,
   `server-examples/django/kenbot_tts/` (views.py + urls.py), into this
   Django project as an app (or merge the view into an existing api app).
   Adjust `permission_classes` to match THIS app's auth. Keep the throttle.

2. Settings (env-driven, matching the repo's `.env.example`):

   ```python
   ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
   ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "")
   ```

   Tell Ken to set both on the production server (his domain host) AND in
   local dev env. Voice ID: `Z9CSFTsEQ3J3DsnfCkiX`. The key NEVER goes in
   frontend code, git, or a Vite env var (VITE_* vars are public!).
   `pip install requests` if absent.

3. URLs: `path("api/kenbot/", include("kenbot_tts.urls"))` → endpoint is
   `/api/kenbot/tts/`.

4. Frontend — add the voice props:

   ```tsx
   <KenBot
     ...
     ttsEndpoint="/api/kenbot/tts/"
     // Django session auth needs the CSRF token on POSTs:
     ttsHeaders={{ 'X-CSRFToken': getCsrfCookie() }}   // however this app reads it
   />
   ```

   If the app uses token/JWT auth instead, put its Authorization header in
   `ttsHeaders` and relax/keep the view's permissions accordingly.

5. Verify: ask a question with sound on — Ken's real voice, mouth synced,
   speech starting after the first sentence. Then verify graceful failure:
   temporarily break the endpoint URL and confirm he silently falls back to
   text-only (no user-visible error). Check the 🔊 toggle mutes him.

6. **STOP. Show Ken.**

## Gotchas (learned the hard way — don't rediscover these)

- **Audio needs a user gesture.** Already handled inside the package (the
  click/submit unlock the AudioContext) — but it means you cannot autoplay a
  spoken greeting before the user has clicked anything. Don't try.
- **Captions are always on by design.** The mute toggle (persisted in
  localStorage `kenbot-muted`) only kills audio. Don't hide the text.
- **Same-origin matters.** If this app serves its API on a different
  subdomain than the frontend, CORS must allow the POSTs (and credentials),
  and `connect-src` in any CSP must include it. Same-origin = zero config.
- **He wanders by default.** Pass `wander={false}` if Ken wants him pinned
  (e.g. if he overlaps important UI when strolling).
- **One KenBot per page.** Mounting in both a layout and a page = two Kens.
- **Tailwind v4 coexists fine** — package CSS is plain, `kb-`-prefixed.
  No Tailwind config changes of any kind.

## Optional nice-to-haves (offer to Ken, don't do unprompted)

- `bot.current?.celebrate()` (via `ref={bot}`, type `KenBotHandle`) on the
  app's success moments — finished filing, report exported, etc.
- `pointLeft()` / `pointRight()` to direct attention during onboarding.
- `colors={{ primary: <app brand color> }}` to match the chat UI to the app.
- `appearance` overrides if this app's Ken should dress differently.

## Done means

Chat answers come from THIS app's backend, voice comes from Ken's proxy with
the key server-side only, failures degrade silently to text, and Ken has
approved both stages in the browser.
