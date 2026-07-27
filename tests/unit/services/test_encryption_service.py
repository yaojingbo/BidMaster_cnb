"""
Encryption service unit tests.
"""
import pytest
from cryptography.fernet import Fernet

from app.services.encryption_service import EncryptionService


class TestEncryptionService:
    """Tests for EncryptionService encrypt/decrypt operations."""

    @pytest.fixture
    def service(self):
        """Create service with a generated key for testing."""
        key = Fernet.generate_key()
        return EncryptionService(key=key.decode())

    def test_encrypt_returns_different_data(self, service):
        """加密后数据应与原始数据不同。"""
        original = b"sensitive document content"
        encrypted = service.encrypt(original)
        assert encrypted != original

    def test_decrypt_returns_original(self, service):
        """解密后应还原原始数据。"""
        original = b"sensitive document content"
        encrypted = service.encrypt(original)
        decrypted = service.decrypt(encrypted)
        assert decrypted == original

    def test_encrypted_data_is_bytes(self, service):
        """加密结果应为 bytes 类型。"""
        original = b"test data"
        encrypted = service.encrypt(original)
        assert isinstance(encrypted, bytes)

    def test_different_encryptions_are_different(self, service):
        """同一数据多次加密应产生不同结果。"""
        original = b"same data"
        encrypted1 = service.encrypt(original)
        encrypted2 = service.encrypt(original)
        assert encrypted1 != encrypted2

    def test_decrypt_wrong_data_raises_error(self, service):
        """解密无效数据应抛出异常。"""
        with pytest.raises(Exception):
            service.decrypt(b"invalid encrypted data")

    def test_generate_key_produces_valid_fernet_key(self):
        """generate_key 应产生有效的 Fernet 密钥。"""
        key = EncryptionService.generate_key()
        assert isinstance(key, bytes)
        assert len(key) == 44

    def test_key_from_password_produces_valid_key(self):
        """key_from_password 应产生有效的 Fernet 密钥。"""
        key = EncryptionService.key_from_password("test_password_123", b"salt_value_12345")
        assert isinstance(key, bytes)
        assert len(key) == 44

    def test_key_from_password_same_inputs_same_key(self):
        """相同密码和盐应产生相同密钥。"""
        key1 = EncryptionService.key_from_password("test_password_123", b"salt_value_12345")
        key2 = EncryptionService.key_from_password("test_password_123", b"salt_value_12345")
        assert key1 == key2

    def test_key_from_password_different_salt_different_key(self):
        """不同盐应产生不同密钥。"""
        key1 = EncryptionService.key_from_password("test_password_123", b"salt_1")
        key2 = EncryptionService.key_from_password("test_password_123", b"salt_2")
        assert key1 != key2

    def test_encrypt_decrypt_roundtrip_large_data(self, service):
        """加密解密大内容应正确还原。"""
        original = b"large document content " * 1000
        encrypted = service.encrypt(original)
        decrypted = service.decrypt(encrypted)
        assert decrypted == original
