from __future__ import annotations

from typing import Any


def build_extract_markdown(record: dict[str, Any]) -> tuple[str, str]:
    title = record.get("name") or record.get("file_name") or f"提取结果 {record.get('id', '')}".strip()
    content = str(record.get("content") or "").strip()
    if content:
        return content, title

    elements = record.get("elements") or []
    lines = [f"# {title}"]
    for element in elements:
        if not isinstance(element, dict):
            continue
        name = str(element.get("name") or "未命名要素").strip()
        body = str(element.get("content") or "").strip()
        if body:
            lines.extend(["", f"## {name}", "", body])
    return "\n".join(lines), title


def build_simulate_markdown(record: dict[str, Any]) -> tuple[str, str]:
    title = record.get("name") or f"模拟任务 {record.get('task_id', '')}".strip()
    step_results = record.get("step_results") or {}
    labels = {
        "step1": "Step 1：PDF转换",
        "step2": "Step 2：要素提取",
        "step3": "Step 3：对比分析",
        "step4": "Step 4：模拟编制",
    }
    lines = [f"# {title}"]
    if isinstance(step_results, dict):
        for key in ["step1", "step2", "step3", "step4"]:
            if key not in step_results:
                continue
            value = step_results.get(key)
            content = value if isinstance(value, str) else _jsonish(value)
            lines.extend(["", f"## {labels[key]}", "", content])
    return "\n".join(lines), title


def build_opening_markdown(record: dict[str, Any]) -> tuple[str, str]:
    meta = record.get("meta") or {}
    stats = record.get("bid_stats") or {}
    title = record.get("name") or str(meta.get("project_name") or f"开标分析 {record.get('id', '')}".strip())
    lines = [
        "# 开标分析报告",
        "",
        f"- 项目名称：{meta.get('project_name') or record.get('name') or record.get('id') or '-'}",
        f"- 项目编号：{meta.get('bid_number') or '-'}",
        f"- 投标人数量：{record.get('bidder_count') or 0}",
        f"- 分析时间：{record.get('created_at') or '-'}",
    ]

    rankings = record.get("bid_ranking") or []
    if rankings:
        lines.extend(["", "## 投标价排名", "", "| 排名 | 投标人 | 报价 |", "| --- | --- | --- |"])
        for item in rankings:
            if not isinstance(item, dict):
                continue
            lines.append(f"| {item.get('rank', '-')} | {item.get('name', '-')} | {_format_number(item.get('price'))} |")

    if stats:
        std = stats.get("std_dev", stats.get("std"))
        lines.extend(["", "## 统计指标", "", "| 指标 | 值 |", "| --- | --- |"])
        lines.append(f"| 均值 | {_format_number(stats.get('mean'))} |")
        if std is not None:
            lines.append(f"| 标准差 | {std} |")
        lines.append(f"| 离散系数 | {stats.get('cv', '-')}% |")
        lines.append(f"| 最小值 | {_format_number(stats.get('min'))} |")
        lines.append(f"| 最大值 | {_format_number(stats.get('max'))} |")
        lines.append(f"| 极差 | {_format_number(stats.get('range'))} |")

    ai_analysis = str(record.get("ai_analysis") or "").strip()
    if ai_analysis:
        lines.extend(["", "## AI 综合分析", "", ai_analysis])

    return "\n".join(lines), title


def _format_number(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, int):
        return f"{value:,}"
    if isinstance(value, float):
        return f"{value:,.2f}".rstrip("0").rstrip(".")
    return str(value)


def _jsonish(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)
