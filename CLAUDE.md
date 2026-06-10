# sherpa-kenbot

A reusable React component package: a small (~160px tall) animated cartoon helper —
"KenBot" — who floats in the corner of Ken's web apps, answers help questions through a
pluggable AI backend, and speaks answers aloud in Ken's cloned ElevenLabs voice with lip
sync. Installed across multiple host apps via `npm install github:<account>/sherpa-kenbot`.

## Who Ken is

Ken is a CPA learning to code. Keep code readable; comment the non-obvious parts
(state machine, audio analyser, timers) generously. Explain decisions in plain English.

## Stack & conventions

- Vite **library mode**, React 19, TypeScript **strict** — `any` is banned.
- Peer deps: `react`, `react-dom` only. `motion` (Framer Motion) is a regular dependency.
- Styling: plain CSS bundled with the package, every class prefixed `kb-`.
  **No Tailwind dependency** — must drop into any host app.
- Character is 100% code-drawn SVG in layered groups (body, head, hair, glasses,
  eyes, eyebrows, mouth with 0–1 openness, left/right arms). No image files.
- npm workspaces: root = the library, `demo/` = the playground app.
  `npm run dev` at the root launches the demo. The demo aliases `sherpa-kenbot` → `../src`
  so library edits hot-reload without a build step.
- Respect `prefers-reduced-motion`: keep blinks, drop bounce/gestures.
- Unit tests (vitest): state machine + TTS sentence queue, once those exist.

## Architecture (current)

- `src/state/stateMachine.ts` — PURE state machine (no React, no timers):
  8 states, `reduce(current, event)`. Timed states (greet/celebrate/point-*)
  auto-return to idle; stale timers are ignored. Unit-tested.
