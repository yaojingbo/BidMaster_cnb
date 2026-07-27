"""
PDF OCR 服务调度器：
- engine="ocrmypdf"：本地 OCRmyPDF + Tesseract 识别（macOS 默认推荐）
- engine="paddleocr"：本地 PaddleOCR 识别（Linux 可选）
- engine="llm"：多模态 LLM 视觉模型识别（云端、按 token 计费）
- engine="auto"（默认）：macOS 优先 OCRmyPDF，Linux 可优先 PaddleOCR，本地失败时回退 LLM

当 pdfplumber 提取文本量过少时，判定为扫描件，由 extract_service 触发 OCR 流程。
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import platform
from typing import AsyncGenerator, Dict, Any, Literal, Optional

from app.infrastructure.llm.lite_llm import LiteLLMService

logger = logging.getLogger(__name__)

# 每个 provider 支持视觉能力的模型列表
# 列表顺序决定优先级：第一个为默认 OCR 模型
VISION_MODELS: dict[str, list[str]] = {
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    "claude": ["claude-sonnet-4-20250514", "claude-opus-4-5-20251101"],
    "dashscope": [
        "qwen3.7-plus", "qwen3.7-max", "qwen3.6-plus", "qwen3.6-flash",
        "qwen-vl-ocr", "qwen3-vl-plus", "qwen-vl-plus", "qwen-vl-max",
    ],
    "zhipu": ["glm-4v-plus", "glm-4v"],
    "ollama": ["llava", "bakllava"],
}

# 不支持 vision 的供应商（仅文本模型）
_NO_VISION_PROVIDERS = {"deepseek", "minimax"}

# OCR 最大页数（控制 token 消耗）
MAX_OCR_PAGES = 15


def is_vision_capable(provider: str, model: str = None) -> bool:
    """检查 provider/model 是否支持视觉输入。"""
    if provider in _NO_VISION_PROVIDERS:
        return False
    if not model:
        return provider in VISION_MODELS and len(VISION_MODELS[provider]) > 0
    models = VISION_MODELS.get(provider, [])
    if model in models:
        return True
    # 宽松匹配：模型名含多模态相关关键词
    # qwen3.x/qwen3.x-plus 等百炼新模型均为多模态，通过 qwen3/qwen4 匹配
    keywords = ["vl", "vision", "ocr", "4o", "4v", "llava", "bakllava", "qwen3", "qwen4"]
    model_lower = model.lower()
    return any(kw in model_lower for kw in keywords)


def _find_vision_model(provider: str) -> Optional[str]:
    """在当前 provider 下找一个支持 vision 的模型。"""
    models = VISION_MODELS.get(provider, [])
    return models[0] if models else None


def _get_fallback_provider_model() -> tuple[str, str]:
    """回退到默认的视觉模型（阿里百炼 qwen-vl-ocr，专用 OCR 模型，更易开通）。"""
    return "dashscope", "qwen-vl-ocr"


def pdf_pages_to_images(
    content: bytes,
    dpi: int = 150,
    max_pages: int | None = MAX_OCR_PAGES,
    page_numbers: list[int] | None = None,
    cancel_event: asyncio.Event | None = None,
) -> list[tuple[int, str]]:
    """将 PDF 指定页面渲染为 base64 编码的 PNG 图片。

    Returns:
        (页码, 图片 base64) 列表
    """
    import fitz  # PyMuPDF

    selected_pages = set(page_numbers or [])
    doc = fitz.open(stream=content, filetype="pdf")
    images: list[tuple[int, str]] = []
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)

    page_limit = max_pages or MAX_OCR_PAGES
    for page_index, page in enumerate(doc):
        if cancel_event and cancel_event.is_set():
            break
        page_num = page_index + 1
        if selected_pages and page_num not in selected_pages:
            continue
        if len(images) >= page_limit:
            break
        pix = page.get_pixmap(matrix=matrix)
        img_bytes = pix.tobytes("png")
        images.append((page_num, base64.b64encode(img_bytes).decode("utf-8")))

    doc.close()
    return images


def resolve_vision_model(provider: str, model: str = None) -> tuple[str, str]:
    """解析可用的视觉模型，必要时回退。

    Returns:
        (effective_provider, effective_model)
    """
    if is_vision_capable(provider, model):
        return provider, model or _find_vision_model(provider) or _get_fallback_provider_model()[1]

    # 当前 provider 不支持 vision，尝试同 provider 下的视觉模型
    fallback_model = _find_vision_model(provider)
    if fallback_model:
        return provider, fallback_model

    # 彻底回退
    return _get_fallback_provider_model()


async def ocr_pdf(
    content: bytes,
    provider: str,
    model: str = None,
    user_id: str = None,
    progress_callback=None,
    page_numbers: list[int] | None = None,
    engine: Literal["llm", "ocrmypdf", "paddleocr", "auto"] = "auto",
    max_pages: int | None = None,
    timeout_seconds: int | None = None,
    cancel_event: asyncio.Event | None = None,
) -> str:
    """对图片型 PDF 执行 OCR 识别。"""
    engine_name = (engine or "auto").lower()

    if engine_name in ("auto", "ocrmypdf", "local"):
        try:
            from app.services.ocrmypdf_service import is_ocrmypdf_available, ocrmypdf_pdf

            if not is_ocrmypdf_available():
                if engine_name in ("ocrmypdf", "local"):
                    raise RuntimeError("OCRmyPDF 或 Tesseract 中文语言包未安装，请先安装 ocrmypdf 和 tesseract-lang")
                logger.info("OCR engine=auto 但 OCRmyPDF 不可用，继续尝试其他 OCR 路径")
            else:
                logger.info("OCR engine=ocrmypdf（%s）", engine_name)
                try:
                    text = await ocrmypdf_pdf(
                        content,
                        page_numbers=page_numbers,
                        progress_callback=progress_callback,
                        max_pages=max_pages,
                        timeout_seconds=timeout_seconds,
                        cancel_event=cancel_event,
                    )
                except Exception as ocrmypdf_err:
                    if engine_name in ("ocrmypdf", "local"):
                        raise RuntimeError(f"OCRmyPDF 识别失败: {ocrmypdf_err}") from ocrmypdf_err
                    logger.warning("OCRmyPDF 异常，继续尝试其他 OCR 路径: %s", ocrmypdf_err)
                else:
                    if text.strip():
                        return text
                    logger.warning("OCRmyPDF 未识别到文字，继续尝试其他 OCR 路径")
        except Exception as e:
            if engine_name in ("ocrmypdf", "local"):
                raise
            logger.warning("OCRmyPDF 调度异常，继续尝试其他 OCR 路径: %s", e)

    should_try_paddleocr = engine_name == "paddleocr" or (engine_name == "auto" and platform.system() == "Linux")
    if should_try_paddleocr:
        try:
            from app.services.paddleocr_service import is_paddleocr_available, paddleocr_pdf

            if not is_paddleocr_available():
                if engine_name == "paddleocr":
                    raise RuntimeError("PaddleOCR 未安装，请切换为 auto/ocrmypdf/llm 引擎")
                logger.info("OCR engine=auto 但 PaddleOCR 未安装，回退 LLM")
            else:
                logger.info("OCR engine=paddleocr（%s）", engine_name)
                try:
                    text = await paddleocr_pdf(
                        content,
                        page_numbers,
                        progress_callback,
                        max_pages=max_pages,
                        cancel_event=cancel_event,
                        timeout_seconds=timeout_seconds,
                    )
                except Exception as paddle_err:
                    if engine_name == "paddleocr":
                        raise RuntimeError(f"PaddleOCR 识别失败: {paddle_err}") from paddle_err
                    logger.warning("PaddleOCR 异常，回退 LLM: %s", paddle_err)
                else:
                    if text.strip():
                        return text
                    logger.warning("PaddleOCR 未识别到文字，回退 LLM")
        except Exception as e:
            if engine_name == "paddleocr":
                raise
            logger.warning("OCR 调度异常，回退 LLM: %s", e)

    return await _ocr_pdf_llm(
        content,
        provider,
        model,
        user_id,
        progress_callback,
        page_numbers,
        max_pages=max_pages,
        timeout_seconds=timeout_seconds,
        cancel_event=cancel_event,
    )


async def _ocr_pdf_llm(
    content: bytes,
    provider: str,
    model: str,
    user_id: str,
    progress_callback,
    page_numbers: list[int] | None,
    max_pages: int | None = None,
    timeout_seconds: int | None = None,
    cancel_event: asyncio.Event | None = None,
) -> str:
    """LLM 视觉模型 OCR 路径（多模态云端识别）。"""
    effective_provider, effective_model = resolve_vision_model(provider, model)

    images = pdf_pages_to_images(content, page_numbers=page_numbers, max_pages=max_pages, cancel_event=cancel_event)
    total = len(images)

    if total == 0:
        return ""

    llm = LiteLLMService()
    all_text: list[str] = []

    for i, (page_num, img_b64) in enumerate(images):
        if cancel_event and cancel_event.is_set():
            break
        if progress_callback:
            await progress_callback(i + 1, total)

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "请识别并提取这张图片中的所有文字内容。"
                            "保持原始格式，包括标题、段落、表格等结构。"
                            "只输出识别到的文字，不要添加额外说明。"
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{img_b64}"},
                    },
                ],
            }
        ]

        try:
            async def collect_page_text() -> str:
                page_text = ""
                async for chunk in llm.complete(
                    effective_provider,
                    messages,
                    model=effective_model,
                    stream=False,
                    user_id=user_id,
                ):
                    page_text += chunk
                return page_text

            if timeout_seconds:
                response_text = await asyncio.wait_for(collect_page_text(), timeout=timeout_seconds)
            else:
                response_text = await collect_page_text()

            if response_text.strip():
                all_text.append(f"--- 第 {page_num} 页 OCR 文本 ---\n{response_text.strip()}")
        except Exception as e:
            err_msg = str(e)
            logger.warning("OCR 第 %d 页失败: %s", page_num, e)
            # 401/403 认证错误：API Key 无权限，继续重试其他页也无意义，立即终止
            if "401" in err_msg or "403" in err_msg or "API key" in err_msg.lower() or "Incorrect" in err_msg:
                logger.error("OCR 认证失败，终止剩余页面识别: %s", err_msg[:200])
                raise RuntimeError(f"视觉模型 {effective_provider}/{effective_model} 认证失败，请确认 API Key 有该模型权限")
            all_text.append(f"--- 第 {page_num} 页 OCR 文本 ---\n[OCR 识别失败: {err_msg[:80]}]")

    return "\n\n".join(all_text)
