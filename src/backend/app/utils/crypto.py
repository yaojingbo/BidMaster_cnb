"""
Crypto utilities for password hashing, encryption, and JWT tokens.
"""
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt


def generate_salt(length: int = 32) -> bytes:
    """Generate a random salt."""
    return secrets.token_bytes(length)


def hash_password(password: str, salt: bytes) -> str:
    """Hash password with salt using PBKDF2."""
    dk = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode(),
        salt,
        iterations=480000,
    )
    return dk.hex()


def verify_password(password: str, salt: bytes, expected_hash: str) -> bool:
    """Verify password against stored hash."""
    actual_hash = hash_password(password, salt)
    return secrets.compare_digest(actual_hash, expected_hash)


def generate_api_key() -> str:
    """Generate a random API key."""
    return secrets.token_urlsafe(32)


def create_access_token(data: dict, secret: str, expire_minutes: int = 60) -> str:
    """Create JWT access token."""
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload["type"] = "access"
    return jwt.encode(payload, secret, algorithm="HS256")


def create_refresh_token(data: dict, secret: str, expire_days: int = 7) -> str:
    """Create JWT refresh token."""
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=expire_days)
    payload["type"] = "refresh"
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str, secret: str) -> Optional[dict]:
    """Decode and validate JWT token. Returns None if invalid/expired."""
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None