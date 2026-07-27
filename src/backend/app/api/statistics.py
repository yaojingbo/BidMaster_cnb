from __future__ import annotations
"""
Opening/statistics analysis API routes with comprehensive 6-dimension analysis.
所有端点强制认证。
"""
import io
import json
import logging
import sys
import asyncio
import traceback
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sse_starlette.sse import EventSourceResponse

from app.services.statistics_service import StatisticsService
from app.services.llm_service import LLMService
from app.services.prompt_builder import get_prompt_builder
from app.models.schemas import OpeningAnalysisRequest
from app.utils.auth_dep import get_current_user
from app.infrastructure.pg_storage import (
    add_opening,
    update_opening,
    get_opening,
    get_file,
    calculate_content_hash,
    find_completed_opening,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/statistics", tags=["statistics"])

OPENING_IDLE_TIMEOUT_SECONDS = 4.0
OPENING_MAX_IDLE_TICKS = 8
OPENING_MAX_IDLE_TICKS_LARGE = 20


def _opening_idle_ticks(analysis_data: dict) -> int:
    bidder_count = analysis_data.get("bidder_count", 0) or len(analysis_data.get("bid_ranking") or [])
    if bidder_count >= 30:
        return OPENING_MAX_IDLE_TICKS_LARGE
    if bidder_count >= 10:
        return 14
    return OPENING_MAX_IDLE_TICKS


def _extract_number(text: str):
    """从文本中提取第一个数字。"""
    import re
    m = re.search(r"(\d+\.?\d*)", str(text).strip())
    return float(m.group(1)) if m else None


def _extract_final_price(text: str):
    """从备注中提取最终报价。"""
    import re
    patterns = [
        r"最终报价[：:]*\s*(\d+\.?\d*)\s*万元",
        r"最终报价[：:]*\s*(\d+\.?\d*)",
        r"二次报价[：:]*\s*(\d+\.?\d*)\s*万元",
    ]
    for pat in patterns:
        m = re.search(pat, str(text))
        if m:
            return float(m.group(1))
    return None


def parse_opening_excel(content: bytes, filename: str) -> dict:
    """
    解析开标一览表 Excel/CSV 文件。

    使用 header=None 将全部行作为数据处理，手动查找表头行，
    兼容表头行不在第一行的招标表格格式。
    """
    import re

    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), header=None, encoding="utf-8")
    elif filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content), header=None)
    else:
        raise ValueError("不支持的文件格式，请使用 Excel 或 CSV")

    # 全部转为字符串
    df = df.fillna("").astype(str)

    # =========================================================================
    # 1. 提取项目元数据
    # =========================================================================
    meta = {
        "project_name": "",
        "bid_number": "",
        "opening_time": "",
        "opening_location": "",
        "max_price": None,
        "benchmark_price": None,
        "d_value": None,
    }

    # 搜索前 5 行找项目名称和招标编号
    for idx in range(min(5, len(df))):
        for cell in df.iloc[idx]:
            cell = str(cell).strip()
            if not cell:
                continue
            m = re.match(r"项目名称[：:]\s*(.+)", cell)
            if m:
                meta["project_name"] = m.group(1).strip()
            elif not meta["project_name"] and idx == 0 and not any(
                kw in cell for kw in ["序号", "投标", "报价", "标段", "开标", "评标"]
            ):
                meta["project_name"] = cell

            m2 = re.search(r"(?:招标|项目)编号[：:]\s*(\S+)", cell)
            if m2:
                meta["bid_number"] = m2.group(1).strip()

    # 搜索最后 10 行找限价/基准价/D值
    for idx in range(max(0, len(df) - 10), len(df)):
        row = df.iloc[idx]
        for col_idx, cell in enumerate(row):
            cell = str(cell).strip()
            if "最高投标限价" in cell or "最高限价" in cell:
                for j in range(col_idx + 1, len(row)):
                    val = _extract_number(str(row.iloc[j]).strip())
                    if val is not None:
                        meta["max_price"] = val
                        break
            elif "评标基准价" in cell or "基准价" in cell:
                for j in range(col_idx + 1, len(row)):
                    val = _extract_number(str(row.iloc[j]).strip())
                    if val is not None:
                        meta["benchmark_price"] = val
                        break
            elif cell in ("D值",) or cell.startswith("D值"):
                for j in range(col_idx + 1, len(row)):
                    val = _extract_number(str(row.iloc[j]).strip())
                    if val is not None:
                        meta["d_value"] = val
                        break

    # =========================================================================
    # 2. 查找表头行和列映射
    # =========================================================================
    header_row = None
    col_map = {}
    raw_headers = []
    column_mapping = {}

    for idx, row in df.iterrows():
        row_text = " ".join(str(c) for c in row.values)
        has_bidder_kw = any(kw in row_text for kw in ["投标人", "投标单位", "单位名称"])
        has_price_kw = any(kw in row_text for kw in ["报价", "投标价"])
        if has_bidder_kw and has_price_kw:
            header_row = idx
            for col_idx, cell in enumerate(row):
                cell = str(cell).strip()
                if not cell or cell == "nan":
                    continue
                raw_headers.append(cell)
                if any(kw in cell for kw in ["投标人", "投标单位", "单位名称"]):
                    col_map["name"] = col_idx
                    column_mapping[cell] = "name"
                elif any(kw in cell for kw in ["制造商", "产地", "品牌"]):
                    col_map["manufacturer"] = col_idx
                    column_mapping[cell] = "manufacturer"
                elif any(kw in cell for kw in ["最终投标价", "最终报价", "二次报价"]) and "比较" not in cell:
                    col_map["final_price"] = col_idx
                    column_mapping[cell] = "final_price"
                elif any(kw in cell for kw in ["投标价", "投标报价", "首次报价", "报价(元)", "报价（元）"]) and "最终" not in cell and "比较" not in cell and "方式" not in cell:
                    col_map["bid_price"] = col_idx
                    column_mapping[cell] = "bid_price"
                elif "资信" in cell:
                    col_map["credit_score"] = col_idx
                    column_mapping[cell] = "credit_score"
                elif "技术标" in cell or "技术分" in cell:
                    col_map["technical_score"] = col_idx
                    column_mapping[cell] = "technical_score"
                elif "商务标" in cell or "商务分" in cell:
                    col_map["commercial_score"] = col_idx
                    column_mapping[cell] = "commercial_score"
                elif cell == "合计" or "总得分" in cell or "综合评分" in cell:
                    col_map["total_score"] = col_idx
                    column_mapping[cell] = "total_score"
                elif "备注" in cell:
                    col_map["remarks"] = col_idx
                    column_mapping[cell] = "remarks"
            # Fallback: 如果没找到 bid_price，找任意包含"报价"的列
            if "bid_price" not in col_map:
                for col_idx, cell in enumerate(row):
                    cell = str(cell).strip()
                    if "报价" in cell and "比较" not in cell and "方式" not in cell:
                        col_map["bid_price"] = col_idx
                        if cell not in column_mapping:
                            column_mapping[cell] = "bid_price"
                        break
            break

    # =========================================================================
    # 3. 提取投标人数据
    # =========================================================================
    bidders = []

    if header_row is not None:
        for idx in range(header_row + 1, len(df)):
            row = df.iloc[idx]
            name = str(row.iloc[col_map.get("name", 0)]).strip()
            if not name or name == "nan" or name.startswith("合计") or name.startswith("小计"):
                continue
            # 跳过汇总行
            row_text = " ".join(str(c) for c in row)
            if any(kw in row_text for kw in ["最高投标限价", "评标基准价", "D值"]):
                continue

            bid_price_str = str(row.iloc[col_map.get("bid_price", 1)]).strip()
            bid_price = _extract_number(bid_price_str)

            remarks = str(row.iloc[col_map.get("remarks", len(row) - 1)]).strip()
            final_price = _extract_number(str(row.iloc[col_map["final_price"]]).strip()) if "final_price" in col_map else None
            if final_price is None:
                final_price = _extract_final_price(remarks)

            bidder = {
                "name": name,
                "manufacturer": str(row.iloc[col_map.get("manufacturer", 1)]).strip() if "manufacturer" in col_map else "",
                "bid_price": bid_price,
                "final_price": final_price,
                "credit_score": _extract_number(str(row.iloc[col_map["credit_score"]]).strip()) if "credit_score" in col_map else 0,
                "technical_score": _extract_number(str(row.iloc[col_map["technical_score"]]).strip()) if "technical_score" in col_map else 0,
                "commercial_score": _extract_number(str(row.iloc[col_map["commercial_score"]]).strip()) if "commercial_score" in col_map else 0,
                "total_score": _extract_number(str(row.iloc[col_map["total_score"]]).strip()) if "total_score" in col_map else 0,
                "remarks": remarks,
            }
            bidders.append(bidder)

    # 转换为 records 格式（兼容旧版 compute_all_dimensions）
    records = []
    for b in bidders:
        records.append({k: v for k, v in b.items()})

    return {
        "meta": meta,
        "bidders": bidders,
        "records": records,
        "columns": list(col_map.keys()) if col_map else [],
        "raw_headers": raw_headers,
        "column_mapping": column_mapping,
        "row_count": len(bidders),
    }


