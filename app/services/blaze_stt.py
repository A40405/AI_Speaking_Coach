"""Blaze speech-to-text service (English only)."""

from __future__ import annotations

import io
import os

import requests

from app.core.logger import logger
from app.core.telemetry import span_context

_ENV_BASE_URL = "BLAZE_STT_BASE_URL"
_ENV_API_KEY = "BLAZE_API_KEY"
_ENV_MODEL = "BLAZE_STT_MODEL"
_ENV_LANGUAGE = "BLAZE_STT_LANGUAGE"
_REQUEST_TIMEOUT_SECONDS = 60


class BlazeSTTService:
    """Transcribe audio bytes into text using Blaze STT API."""

    def __init__(self, model_name: str | None = None, language: str | None = None):
        self.base_url = (os.getenv(_ENV_BASE_URL, "https://api.blaze.vn/v1/stt/execute") or "").strip()
        self.api_key = (os.getenv(_ENV_API_KEY, "") or "").strip()
        self.model_name = (model_name or os.getenv(_ENV_MODEL, "stt-async-1.0") or "stt-async-1.0").strip()
        self.language = (language or os.getenv(_ENV_LANGUAGE, "en") or "en").strip().lower()

        if self.language != "en":
            logger.warning("BlazeSTTService only supports English in this app; forcing language='en' (got %r)", self.language)
            self.language = "en"
        logger.info("BlazeSTTService ready model=%s language=%s", self.model_name, self.language)

    def transcribe(self, audio_bytes: bytes, filename: str = "recording.wav") -> str:
        if not audio_bytes:
            logger.warning("BlazeSTTService: transcribe called with empty audio bytes")
            return ""
        if not self.api_key:
            logger.error("BlazeSTTService: %s is missing", _ENV_API_KEY)
            return ""
        if not self.base_url:
            logger.error("BlazeSTTService: %s is missing", _ENV_BASE_URL)
            return ""

        url = f"{self.base_url}?model={self.model_name}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        file_obj = io.BytesIO(audio_bytes)
        file_obj.name = filename
        files = {"audio_file": (filename, file_obj, "audio/mpeg")}
        data = {"language": "en"}

        logger.info("BlazeSTT transcribe start filename=%r size=%d bytes model=%s", filename, len(audio_bytes), self.model_name)
        with span_context("stt.transcribe", kind="stt") as span:
            span.set(model=self.model_name, audio_bytes=len(audio_bytes))
            try:
                response = requests.post(url, headers=headers, files=files, data=data, timeout=_REQUEST_TIMEOUT_SECONDS)
            except requests.RequestException as exc:
                logger.error("BlazeSTT request failed: %s", exc)
                return ""

        if response.status_code >= 400:
            logger.error("BlazeSTT failed HTTP %d - %s", response.status_code, response.text[:200])
            return ""

        try:
            payload = response.json()
        except ValueError:
            logger.error("BlazeSTT returned non-JSON response")
            return ""

        text = self._extract_text(payload)
        logger.info("BlazeSTT transcribe done transcript_length=%d", len(text))
        return text

    @staticmethod
    def _extract_text(payload: object) -> str:
        if isinstance(payload, dict):
            for key in ("text", "transcript", "transcription"):
                value = payload.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
            result = payload.get("result")
            if isinstance(result, dict):
                for key in ("text", "transcript", "transcription"):
                    value = result.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()
        return ""

