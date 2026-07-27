from __future__ import annotations
"""
File service for handling file uploads, storage, and retrieval.
"""
from app.config import get_settings
from app.infrastructure.storage import StorageService
from app.utils.exceptions import FileTooLargeError, UnsupportedFileTypeError


class FileService:
    """Service for managing file operations."""

    def __init__(self, storage: StorageService = None):
        self.storage = storage or StorageService()
        self.settings = get_settings()

    def validate_file(self, file_content: bytes, mime_type: str) -> None:
        """
        Validate file size and type.

        Args:
            file_content: File content bytes
            mime_type: MIME type of file

        Raises:
            FileTooLargeError: If file exceeds size limit
            UnsupportedFileTypeError: If file type not allowed
        """
        # Check file size
        if len(file_content) > self.settings.max_file_size:
            raise FileTooLargeError("50MB")

        # Check MIME type
        if mime_type not in self.settings.allowed_mime_types:
            allowed = ", ".join(self.settings.allowed_mime_types)
            raise UnsupportedFileTypeError(f"{mime_type}. Allowed: {allowed}")

    async def upload(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str,
        category: str = "tender",
    ) -> dict:
        """
        Upload and encrypt a file.

        Args:
            file_content: File content bytes
            filename: Original filename
            mime_type: MIME type
            category: Document category (tender/bid)

        Returns:
            File metadata including id, path, and encrypted_content for DB storage
        """
        # Validate
        self.validate_file(file_content, mime_type)

        # Encrypt and get content for DB storage
        file_id, encrypted_path, encrypted_content = await self.storage.save(file_content, filename)

        return {
            "id": file_id,
            "name": filename,
            "size": len(file_content),
            "mime_type": mime_type,
            "category": category,
            "encrypted_path": encrypted_path,
            "encrypted_content": encrypted_content,
            "status": "ready",
        }

    async def download(self, file_id: str, user_id: str = None) -> bytes:
        """
        Download and decrypt a file.

        Args:
            file_id: File identifier

        Returns:
            Decrypted file content
        """
        return await self.storage.read(file_id, user_id)

    async def delete(self, file_id: str) -> bool:
        """
        Delete an encrypted file.

        Args:
            file_id: File identifier

        Returns:
            True if deleted
        """
        return await self.storage.delete(file_id)

    async def exists(self, file_id: str) -> bool:
        """Check if file exists."""
        return await self.storage.exists(file_id)


# Global file service instance
_file_service: FileService | None = None


def get_file_service() -> FileService:
    """Get or create file service instance."""
    global _file_service
    if _file_service is None:
        _file_service = FileService()
    return _file_service
