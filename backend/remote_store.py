"""Small synchronous libSQL HTTP v2 adapter for the existing SQLite domain.

Each context owns a server stream. Writes commit remotely before returning;
network/commit failures are never retried or redirected to a local database.
Protocol: https://github.com/tursodatabase/libsql/blob/main/docs/HTTP_V2_SPEC.md
"""
import base64
import http.client
import json
import os
import sqlite3
from contextlib import closing
from urllib.parse import urlsplit


class RemoteDatabaseError(sqlite3.OperationalError):
    pass


def settings():
    mode = os.getenv('SMARTMAINT_STORAGE', 'sqlite').strip().lower()
    if mode not in {'sqlite', 'turso'}:
        raise ValueError('SMARTMAINT_STORAGE must be sqlite or turso')
    if mode == 'sqlite':
        return None
    url = os.getenv('TURSO_DATABASE_URL', '').strip()
    token = os.getenv('TURSO_AUTH_TOKEN', '').strip()
    parts = urlsplit(url)
    if (parts.scheme not in {'libsql', 'https'} or not parts.hostname
            or not parts.hostname.endswith('.turso.io') or parts.port
            or parts.username or parts.password or parts.path not in {'', '/'}
            or parts.query or parts.fragment):
        raise ValueError('TURSO_DATABASE_URL must be a libsql:// or https:// Turso database hostname')
    if not token or any(c.isspace() for c in token):
        raise ValueError('TURSO_AUTH_TOKEN is required for turso storage')
    return 'https://' + parts.hostname, token


def encode(value):
    if value is None:
        return {'type': 'null'}
    if isinstance(value, (bool, int)):
        return {'type': 'integer', 'value': str(int(value))}
    if isinstance(value, float):
        return {'type': 'float', 'value': value}
    if isinstance(value, str):
        return {'type': 'text', 'value': value}
    if isinstance(value, bytes):
        return {'type': 'blob', 'base64': base64.b64encode(value).decode('ascii')}
    raise TypeError('Unsupported SQL parameter type')


def decode(value):
    kind = value['type']
    if kind == 'null':
        return None
    if kind == 'integer':
        return int(value['value'])
    if kind == 'float':
        return float(value['value'])
    if kind == 'text':
        return value['value']
    if kind == 'blob':
        return base64.b64decode(value['base64'])
    raise RemoteDatabaseError('Unsupported remote SQL value')


class Row:
    """sqlite3.Row-compatible keys, iteration over values and integer lookup."""
    def __init__(self, names, values):
        self.names, self.values = names, tuple(values)

    def keys(self):
        return self.names

    def __getitem__(self, key):
        return self.values[self.names.index(key)] if isinstance(key, str) else self.values[key]

    def __iter__(self):
        return iter(self.values)

    def __len__(self):
        return len(self.values)


class Cursor:
    def __init__(self, result):
        names = [c['name'] for c in result.get('cols', [])]
        self.rows = iter([Row(names, [decode(v) for v in row]) for row in result.get('rows', [])])
        self.rowcount = result.get('affected_row_count', 0)
        last = result.get('last_insert_rowid')
        self.lastrowid = int(last) if last is not None else None

    def fetchone(self):
        return next(self.rows, None)

    def fetchall(self):
        return list(self.rows)

    def __iter__(self):
        return self.rows


