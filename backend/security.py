"""Opaque sessions and salted PBKDF2 passwords; no browser-supplied role grants."""
import hashlib
import hmac
import secrets

ITERATIONS = 600_000
COOKIE_NAME = "smartmaint_session"
SESSION_SECONDS = 8 * 60 * 60


def password_hash(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest}"


def verify_password(password, encoded):
    algorithm, count, salt, expected = encoded.split("$")
    if algorithm != "pbkdf2_sha256":
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(count)).hex()
    return hmac.compare_digest(actual, expected)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def public_user(row):
    permissions = ["assets:read"]
    if row["role"] in {"maintenance", "expert"}:
        permissions.append("cases:read")
    if row["role"] == "maintenance":
        permissions.extend(["cases:create", "cases:context:write"])
    return {"id": row["id"], "username": row["username"], "name": row["name"],
            "role": row["role"], "permissions": permissions}
