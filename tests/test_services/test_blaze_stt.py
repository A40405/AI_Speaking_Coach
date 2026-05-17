from unittest.mock import MagicMock, patch

from app.services.blaze_stt import BlazeSTTService


class TestBlazeSTTService:
    def test_returns_empty_when_api_key_missing(self, monkeypatch):
        monkeypatch.delenv("BLAZE_API_KEY", raising=False)
        monkeypatch.setenv("BLAZE_STT_BASE_URL", "https://api.blaze.vn/v1/stt/execute")
        with patch("app.services.blaze_stt.requests.post") as mock_post:
            text = BlazeSTTService().transcribe(b"audio", filename="a.mp3")
        assert text == ""
        mock_post.assert_not_called()

    def test_happy_path_extracts_text(self, monkeypatch):
        monkeypatch.setenv("BLAZE_API_KEY", "test-key")
        monkeypatch.setenv("BLAZE_STT_BASE_URL", "https://api.blaze.vn/v1/stt/execute")
        monkeypatch.setenv("BLAZE_STT_MODEL", "stt-async-1.0")

        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = {"text": "Hello world"}

        with patch("app.services.blaze_stt.requests.post", return_value=mock_response) as mock_post:
            text = BlazeSTTService().transcribe(b"audio-bytes", filename="recording.mp3")

        assert text == "Hello world"
        args, kwargs = mock_post.call_args
        assert args[0].endswith("?model=stt-async-1.0")
        assert kwargs["data"]["language"] == "en"

    def test_extracts_nested_result_text(self, monkeypatch):
        monkeypatch.setenv("BLAZE_API_KEY", "test-key")
        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = {"result": {"transcript": "Nested text"}}

        with patch("app.services.blaze_stt.requests.post", return_value=mock_response):
            text = BlazeSTTService().transcribe(b"audio")
        assert text == "Nested text"

    def test_http_error_returns_empty(self, monkeypatch):
        monkeypatch.setenv("BLAZE_API_KEY", "test-key")
        mock_response = MagicMock(status_code=401, text="unauthorized")

        with patch("app.services.blaze_stt.requests.post", return_value=mock_response):
            text = BlazeSTTService().transcribe(b"audio")
        assert text == ""

