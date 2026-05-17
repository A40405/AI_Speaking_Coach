import importlib
from types import SimpleNamespace


class _FakePromptPath:
    def __init__(self, text: str, mtime: float = 1.0, exists: bool = True):
        self._text = text
        self._mtime = mtime
        self._exists = exists

    def stat(self):
        if not self._exists:
            raise OSError("missing")
        return SimpleNamespace(st_mtime=self._mtime)

    def read_text(self, encoding="utf-8"):
        if not self._exists:
            raise OSError("missing")
        return self._text


def _sections_text(**sections) -> str:
    parts = []
    for name, content in sections.items():
        parts.append(f"<!-- BEGIN: {name} -->\n{content}\n<!-- END: {name} -->")
    return "\n\n".join(parts)


def _reset_cache(pb) -> None:
    pb._CACHE["mtime"] = None
    pb._CACHE["sections"] = None


class TestToolCallCap:
    def test_default_value_is_5(self, monkeypatch):
        monkeypatch.delenv("TOOL_CALL_CAP", raising=False)
        import app.core.settings as s
        importlib.reload(s)
        assert s.TOOL_CALL_CAP == 5

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("TOOL_CALL_CAP", "3")
        import app.core.settings as s
        importlib.reload(s)
        assert s.TOOL_CALL_CAP == 3


class TestLoadPreflightPrompt:
    def test_returns_section_content(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(preflight_prompt="preflight content")
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=2.0))
        _reset_cache(pb)

        assert pb.load_preflight_prompt() == "preflight content"

    def test_returns_fallback_when_file_missing(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text="", exists=False))
        _reset_cache(pb)

        result = pb.load_preflight_prompt()
        assert "SAFETY" in result
        assert "TOOL" in result

    def test_returns_fallback_when_section_missing(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(system_prompt="only base")
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=3.0))
        _reset_cache(pb)

        result = pb.load_preflight_prompt()
        assert "SAFETY" in result


class TestLoadBlockedResponse:
    def test_returns_section_content(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(blocked_response="blocked content")
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=4.0))
        _reset_cache(pb)

        assert pb.load_blocked_response() == "blocked content"

    def test_returns_fallback_when_file_missing(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text="", exists=False))
        _reset_cache(pb)

        result = pb.load_blocked_response()
        assert result == pb._BLOCKED_RESPONSE_FALLBACK

    def test_returns_fallback_when_section_missing(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(system_prompt="only base")
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=5.0))
        _reset_cache(pb)

        result = pb.load_blocked_response()
        assert result == pb._BLOCKED_RESPONSE_FALLBACK
