from __future__ import annotations
"""
Encryption service for file content encryption/decryption.
"""
from cryptography.fernet import Fernet
from typing import Optional

from app.config import get_settings


class EncryptionService:
    """Service for encrypting and decrypting file content."""

    def __init__(self, key: Optional[str] = None):
        settings = get_settings()
        self.key = key or settings.fernet_key

        if self.key:
            self.fernet = Fernet(self.key.encode() if isinstance(self.key, str) else self.key)
        else:
            # 从 JWT secret 派生稳定密钥，确保重启后仍可解密
            self.fernet = Fernet(self.key_from_password(settings.jwt_secret, b"bidmaster-fernet-salt"))

    def encrypt(self, data: bytes) -> bytes:
        """
        Encrypt data using Fernet symmetric encryption.

        Args:
            data: Raw data to encrypt

        Returns:
            Encrypted data
        """
        return self.fernet.encrypt(data)

    def decrypt(self, encrypted_data: bytes) -> bytes:
        """
        Decrypt data using Fernet symmetric encryption.

        Args:
            encrypted_data: Encrypted data

        Returns:
            Decrypted data
        """
        return self.fernet.decrypt(encrypted_data)

    @staticmethod
    def generate_key() -> bytes:
        """Generate a new Fernet key."""
        return Fernet.generate_key()

    @staticmethod
    def key_from_password(password: str, salt: bytes) -> bytes:
        """
        Derive a Fernet key from a password and salt.

        Args:
            password: User password
            salt: Random salt

        Returns:
            Derived key suitable for Fernet
        """
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        import base64

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key


# Global encryption service instance
_encryption_service: EncryptionService | None = None


def get_encryption_service() -> EncryptionService:
    """Get or create encryption service instance."""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service