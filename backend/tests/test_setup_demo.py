from backend.setup_demo import initialize_demo, main
from backend.store import connect


def test_setup_seeds_fresh_database_and_preserves_existing_data(tmp_path):
    path = tmp_path / "demo.sqlite3"
    first = initialize_demo(path)
    assert first == {"usersCreated": 5, "samplesAdded": 4}
    with connect(path) as db:
        password = db.execute("SELECT password_hash FROM users WHERE id='u-minh'").fetchone()[0]
        db.execute("UPDATE cases SET title='User-created edit' WHERE id='BM-26028'")
    assert initialize_demo(path) == {"usersCreated": 0, "samplesAdded": 0}
    with connect(path) as db:
        assert db.execute("SELECT count(*) FROM cases").fetchone()[0] == 5
        assert db.execute("SELECT title FROM cases WHERE id='BM-26028'").fetchone()[0] == "User-created edit"
        assert db.execute("SELECT password_hash FROM users WHERE id='u-minh'").fetchone()[0] == password


def test_setup_creates_offline_config_but_does_not_replace_it(tmp_path, monkeypatch):
    import backend.setup_demo as setup
    import backend.config as config
    monkeypatch.setattr(setup, "ROOT", tmp_path)
    monkeypatch.setattr(config, "load_config", lambda: None)
    monkeypatch.setenv("SMARTMAINT_DB", str(tmp_path / "demo.sqlite3"))
    main()
    env = tmp_path / ".env"
    assert "SMARTMAINT_ANSWER_MODE=template" in env.read_text(encoding="utf-8")
    assert "SMARTMAINT_RETRIEVAL_MODE=keyword" in env.read_text(encoding="utf-8")
    custom = "SMARTMAINT_ANSWER_MODE=gemini\nGEMINI_API_KEY=local-test-placeholder\n"
    env.write_text(custom, encoding="utf-8")
    main()
    assert env.read_text(encoding="utf-8") == custom