def _opening_record_to_result(record: dict) -> dict:
    return {
        "bidder_count": record.get("bidder_count", 0),
        "meta": record.get("meta") or {},
        "bid_ranking": record.get("bid_ranking") or [],
        "bid_stats": record.get("bid_stats") or {},
        "requested_modules": [],
    }


ALL_MODULES = {"bid_ranking", "final_ranking", "discount", "statistics", "scores", "benchmark"}


def compute_all_dimensions(bidders: list, meta: dict, modules: list[str] = None) -> dict:
    """
    Compute all 6 analysis dimensions from bidder data.

    Args:
        bidders: List of bidder dicts
        meta: Metadata dict
        modules: Optional list of module keys to compute (None = all)

    Returns:
        Dict with all dimension results
    """
    # 过滤掉前端传入的非后端模块（如 "comprehensive"）
    if modules:
        active_modules = [m for m in modules if m in ALL_MODULES]
        if not active_modules:
            active_modules = list(ALL_MODULES)
    else:
        active_modules = list(ALL_MODULES)

    result = {
        "bidder_count": len(bidders),
        "meta": meta,
        "requested_modules": active_modules,
    }

    try:
        _compute_dimensions(bidders, meta, active_modules, result)
    except Exception as e:
        logger.error("compute_all_dimensions 异常: %s", traceback.format_exc())
        print(f"[BID_MASTER_ERROR] compute_all_dimensions 失败: {traceback.format_exc()}", file=sys.stderr)
        # 重新抛出，让路由层的 except 捕获后返回 HTTP 500
        raise

    return result


