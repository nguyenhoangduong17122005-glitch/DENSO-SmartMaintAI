"""Launch the local demo from its folder, opening a browser when HTTP is ready."""
import json
import threading
import time
import urllib.request
import webbrowser

URL = "http://127.0.0.1:8001/"


def ready():
    try:
        with urllib.request.urlopen(URL + "api/health", timeout=1) as response:
            data = json.load(response)
        return data.get("status") == "ok" and data.get("environment") == "demo" and data.get("adapter") == "mock"
    except (OSError, ValueError, AttributeError):
        return False


def open_when_ready():
    for _ in range(60):
        if ready():
            webbrowser.open(URL)
            return
        time.sleep(0.5)


def main():
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    from .config import load_config
    load_config()
    if ready():
        print("Demo is already running. Opening " + URL)
        print("If you changed .env, stop the old server with Ctrl+C and launch again.")
        webbrowser.open(URL)
        return
    import uvicorn
    import os
    import sqlite3
    from pathlib import Path
    from .store import DEFAULT_DB
    from .setup_demo import initialize_demo
    from .demo_knowledge import add_knowledge_samples
    path = Path(os.getenv('SMARTMAINT_DB', str(DEFAULT_DB)))
    initialize_demo(path)
    print('Knowledge demo ready:', len(add_knowledge_samples(path)), 'new lesson/source pairs.')
    if os.getenv('SMARTMAINT_RETRIEVAL_MODE') == 'vector' and os.getenv('GEMINI_API_KEY', '').strip():
        from .rag.vectors import build_index, VectorError
        from .rag.search import load_runtime_documents
        try:
            print('Preparing Gemini embeddings and local vector index...')
            result = build_index(load_runtime_documents())
            print('Vector index ready:', result['chunks'], 'chunks')
        except (VectorError, OSError, sqlite3.Error) as error:
            print(str(error) if isinstance(error, VectorError) else 'Vector index could not be prepared.')
            print('The app will show a keyword fallback until the vector index is ready.')

    threading.Thread(target=open_when_ready, daemon=True).start()
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8001)


if __name__ == "__main__":
    main()
