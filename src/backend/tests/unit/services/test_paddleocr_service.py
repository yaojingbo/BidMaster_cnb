"""
PaddleOCR 服务单元测试。

由于 paddlepaddle/paddleocr 是可选依赖（生产环境可能未安装），
测试通过 monkeypatch 和 mock 模拟依赖注入，确保即使用户未装 paddleocr 也能跑通测试。
"""
import builtins
import sys
import types
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def fake_paddleocr():
    """注入 fake paddleocr 模块，模拟 PaddleOCR 已安装。

    Returns:
        dict: 包含 fake_engine（OCR 实例）和 fake_module（PaddleOCR 类 mock）
    """
    fake_module = types.ModuleType("paddleocr")
    fake_engine = MagicMock()
    fake_engine.ocr.return_value = [
        [
            ([(0, 0), (100, 0), (100, 30), (0, 30)], ("测试文字", 0.99)),
            ([(0, 30), (100, 30), (100, 60), (0, 60)], ("第二行", 0.97)),
        ]
    ]
    fake_module.PaddleOCR = MagicMock(return_value=fake_engine)
    fake_paddle = types.ModuleType("paddle")
    sys.modules["paddleocr"] = fake_module
    sys.modules["paddle"] = fake_paddle
    # 清理可能的 lru_cache
    from app.services import paddleocr_service
    paddleocr_service._get_ocr_engine.cache_clear()
    yield {"engine": fake_engine, "module": fake_module}
    sys.modules.pop("paddleocr", None)
    sys.modules.pop("paddle", None)
    paddleocr_service._get_ocr_engine.cache_clear()


@pytest.fixture
def fake_paddleocr_missing():
    """模拟 paddleocr 未安装（ImportError）。"""
    sys.modules.pop("paddleocr", None)
    sys.modules.pop("paddle", None)
    original_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name in {"paddleocr", "paddle"}:
            raise ImportError(f"No module named '{name}'")
        return original_import(name, *args, **kwargs)

    with patch("builtins.__import__", side_effect=fake_import):
        yield


@pytest.fixture
def fake_fitz(monkeypatch):
    """注入 fake PyMuPDF：构造 2 页 PDF，每页返回固定 PNG bytes。"""
    fake_fitz = types.ModuleType("fitz")

    fake_page1 = MagicMock()
    fake_page1.get_pixmap.return_value.tobytes.return_value = b"PNG1"
    fake_page2 = MagicMock()
    fake_page2.get_pixmap.return_value.tobytes.return_value = b"PNG2"

    fake_doc = MagicMock()
    fake_doc.__iter__ = MagicMock(return_value=iter([fake_page1, fake_page2]))
    fake_doc.__len__ = MagicMock(return_value=2)
    fake_doc.__getitem__ = MagicMock(side_effect=[fake_page1, fake_page2])
    fake_doc.close = MagicMock()
    fake_fitz.open = MagicMock(return_value=fake_doc)
    fake_fitz.Matrix = MagicMock(return_value="matrix")

    sys.modules["fitz"] = fake_fitz
    yield fake_fitz


class TestPaddleOcrAvailability:
    def test_is_available_returns_true_when_installed(self, fake_paddleocr):
        from app.services.paddleocr_service import is_paddleocr_available
        assert is_paddleocr_available() is True

    def test_is_available_returns_false_when_missing(self, fake_paddleocr_missing):
        from app.services.paddleocr_service import is_paddleocr_available
        assert is_paddleocr_available() is False


class TestPaddleOcrPdf:
    @pytest.mark.asyncio
    async def test_paddleocr_pdf_invokes_engine_per_page(self, fake_paddleocr, fake_fitz):
        from app.services import paddleocr_service

        progress_calls = []

        async def progress_cb(page: int, total: int):
            progress_calls.append((page, total))

        result = await paddleocr_service.paddleocr_pdf(
            content=b"%PDF-FAKE",
            page_numbers=None,
            progress_callback=progress_cb,
        )

        # 引擎被调用 2 次（2 页）
        assert fake_paddleocr["engine"].ocr.call_count == 2
        # 返回文本包含每页标识与识别行
        assert "第 1 页" in result
        assert "第 2 页" in result
        assert "测试文字" in result
        assert "第二行" in result
        # 进度回调在每页开始和完成时各触发一次
        assert progress_calls == [(1, 2), (1, 2), (2, 2), (2, 2)]

    @pytest.mark.asyncio
    async def test_paddleocr_pdf_handles_single_page_failure(self, fake_paddleocr, fake_fitz):
        from app.services import paddleocr_service

        fake_paddleocr["engine"].ocr.side_effect = [
            [[((0, 0), ("成功页", 0.99))]],
            RuntimeError("mock 单页识别失败"),
        ]

        result = await paddleocr_service.paddleocr_pdf(b"%PDF-FAKE")

        # 第一页正常，第二页失败但流程继续
        assert "成功页" in result
        assert "OCR 识别失败" in result

    @pytest.mark.asyncio
    async def test_paddleocr_pdf_respects_max_pages(self, fake_paddleocr, monkeypatch):
        """即使 PDF 有 20 页，也只识别前 15 页。"""
        from app.services import paddleocr_service

        fake_fitz = types.ModuleType("fitz")
        pages = [MagicMock() for _ in range(20)]
        for p in pages:
            p.get_pixmap.return_value.tobytes.return_value = b"PNG"
        fake_doc = MagicMock()
        fake_doc.__iter__ = MagicMock(return_value=iter(pages))
        fake_doc.__len__ = MagicMock(return_value=len(pages))
        fake_doc.__getitem__ = MagicMock(side_effect=pages)
        fake_doc.close = MagicMock()
        fake_fitz.open = MagicMock(return_value=fake_doc)
        fake_fitz.Matrix = MagicMock(return_value="matrix")
        sys.modules["fitz"] = fake_fitz

        result = await paddleocr_service.paddleocr_pdf(b"%PDF-FAKE")
        # 调用次数等于 _MAX_PAGES（15）
        assert fake_paddleocr["engine"].ocr.call_count == paddleocr_service._MAX_PAGES

    @pytest.mark.asyncio
    async def test_engine_singleton_reused_across_calls(self, fake_paddleocr, fake_fitz):
        """多次调用应复用同一个 PaddleOCR 实例。"""
        from app.services import paddleocr_service
        from app.services.paddleocr_service import paddleocr_pdf

        paddleocr_service._get_ocr_engine.cache_clear()
        await paddleocr_pdf(b"%PDF-1")
        await paddleocr_pdf(b"%PDF-2")
        # PaddleOCR() 构造器应只被调用一次（单例）
        assert fake_paddleocr["module"].PaddleOCR.call_count == 1
        paddleocr_service._get_ocr_engine.cache_clear()