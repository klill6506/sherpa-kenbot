"""URL wiring for the KenBot TTS proxy. Include from the project urls.py:

    path("api/kenbot/", include("kenbot_tts.urls")),
"""

from django.urls import path

from .views import KenBotTtsView, KenBotVoicesView

urlpatterns = [
    path("tts/", KenBotTtsView.as_view(), name="kenbot-tts"),
    # Optional: only needed if you let users choose a voice.
    path("voices/", KenBotVoicesView.as_view(), name="kenbot-voices"),
]
