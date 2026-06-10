# Server examples — wiring KenBot's voice into a host backend

KenBot never talks to ElevenLabs directly and never sees the API key. Each
host app runs a small proxy on its own backend; KenBot's `ttsEndpoint` prop
points at it. This folder holds the reference implementation for Ken's usual
stack (Django 5.2 + DRF).

## Django (django/kenbot_tts/)

1. Copy `kenbot_tts/` into your Django project (or merge the view into an
   existing app).

2. Settings — read the credentials from the environment (matches
   `.env.example`):

   ```python
   # settings.py
   import os

   ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
   ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "")
   ```

3. URLs:

   ```python
   # project urls.py
   path("api/kenbot/", include("kenbot_tts.urls")),
   ```

4. Frontend:

   ```tsx
   <KenBot ttsEndpoint="/api/kenbot/tts/" ... />
   ```

5. `pip install requests` if the project doesn't already have it.

Notes:

- The view requires an authenticated user and throttles to 60 requests/min
  per user. Adjust `permission_classes` to match the host app — but keep the
  throttle: every request costs ElevenLabs credits.
- KenBot sends ONE SENTENCE per request (that's the sentence queue keeping
  speech latency low), so `MAX_TEXT_LENGTH = 600` is plenty.
- Any non-OK response makes KenBot fall back to text-only silently — a
  misconfigured proxy never breaks the chat, it just mutes him.
- If the Django API lives on another origin than the frontend, allow the
  POST in your CORS config (django-cors-headers).

## Local testing without ElevenLabs

`npm run mock-tts` (repo root) starts a tiny Node server on
http://localhost:8787/tts that speaks robotic babble — same request/response
shape, no key needed. Point the demo's "TTS endpoint" field at it to watch
the lip sync work offline.