def _compute_dimensions(bidders: list, meta: dict, active_modules: list, result: dict):
    """compute_all_dimensions 的实际计算逻辑，分离以便于错误追踪。"""
    bid_prices = [b["bid_price"] for b in bidders if b.get("bid_price") is not None and b["bid_price"] > 0]

    # Module A: 投标价排名
    if "bid_ranking" in active_modules and bid_prices:
        sorted_bidders = sorted(
            [b for b in bidders if b.get("bid_price") is not None and b["bid_price"] > 0],
            key=lambda b: b["bid_price"],
        )
        avg_price = sum(bid_prices) / len(bid_prices)
        min_price = min(bid_prices)

        result["bid_ranking"] = [
            {
                "rank": i + 1,
                "name": b["name"],
                "price": b["bid_price"],
                "deviation_pct": round((b["bid_price"] - avg_price) / avg_price * 100, 2),
                "gap_from_lowest": round(b["bid_price"] - min_price, 2),
            }
            for i, b in enumerate(sorted_bidders)
        ]

    # Module B: 最终报价排名
    if "final_ranking" in active_modules:
        bidders_with_final = [b for b in bidders if b.get("final_price") is not None]
        if bidders_with_final:
            sorted_final = sorted(bidders_with_final, key=lambda b: b["final_price"])
            avg_final = sum(b["final_price"] for b in bidders_with_final) / len(bidders_with_final)
            min_final = min(b["final_price"] for b in bidders_with_final)

            result["final_ranking"] = [
                {
                    "rank": i + 1,
                    "name": b["name"],
                    "price": b["final_price"],
                    "deviation_pct": round((b["final_price"] - avg_final) / avg_final * 100, 2),
                    "gap_from_lowest": round(b["final_price"] - min_final, 2),
                }
                for i, b in enumerate(sorted_final)
            ]
        else:
            result["final_ranking"] = None

    # Module C: 降价分析
    if "discount" in active_modules and bid_prices:
        discount_results = []
        for b in bidders:
            if b.get("final_price") is not None and b.get("bid_price") and b["bid_price"] > 0:
                discount_amount = round(b["bid_price"] - b["final_price"], 2)
                discount_pct = round(discount_amount / b["bid_price"] * 100, 2)

                # Classify strategy
                if discount_pct > 8:
                    strategy = "激进"
                elif discount_pct >= 4:
                    strategy = "适度"
                else:
                    strategy = "保守"

                discount_results.append({
                    "name": b["name"],
                    "bid_price": b["bid_price"],
                    "final_price": b["final_price"],
                    "discount_amount": discount_amount,
                    "discount_pct": discount_pct,
                    "strategy": strategy,
                })
        result["discount_results"] = discount_results

    # Module D: 统计分析
    if "statistics" in active_modules and bid_prices:
        n = len(bid_prices)
        avg = sum(bid_prices) / n
        variance = sum((p - avg) ** 2 for p in bid_prices) / n
        std_dev = variance ** 0.5
        cv = round(std_dev / avg * 100, 2) if avg > 0 else 0
        cv_level = "集中" if cv < 5 else "中等" if cv < 10 else "分散"

        result["bid_stats"] = {
            "max": max(bid_prices),
            "min": min(bid_prices),
            "mean": round(avg, 2),
            "std_dev": round(std_dev, 2),
            "cv": cv,
            "cv_level": cv_level,
            "range": round(max(bid_prices) - min(bid_prices), 2),
            "count": n,
        }

        # Tiers
        tiers = {"低梯队": [], "中梯队": [], "高梯队": []}
        for b in bidders:
            if b.get("bid_price") and b["bid_price"] > 0:
                deviation_pct = (b["bid_price"] - avg) / avg * 100
                tier_name = "低梯队" if deviation_pct <= -5 else "高梯队" if deviation_pct > 5 else "中梯队"
                tiers[tier_name].append({
                    "name": b["name"],
                    "price": b["bid_price"],
                    "deviation_pct": round(deviation_pct, 2),
                })
        result["tiers"] = tiers

        # Final stats if available
        final_prices = [b["final_price"] for b in bidders if b.get("final_price") is not None]
        if final_prices:
            n_f = len(final_prices)
            avg_f = sum(final_prices) / n_f
            var_f = sum((p - avg_f) ** 2 for p in final_prices) / n_f
            std_f = var_f ** 0.5
            cv_f = round(std_f / avg_f * 100, 2) if avg_f > 0 else 0
            cv_level_f = "集中" if cv_f < 5 else "中等" if cv_f < 10 else "分散"

            result["final_stats"] = {
                "max": max(final_prices),
                "min": min(final_prices),
                "mean": round(avg_f, 2),
                "std_dev": round(std_f, 2),
                "cv": cv_f,
                "cv_level": cv_level_f,
                "range": round(max(final_prices) - min(final_prices), 2),
                "count": n_f,
            }

    # Module E: 评分对比
    if "scores" in active_modules:
        scored_bidders = [b for b in bidders if (b.get("total_score") or 0) > 0]
        if scored_bidders:
            sorted_scores = sorted(scored_bidders, key=lambda b: b["total_score"], reverse=True)
            result["score_ranking"] = [
                {
                    "rank": i + 1,
                    "name": b["name"],
                    "credit_score": b.get("credit_score", 0),
                    "technical_score": b.get("technical_score", 0),
                    "commercial_score": b.get("commercial_score", 0),
                    "total_score": b.get("total_score", 0),
                }
                for i, b in enumerate(sorted_scores)
            ]
        else:
            result["score_ranking"] = []

    # Module F: 基准价对比
    if "benchmark" in active_modules and meta.get("benchmark_price") is not None and bid_prices:
        benchmark = meta["benchmark_price"]
        max_price = meta.get("max_price")
        benchmark_results = []

        for b in bidders:
            if b.get("bid_price") and b["bid_price"] > 0:
                deviation = round(b["bid_price"] - benchmark, 2)
                deviation_pct = round(deviation / benchmark * 100, 2)
                below_benchmark = b["bid_price"] <= benchmark

                entry = {
                    "name": b["name"],
                    "price": b["bid_price"],
                    "deviation_from_benchmark": deviation,
                    "deviation_pct": deviation_pct,
                    "below_benchmark": below_benchmark,
                    "total_score": b.get("total_score", 0),
                }

                if max_price:
                    entry["max_price"] = max_price
                    entry["ratio_to_max_pct"] = round(b["bid_price"] / max_price * 100, 2)
                    entry["below_max"] = b["bid_price"] <= max_price

                benchmark_results.append(entry)

        result["benchmark_comparison"] = sorted(
            benchmark_results,
            key=lambda x: abs(x.get("deviation_pct", 0)),
        )
    else:
        result["benchmark_comparison"] = None


