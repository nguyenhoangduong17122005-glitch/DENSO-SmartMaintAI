"""Load local settings without replacing explicitly supplied environment variables."""
from dotenv import load_dotenv
from .store import ROOT


def load_config():
    load_dotenv(ROOT / '.env', override=False)
