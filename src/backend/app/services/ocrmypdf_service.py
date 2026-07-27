"""
OCRmyPDF + Tesseract 本地 OCR 服务。
"""
from __future__ import annotations

import asyncio
import io
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_DEFAULT_LANGUAGE = "chi_sim+eng"
_DEFAULT_MAX_PAGES = 15
_LAST_EVIDENCE: dict[str, str] | None = None


def get_last_ocrmypdf_evidence() -> dict[str, str] | None:
    return _LAST_EVIDENCE


def _save_evidence(pdf_bytes: bytes, text: str) -> dict[str, str] | None:
    global _LAST_EVIDENCE

    if os.getenv("OCR_SAVE_EVIDENCE", "true").lower() not in {"1", "true", "yes", "on"}:
        _LAST_EVIDENCE = None
        return None

    evidence_dir = Path(os.getenv("OCR_EVIDENCE_DIR", "tmp/ocr-evidence"))
    evidence_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
    pdf_path = evidence_dir / f"{stem}.pdf"
    text_path = evidence_dir / f"{stem}.txt"
    pdf_path.write_bytes(pdf_bytes)
    text_path.write_text(text, encoding="utf-8")
    _LAST_EVIDENCE = {
        "pdf_path": str(pdf_path.resolve()),
        "text_path": str(text_path.resolve()),
    }
    logger.info("OCRmyPDF 证据文件已保存: pdf=%s text=%s", _LAST_EVIDENCE["pdf_path"], _LAST_EVIDENCE["text_path"])
    return _LAST_EVIDENCE


def get_ocrmypdf_status() -> dict[str, object]:
    ocrmypdf_path = shutil.which("ocrmypdf")
    tesseract_path = shutil.which("tesseract")
    languages: list[str] = []
    language_error = ""

    if tesseract_path:
        try:
            result = subprocess.run(
                ["tesseract", "--list-langs"],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
            output = "\n".join([result.stdout, result.stderr])
            languages = [line.strip() for line in output.splitlines() if line.strip() and not line.lower().startswith("list of available")]
            if result.returncode != 0:
                language_error = output.strip()[:300]
        except Exception as exc:
            language_error = str(exc)

    missing = []
    if not ocrmypdf_path:
        missing.append("ocrmypdf")
    if not tesseract_path:
        missing.append("tesseract")
    if "chi_sim" not in languages:
        missing.append("chi_sim")
    if "eng" not in languages:
        missing.append("eng")

    return {
        "available": not missing,
        "ocrmypdf": bool(ocrmypdf_path),
        "tesseract": bool(tesseract_path),
        "chi_sim": "chi_sim" in languages,
        "eng": "eng" in languages,
        "languages": languages,
        "missing": missing,
        "error": language_error,
    }


def is_ocrmypdf_available() -> bool:
    return bool(get_ocrmypdf_status()["available"])


def _page_range(page_numbers: Optional[list[int]], max_pages: int | None) -> str | None:
    if page_numbers:
        pages = sorted({page for page in page_numbers if page > 0})
        return ",".join(str(page) for page in pages)

    if max_pages is None:
        return None

    return f"1-{max_pages}"


def _format_pdf_table(table: list[list[object]]) -> str:
    rows: list[str] = []
    for row in table or []:
        cells = [str(cell).strip() if cell is not None else "" for cell in row]
        if any(cells):
            rows.append(" | ".join(cells))
    return "\n".join(rows)


def _extract_text_from_pdf(content: bytes, max_pages: int | None) -> str:
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        pages = pdf.pages if max_pages is None else pdf.pages[:max_pages]
        for page_index, page in enumerate(pages, start=1):
            page_parts: list[str] = []
            page_text = page.extract_text() or ""
            if page_text.strip():
                page_parts.append(f"--- 第 {page_index} 页 OCR 文本 ---\n{page_text.strip()}")

            table_parts = []
            for table in page.extract_tables() or []:
                table_text = _format_pdf_table(table)
                if table_text.strip():
                    table_parts.append(table_text)
            if table_parts:
                page_parts.append(f"--- 第 {page_index} 页 OCR 表格 ---\n" + "\n\n".join(table_parts))

            if page_parts:
                parts.append("\n\n".join(page_parts))

    return "\n\n".join(parts)


async def ocrmypdf_pdf(
    content: bytes,
    page_numbers: list[int] | None = None,
    progress_callback=None,
    max_pages: int | None = None,
    timeout_seconds: int | None = None,
    cancel_event: asyncio.Event | None = None,
) -> str:
    if not is_ocrmypdf_available():
        status = get_ocrmypdf_status()
        missing = ", ".join(str(item) for item in status["missing"])
        raise RuntimeError(f"OCRmyPDF 环境不可用，缺少: {missing}")

    pages = _page_range(page_numbers, max_pages)
    page_limit = max_pages

    if progress_callback:
        await progress_callback(1, 2)

    with tempfile.TemporaryDirectory(prefix="bidmaster-ocrmypdf-") as tmpdir:
        input_path = Path(tmpdir) / "input.pdf"
        output_path = Path(tmpdir) / "output.pdf"
        input_path.write_bytes(content)

        command = [
            "ocrmypdf",
            "--skip-text",
            "--language",
            _DEFAULT_LANGUAGE,
            "--jobs",
            "1",
        ]
        if pages:
            command.extend(["--pages", pages])
        command.extend([
            "--quiet",
            str(input_path),
            str(output_path),
        ])

        logger.info("启动 OCRmyPDF: pages=%s", pages or "all")
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        communicate_task = asyncio.create_task(process.communicate())
        started_at = asyncio.get_running_loop().time()
        try:
            while not communicate_task.done():
                if cancel_event and cancel_event.is_set():
                    process.terminate()
                    await process.wait()
                    return ""
                if timeout_seconds and asyncio.get_running_loop().time() - started_at > timeout_seconds:
                    process.terminate()
                    await process.wait()
                    raise RuntimeError(f"OCRmyPDF 超过 {timeout_seconds} 秒未完成")
                await asyncio.sleep(0.2)
            stdout, stderr = await communicate_task
        except asyncio.CancelledError:
            process.terminate()
            await process.wait()
            raise
        except Exception:
            if process.returncode is None:
                process.terminate()
                await process.wait()
            raise

        if process.returncode != 0:
            error_text = stderr.decode("utf-8", errors="ignore").strip() or stdout.decode("utf-8", errors="ignore").strip()
            raise RuntimeError(error_text[:300] or "OCRmyPDF 执行失败")

        if not output_path.exists():
            raise RuntimeError("OCRmyPDF 未生成带文字层 PDF")

        if progress_callback:
            await progress_callback(2, 2)

        output_bytes = output_path.read_bytes()
        text = _extract_text_from_pdf(output_bytes, page_limit)
        _save_evidence(output_bytes, text)
        return text
