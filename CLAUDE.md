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

- `src/character/Character.tsx` — pure presentational SVG. Takes `appearance`
  (colors/hair/glasses) + `pose` (mouthOpen, eyesOpen, browLift, pupilOffset)
  and just renders. No timers, no state. Uses `useId` for SVG def ids so two
  KenBots on one page don't collide.
- `src/character/appearance.ts` — `CharacterAppearance` type, Ken's default look,
  and `shade()` for deriving shadow/blush tones from base colors.
- `src/hooks/useIdleLife.ts` — blink + glance timers (self-rescheduling random
  setTimeout chains).
- `src/KenBot.tsx` — the real component: fixed positioning, breathing, feeds pose
  values into Character. The state machine will live at this layer (Phase 2).
- `demo/` — playground: big Character preview + control panel (colors, hair,
  glasses, pose sliders) + a true-size KenBot in the corner.

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
- [ ] **Phase 2** — Full animation state machine (idle/greet/listening/thinking/talking/
      celebrate/point-left/point-right) + demo buttons for every state. Imperative ref
      handle (`KenBotHandle`) for celebrate/point.
- [ ] **Phase 3** — Speech-bubble chat panel (~320px, anchored above him), message history,
      streaming text, mute toggle persisted in localStorage, pluggable backend + demo mock.
- [ ] **Phase 4** — ElevenLabs TTS, Web Audio lip sync, sentence queue, DRF proxy example.
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