def get_available_modules(columns: list[str], meta: dict) -> list[dict]:
    """根据检测到的列和元数据，返回可用的分析维度列表。"""
    has_bid_price = "bid_price" in columns
    has_final = any(c in columns for c in ["final_price", "remarks"])
    has_scores = any(c in columns for c in ["credit_score", "technical_score", "commercial_score", "total_score"])
    has_benchmark = meta.get("benchmark_price") is not None

    modules = [
        {
            "key": "bid_ranking",
            "label": "投标价排名",
            "available": has_bid_price,
            "description": "按投标价从低到高排序，计算偏离均值比例" if has_bid_price else "表格中未检测到投标价数据",
        },
        {
            "key": "final_ranking",
            "label": "最终报价排名",
            "available": has_final,
            "description": "按最终报价从低到高排序" if has_final else "表格中未检测到备注/最终报价数据",
        },
        {
            "key": "discount",
            "label": "降价分析",
            "available": has_bid_price and has_final,
            "description": "投标价 vs 最终报价降价幅度与策略分类" if (has_bid_price and has_final) else "需要投标价和最终报价数据",
        },
        {
            "key": "statistics",
            "label": "统计分析",
            "available": has_bid_price,
            "description": "均值/标准差/离散系数/梯队分布" if has_bid_price else "表格中未检测到投标价数据",
        },
        {
            "key": "scores",
            "label": "评分对比",
            "available": has_scores,
            "description": "资信/技术/商务/综合评分排名对比" if has_scores else "表格中未检测到评分数据（资信/技术/商务/合计）",
        },
        {
            "key": "benchmark",
            "label": "基准价对比",
            "available": has_benchmark,
            "description": "各投标报价与评标基准价的偏离分析" if has_benchmark else "表格中未检测到评标基准价数据",
        },
        {
            "key": "comprehensive",
            "label": "综合分析 (AI)",
            "available": True,
            "description": "AI 对分析结果进行综合解读与策略建议",
        },
    ]
    return modules


def _is_sufficient_opening_analysis(text: str | None) -> bool:
    if not text:
        return False
    required_sections = ["报价", "综合", "建议"]
    return len(text.strip()) >= 1000 and all(section in text for section in required_sections)


async def _find_sufficient_completed_opening(source_hash: str, modules: list[str] | None, user_id: str, require_ai: bool = False) -> dict | None:
    cached = await find_completed_opening(source_hash, modules, user_id, require_ai=require_ai)
    if require_ai and cached and not _is_sufficient_opening_analysis(cached.get("ai_analysis")):
        return None
    return cached


