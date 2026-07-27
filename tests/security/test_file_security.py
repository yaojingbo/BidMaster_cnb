"""Security tests for file operations."""
import pytest
from app.services.encryption_service import EncryptionService


class TestFileSecurity:
    """Security tests for file handling."""

    @pytest.fixture
    def service(self):
        """Create service instance."""
        return EncryptionService()

    def test_sql_injection_prevention(self, service):
        """Test SQL injection prevention in file operations."""
        malicious_input = "test.pdf'; DROP TABLE users; --"

        encrypted = service.encrypt_text(malicious_input)
        decrypted = service.decrypt_text(encrypted)

        # The malicious input should be preserved, not executed
        assert decrypted == malicious_input

    def test_path_traversal_prevention(self, service):
        """Test path traversal prevention."""
        malicious_path = "../../../etc/passwd"

        encrypted = service.encrypt_text(malicious_path)
        decrypted = service.decrypt_text(encrypted)

        # The path should be preserved
        assert decrypted == malicious_path

    def test_large_encrypted_content_integrity(self, service):
        """Test that large encrypted content maintains integrity."""
        large_content = "x" * 5 * 1024 * 1024  # 5MB

        encrypted = service.encrypt_text(large_content)
        decrypted = service.decrypt_text(encrypted)

        assert decrypted == large_content

    def test_binary_content_encryption(self, service):
        """Test encrypting binary content."""
        binary_content = bytes(range(256))

        encrypted = service.encrypt_text(binary_content.decode('latin-1'))
        decrypted = service.decrypt_text(encrypted)

        assert decrypted.encode('latin-1') == binary_content
