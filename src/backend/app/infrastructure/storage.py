from __future__ import annotations
"""
File storage with encryption support using Fernet.
文件内容加密后存入 PostgreSQL（BYTEA 列），本地数据库不可用时回退到磁盘文件。
"""
import uuid
from pathlib import Path
import aiofiles
from cryptography.fernet import Fernet
from typing import Optional

from app.config import get_settings
from app.infrastructure.pg_storage import get_file_content, use_mock_storage


class StorageService:
    """File storage service with Fernet encryption, backed by PostgreSQL."""

    def __init__(self, fernet_key: str = None):
        settings = get_settings()
        self.upload_dir = Path(settings.upload_dir)
        self.fernet_key = fernet_key or settings.fernet_key
        self.upload_dir.mkdir(parents=True, exist_ok=True)

        # Initialize Fernet cipher
        if self.fernet_key:
            self.cipher = Fernet(self.fernet_key.encode())
        else:
            # Generate a key for development (NOT for production)
            self.cipher = Fernet(Fernet.generate_key())

    def _get_file_path(self, file_id: str) -> Path:
        return self.upload_dir / f"{file_id}.enc"

    async def save(self, content: bytes, original_name: str) -> tuple[str, str]:
        """
        Encrypt content and return (file_id, placeholder_path).

        实际存储由调用方通过 pg_storage.add_file(..., encrypted_content=...) 写入数据库。
        这里只负责生成 ID 和加密内容。

        Args:
            content: File content bytes
            original_name: Original filename

        Returns:
            Tuple of (file_id, placeholder_path)
        """
        file_id = str(uuid.uuid4())
        encrypted_content = self.cipher.encrypt(content)
        if use_mock_storage():
            file_path = self._get_file_path(file_id)
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(encrypted_content)
            return file_id, str(file_path), encrypted_content
        return file_id, f"pg://{file_id}", encrypted_content

    async def read(self, file_id: str, user_id: str = None) -> bytes:
        """
        Read and decrypt file content from PostgreSQL.

        Args:
            file_id: File identifier

        Returns:
            Decrypted file content
        """
        if use_mock_storage():
            file_path = self._get_file_path(file_id)
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_id}")
            async with aiofiles.open(file_path, "rb") as f:
                encrypted_content = await f.read()
        else:
            encrypted_content = await get_file_content(file_id, user_id)
            if encrypted_content is None:
                raise FileNotFoundError(f"File not found: {file_id}")

        # Decrypt
        return self.cipher.decrypt(encrypted_content)

    async def delete(self, file_id: str) -> bool:
        """
        Delete is handled by pg_storage.delete_file which removes the entire row.

        Args:
            file_id: File identifier

        Returns:
            True (row deletion is handled elsewhere)
        """
        if use_mock_storage():
            file_path = self._get_file_path(file_id)
            if file_path.exists():
                file_path.unlink()
                return True
            return False
        return True

    async def exists(self, file_id: str) -> bool:
        """Check if file exists in database."""
        if use_mock_storage():
            return self._get_file_path(file_id).exists()
        content = await get_file_content(file_id)
        return content is not None


# Global storage instance
_storage: Optional[StorageService] = None


def get_storage() -> StorageService:
    """Get or create storage service instance."""
    global _storage
    if _storage is None:
        _storage = StorageService()
    return _storage
