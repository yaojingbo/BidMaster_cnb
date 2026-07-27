"""
Crypto utility unit tests.
"""
import pytest

from app.utils.crypto import generate_salt, hash_password, verify_password, generate_api_key


class TestGenerateSalt:
    """Tests for salt generation."""

    def test_salt_is_bytes(self):
        salt = generate_salt()
        assert isinstance(salt, bytes)

    def test_salt_default_length(self):
        salt = generate_salt()
        assert len(salt) == 32

    def test_salt_custom_length(self):
        salt = generate_salt(length=16)
        assert len(salt) == 16

    def test_different_salts_are_different(self):
        salt1 = generate_salt()
        salt2 = generate_salt()
        assert salt1 != salt2


class TestHashPassword:
    """Tests for password hashing."""

    def test_hash_is_string(self):
        salt = generate_salt()
        hash_val = hash_password("password123", salt)
        assert isinstance(hash_val, str)

    def test_same_password_same_salt_same_hash(self):
        salt = generate_salt()
        hash1 = hash_password("password123", salt)
        hash2 = hash_password("password123", salt)
        assert hash1 == hash2

    def test_different_password_different_hash(self):
        salt = generate_salt()
        hash1 = hash_password("password123", salt)
        hash2 = hash_password("password456", salt)
        assert hash1 != hash2

    def test_same_password_different_salt_different_hash(self):
        hash1 = hash_password("password123", generate_salt())
        hash2 = hash_password("password123", generate_salt())
        assert hash1 != hash2


class TestVerifyPassword:
    """Tests for password verification."""

    def test_correct_password(self):
        salt = generate_salt()
        hash_val = hash_password("password123", salt)
        assert verify_password("password123", salt, hash_val) is True

    def test_wrong_password(self):
        salt = generate_salt()
        hash_val = hash_password("password123", salt)
        assert verify_password("wrongpassword", salt, hash_val) is False

    def test_wrong_salt(self):
        salt1 = generate_salt()
        salt2 = generate_salt()
        hash_val = hash_password("password123", salt1)
        assert verify_password("password123", salt2, hash_val) is False


class TestGenerateApiKey:
    """Tests for API key generation."""

    def test_key_is_string(self):
        key = generate_api_key()
        assert isinstance(key, str)

    def test_key_length(self):
        key = generate_api_key()
        # token_urlsafe(32) produces ~43 chars
        assert len(key) >= 32

    def test_different_keys_are_different(self):
        key1 = generate_api_key()
        key2 = generate_api_key()
        assert key1 != key2