import re


def test_base_prompt_contains_coaching_identity_and_style():
    import app.prompts.prompt_builder as pb

    prompt = pb.build_system_prompt(include_grammar=False)
    lower = prompt.lower()
    assert "english-speaking coach" in lower or "english speaking coach" in lower
    assert "supportive" in lower
    assert "follow-up" in lower or "follow up" in lower


def test_blocked_response_matches_current_contract():
    import app.prompts.prompt_builder as pb

    text = pb.load_blocked_response()
    assert "outside what i can help with" in text.lower()
    assert "practice in english" in text.lower()


def test_preflight_prompt_has_three_axes():
    import app.prompts.prompt_builder as pb

    preflight = pb.load_preflight_prompt()
    assert "SAFETY" in preflight
    assert "SCOPE" in preflight
    assert "TOOL" in preflight


def test_grammar_instruction_contract_contains_response_and_grammar_blocks():
    import app.prompts.prompt_builder as pb

    prompt = pb.build_system_prompt(include_grammar=True, include_suggestions=False)
    assert "<response>" in prompt
    assert "<grammar>" in prompt
    assert "RESPONSE FORMAT" in prompt


def test_suggestions_instruction_contract_contains_three_suggestions_rule():
    import app.prompts.prompt_builder as pb

    prompt = pb.build_system_prompt(include_grammar=True, include_suggestions=True)
    lower = prompt.lower()
    assert "<suggestions>" in prompt
    assert "exactly 3" in lower or "exactly three" in lower


def test_structured_output_mode_excludes_xml_blocks_and_demands_json():
    import app.prompts.prompt_builder as pb

    prompt = pb.build_system_prompt(include_grammar=True, use_structured_output=True)
    lower = prompt.lower()
    assert "single valid json object" in lower or "valid json object" in lower
    assert "<grammar>" not in prompt
    assert "<suggestions>" not in prompt


def test_topic_layer_fallback_for_unknown_category_and_topic():
    import app.prompts.prompt_builder as pb

    prompt = pb.build_system_prompt(category="unknown-cat", topic="unknown-topic", include_grammar=False)
    assert "## Category:" in prompt
    assert "## Topic:" in prompt


def test_word_limits_present_in_prompt_contracts():
    import app.prompts.prompt_builder as pb

    prompt = pb.build_system_prompt(include_grammar=True)
    numbers = re.findall(r"\b\d+\b", prompt)
    assert "75" in numbers
    assert "100" in numbers
