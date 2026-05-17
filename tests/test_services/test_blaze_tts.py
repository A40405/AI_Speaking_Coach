import os
from unittest.mock import MagicMock, patch


class TestBlazeTTS:
    def _set_required_env(self):
        os.environ["BLAZE_API_KEY"] = "test-key"
        os.environ["BLAZE_TTS_BASE_URL"] = "https://api.blaze.vn/v1/tts"
        os.environ["BLAZE_TTS_MODEL"] = "v1.5_pro"
        os.environ["BLAZE_TTS_LANGUAGE"] = "en"
        os.environ["BLAZE_SPEAKER_ID"] = "default-speaker"
        os.environ["BLAZE_SPEAKER_ID_MALE"] = "male-speaker"
        os.environ["BLAZE_SPEAKER_ID_FEMALE"] = "female-speaker"

    def test_resolve_speaker_id_by_gender(self):
        self._set_required_env()
        from app.services.blaze_tts import BlazeTTS

        tts = BlazeTTS()
        assert tts._resolve_speaker_id("male", "us") == "male-speaker"
        assert tts._resolve_speaker_id("female", "uk") == "female-speaker"

    def test_convert_returns_empty_when_required_env_missing(self, monkeypatch):
        monkeypatch.delenv("BLAZE_API_KEY", raising=False)
        from app.services.blaze_tts import BlazeTTS

        assert BlazeTTS().convert_text_to_speech("hello") == b""

    def test_convert_happy_path_downloads_audio(self):
        self._set_required_env()
        from app.services.blaze_tts import BlazeTTS

        create_resp = MagicMock(status_code=200)
        create_resp.json.return_value = {"id": "task-123"}

        download_resp = MagicMock(status_code=200)
        download_resp.iter_content.return_value = [b"mp3", b"data"]
        download_resp.__enter__ = lambda s: s
        download_resp.__exit__ = lambda s, exc_type, exc, tb: None
        download_resp.close = lambda: None

        with (
            patch("app.services.blaze_tts.requests.post", return_value=create_resp),
            patch("app.services.blaze_tts.requests.get", return_value=download_resp),
        ):
            audio = BlazeTTS().convert_text_to_speech("hello", voice_gender="male", voice_accent="us")

        assert audio == b"mp3data"

    def test_convert_retries_when_pending_then_succeeds(self):
        self._set_required_env()
        from app.services.blaze_tts import BlazeTTS

        create_resp = MagicMock(status_code=200)
        create_resp.json.return_value = {"id": "task-123"}

        pending_resp = MagicMock(status_code=425, text="pending")
        pending_resp.iter_content.return_value = []
        pending_resp.close = lambda: None

        success_resp = MagicMock(status_code=200)
        success_resp.iter_content.return_value = [b"audio"]
        success_resp.close = lambda: None

        with (
            patch("app.services.blaze_tts.requests.post", return_value=create_resp),
            patch("app.services.blaze_tts.requests.get", side_effect=[pending_resp, success_resp]),
            patch("app.services.blaze_tts.time.sleep"),
        ):
            audio = BlazeTTS().convert_text_to_speech("hello")

        assert audio == b"audio"