@router.post("/parse")
async def parse_statistics_data(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """解析 Excel/CSV 开标数据，返回检测到的列和可用分析维度。"""
    try:
        content = await file.read()
        parsed = parse_opening_excel(content, file.filename)
        available_modules = get_available_modules(parsed.get("columns", []), parsed.get("meta", {}))
        return {
            "success": True,
            "data": {
                **parsed,
                "available_modules": available_modules,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_opening(request: OpeningAnalysisRequest, current_user: dict = Depends(get_current_user)):
    """
    Comprehensive 6-dimension opening analysis.
    """
    if not request.fileId:
        raise HTTPException(status_code=400, detail="缺少 fileId 参数")

    try:
        from app.services.file_service import get_file_service
        file_service = get_file_service()

        content = await file_service.download(request.fileId, current_user["id"])

        # Parse filename from mock storage or use generic
        filename = "bid_opening.xlsx"
        # Try to detect format from content
        try:
            import io
            df = pd.read_excel(io.BytesIO(content))
            filename = "bid_opening.xlsx"
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(content))
                filename = "bid_opening.csv"
            except Exception:
                filename = "bid_opening.xlsx"

        parsed = parse_opening_excel(content, filename)
        modules = request.modules or None
        result = compute_all_dimensions(parsed["bidders"], parsed["meta"], modules)

        file_record = await get_file(request.fileId, current_user["id"])
        original_name = file_record.get("original_name", "") if file_record else ""

        # 保存开标结果到 mock_storage
        await add_opening({
            "file_id": request.fileId,
            "file_name": original_name,
            "bidder_count": result.get("bidder_count", parsed.get("bidder_count", 0)),
            "bid_ranking": result.get("bid_ranking", []),
            "bid_stats": result.get("bid_stats", {}),
            "meta": result.get("meta", parsed.get("meta", {})),
            "status": "completed",
        }, user_id=current_user["id"])

        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/upload")
async def analyze_opening_upload(
    file: UploadFile = File(...),
    modules: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload file and analyze directly (combined upload + analyze).
    """
    try:
        content = await file.read()
        source_hash = calculate_content_hash(content)
        try:
            module_list = json.loads(modules) if modules else None
        except (json.JSONDecodeError, ValueError):
            module_list = None
        if module_list is None and modules:
            module_list = [m.strip() for m in modules.split(",") if m.strip()]
        cached = await _find_sufficient_completed_opening(source_hash, module_list, current_user["id"])
        if cached:
            return {"success": True, "data": _opening_record_to_result(cached), "cached": True}

        parsed = parse_opening_excel(content, file.filename)

        result = compute_all_dimensions(parsed["bidders"], parsed["meta"], module_list)

        # 保存开标结果到 mock_storage
        await add_opening({
            "file_id": None,
            "file_name": file.filename or "",
            "bidder_count": result.get("bidder_count", parsed.get("bidder_count", 0)),
            "bid_ranking": result.get("bid_ranking", []),
            "bid_stats": result.get("bid_stats", {}),
            "meta": result.get("meta", parsed.get("meta", {})),
            "status": "completed",
            "source_hash": source_hash,
        }, user_id=current_user["id"])

        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def comprehensive_analysis_generator(
    analysis_data: dict,
    provider: str = "deepseek",
    model: str = None,
    user_id: str = None,
):
    """
    SSE generator for AI comprehensive analysis of opening results.

    LLM 调用解耦到后台 asyncio Task，前端断连不会中断 LLM 调用。
    生成 task_id 并在首条事件返回，前端可用此 ID 轮询结果。
    """
    import asyncio
    import uuid

    llm_service = LLMService()

    task_id = str(uuid.uuid4())[:8]
    await add_opening({
        "id": task_id,
        "file_id": analysis_data.get("file_id"),
        "file_name": analysis_data.get("file_name", ""),
        "bidder_count": analysis_data.get("bidder_count", 0),
        "bid_ranking": analysis_data.get("bid_ranking", []),
        "bid_stats": analysis_data.get("bid_stats", {}),
        "meta": analysis_data.get("meta", {}),
        "ai_analysis": "",
        "status": "running",
    }, user_id=user_id)

    yield {
        "event": "message",
        "data": json.dumps({"type": "task_created", "task_id": task_id}),
    }

    yield {
        "event": "progress",
        "data": json.dumps({"type": "progress", "message": "AI 正在生成综合分析..."}),
    }

    prompt_builder = get_prompt_builder()
    statistics_json = json.dumps(analysis_data, ensure_ascii=False, indent=2)

    messages = [
        {"role": "system", "content": prompt_builder.build_opening_system_prompt()},
        {"role": "user", "content": prompt_builder.build_opening_user_prompt(statistics_json)},
    ]

    chunk_queue: asyncio.Queue = asyncio.Queue()
    result_holder = {"text": "", "done": False, "error": None}

    async def _llm_background_task():
        try:
            async for chunk in llm_service.llm.complete(provider, messages, model=model, stream=True, user_id=user_id, temperature=0.3):
                result_holder["text"] += chunk
                await chunk_queue.put({"type": "chunk", "content": chunk})
            result_holder["done"] = True
            await chunk_queue.put({"type": "llm_done"})
        except Exception as e:
            result_holder["error"] = str(e)
            await chunk_queue.put({"type": "llm_error", "error": str(e)})

    background_task = asyncio.create_task(_llm_background_task())

    _saved = False

    try:
        while True:
            event = await chunk_queue.get()
            if event["type"] == "chunk":
                yield {
                    "event": "message",
                    "data": json.dumps({"type": "content", "content": event["content"]}),
                }
            elif event["type"] == "llm_done":
                await update_opening(task_id, {
                    "ai_analysis": result_holder["text"],
                    "status": "completed",
                })
                _saved = True
                yield {
                    "event": "done",
                    "data": json.dumps({
                        "type": "done",
                        "data": {"summary": "AI 综合分析完成", "contentLength": len(result_holder["text"])},
                    }),
                }
                break
            elif event["type"] == "llm_error":
                await update_opening(task_id, {"status": "error", "ai_analysis": result_holder["text"]})
                _saved = True
                yield {
                    "event": "error",
                    "data": json.dumps({"type": "error", "message": event["error"]}),
                }
                break

    finally:
        if not _saved:
            if result_holder["done"]:
                await update_opening(task_id, {"ai_analysis": result_holder["text"], "status": "completed"})
            elif result_holder["text"]:
                await update_opening(task_id, {"ai_analysis": result_holder["text"], "status": "partial"})

                async def _ensure_save_on_completion():
                    await background_task
                    if result_holder["done"]:
                        await update_opening(task_id, {"ai_analysis": result_holder["text"], "status": "completed"})

                asyncio.create_task(_ensure_save_on_completion())


def _fallback_opening_analysis(analysis_data: dict) -> str:
    meta = analysis_data.get("meta") or {}
    stats = analysis_data.get("bid_stats") or {}
    final_stats = analysis_data.get("final_stats") or {}
    ranking = analysis_data.get("bid_ranking") or []
    final_ranking = analysis_data.get("final_ranking") or []
    discounts = analysis_data.get("discount_results") or []
    scores = analysis_data.get("score_ranking") or []
    benchmarks = analysis_data.get("benchmark_comparison") or []
    tiers = analysis_data.get("tiers") or {}
    project_name = meta.get("project_name") or "开标项目"
    bidder_count = stats.get("count", analysis_data.get("bidder_count", 0))

    lines = [
        f"# {project_name} 开标综合分析报告",
        "",
        "## 一、项目与数据概况",
        f"- 项目名称：{project_name}",
        f"- 有效投标人数量：{bidder_count}",
        f"- 最高投标限价：{meta.get('max_price', '未识别')}",
        f"- 评标基准价：{meta.get('benchmark_price', '未识别')}",
        f"- D值：{meta.get('d_value', '未识别')}",
        "",
        "## 二、报价统计结论",
        f"- 最高报价：{stats.get('max', '未识别')}",
        f"- 最低报价：{stats.get('min', '未识别')}",
        f"- 平均报价：{stats.get('mean', '未识别')}",
        f"- 标准差：{stats.get('std_dev', '未识别')}",
        f"- 离散系数：{stats.get('cv', '未识别')}%，报价集中度：{stats.get('cv_level', '未识别')}",
        f"- 报价极差：{stats.get('range', '未识别')}",
        "",
    ]

    if ranking:
        lines.extend([
            "## 三、投标价排名摘要",
            "| 排名 | 投标单位 | 投标报价 | 偏离均值 | 与最低价差额 |",
            "| --- | --- | ---: | ---: | ---: |",
        ])
        for item in ranking[:10]:
            lines.append(
                f"| {item.get('rank')} | {item.get('name')} | {item.get('price')} | {item.get('deviation_pct')}% | {item.get('gap_from_lowest')} |"
            )
        lowest = ranking[0]
        highest = ranking[-1]
        lines.extend([
            "",
            f"- 最低报价单位为 {lowest.get('name')}，报价 {lowest.get('price')}。",
            f"- 最高报价单位为 {highest.get('name')}，报价 {highest.get('price')}。",
            "- 若最低价与均值偏离较大，应结合技术响应、商务得分和异常低价规则进一步复核。",
            "",
        ])

    if final_ranking:
        lines.extend([
            "## 四、最终报价与降价策略",
            f"- 最终报价最高值：{final_stats.get('max', '未识别')}",
            f"- 最终报价最低值：{final_stats.get('min', '未识别')}",
            f"- 最终报价均值：{final_stats.get('mean', '未识别')}",
            "| 排名 | 投标单位 | 最终报价 | 偏离均值 | 与最低价差额 |",
            "| --- | --- | ---: | ---: | ---: |",
        ])
        for item in final_ranking[:10]:
            lines.append(
                f"| {item.get('rank')} | {item.get('name')} | {item.get('price')} | {item.get('deviation_pct')}% | {item.get('gap_from_lowest')} |"
            )
        if discounts:
            aggressive = [item for item in discounts if item.get("strategy") == "激进"]
            moderate = [item for item in discounts if item.get("strategy") == "适度"]
            conservative = [item for item in discounts if item.get("strategy") == "保守"]
            lines.extend([
                "",
                f"- 激进降价单位：{len(aggressive)} 家，适度降价单位：{len(moderate)} 家，保守降价单位：{len(conservative)} 家。",
                "- 降价幅度较大的单位需要重点关注其报价组成、履约能力和后续变更风险。",
            ])
        lines.append("")
    else:
        lines.extend([
            "## 四、最终报价与降价策略",
            "- 当前文件未识别到最终报价或二次报价列，无法形成最终报价排名和降价策略对比。",
            "- 建议核对表格中是否存在“最终投标价”“最终报价”“二次报价”等字段，或在备注列中保留明确金额。",
            "",
        ])

    if tiers:
        lines.extend(["## 五、价格梯队划分"])
        for tier_name, members in tiers.items():
            names = "、".join(item.get("name", "未识别") for item in members[:8]) or "无"
            lines.append(f"- {tier_name}：{len(members)} 家，代表单位：{names}")
        lines.extend([
            "- 梯队分布可用于判断竞争集中度。若多数单位集中在中梯队，说明报价策略趋同；若高低梯队差异明显，应关注报价合理性边界。",
            "",
        ])

    if scores:
        lines.extend([
            "## 六、评分对比",
            "| 排名 | 投标单位 | 资信标 | 技术标 | 商务标 | 合计 |",
            "| --- | --- | ---: | ---: | ---: | ---: |",
        ])
        for item in scores[:10]:
            lines.append(
                f"| {item.get('rank')} | {item.get('name')} | {item.get('credit_score')} | {item.get('technical_score')} | {item.get('commercial_score')} | {item.get('total_score')} |"
            )
        lines.extend([
            "- 评分排名应与报价排名交叉查看，重点识别低价高分、低价低分、高价高分等不同竞争形态。",
            "",
        ])

    if benchmarks:
        near_benchmark = benchmarks[:5]
        lines.extend([
            "## 七、基准价对比",
            "| 投标单位 | 报价 | 偏离基准价 | 偏离比例 | 是否低于基准价 |",
            "| --- | ---: | ---: | ---: | --- |",
        ])
        for item in near_benchmark:
            below = "是" if item.get("below_benchmark") else "否"
            lines.append(
                f"| {item.get('name')} | {item.get('price')} | {item.get('deviation_from_benchmark')} | {item.get('deviation_pct')}% | {below} |"
            )
        lines.extend([
            "- 与基准价偏离越小，通常越接近评标价格中枢；偏离较大的报价需结合评分办法判断影响。",
            "",
        ])

    lines.extend([
        "## 八、综合判断与建议",
        "- 当前数据已完成结构化解析，可支撑报价排名、离散度、梯队分布、评分对比和基准价偏离分析。",
        "- 对低价单位，应重点复核报价组成、异常低价说明、关键设备或服务内容是否完整。",
        "- 对高价单位，应关注其技术标、资信标得分是否足以支撑报价溢价。",
        "- 后续可结合招标文件评分办法、废标条款和澄清记录，对排名变化原因进行更细化复盘。",
    ])
    return "\n".join(lines)


@router.post("/analyze/comprehensive")
async def analyze_comprehensive(request: OpeningAnalysisRequest, current_user: dict = Depends(get_current_user)):
    """
    AI comprehensive analysis with SSE streaming.

    First runs 6-dimension analysis, then streams AI comprehensive interpretation.
    """
    try:
        from app.services.file_service import get_file_service
        file_service = get_file_service()

        content = await file_service.download(request.fileId, current_user["id"])
        filename = "bid_opening.xlsx"

        parsed = parse_opening_excel(content, filename)
        modules = request.modules or None
        analysis_data = compute_all_dimensions(parsed["bidders"], parsed["meta"], modules)

        return EventSourceResponse(
            comprehensive_analysis_generator(analysis_data, request.provider or "deepseek", model=request.model, user_id=current_user["id"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/comprehensive/upload")
async def analyze_comprehensive_upload(
    file: UploadFile = File(...),
    modules: Optional[str] = Form(None),
    provider: Optional[str] = Form("deepseek"),
    model: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload file + analyze + AI comprehensive SSE streaming (all-in-one).
    """
    try:
        content = await file.read()
        parsed = parse_opening_excel(content, file.filename)

        try:
            module_list = json.loads(modules) if modules else None
        except (json.JSONDecodeError, ValueError):
            module_list = None
        if module_list is None and modules:
            module_list = [m.strip() for m in modules.split(",") if m.strip()]
        analysis_data = compute_all_dimensions(parsed["bidders"], parsed["meta"], module_list)

        return EventSourceResponse(
            comprehensive_analysis_generator(analysis_data, provider or "deepseek", model=model, user_id=current_user["id"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/comprehensive/start")
async def start_comprehensive_analysis(
    request: OpeningAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    启动综合分析后台任务，立即返回 task_id。
    LLM 在后台运行，前端通过 GET /analysis-task/{task_id} 轮询结果。
    """
    import asyncio
    import uuid

    try:
        from app.services.file_service import get_file_service
        file_service = get_file_service()

        content = await file_service.download(request.fileId, current_user["id"])
        source_hash = calculate_content_hash(content)
        filename = "bid_opening.xlsx"
        parsed = parse_opening_excel(content, filename)
        modules = request.modules or None
        cached = await _find_sufficient_completed_opening(source_hash, modules, current_user["id"], require_ai=True)
        if cached:
            return {"success": True, "task_id": cached["id"], "cached": True}
        analysis_data = compute_all_dimensions(parsed["bidders"], parsed["meta"], modules)

        file_record = await get_file(request.fileId, current_user["id"])
        original_name = file_record.get("original_name", "") if file_record else ""

        task_id = str(uuid.uuid4())[:8]
        user_id = current_user["id"]

        await add_opening({
            "id": task_id,
            "file_id": analysis_data.get("file_id"),
            "file_name": original_name,
            "bidder_count": analysis_data.get("bidder_count", 0),
            "bid_ranking": analysis_data.get("bid_ranking", []),
            "bid_stats": analysis_data.get("bid_stats", {}),
            "meta": analysis_data.get("meta", {}),
            "ai_analysis": "",
            "status": "running",
            "source_hash": source_hash,
        }, user_id=user_id)

        async def _run_llm():
            llm_service = LLMService()
            provider = request.provider or "deepseek"
            model = request.model

            prompt_builder = get_prompt_builder()
            statistics_json = json.dumps(analysis_data, ensure_ascii=False, indent=2)

            messages = [
                {"role": "system", "content": prompt_builder.build_opening_system_prompt()},
                {"role": "user", "content": prompt_builder.build_opening_user_prompt(statistics_json)},
            ]

            result_text = ""
            chunk_queue: asyncio.Queue = asyncio.Queue()
            logger.info("开标综合分析开始: task_id=%s provider=%s model=%s", task_id, provider, model or "default")

            async def _llm_stream():
                nonlocal result_text
                first_chunk = True
                async for chunk in llm_service.llm.complete(provider, messages, model=model, stream=True, user_id=user_id, temperature=0.3):
                    if first_chunk:
                        logger.info("开标综合分析收到首个模型输出: task_id=%s", task_id)
                        first_chunk = False
                    result_text += chunk
                    await chunk_queue.put(chunk)

            stream_task = asyncio.create_task(_llm_stream())
            idle_ticks = 0
            max_idle_ticks = _opening_idle_ticks(analysis_data)
            try:
                while True:
                    if stream_task.done() and chunk_queue.empty():
                        error = stream_task.exception()
                        if error:
                            raise error
                        break
                    try:
                        await asyncio.wait_for(chunk_queue.get(), timeout=OPENING_IDLE_TIMEOUT_SECONDS)
                        idle_ticks = 0
                    except asyncio.TimeoutError:
                        idle_ticks += 1
                        logger.info("开标综合分析等待模型输出: task_id=%s idle_ticks=%s", task_id, idle_ticks)
                        if idle_ticks < max_idle_ticks:
                            continue
                        logger.warning("开标综合分析模型长时间无输出，使用兜底报告: task_id=%s partial_length=%s", task_id, len(result_text))
                        if not stream_task.done():
                            stream_task.cancel()
                            import contextlib
                            with contextlib.suppress(asyncio.CancelledError):
                                await stream_task
                        break

                final_text = result_text.strip() or _fallback_opening_analysis(analysis_data)
                await update_opening(task_id, {"ai_analysis": final_text, "status": "completed"})
                logger.info("开标综合分析已保存: task_id=%s length=%s", task_id, len(final_text))
            except Exception:
                logger.exception("开标综合分析失败，使用兜底报告: task_id=%s partial_length=%s", task_id, len(result_text))
                await update_opening(task_id, {"ai_analysis": result_text.strip() or _fallback_opening_analysis(analysis_data), "status": "completed"})

        asyncio.create_task(_run_llm())

        return {"success": True, "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/comprehensive/upload/start")
async def start_comprehensive_analysis_upload(
    file: UploadFile = File(...),
    modules: Optional[str] = Form(None),
    provider: Optional[str] = Form("deepseek"),
    model: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    上传文件 + 启动综合分析后台任务，立即返回 task_id。
    """
    import asyncio
    import uuid

    try:
        content = await file.read()
        source_hash = calculate_content_hash(content)
        try:
            module_list = json.loads(modules) if modules else None
        except (json.JSONDecodeError, ValueError):
            module_list = None
        if module_list is None and modules:
            module_list = [m.strip() for m in modules.split(",") if m.strip()]
        cached = await _find_sufficient_completed_opening(source_hash, module_list, current_user["id"], require_ai=True)
        if cached:
            return {"success": True, "task_id": cached["id"], "cached": True}

        parsed = parse_opening_excel(content, file.filename)
        analysis_data = compute_all_dimensions(parsed["bidders"], parsed["meta"], module_list)

        task_id = str(uuid.uuid4())[:8]
        user_id = current_user["id"]

        await add_opening({
            "id": task_id,
            "file_id": analysis_data.get("file_id"),
            "file_name": file.filename or "",
            "bidder_count": analysis_data.get("bidder_count", 0),
            "bid_ranking": analysis_data.get("bid_ranking", []),
            "bid_stats": analysis_data.get("bid_stats", {}),
            "meta": analysis_data.get("meta", {}),
            "ai_analysis": "",
            "status": "running",
            "source_hash": source_hash,
            "provider": provider or "deepseek",
            "model": model or "",
        }, user_id=user_id)

        async def _run_llm():
            llm_service = LLMService()
            provider_name = provider or "deepseek"

            prompt_builder = get_prompt_builder()
            statistics_json = json.dumps(analysis_data, ensure_ascii=False, indent=2)

            messages = [
                {"role": "system", "content": prompt_builder.build_opening_system_prompt()},
                {"role": "user", "content": prompt_builder.build_opening_user_prompt(statistics_json)},
            ]

            result_text = ""
            chunk_queue: asyncio.Queue = asyncio.Queue()
            logger.info("开标综合分析开始: task_id=%s provider=%s model=%s", task_id, provider_name, model or "default")

            async def _llm_stream():
                nonlocal result_text
                first_chunk = True
                async for chunk in llm_service.llm.complete(provider_name, messages, model=model, stream=True, user_id=user_id, temperature=0.3):
                    if first_chunk:
                        logger.info("开标综合分析收到首个模型输出: task_id=%s", task_id)
                        first_chunk = False
                    result_text += chunk
                    await chunk_queue.put(chunk)

            stream_task = asyncio.create_task(_llm_stream())
            idle_ticks = 0
            max_idle_ticks = _opening_idle_ticks(analysis_data)
            try:
                while True:
                    if stream_task.done() and chunk_queue.empty():
                        error = stream_task.exception()
                        if error:
                            raise error
                        break
                    try:
                        await asyncio.wait_for(chunk_queue.get(), timeout=OPENING_IDLE_TIMEOUT_SECONDS)
                        idle_ticks = 0
                    except asyncio.TimeoutError:
                        idle_ticks += 1
                        logger.info("开标综合分析等待模型输出: task_id=%s idle_ticks=%s", task_id, idle_ticks)
                        if idle_ticks < max_idle_ticks:
                            continue
                        logger.warning("开标综合分析模型长时间无输出，使用兜底报告: task_id=%s partial_length=%s", task_id, len(result_text))
                        if not stream_task.done():
                            stream_task.cancel()
                            import contextlib
                            with contextlib.suppress(asyncio.CancelledError):
                                await stream_task
                        break

                final_text = result_text.strip() or _fallback_opening_analysis(analysis_data)
                await update_opening(task_id, {"ai_analysis": final_text, "status": "completed"})
                logger.info("开标综合分析已保存: task_id=%s length=%s", task_id, len(final_text))
            except Exception:
                logger.exception("开标综合分析失败，使用兜底报告: task_id=%s partial_length=%s", task_id, len(result_text))
                await update_opening(task_id, {"ai_analysis": result_text.strip() or _fallback_opening_analysis(analysis_data), "status": "completed"})

        asyncio.create_task(_run_llm())

        return {"success": True, "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis-task/{task_id}")
async def get_analysis_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """获取综合分析任务状态和结果（前端轮询用）。"""
    record = await get_opening(task_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "data": record}


@router.get("/export/{analysis_id}")
async def export_report(analysis_id: str, current_user: dict = Depends(get_current_user)):
    """Export analysis report (placeholder)."""
    return {
        "success": True,
        "data": {"analysisId": analysis_id, "format": "json"},
    }