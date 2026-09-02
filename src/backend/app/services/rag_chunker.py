"""RAG 文档切片器。"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any


PAGE_MARKER = re.compile(r"^---\s*第\s*(\d+)\s*页(?:文本|表格)?\s*---$")
HEADING = re.compile(
    r"^(?:#{1,6}\s+|第[一二三四五六七八九十百\d]+[章节篇]\s*|"
    r"\d+(?:\.\d+){0,4}[、.．\s]+|[一二三四五六七八九十]+、|（[一二三四五六七八九十\d]+）)"
)


@dataclass
class ChunkDraft:
    chunk_index: int
    content: str
    content_hash: str
    chunk_type: str = "text"
    page_start: int | None = None
    page_end: int | None = None
    section_path: str | None = None
    extraction_method: str = "text"
    metadata: dict[str, Any] = field(default_factory=dict)


class RagChunker:
    def __init__(self, chunk_size: int = 1000, overlap: int = 160, min_chars: int = 80):
        if overlap >= chunk_size:
            raise ValueError("chunk_overlap 必须小于 chunk_size")
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_chars = min_chars

    def chunk(self, text: str, extraction_method: str = "text") -> list[ChunkDraft]:
        blocks = self._parse_blocks(text)
        chunks: list[ChunkDraft] = []
        section: str | None = None
        buffer: list[tuple[str, int | None, str]] = []
        current_length = 0

        def flush() -> None:
            nonlocal buffer, current_length
            if not buffer:
                return
            content = "\n\n".join(item[0] for item in buffer).strip()
            if content:
                pages = [item[1] for item in buffer if item[1] is not None]
                chunk_type = "table" if any(item[2] == "table" for item in buffer) else "text"
                self._append_long_content(
                    chunks, content, pages, section, chunk_type, extraction_method,
                )
            buffer = []
            current_length = 0

        for content, page, block_type in blocks:
            if buffer and block_type != buffer[-1][2]:
                flush()
            if HEADING.match(content.strip()):
                flush()
                section = content.strip()[:500]
            if buffer and current_length + len(content) + 2 > self.chunk_size:
                flush()
            buffer.append((content, page, block_type))
            current_length += len(content) + 2
        flush()

        if len(chunks) > 1 and len(chunks[-1].content) < self.min_chars:
            tail = chunks.pop()
            previous = chunks[-1]
            merged = f"{previous.content}\n\n{tail.content}"
            chunks[-1] = self._build_chunk(
                previous.chunk_index,
                merged,
                [p for p in (previous.page_start, previous.page_end, tail.page_start, tail.page_end) if p is not None],
                previous.section_path,
                "table" if "table" in (previous.chunk_type, tail.chunk_type) else "text",
                extraction_method,
            )
        for index, chunk in enumerate(chunks):
            chunk.chunk_index = index
        return chunks

    def _parse_blocks(self, text: str) -> list[tuple[str, int | None, str]]:
        page: int | None = None
        block_type = "text"
        blocks: list[tuple[str, int | None, str]] = []
        current: list[str] = []

        def flush() -> None:
            if current:
                content = "\n".join(current).strip()
                if content:
                    blocks.append((content, page, block_type))
                current.clear()

        for line in text.replace("\r\n", "\n").split("\n"):
            marker = PAGE_MARKER.match(line.strip())
            if marker:
                flush()
                page = int(marker.group(1))
                block_type = "table" if "表格" in line else "text"
                continue
            if not line.strip():
                flush()
                continue
            current.append(line.rstrip())
        flush()
        return blocks

    def _append_long_content(
        self,
        chunks: list[ChunkDraft],
        content: str,
        pages: list[int],
        section: str | None,
        chunk_type: str,
        extraction_method: str,
    ) -> None:
        if len(content) <= self.chunk_size:
            chunks.append(self._build_chunk(len(chunks), content, pages, section, chunk_type, extraction_method))
            return
        start = 0
        while start < len(content):
            end = min(len(content), start + self.chunk_size)
            piece = content[start:end].strip()
            if piece:
                chunks.append(self._build_chunk(len(chunks), piece, pages, section, chunk_type, extraction_method))
            if end >= len(content):
                break
            start = max(start + 1, end - self.overlap)

    @staticmethod
    def _build_chunk(
        index: int,
        content: str,
        pages: list[int],
        section: str | None,
        chunk_type: str,
        extraction_method: str,
    ) -> ChunkDraft:
        page_start = min(pages) if pages else None
        page_end = max(pages) if pages else None
        normalized = re.sub(r"\s+", " ", content).strip()
        digest_source = f"{page_start}:{page_end}:{section or ''}:{chunk_type}:{normalized}"
        return ChunkDraft(
            chunk_index=index,
            content=content,
            content_hash=hashlib.sha256(digest_source.encode("utf-8")).hexdigest(),
            chunk_type=chunk_type,
            page_start=page_start,
            page_end=page_end,
            section_path=section,
            extraction_method=extraction_method,
            metadata={"char_count": len(content)},
        )
