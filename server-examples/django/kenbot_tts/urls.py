"""URL wiring for the KenBot TTS proxy. Include from the project urls.py:

    path("api/kenbot/", include("kenbot_tts.urls")),
"""

from django.urls import path

from .views import KenBotTtsView

urlpatterns = [
    path("tts/", KenBotTtsView.as_view(), name="kenbot-tts"),
]
