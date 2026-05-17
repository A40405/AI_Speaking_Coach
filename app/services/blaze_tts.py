"""Blaze text-to-speech service.

Creates a TTS task and polls the download endpoint for rendered audio bytes.
"""

from __future__ import annotations

import os
import time
from contextlib import closing

import requests

from app.core.logger import logger
from app.core.telemetry import span_context

_ENV_BASE_URL = "BLAZE_TTS_BASE_URL"
_ENV_API_KEY = "BLAZE_API_KEY"
_ENV_MODEL = "BLAZE_TTS_MODEL"
_ENV_LANGUAGE = "BLAZE_TTS_LANGUAGE"
_ENV_DEFAULT_SPEAKER = "BLAZE_SPEAKER_ID"
_REQUEST_TIMEOUT_SECONDS = 30
_DOWNLOAD_TIMEOUT_SECONDS = 60
_POLL_SLEEP_SECONDS = 2
_MAX_DOWNLOAD_RETRIES = 30
_PENDING_STATUS_CODES = {202, 204, 404, 425}
_CHUNK_SIZE_BYTES = 64 * 1024

_SPEAKER_ENV_MAP: dict[tuple[str, str], str] = {
    ("male", "us"): "BLAZE_SPEAKER_ID_MALE",
    ("female", "us"): "BLAZE_SPEAKER_ID_FEMALE",
    ("male", "uk"): "BLAZE_SPEAKER_ID_MALE",
    ("female", "uk"): "BLAZE_SPEAKER_ID_FEMALE",
}


class BlazeTTS:
    """Generate speech audio bytes from text using Blaze TTS API."""

    def _get_env_value(self, key: str) -> str:
        return os.getenv(key, "").strip()

    def _resolve_speaker_id(self, voice_gender: str | None = None, voice_accent: str | None = None) -> str:
        gender = (voice_gender or "").strip().lower()
        accent = (voice_accent or "").strip().lower() or "us"

        env_key = _SPEAKER_ENV_MAP.get((gender, accent))
        if env_key:
            speaker_id = self._get_env_value(env_key)
            if speaker_id:
                return speaker_id
            logger.error("BlazeTTS: %s is not configured for gender=%r accent=%r", env_key, gender, accent)

        default_speaker = self._get_env_value(_ENV_DEFAULT_SPEAKER)
        if default_speaker:
            return default_speaker

        logger.error("BlazeTTS: no speaker ID resolved for gender=%r accent=%r", gender, accent)
        return ""

    def convert_text_to_speech(self, text: str, voice_gender: str | None = None, voice_accent: str | None = None) -> bytes:
        if not text.strip():
            logger.debug("BlazeTTS: empty text provided, skipping synthesis")
            return b""

        api_key = self._get_env_value(_ENV_API_KEY)
        base_url = self._get_env_value(_ENV_BASE_URL)
        model = self._get_env_value(_ENV_MODEL)
        language = self._get_env_value(_ENV_LANGUAGE) or "en"

        if not api_key:
            logger.error("BlazeTTS: %s is not set - cannot synthesize audio", _ENV_API_KEY)
            return b""
        if not base_url:
            logger.error("BlazeTTS: %s is not set - cannot synthesize audio", _ENV_BASE_URL)
            return b""
        if not model:
            logger.error("BlazeTTS: %s is not set - cannot synthesize audio", _ENV_MODEL)
            return b""

        speaker_id = self._resolve_speaker_id(voice_gender, voice_accent)
        if not speaker_id:
            return b""

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "query": text,
            "language": language,
            "audio_speed": "1",
            "audio_quality": 64,
            "audio_format": "mp3",
            "normalization": "basic",
            "speaker_id": speaker_id,
            "model": model,
        }

        with span_context("tts.synthesize", kind="tts") as span:
            span.set(model=model, voice_id=speaker_id, text_length=len(text))
            task_id = self._create_task(base_url=base_url, headers=headers, payload=payload)
            if not task_id:
                return b""
            return self._download_audio(base_url=base_url, task_id=task_id, headers={"Authorization": f"Bearer {api_key}"})

    def _create_task(self, *, base_url: str, headers: dict[str, str], payload: dict[str, str | int]) -> str:
        logger.info("BlazeTTS create request model=%s speaker_id=%s", payload.get("model"), payload.get("speaker_id"))
        try:
            response = requests.post(base_url, json=payload, headers=headers, timeout=_REQUEST_TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            logger.error("BlazeTTS create request failed: %s", exc)
            return ""

        if response.status_code >= 400:
            logger.error("BlazeTTS create failed HTTP %d - %s", response.status_code, response.text[:200])
            return ""

        try:
            data = response.json()
        except ValueError:
            logger.error("BlazeTTS create returned non-JSON response")
            return ""

        task_id = str(data.get("id", "")).strip()
        if not task_id:
            logger.error("BlazeTTS create response missing task id")
            return ""
        return task_id

    def _download_audio(self, *, base_url: str, task_id: str, headers: dict[str, str]) -> bytes:
        url = f"{base_url.rstrip('/')}/{task_id}/download"
        for attempt in range(1, _MAX_DOWNLOAD_RETRIES + 1):
            try:
                with closing(requests.get(url, headers=headers, stream=True, timeout=_DOWNLOAD_TIMEOUT_SECONDS)) as response:
                    if response.status_code == 200:
                        audio = self._read_audio_response(response)
                        if audio:
                            logger.info("BlazeTTS download done task_id=%s size=%d bytes", task_id, len(audio))
                            return audio
                        logger.error("BlazeTTS download returned empty body task_id=%s", task_id)
                        return b""

                    if response.status_code in _PENDING_STATUS_CODES:
                        logger.debug("BlazeTTS download pending task_id=%s attempt=%d status=%d", task_id, attempt, response.status_code)
                        time.sleep(_POLL_SLEEP_SECONDS)
                        continue

                    logger.error(
                        "BlazeTTS download failed task_id=%s status=%d body=%s",
                        task_id,
                        response.status_code,
                        response.text[:200],
                    )
                    return b""
            except requests.RequestException as exc:
                logger.error("BlazeTTS download request failed task_id=%s attempt=%d error=%s", task_id, attempt, exc)
                time.sleep(_POLL_SLEEP_SECONDS)

        logger.error("BlazeTTS download timed out task_id=%s attempts=%d", task_id, _MAX_DOWNLOAD_RETRIES)
        return b""

    def _read_audio_response(self, response: requests.Response) -> bytes:
        chunks: list[bytes] = []
        for chunk in response.iter_content(chunk_size=_CHUNK_SIZE_BYTES):
            if chunk:
                chunks.append(chunk)
        return b"".join(chunks)
