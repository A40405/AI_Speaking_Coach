# Backend Test Suite Documentation

> Project: AI Speaking Coach (A20-App-014)  
> Framework: `pytest`  
> Scope: all tests under `tests/` (unit, API, integration-style mocked flows)

## 1. Overview

The suite is mock-heavy and optimized for deterministic local runs:

- no real PostgreSQL or object storage needed
- AI providers are mocked at service/route boundaries
- API behavior is verified with `TestClient` + mocked DB cursors
- guardrails and prompt contracts are covered with focused unit tests

## 2. Current Test Inventory (100% matched)

Current source of truth: `python -m pytest tests --collect-only -qq`  
Collected tests: **525**

### 2.1 By folder

| Folder | Tests |
| --- | ---: |
| `tests/helpers` | 1 |
| `tests/test_agents` | 45 |
| `tests/test_ai_services` | 87 |
| `tests/test_api` | 174 |
| `tests/test_core` | 20 |
| `tests/test_db_schema` | 2 |
| `tests/test_grammar_parser` | 31 |
| `tests/test_guardrails` | 91 |
| `tests/test_security` | 23 |
| `tests/test_services` | 51 |
| **Total** | **525** |

### 2.2 By file

| File | Tests |
| --- | ---: |
| `tests/helpers/test_db_mocks.py` | 1 |
| `tests/test_agents/test_flashcard_tools.py` | 6 |
| `tests/test_agents/test_output_models.py` | 12 |
| `tests/test_agents/test_pipeline_guardrail.py` | 7 |
| `tests/test_agents/test_pipeline_structured_output.py` | 7 |
| `tests/test_agents/test_pipeline_suggestions.py` | 1 |
| `tests/test_agents/test_pipeline_tool_use_failed.py` | 3 |
| `tests/test_agents/test_pipeline_voice_accent.py` | 2 |
| `tests/test_agents/test_tool_steps.py` | 7 |
| `tests/test_ai_services/test_ai_services.py` | 60 |
| `tests/test_ai_services/test_prompt_builder_grammar.py` | 11 |
| `tests/test_ai_services/test_prompt_builder_pipeline_prompts.py` | 8 |
| `tests/test_ai_services/test_system_prompt_structure.py` | 8 |
| `tests/test_api/test_audio_proxy.py` | 2 |
| `tests/test_api/test_clear_history.py` | 6 |
| `tests/test_api/test_oauth.py` | 19 |
| `tests/test_api/test_routes.py` | 73 |
| `tests/test_api/test_schemas.py` | 37 |
| `tests/test_api/test_tool_call_step_schema.py` | 4 |
| `tests/test_api/test_topic_conversations.py` | 11 |
| `tests/test_api/test_topics.py` | 4 |
| `tests/test_api/test_user_data_flow.py` | 18 |
| `tests/test_core/test_logger_uuid_mask.py` | 5 |
| `tests/test_core/test_logging_middleware.py` | 4 |
| `tests/test_core/test_metrics_ttft.py` | 4 |
| `tests/test_core/test_settings_smtp.py` | 7 |
| `tests/test_db_schema/test_messages_suggestions_schema.py` | 2 |
| `tests/test_grammar_parser/test_annotated_grammar.py` | 31 |
| `tests/test_guardrails/test_audit_logger.py` | 8 |
| `tests/test_guardrails/test_content_filter.py` | 8 |
| `tests/test_guardrails/test_exceptions.py` | 4 |
| `tests/test_guardrails/test_injection.py` | 29 |
| `tests/test_guardrails/test_input_guardrails.py` | 8 |
| `tests/test_guardrails/test_output_guardrails.py` | 5 |
| `tests/test_guardrails/test_rate_limiter.py` | 5 |
| `tests/test_guardrails/test_topic_filter.py` | 17 |
| `tests/test_guardrails/test_validator.py` | 7 |
| `tests/test_security/test_security.py` | 23 |
| `tests/test_services/test_azure_assessment.py` | 19 |
| `tests/test_services/test_blaze_stt.py` | 4 |
| `tests/test_services/test_blaze_tts.py` | 4 |
| `tests/test_services/test_elevenlabs_tts.py` | 10 |
| `tests/test_services/test_email_service.py` | 4 |
| `tests/test_services/test_groq_llm_streaming.py` | 10 |

## 3. How To Run

### Full suite

```bash
python -m pytest tests -q
```

### Collect-only inventory

```bash
python -m pytest tests --collect-only -qq
```

### Per module

```bash
python -m pytest tests/test_api/test_routes.py -q
```

### Coverage

```bash
python -m pytest tests --cov=app --cov-report=term-missing --cov-report=html
```

## 4. Key Coverage Areas

- Auth and identity: register/login/me, OAuth callback/linking, password reset/change
- Conversation flows: create/continue/list/history/clear/topic-bound sessions
- Audio flows: chat audio input path, audio proxy, upload validation/signature checks
- AI pipeline behavior: fallback logic, structured output parsing, tool-step extraction
- Guardrails: prompt injection, topic filtering, output filtering, audit logging, rate limit
- Service adapters: Azure assessment, Blaze STT/TTS, ElevenLabs TTS, Groq streaming
- Schema contracts: API payload models and DB schema assertions

## 5. Notes & Known Environment Gotchas

- Some runs may print LangSmith multipart ingest warnings in offline/proxy-blocked environments; test pass/fail status is unaffected.
- Azure assessment tests expect the SDK import path to be available in the test environment (already handled in current local run).
- Route tests rely on mocked DB side effects; mismatched `fetchone()`/`fetchall()` sequences can trigger `StopIteration`.

## 6. Latest Test Run Result (2026-05-17)

### Environment

- Project: `AI_Speaking_Coach_H`
- Date (local): `2026-05-17 14:28:39 +07:00`
- Runner: `python -m pytest`

### Commands Executed

```bash
python -m pytest tests --collect-only -qq
python -m pytest tests -q
```

### Results

- Collected: **525**
- Passed: **525**
- Failed: **0**
- Errors: **0**
- Warnings: **1**
- Duration: **30.40s**

Pytest summary:

```text
======================= 525 passed, 1 warning in 30.40s =======================
```

### Warning Observed

- `LangChainPendingDeprecationWarning` from `langgraph.cache.base` (default value of `allowed_objects` will change).

### Non-blocking Post-run Noise

- LangSmith multipart ingest connection errors were printed after test completion due to network/proxy restrictions.
- These did not change pytest exit code (suite still passed).

## 7. Related Files

- `tests/conftest.py`
- `tests/helpers/db_mocks.py`
- `tests/test_api/test_routes.py`
- `tests/test_ai_services/test_ai_services.py`
- `tests/test_guardrails/test_injection.py`
- `tests/test_services/test_azure_assessment.py`
