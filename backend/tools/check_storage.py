"""Read-only storage readiness check; never prints credentials or case contents."""
import json
import os
from pathlib import Path


def main():
    from ..config import load_config
    from ..remote_store import settings
    from ..store import DEFAULT_DB, connect
    load_config()
    remote = settings()
    path = Path(os.getenv('SMARTMAINT_DB', str(DEFAULT_DB)))
    if not remote and not path.exists():
        raise SystemExit('Local database does not exist; run setup-demo first.')
    with connect(path) as db:
        db.execute('PRAGMA query_only=ON')
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        result = {'storage': 'turso' if remote else 'sqlite', 'connected': True,
                  'schemaReady': 'schema_migrations' in tables and bool(db.execute(
                      'SELECT 1 FROM schema_migrations WHERE version=5').fetchone()),
                  'cases': db.execute('SELECT count(*) FROM cases').fetchone()[0] if 'cases' in tables else 0,
                  'knowledge': db.execute('SELECT count(*) FROM knowledge').fetchone()[0] if 'knowledge' in tables else 0}
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
