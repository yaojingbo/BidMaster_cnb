"""知识库 ZIP 安全检查与受限读取。"""
from __future__ import annotations

import io
import stat
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.config import get_settings
from app.utils.exceptions import AppError


@dataclass(frozen=True)
class ArchivePdf:
    path: str
    content: bytes
    compressed_size: int
    uncompressed_size: int
    crc: int


class SafeZipService:
    def __init__(self):
        self.settings = get_settings()

    def read_pdfs(self, content: bytes) -> list[ArchivePdf]:
        if len(content) > self.settings.rag_archive_max_size:
            raise AppError("ZIP 文件超过 50 MiB 限制", 413, "ARCHIVE_TOO_LARGE")
        if not content.startswith(b"PK\x03\x04"):
            raise AppError("文件不是有效 ZIP", 400, "INVALID_ARCHIVE")
        try:
            archive = zipfile.ZipFile(io.BytesIO(content))
        except zipfile.BadZipFile as exc:
            raise AppError("ZIP 文件损坏", 400, "INVALID_ARCHIVE") from exc

        infos = archive.infolist()
        if len(infos) > self.settings.rag_archive_max_entries:
            raise AppError("ZIP 成员数量超过限制", 400, "ARCHIVE_ENTRY_LIMIT")

        accepted: list[zipfile.ZipInfo] = []
        total_declared = 0
        normalized_names: set[str] = set()
        for info in infos:
            if info.is_dir():
                continue
            path = self._validate_path(info.filename)
            key = unicodedata.normalize("NFC", path).casefold()
            if key in normalized_names:
                raise AppError("ZIP 中存在规范化后重名文件", 400, "ARCHIVE_DUPLICATE_PATH")
            normalized_names.add(key)
            if info.flag_bits & 0x1:
                raise AppError("不支持密码或加密 ZIP", 400, "ARCHIVE_ENCRYPTED_NOT_SUPPORTED")
            mode = info.external_attr >> 16
            file_type = stat.S_IFMT(mode)
            if file_type and file_type != stat.S_IFREG:
                raise AppError("ZIP 包含非普通文件", 400, "ARCHIVE_UNSAFE_ENTRY")
            suffix = PurePosixPath(path).suffix.lower()
            if suffix in {".zip", ".rar", ".7z", ".tar", ".gz"}:
                raise AppError("不支持嵌套压缩包", 400, "ARCHIVE_NESTED_NOT_SUPPORTED")
            if suffix != ".pdf":
                raise AppError(f"ZIP 仅允许 PDF：{path}", 400, "ARCHIVE_NON_PDF_ENTRY")
            if info.file_size > self.settings.rag_archive_max_entry_size:
                raise AppError(f"ZIP 成员过大：{path}", 400, "ARCHIVE_ENTRY_TOO_LARGE")
            ratio = info.file_size / max(1, info.compress_size)
            if ratio > self.settings.rag_archive_max_entry_ratio:
                raise AppError(f"ZIP 成员压缩率异常：{path}", 400, "ARCHIVE_COMPRESSION_RATIO")
            total_declared += info.file_size
            accepted.append(info)

        if not accepted:
            raise AppError("ZIP 中没有 PDF", 400, "ARCHIVE_NO_PDF")
        if len(accepted) > self.settings.rag_archive_max_pdf_files:
            raise AppError("ZIP 中 PDF 数量超过限制", 400, "ARCHIVE_PDF_LIMIT")
        if total_declared > self.settings.rag_archive_max_uncompressed_size:
            raise AppError("ZIP 解压总大小超过限制", 400, "ARCHIVE_UNCOMPRESSED_LIMIT")
        total_ratio = total_declared / max(1, len(content))
        if total_ratio > self.settings.rag_archive_max_total_ratio:
            raise AppError("ZIP 整体压缩率异常", 400, "ARCHIVE_COMPRESSION_RATIO")

        result: list[ArchivePdf] = []
        total_actual = 0
        try:
            for info in accepted:
                chunks: list[bytes] = []
                entry_size = 0
                with archive.open(info, "r") as stream:
                    while True:
                        chunk = stream.read(1024 * 1024)
                        if not chunk:
                            break
                        entry_size += len(chunk)
                        total_actual += len(chunk)
                        if entry_size > self.settings.rag_archive_max_entry_size:
                            raise AppError("ZIP 成员实际大小超过限制", 400, "ARCHIVE_ENTRY_TOO_LARGE")
                        if total_actual > self.settings.rag_archive_max_uncompressed_size:
                            raise AppError("ZIP 实际解压总量超过限制", 400, "ARCHIVE_UNCOMPRESSED_LIMIT")
                        chunks.append(chunk)
                data = b"".join(chunks)
                if not data.startswith(b"%PDF-"):
                    raise AppError(f"文件内容不是 PDF：{info.filename}", 400, "ARCHIVE_INVALID_PDF")
                result.append(ArchivePdf(
                    path=self._validate_path(info.filename), content=data,
                    compressed_size=info.compress_size, uncompressed_size=len(data), crc=info.CRC,
                ))
        except (RuntimeError, zipfile.BadZipFile) as exc:
            raise AppError("ZIP 解压或 CRC 校验失败", 400, "ARCHIVE_CORRUPTED") from exc
        finally:
            archive.close()
        return result

    def _validate_path(self, raw: str) -> str:
        if "\x00" in raw or any(ord(char) < 32 for char in raw):
            raise AppError("ZIP 文件名包含非法字符", 400, "ARCHIVE_UNSAFE_PATH")
        path = unicodedata.normalize("NFC", raw.replace("\\", "/"))
        if len(path.encode("utf-8")) > self.settings.rag_archive_max_filename_bytes:
            raise AppError("ZIP 文件名过长", 400, "ARCHIVE_UNSAFE_PATH")
        pure = PurePosixPath(path)
        parts = pure.parts
        if pure.is_absolute() or any(part in {"", ".", ".."} for part in parts):
            raise AppError("ZIP 包含不安全路径", 400, "ARCHIVE_UNSAFE_PATH")
        if parts and ":" in parts[0]:
            raise AppError("ZIP 包含 Windows 绝对路径", 400, "ARCHIVE_UNSAFE_PATH")
        if len(parts) > self.settings.rag_archive_max_path_depth:
            raise AppError("ZIP 路径层级超过限制", 400, "ARCHIVE_UNSAFE_PATH")
        return "/".join(parts)
