"""Mock adapter. Authorization is enforced by the API before calling this adapter."""
import json
from pathlib import Path

from .store import ROOT


class MockHozenDX:
    def __init__(self, fixture_path=None):
        self.fixture_path = Path(fixture_path or ROOT / "fixtures/hozendx/cnc-04.mock.json")

    def get_asset(self, asset_id):
        # Never construct a file path from an externally supplied asset ID.
        if asset_id != "CNC-04":
            return None
        payload = json.loads(self.fixture_path.read_text(encoding="utf-8"))
        if (payload.get("environment") != "demo" or payload.get("isSimulated") is not True
                or payload.get("adapterMode") != "mock"
                or payload.get("data", {}).get("asset", {}).get("id") != asset_id):
            raise ValueError("Invalid or non-demo mock fixture")
        return payload
