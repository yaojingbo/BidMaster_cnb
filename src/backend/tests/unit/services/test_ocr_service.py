"""
OCR 服务调度器单元测试。
"""
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _install_ocrmypdf_module(available: bool = True, text: str = "本地识别文本", error: Exception | None = None):
    fake_module = types.ModuleType("app.services.ocrmypdf_service")
    fake_module.is_ocrmypdf_available = MagicMock(return_value=available)
    fake_module.ocrmypdf_pdf = AsyncMock(side_effect=error) if error else AsyncMock(return_value=text)
    sys.modules["app.services.ocrmypdf_service"] = fake_module
    return fake_module


def _install_paddleocr_module(available: bool = True, text: str = "PaddleOCR 文本", error: Exception | None = None):
    fake_module = types.ModuleType("app.services.paddleocr_service")
    fake_module.is_paddleocr_available = MagicMock(return_value=available)
    fake_module.paddleocr_pdf = AsyncMock(side_effect=error) if error else AsyncMock(return_value=text)
    sys.modules["app.services.paddleocr_service"] = fake_module
    return fake_module


def _cleanup_ocr_modules():
    sys.modules.pop("app.services.ocrmypdf_service", None)
    sys.modules.pop("app.services.paddleocr_service", None)


@pytest.mark.asyncio
async def test_engine_ocrmypdf_uses_local_when_available():
    fake_ocrmypdf = _install_ocrmypdf_module(available=True, text="OCRmyPDF 文本")

    from app.services.ocr_service import ocr_pdf

    result = await ocr_pdf(
        content=b"%PDF-FAKE",
        provider="dashscope",
        engine="ocrmypdf",
    )

    assert result == "OCRmyPDF 文本"
    fake_ocrmypdf.ocrmypdf_pdf.assert_awaited_once()
    _cleanup_ocr_modules()


@pytest.mark.asyncio
async def test_engine_ocrmypdf_raises_when_not_installed():
    _install_ocrmypdf_module(available=False)

    from app.services.ocr_service import ocr_pdf

    with pytest.raises(RuntimeError, match="OCRmyPDF"):
        await ocr_pdf(content=b"%PDF-FAKE", provider="dashscope", engine="ocrmypdf")

    _cleanup_ocr_modules()


@pytest.mark.asyncio
async def test_engine_auto_uses_ocrmypdf_first_on_macos():
    fake_ocrmypdf = _install_ocrmypdf_module(available=True, text="OCRmyPDF 文本")
    fake_paddleocr = _install_paddleocr_module(available=True, text="PaddleOCR 文本")

    from app.services.ocr_service import ocr_pdf

    with patch("app.services.ocr_service.platform.system", return_value="Darwin"):
        result = await ocr_pdf(
            content=b"%PDF-FAKE",
            provider="dashscope",
            engine="auto",
        )

    assert result == "OCRmyPDF 文本"
    fake_ocrmypdf.ocrmypdf_pdf.assert_awaited_once()
    fake_paddleocr.paddleocr_pdf.assert_not_called()
    _cleanup_ocr_modules()


@pytest.mark.asyncio
async def test_engine_auto_falls_back_to_llm_when_ocrmypdf_missing_on_macos():
    _install_ocrmypdf_module(available=False)
    fake_paddleocr = _install_paddleocr_module(available=True, text="PaddleOCR 文本")

    from app.services.ocr_service import ocr_pdf

    with patch("app.services.ocr_service.platform.system", return_value="Darwin"):
        with patch("app.services.ocr_service._ocr_pdf_llm", new=AsyncMock(return_value="LLM 文本")) as mock_llm:
            result = await ocr_pdf(
                content=b"%PDF-FAKE",
                provider="dashscope",
                engine="auto",
            )

    assert result == "LLM 文本"
    mock_llm.assert_awaited_once()
    fake_paddleocr.paddleocr_pdf.assert_not_called()
    _cleanup_ocr_modules()


@pytest.mark.asyncio
async def test_engine_auto_tries_paddleocr_on_linux_after_ocrmypdf_failure():
    _install_ocrmypdf_module(available=True, error=RuntimeError("OCRmyPDF 失败"))
    fake_paddleocr = _install_paddleocr_module(available=True, text="PaddleOCR 文本")

    from app.services.ocr_service import ocr_pdf

    with patch("app.services.ocr_service.platform.system", return_value="Linux"):
        result = await ocr_pdf(
            content=b"%PDF-FAKE",
            provider="dashscope",
            engine="auto",
        )

    assert result == "PaddleOCR 文本"
    fake_paddleocr.paddleocr_pdf.assert_awaited_once()
    _cleanup_ocr_modules()


@pytest.mark.asyncio
async def test_engine_paddleocr_uses_local_when_available():
    fake_paddleocr = _install_paddleocr_module(available=True, text="PaddleOCR 文本")

    from app.services.ocr_service import ocr_pdf

    result = await ocr_pdf(
        content=b"%PDF-FAKE",
        provider="dashscope",
        engine="paddleocr",
    )

    assert result == "PaddleOCR 文本"
    fake_paddleocr.paddleocr_pdf.assert_awaited_once()
    _cleanup_ocr_modules()


@pytest.mark.asyncio
async def test_engine_paddleocr_raises_when_not_installed():
    _install_paddleocr_module(available=False)

    from app.services.ocr_service import ocr_pdf

    with pytest.raises(RuntimeError, match="PaddleOCR 未安装"):
        await ocr_pdf(content=b"%PDF-FAKE", provider="dashscope", engine="paddleocr")

    _cleanup_ocr_modules()


@pytest.mark.asyncio
async def test_engine_llm_skips_local_ocr_entirely():
    fake_ocrmypdf = _install_ocrmypdf_module(available=True)
    fake_paddleocr = _install_paddleocr_module(available=True)

    from app.services.ocr_service import ocr_pdf

    with patch("app.services.ocr_service._ocr_pdf_llm", new=AsyncMock(return_value="LLM 文本")) as mock_llm:
        result = await ocr_pdf(
            content=b"%PDF-FAKE",
            provider="dashscope",
            engine="llm",
        )

    assert result == "LLM 文本"
    mock_llm.assert_awaited_once()
    fake_ocrmypdf.ocrmypdf_pdf.assert_not_called()
    fake_paddleocr.paddleocr_pdf.assert_not_called()
    _cleanup_ocr_modules()