- `src/hooks/useKenBotState.ts` — React plumbing around the machine: holds the
  live state, schedules/cancels timed-state timers. Also `useFakeTalk` (random
  cartoon lip-flap for the talking state until Phase 4's real audio).
- `src/character/Character.tsx` — pure presentational SVG. Takes `appearance`
  (colors/hair/glasses) + `pose` (mouthOpen, eyesOpen, browLift, pupilOffset)
  + `state`. Two-joint arms (shoulder + elbow groups). Gross motion is plain
  CSS: static per-state joint angles inline (tweened by CSS transitions) plus
  keyframe animations in kenbot.css (wave/bounce/waggle) keyed off
  `kb-state-*` classes. Uses `useId` for SVG def ids so two KenBots on one
  page don't collide.
  **IMPORTANT LESSON**: do NOT rotate SVG joints with the motion library — it
  manages transform-origin itself (bounding-box relative) and every joint
  spins around the wrong point. Plain CSS + `transform-box: view-box` pivots
  exactly at viewBox coordinates. Motion is only used for the HTML-level
  breathing bob in KenBot.tsx.
- `src/character/appearance.ts` — `CharacterAppearance` type, Ken's default look,
  and `shade()` for deriving shadow/blush tones from base colors.
- `src/hooks/useIdleLife.ts` — blink + glance timers (self-rescheduling random
  setTimeout chains).
- `src/hooks/useWander.ts` — the wander brain (Ken requested "can he walk
  about"): while idle, every 6–16s he strolls up to `wanderRange` px along the
  screen edge at 50px/s (translateX transition on .kb-root), state `walking`
  during travel, then back to idle; usually heads home next trip. Interruptions
  glide him home fast. `wander` prop defaults ON; disabled under reduced motion.
  `walking` is a persistent (not timed) state — the hook owns its duration.
  The leg/arm/bob walk cycle is CSS keyframes keyed off kb-state-walking.
- `src/chat/backend.ts` — pluggable backend layer. `AskFunction` =
  `(message, history) → Promise<string> | AsyncIterable<string>`;
  `createEndpointAsk(url)` POSTs `{message, history}` and streams the body;
  `toStream` normalizes every allowed shape into chunk streams. Unit-tested
  (including a stubbed-fetch streaming test).
- `src/chat/useChat.ts` — conversation state: session-only history, send flow,
  status (`idle → thinking → streaming → idle`). Streamed chunks grow the last
  assistant message in place. Errors become a friendly assistant reply — raw
  errors never reach the end user.
- `src/chat/ChatPanel.tsx` — the speech bubble (~320px, anchored above him,
  tail pointing at him; flips below for top corners). Header = name + mute +
  close; typing dots while thinking; auto-scroll; themed via --kb-primary /
  --kb-accent from the `colors` prop.
- `src/voice/sentences.ts` — incremental sentence splitter for streamed answers
  (emit each sentence the moment it completes → speech starts after sentence 1,
  not after the whole answer). Force-splits punctuation-less run-ons at ~280
  chars. Unit-tested (decimals safe, word-boundary force splits, flush).
- `src/voice/useSpeech.ts` — the voice engine. Per sentence: POST {text} to
  `ttsEndpoint` → decode → play via Web Audio. Fetches run in PARALLEL, clips
  play IN ORDER. An AnalyserNode measures RMS loudness per animation frame →
  mouthOpen (noise gate + fast-attack/slow-release smoothing). A `generation`
  counter invalidates stale loops on stop(). Graceful: no endpoint / muted /
  2 consecutive failures / blocked AudioContext = silent text-only, never an
  error. AUTOPLAY: browsers need a user gesture before audio — `unlock()` is
  called from the trigger click and chat submit handlers.
- `demo/mock-tts-server.mjs` — `npm run mock-tts` → http://localhost:8787/tts
  speaks robotic babble (WAV, syllable-pulsed loudness) so the whole voice
  pipeline + lip sync is testable offline with zero keys.
- `server-examples/django/` — the reference ElevenLabs proxy (DRF APIView,
  streams mp3, key/voice from env, auth + 60/min throttle, .env.example with
  Ken's voice ID).
- `src/KenBot.tsx` — the real component: fixed positioning, breathing, runs the
  state machine, exposes `KenBotHandle` (celebrate/pointLeft/pointRight/setState)
  via the React 19 ref prop, per-state face table (brows/mouth/gaze), greets on
  mount, `onStateChange` callback for hosts. He's wrapped in a real <button>
  (accessible chat trigger). Chat drives the machine ON TRANSITIONS ONLY
  (open→listening, thinking→thinking, streaming→talking, closed→idle) — a
  transition guard keeps it from stomping greet/celebrate. Mute persists in
  localStorage under `kenbot-muted` (Phase 4 consumes it).
- `demo/` — playground: big Character preview + state trigger buttons + control
  panel (colors, hair, glasses, pose sliders) + a true-size KenBot in the corner
  driven through its ref.

## Character design

Friendly cartoon man, Pixar-simple rounded shapes, big expressive eyes. Subtle
resemblance to Ken. Final Phase 1 look (Ken-approved 2026-06-10, baked into
`defaultAppearance`): light blond **buzz cut**, **round glasses** (Ken changed his
mind from the original no-glasses brief), light blue **short-sleeve** shirt, black
tie, **pocket protector with pens**. Warm, not corporate.
NOTE: the old `Ken Bot/` folder (kenbot.html, kenbot-character.svg) is a REJECTED
earlier design — do not reuse it.

## Pluggable AI + voice (security-critical, later phases)

- No AI keys in this package, ever. Host apps pass `onAsk(message, history)`
  (string Promise or AsyncIterable<string>) or an `askEndpoint` URL.
- ElevenLabs: component takes a `ttsEndpoint` prop; each host app proxies from its
  Django backend. Reference DRF proxy in `/server-examples`, model `eleven_flash_v2_5`.
  Voice ID `Z9CSFTsEQ3J3DsnfCkiX` goes in `.env.example` as `ELEVENLABS_VOICE_ID`;
  the API key stays a blank placeholder. Key must NEVER appear in frontend code.
- Lip sync: Web Audio AnalyserNode amplitude → mouth openness per frame.
- Long answers split into sentences, TTS requests queued so speech starts fast.
- Graceful degradation: no ttsEndpoint or a failed request → text-only, no user-facing error.

## Phase plan (STOP after each phase for Ken's approval)

- [x] **Phase 1** — Repo scaffold, CLAUDE.md, hub memory files, static character in demo
      with idle breathing + blinks, control panel (colors/hair/glasses) for look iteration.
      *(approved by Ken 2026-06-10; his picks baked into defaultAppearance)*
- [x] **Phase 2** — Full animation state machine (idle/greet/listening/thinking/talking/
      celebrate/point-left/point-right) + demo buttons for every state. Imperative ref
      handle (`KenBotHandle`) for celebrate/point. *(approved 2026-06-10; `walking` +
      wander system added on Ken's request the same day)*
- [x] **Phase 3** — Speech-bubble chat panel (~320px, anchored above him), message history,
      streaming text, mute toggle persisted in localStorage, pluggable backend + demo mock.
      *(approved 2026-06-10)*
- [ ] **Phase 4** — ElevenLabs TTS, Web Audio lip sync, sentence queue, DRF proxy example.
      *(built + tested; awaiting Ken's review)*
- [ ] **Phase 5** — Distribution packaging (github: install), README drop-in guide
      (Vite/React/Tailwind host + Django wiring).

## Memory discipline (standing instruction)

The personal hub repo is at `G:\My Drive\kens-personal-life` **on this machine**
(drive letters vary by computer — confirm if unreachable). This project's memory files:

- `G:\My Drive\kens-personal-life\apps\sherpa-kenbot\STATUS.md` — current state + next step
- `G:\My Drive\kens-personal-life\apps\sherpa-kenbot\MEMORY.md` — accumulated decisions + reasoning

**A phase is NOT complete until STATUS.md and MEMORY.md are updated.** Update them
without being asked at every phase end and after any significant mid-phase decision.
At each phase end: update both files, commit, and remind Ken to push to GitHub and
jot a diary line in `kens-personal-life/diary/`.
