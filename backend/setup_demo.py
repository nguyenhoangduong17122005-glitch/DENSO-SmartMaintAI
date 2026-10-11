"""Prepare local demo data without replacing existing settings or records."""
import os
from pathlib import Path

from .store import DEFAULT_DB, ROOT

OFFLINE_CONFIG = """# Local settings. Never commit this file or share API keys.
SMARTMAINT_ANSWER_MODE=template
SMARTMAINT_RETRIEVAL_MODE=keyword
SMARTMAINT_GEMINI_MODEL=gemini-3.8-flash
SMARTMAINT_EMBEDDING_MODEL=gemini-embedding-001
SMARTMAINT_EMBEDDING_DIMENSIONS=768
SMARTMAINT_VECTOR_MIN_SCORE=0.45
GEMINI_API_KEY=
"""


def initialize_demo(path):
    from .manage import add_demo_samples, seed_demo
    # The role picker does not need passwords. Do not print generated credentials.
    issued = seed_demo(path)
    added = add_demo_samples(path)
    return {"usersCreated": len(issued), "samplesAdded": len(added)}


def main():
    from .config import load_config
    try:
        with (ROOT / ".env").open("x", encoding="utf-8") as stream:
            stream.write(OFFLINE_CONFIG)
        print("Created .env in offline demo mode. No API key required.")
    except FileExistsError:
        print("Kept existing .env settings.")
    load_config()
    path = Path(os.environ.get("SMARTMAINT_DB", DEFAULT_DB))
    result = initialize_demo(path)
    print("Demo data ready:", result["usersCreated"], "new users,",
          result["samplesAdded"], "additional sample cases.")
    print("Existing records and passwords were preserved.")
    print("Start with Chay-demo.cmd or: python -m backend.launch_demo")


if __name__ == "__main__":
    main()