class Connection:
    def __init__(self, url, token):
        self.url, self.token = url, token
        self.host = urlsplit(url).hostname
        self.transport = None
        self.baton = None
        self.in_transaction = False
        self.closed = False
        self.broken = False

    def _send(self, request):
        if self.closed or self.broken:
            raise RemoteDatabaseError('Remote database connection is unavailable')
        body = json.dumps({'baton': self.baton, 'requests': [request]}, allow_nan=False).encode('utf-8')
        try:
            if self.transport is None:
                self.transport = http.client.HTTPSConnection(self.host, timeout=10)
            self.transport.request('POST', '/v2/pipeline', body, {
                'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
            response = self.transport.getresponse()
            data = response.read()
            if response.status != 200:
                raise RemoteDatabaseError('Remote database rejected the request; check credentials and quota')
            payload = json.loads(data)
            self.baton = payload['baton']
            base = payload.get('base_url')
            if base:
                # Only permit trusted provider routing; never forward the token to arbitrary hosts.
                parts = urlsplit(base)
                if (parts.scheme != 'https' or not parts.hostname or not parts.hostname.endswith('.turso.io')
                        or parts.username or parts.password or parts.port
                        or parts.path not in {'', '/'} or parts.query or parts.fragment):
                    raise RemoteDatabaseError('Untrusted remote database routing URL')
                if parts.hostname != self.host:
                    self.transport.close()
                    self.transport = None
                    self.host = parts.hostname
            result = payload['results'][0]
        except (OSError, http.client.HTTPException, ValueError, KeyError, IndexError, RemoteDatabaseError):
            self.broken = True
            raise RemoteDatabaseError('Remote database request failed; transaction outcome must be checked') from None
        if result['type'] == 'error':
            error = result.get('error', {})
            code = error.get('code', '')
            if code.startswith('SQLITE_CONSTRAINT'):
                raise sqlite3.IntegrityError(error.get('message', 'Remote SQL constraint failed'))
            raise RemoteDatabaseError('Remote SQL operation failed (' + code + ')')
        if request['type'] != 'close' and not self.baton:
            self.broken = True
            raise RemoteDatabaseError('Remote database stream expired')
        return result['response']

    def execute(self, sql, parameters=()):
        verb = sql.lstrip().split(None, 1)[0].upper()
        # Match sqlite3 legacy transaction semantics for application DML.
        if verb in {'INSERT', 'UPDATE', 'DELETE', 'REPLACE'} and not self.in_transaction:
            self.execute('BEGIN DEFERRED')
        result = self._send({'type': 'execute', 'stmt': {
            'sql': sql, 'args': [encode(v) for v in parameters], 'want_rows': True}})
        if verb == 'BEGIN':
            self.in_transaction = True
        elif verb in {'COMMIT', 'ROLLBACK', 'END'}:
            self.in_transaction = False
        return Cursor(result['result'])

    def executemany(self, sql, parameters):
        # One transaction; failure propagates to store.connect(), which rolls back.
        cursor = Cursor({})
        for values in parameters:
            cursor = self.execute(sql, values)
        return cursor

    def executescript(self, sql):
        # Unlike pipeline execute[], sequence stops at the first failing statement.
        self._send({'type': 'sequence', 'sql': sql})

    def commit(self):
        if self.in_transaction:
            self.execute('COMMIT')

    def rollback(self):
        if self.in_transaction and not self.broken:
            self.execute('ROLLBACK')

    def close(self):
        if self.closed:
            return
        try:
            if self.baton and not self.broken:
                self._send({'type': 'close'})
        except RemoteDatabaseError:
            pass  # Closing a stream must not hide a successful COMMIT or the original exception.
        finally:
            self.closed = True
            if self.transport:
                self.transport.close()


def initialize_demo_remote():
    """Bootstrap a NEW libSQL database in one transaction; preserve current data.

    Build the schema and synthetic seed locally first, avoiding hundreds of
    migration roundtrips inside libSQL's five-second transaction window.
    Existing older remote schemas require a deliberate backed-up migration.
    """
    import tempfile
    from pathlib import Path
    from .setup_demo import initialize_demo
    from .store import connect, local_storage
    with connect(None) as db:
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
        if tables:
            if 'schema_migrations' not in tables or not db.execute('SELECT 1 FROM schema_migrations WHERE version=5').fetchone():
                raise ValueError('Remote schema is not version 5; back up and migrate it explicitly before deploying')
            return {'usersCreated': 0, 'samplesAdded': 0}
    with tempfile.TemporaryDirectory(prefix='smartmaint-seed-') as directory:
        path = Path(directory) / 'seed.sqlite3'
        with local_storage():
            result = initialize_demo(path)
        with closing(sqlite3.connect(path)) as seed:
            # iterdump interleaves CREATE/INSERT by table name. Create ALL tables
            # before loading rows so FK targets exist, then defer FK validation
            # until commit. Triggers must be created after the historic seed rows.
            statements, current = [], ''
            for line in seed.iterdump():
                current += line + '\n'
                if sqlite3.complete_statement(current):
                    statements.append(current.strip())
                    current = ''
            statements = [s for s in statements if s not in {'BEGIN TRANSACTION;', 'COMMIT;'}]
            tables = [s for s in statements if s.startswith('CREATE TABLE')]
            remaining = [s for s in statements if not s.startswith('CREATE TABLE')]
            dump = 'PRAGMA defer_foreign_keys=ON;\n' + '\n'.join(tables + remaining)
    with connect(None) as db:
        db.execute('BEGIN IMMEDIATE')
        # Recheck under the write lock: two simultaneous cold starts must not reseed.
        if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1").fetchone():
            raise ValueError('Remote database was initialized concurrently; restart deployment')
        db.executescript(dump)
        if db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Remote seed has invalid foreign keys')
    return result
