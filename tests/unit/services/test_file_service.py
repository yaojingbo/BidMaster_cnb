"""
File service unit tests.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.file_service import FileService
from app.utils.exceptions import FileTooLargeError, UnsupportedFileTypeError


class TestFileService:
    """Tests for FileService."""

    @pytest.fixture
    def storage(self):
        """Create mocked storage service."""
        storage = MagicMock()
        storage.save = AsyncMock(return_value=("file-1", "pg://file-1", b"encrypted"))
        storage.read = AsyncMock(return_value=b"file content")
        storage.delete = AsyncMock(return_value=True)
        storage.exists = AsyncMock(return_value=True)
        return storage

    @pytest.fixture
    def service(self, storage):
        """Create service with mocked storage."""
        return FileService(storage=storage)

    def test_validate_file_accepts_allowed_type(self, service):
        """允许的文件类型和大小应通过校验。"""
        service.validate_file(b"PDF content", "application/pdf")

    def test_validate_file_size_limit(self, service):
        """超出大小限制应抛出 FileTooLargeError。"""
        large_content = b"x" * (service.settings.max_file_size + 1)
        with pytest.raises(FileTooLargeError):
            service.validate_file(large_content, "application/pdf")

    def test_validate_unsupported_mime_type(self, service):
        """不支持的 MIME 类型应抛出 UnsupportedFileTypeError。"""
        with pytest.raises(UnsupportedFileTypeError):
            service.validate_file(b"content", "application/octet-stream")

    @pytest.mark.asyncio
    async def test_upload_success(self, service, storage):
        """上传成功应返回当前 schema 使用的文件元数据。"""
        result = await service.upload(b"PDF content", "test.pdf", "application/pdf", category="tender")

        storage.save.assert_awaited_once_with(b"PDF content", "test.pdf")
        assert result["id"] == "file-1"
        assert result["name"] == "test.pdf"
        assert result["size"] == len(b"PDF content")
        assert result["mime_type"] == "application/pdf"
        assert result["category"] == "tender"
        assert result["encrypted_path"] == "pg://file-1"
        assert result["encrypted_content"] == b"encrypted"
        assert result["status"] == "ready"

    @pytest.mark.asyncio
    async def test_download_returns_storage_content(self, service, storage):
        """下载应返回 storage.read 的内容。"""
        result = await service.download("file-1")
        storage.read.assert_awaited_once_with("file-1", None)
        assert result == b"file content"

    @pytest.mark.asyncio
    async def test_delete_delegates_to_storage(self, service, storage):
        """删除应委托给 storage.delete。"""
        result = await service.delete("file-1")
        storage.delete.assert_awaited_once_with("file-1")
        assert result is True

    @pytest.mark.asyncio
    async def test_exists_delegates_to_storage(self, service, storage):
        """存在性检查应委托给 storage.exists。"""
        result = await service.exists("file-1")
        storage.exists.assert_awaited_once_with("file-1")
        assert result is True
