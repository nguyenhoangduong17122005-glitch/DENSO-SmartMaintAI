import pytest


@pytest.fixture(autouse=True)
def offline_defaults(monkeypatch):
    """Local .env must never trigger provider calls during automated tests."""
    monkeypatch.setenv('SMARTMAINT_RETRIEVAL_MODE', 'keyword')
    monkeypatch.setenv('SMARTMAINT_ANSWER_MODE', 'template')
    monkeypatch.setenv('SMARTMAINT_STORAGE', 'sqlite')
