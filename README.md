# sherpa-kenbot

A small animated cartoon Ken (~160px tall) who floats in the corner of a web app,
answers help questions through *your* AI backend, and speaks his answers aloud in
Ken's cloned ElevenLabs voice with live lip sync. 100% code-drawn SVG — no image
files, no Tailwind dependency, drops into any React 19 app.

He breathes, blinks, glances around, occasionally strolls along the bottom of the
screen, waves hello, leans in to listen, puts his hand to his chin while thinking,
and his mouth moves to the actual loudness of his voice.

## Install

```bash
npm install github:klill6506/sherpa-kenbot
```

Peer dependencies: `react` and `react-dom` (v19). Everything else comes along
automatically. The package builds itself on install (the `prepare` script), so
the first install takes a few extra seconds.

## Quick start (Vite / React / Tailwind host)

```tsx
// App.tsx (or any layout component that's always mounted)
import { KenBot } from 'sherpa-kenbot';
import 'sherpa-kenbot/styles.css';

export function App() {
  return (
    <>
      {/* ...your app... */}
      <KenBot
        askEndpoint="/api/help/"        // your AI backend (see Backend below)
        ttsEndpoint="/api/kenbot/tts/"  // your voice proxy (see Voice below)
      />
    </>
  );
}
```

That's the whole integration. The CSS is plain, prefixed `kb-`, and coexists
fine with Tailwind v4 — no config anywhere.

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `onAsk` | — | Backend option A: `(message, history) => Promise<string> \| AsyncIterable<string>` |
| `askEndpoint` | — | Backend option B: URL; receives `POST {message, history}`, may stream text |
| `ttsEndpoint` | — | Voice proxy URL; receives `POST {text}` per sentence, returns audio. Omit = text-only |
| `ttsHeaders` | — | Extra headers for TTS requests (e.g. `{'X-CSRFToken': ...}` for Django session auth) |
| `voices` | — | `[{id, label}]` — two or more puts a voice picker in the chat header |
| `voice` | first in `voices` | Which voice to start with |
| `voiceInput` | `true` | Show the 🎤 button so users can *speak* their question (Chrome/Edge) |
| `voiceInputLang` | `"en-US"` | Language the microphone listens for (BCP-47) |
| `name` | `"Ken"` | Chat header name |
| `greeting` | a friendly hello | First message in the bubble |
| `position` | `"bottom-right"` | `bottom-right` / `bottom-left` / `top-right` / `top-left` |
| `sizeScale` | `1` | 1 = 160px tall |
| `zIndex` | `9999` | Stacking order |
| `colors` | blue-ish | `{ primary, accent }` for the chat UI |
| `appearance` | Ken's look | Override colors/hair/glasses/pocket protector |
| `autoGreet` | `true` | Wave on mount |
| `wander` | `true` | Occasionally stroll along the screen edge while idle |
| `wanderRange` | `150` | Max stroll distance, px |
| `onStateChange` | — | Observe his animation state |
| `ref` | — | `KenBotHandle` imperative controls (below) |

### Imperative controls

```tsx
import { useRef } from 'react';
import { KenBot, type KenBotHandle } from 'sherpa-kenbot';

const bot = useRef<KenBotHandle>(null);
// ...
<KenBot ref={bot} ... />
// when the user finishes something worth cheering:
bot.current?.celebrate();
// to direct attention at UI on either side of the screen:
bot.current?.pointLeft();
bot.current?.pointRight();
```

## Backend (the brains)

This package never talks to an AI service and never holds API keys. Wire in the
host app's existing help backend either way:

**Option A — a function** (full control, streaming optional):

```tsx
async function* askMyBackend(message: string, history: KenBotMessage[]) {
  const res = await fetch('/api/help/', { /* your auth, your shape */ });
  // yield chunks as they arrive, or just return a whole string
}
<KenBot onAsk={askMyBackend} />
```

**Option B — a URL.** KenBot POSTs `{ message, history }` as JSON and renders
the text response as it streams. A Django `StreamingHttpResponse` of plain text
works as-is.

History is the session's prior messages (`{role, content}` objects). Errors are
never shown raw — he apologizes and asks the user to try again.

## Voice (security-critical)

The ElevenLabs API key lives ONLY on the host backend. KenBot sends each
sentence of an answer to `ttsEndpoint` (`POST {text}`) the moment the sentence
finishes streaming, and plays the clips in order — so speech starts fast.
The mouth is driven by the real audio loudness via the Web Audio API.

**Django wiring:** copy [`server-examples/django/kenbot_tts/`](server-examples/django/kenbot_tts/)
into the host project, set `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` in the
environment, include the urls, and pass `ttsEndpoint="/api/kenbot/tts/"`.
Full steps in [`server-examples/README.md`](server-examples/README.md).

Degradation is silent by design: no `ttsEndpoint`, muted (the bubble's 🔊
toggle, persisted in localStorage), failed requests, or blocked audio — he
just shows text and mimes along. Captions are always on.

### Choosing a voice

Hand him a menu and a picker appears in the chat header; the choice is
remembered across sessions:

```tsx
<KenBot
  ttsEndpoint="/api/kenbot/tts/"
  voices={[
    { id: 'Z9CSFTsEQ3J3DsnfCkiX', label: 'Ken' },
    { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Narrator' },
  ]}
/>
```

The chosen id rides along with each sentence (`POST {text, voice}`), and the
host's proxy decides what it means. **That proxy must allowlist the ids it
accepts** — `voice` comes from the browser, so an unchecked id lets anyone
spend the account's credits on any voice in the library. The Django example
does this with a `KENBOT_VOICES` dict, which doubles as the menu that
`GET /api/kenbot/voices/` serves.

Switching voices stops him mid-answer rather than finishing it half in one
voice and half in another. Without a `voices` list, nothing changes: no
picker, no `voice` in the request, and the server uses its own default.

## Talking to him (microphone)

The bubble has a 🎤 button: click it, ask your question out loud, and it sends
itself as soon as you stop talking. Live text appears in the input while you
speak, so you can see what he heard. Clicking the mic also cuts off whatever
he was saying, so you can interrupt him.

This uses the **browser's own** `SpeechRecognition` engine — no API key, no
cost, and nothing to add to the host backend. Two things to know:

- **Chrome and Edge only.** Firefox has no engine; the button simply doesn't
  render there and typing works as always. Same if permission is denied.
- **Chrome recognizes speech in Google's cloud**, so dictated audio leaves the
  machine. Fine for "how do I add a client?"; pass `voiceInput={false}` on any
  screen where users might speak confidential details.

## Accessibility

- The character is a real `<button>`; the bubble is a `role="dialog"`.
- `prefers-reduced-motion`: blinks stay, the wave/bounce/wander theatrics stop,
  and pose changes still happen (a pointing arm carries meaning).

## Developing this package

```bash
git clone https://github.com/klill6506/sherpa-kenbot
cd sherpa-kenbot
npm run setup      # installs root + demo deps (two installs — no workspace
                   # symlinks, so it works on network drives)
npm run dev        # playground on http://localhost:5173
npm test           # state machine, backend streaming, sentence splitter
npm run mock-tts   # offline fake voice (robot babble) on :8787/tts
npm run real-tts   # real ElevenLabs voice on :8788/tts — needs .env
                   # (copy .env.example, add your API key)
```

The playground has live controls for his look, buttons for every animation
state, and a TTS endpoint box for voice testing. See [CLAUDE.md](CLAUDE.md)
for architecture notes.
