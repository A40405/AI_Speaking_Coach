from types import SimpleNamespace
from pathlib import Path


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


class TestLoadSections:
    def test_parses_all_sections(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(
            system_prompt="base content",
            grammar_instruction="grammar content",
            suggestions_instruction="suggestions content",
            preflight_prompt="preflight content",
            blocked_response="blocked content",
        )
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=2.0))
        _reset_cache(pb)

        sections = pb._load_sections()
        assert sections["system_prompt"] == "base content"
        assert sections["grammar_instruction"] == "grammar content"
        assert sections["suggestions_instruction"] == "suggestions content"
        assert sections["preflight_prompt"] == "preflight content"
        assert sections["blocked_response"] == "blocked content"

    def test_strips_section_content(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(system_prompt="\n\n  trimmed  \n")
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=3.0))
        _reset_cache(pb)

        assert pb._load_sections()["system_prompt"] == "trimmed"

    def test_cache_hit_avoids_disk_read(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        fake = _FakePromptPath(text="should-not-read", mtime=10.0)
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", fake)
        pb._CACHE["mtime"] = 10.0
        pb._CACHE["sections"] = {"system_prompt": "cached"}

        called = {"read": 0}

        def _boom(*args, **kwargs):
            called["read"] += 1
            raise AssertionError("read_text should not be called on cache hit")

        monkeypatch.setattr(fake, "read_text", _boom)

        result = pb._load_sections()
        assert result["system_prompt"] == "cached"
        assert called["read"] == 0

    def test_cache_miss_on_stale_mtime(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(system_prompt="new content")
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=5.0))
        pb._CACHE["mtime"] = 0.0
        pb._CACHE["sections"] = {"system_prompt": "old content"}

        result = pb._load_sections()
        assert result["system_prompt"] == "new content"

    def test_returns_fallbacks_when_file_missing(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text="", exists=False))
        _reset_cache(pb)

        sections = pb._load_sections()
        assert "SAFETY" in sections["preflight_prompt"]
        assert "RESPONSE FORMAT" in sections["grammar_instruction"]
        assert sections["system_prompt"] == pb._BASE_FALLBACK
        assert sections["blocked_response"] == pb._BLOCKED_RESPONSE_FALLBACK


class TestBuildSystemPromptGrammar:
    def test_grammar_block_appended_when_include_grammar_true(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(system_prompt="base", grammar_instruction="GRAMMAR BLOCK")
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=6.0))
        _reset_cache(pb)

        prompt = pb.build_system_prompt(include_grammar=True)
        assert "GRAMMAR BLOCK" in prompt

    def test_grammar_block_absent_when_include_grammar_false(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(system_prompt="base", grammar_instruction="GRAMMAR BLOCK")
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=7.0))
        _reset_cache(pb)

        prompt = pb.build_system_prompt(include_grammar=False)
        assert "GRAMMAR BLOCK" not in prompt

    def test_suggestions_block_appended_with_grammar(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(
            system_prompt="base",
            grammar_instruction="GRAMMAR BLOCK",
            suggestions_instruction="SUGGESTIONS BLOCK",
        )
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=8.0))
        _reset_cache(pb)

        prompt = pb.build_system_prompt(include_grammar=True)
        assert "GRAMMAR BLOCK" in prompt
        assert "SUGGESTIONS BLOCK" in prompt

    def test_suggestions_block_absent_when_disabled(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(
            system_prompt="base",
            grammar_instruction="GRAMMAR BLOCK",
            suggestions_instruction="SUGGESTIONS BLOCK",
        )
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=9.0))
        _reset_cache(pb)

        prompt = pb.build_system_prompt(include_grammar=True, include_suggestions=False)
        assert "GRAMMAR BLOCK" in prompt
        assert "SUGGESTIONS BLOCK" not in prompt

    def test_grammar_and_suggestions_absent_when_use_structured_output(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(
            system_prompt="base",
            grammar_instruction="GRAMMAR BLOCK",
            suggestions_instruction="SUGGESTIONS BLOCK",
        )
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=11.0))
        _reset_cache(pb)

        prompt = pb.build_system_prompt(include_grammar=True, use_structured_output=True)
        assert "GRAMMAR BLOCK" not in prompt
        assert "SUGGESTIONS BLOCK" not in prompt

    def test_structured_output_false_preserves_existing_behaviour(self, monkeypatch):
        import app.prompts.prompt_builder as pb

        text = _sections_text(
            system_prompt="base",
            grammar_instruction="GRAMMAR BLOCK",
            suggestions_instruction="SUGGESTIONS BLOCK",
        )
        monkeypatch.setattr(pb, "_SYSTEM_PROMPT_PATH", _FakePromptPath(text=text, mtime=12.0))
        _reset_cache(pb)

        prompt = pb.build_system_prompt(include_grammar=True, use_structured_output=False)
        assert "GRAMMAR BLOCK" in prompt
        assert "SUGGESTIONS BLOCK" in prompt
