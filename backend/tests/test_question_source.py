import importlib
import os

import pytest


def reload_generator(monkeypatch, **env):
    for k in ("USE_QUESTION_BANK", "MOCK_LLM", "GEMINI_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    from serving import question_generator
    return importlib.reload(question_generator)


def test_fresh_checkout_without_env_uses_the_offline_bank(monkeypatch):
    q = reload_generator(monkeypatch)
    assert q.USE_QUESTION_BANK is True
    mcq = q.generate_mcq("Lists", "easy")
    assert len(mcq["choices"]) == 4 and 0 <= mcq["correct_index"] < 4


def test_a_gemini_key_enables_live_generation_by_default(monkeypatch):
    assert reload_generator(monkeypatch, GEMINI_API_KEY="k").USE_QUESTION_BANK is False


def test_explicit_setting_always_wins(monkeypatch):
    assert reload_generator(monkeypatch, GEMINI_API_KEY="k", USE_QUESTION_BANK="true").USE_QUESTION_BANK is True
    assert reload_generator(monkeypatch, USE_QUESTION_BANK="false").USE_QUESTION_BANK is False


def test_live_mode_without_the_package_falls_back_to_the_bank_instead_of_a_500(monkeypatch):
    q = reload_generator(monkeypatch, USE_QUESTION_BANK="false", GEMINI_API_KEY="k")
    monkeypatch.setattr(q, "_get_model", lambda: (_ for _ in ()).throw(ModuleNotFoundError("google")))
    assert len(q.generate_mcq("Syntax", "easy")["choices"]) == 4


@pytest.fixture(autouse=True)
def restore_generator(monkeypatch):
    yield
    monkeypatch.setenv("USE_QUESTION_BANK", "true")
    from serving import question_generator
    importlib.reload(question_generator)
