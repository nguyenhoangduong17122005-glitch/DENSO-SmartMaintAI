"""Container/hosting entry point: seed once, retain data, serve one worker."""
import os
from pathlib import Path


def prepare():
    from .config import load_config
    from .hosting import hosting_settings
    from .setup_demo import initialize_demo
    from .store import DEFAULT_DB
    from .remote_store import initialize_demo_remote, settings
    load_config()
    hosting_settings()  # Fail on invalid public configuration before serving.
    path = Path(os.getenv('SMARTMAINT_DB', str(DEFAULT_DB)))
    result = initialize_demo_remote() if settings() else initialize_demo(path)
    print('Demo data ready:', result['usersCreated'], 'new users,', result['samplesAdded'], 'new sample cases.')
    if os.getenv('SMARTMAINT_RETRIEVAL_MODE') == 'vector' and os.getenv('GEMINI_API_KEY', '').strip():
        import sqlite3
        from .rag.search import load_runtime_documents
        from .rag.vectors import build_index, VectorError
        try:
            index = build_index(load_runtime_documents(path))
            print('Vector index ready:', index['chunks'], 'chunks.')
        except (VectorError, OSError, sqlite3.Error):
            print('Vector index unavailable; retrieval will report its fallback mode.')
    return path


def main():
    prepare()
    import uvicorn
    port = int(os.getenv('PORT', '8001'))
    uvicorn.run('backend.main:app', host='0.0.0.0', port=port, workers=1)


if __name__ == '__main__':
    main()
