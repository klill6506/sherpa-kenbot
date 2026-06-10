"""
Reference ElevenLabs TTS proxy for KenBot — Django 5.2 + DRF.

Why a proxy: the ElevenLabs API key must NEVER reach the browser. KenBot's
`ttsEndpoint` prop points at this view; the key stays in Django settings.

The flow per sentence:
    KenBot  ──POST {"text": "..."}──►  this view
    this view ──streamed request──►  ElevenLabs text-to-speech
    this view ◄──mp3 bytes (streamed)──  ElevenLabs
    KenBot  ◄──audio/mpeg (streamed back as it arrives)──  this view

Wiring (see also ../README.md):
    settings.py   ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID from env
    urls.py       path("api/kenbot/tts/", KenBotTtsView.as_view())
    KenBot prop   ttsEndpoint="/api/kenbot/tts/"

Requires the `requests` package (pip install requests).
"""

import requests
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

ELEVENLABS_STREAM_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"

# eleven_flash_v2_5: ElevenLabs' low-latency model — right choice for short
# per-sentence requests where speed matters more than maximum quality.
ELEVENLABS_MODEL = "eleven_flash_v2_5"

# KenBot sends one sentence at a time, so anything huge is not coming from it.
MAX_TEXT_LENGTH = 600


class KenBotTtsThrottle(UserRateThrottle):
    """A chatty user asks a few questions/minute, each a handful of
    sentences — 60/min is generous headroom without letting one user
    burn the ElevenLabs bill."""

    rate = "60/min"


class KenBotTtsView(APIView):
    # Match this to however the host app authenticates its own users.
    # Drop to [] for a public site, but keep the throttle either way.
    permission_classes = [IsAuthenticated]
    throttle_classes = [KenBotTtsThrottle]

    def post(self, request):
        text = str(request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(text) > MAX_TEXT_LENGTH:
            return Response({"detail": "text too long"}, status=status.HTTP_400_BAD_REQUEST)

        api_key = getattr(settings, "ELEVENLABS_API_KEY", "")
        voice_id = getattr(settings, "ELEVENLABS_VOICE_ID", "")
        if not api_key or not voice_id:
            # Service not configured — KenBot degrades to text-only on any
            # non-OK response, so this is safe to return.
            return Response({"detail": "tts not configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        upstream = requests.post(
            ELEVENLABS_STREAM_URL.format(voice_id=voice_id),
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={
                "text": text,
                "model_id": ELEVENLABS_MODEL,
            },
            stream=True,  # start forwarding bytes before ElevenLabs finishes
            timeout=30,
        )
        if not upstream.ok:
            return Response({"detail": "tts upstream error"}, status=status.HTTP_502_BAD_GATEWAY)

        return StreamingHttpResponse(
            upstream.iter_content(chunk_size=8192),
            content_type="audio/mpeg",
        )
