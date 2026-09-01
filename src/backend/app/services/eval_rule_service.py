"""
评标基准价计算规则内核（确定性纯函数）。

设计约定（specs/pm/opening-analysis-eval-rule-prd.md）：
- AI 只负责把评标办法文字解析成结构化 eval_rule，绝不参与数值计算；
- 六种内置办法一律走本模块纯函数，输出基准价与完整中间量供前端对账。

eval_rule 结构：
    {
      "method": "arithmetic_mean | mean_discount_k | second_average |
                 trimmed_mean | weighted_composite | median_or_second_low",
      "price_field": "final_price | bid_price" | None（缺省自动选）,
      "params": { k_pct, deviation_band, trim_high, trim_low,
                  limit_price_weight, floor_weight, floor_price, pick, round_digits },
      "exclude_bidders": ["手动判定无效的投标人名称"],
      "source": "preset | extracted | parsed_custom"
    }
"""

from __future__ import annotations

from typing import Any

METHOD_LABELS: dict[str, str] = {
    "arithmetic_mean": "算术平均法",
    "mean_discount_k": "均值下浮法（K值）",
    "second_average": "二次平均法",
    "trimmed_mean": "去高去低法",
    "weighted_composite": "加权复合法",
    "median_or_second_low": "次低价/中位数",
}

VALID_METHODS = frozenset(METHOD_LABELS)

_PARAM_DEFAULTS: dict[str, Any] = {
    "k_pct": None,
    "deviation_band": 5.0,
    "trim_high": 1,
    "trim_low": 1,
    "limit_price_weight": 60.0,
    "floor_weight": 0.0,
    "floor_price": None,
    "pick": "second_low",
    "round_digits": 2,
}

_PRICE_FIELDS = ("final_price", "bid_price")


def normalize_rule(raw: dict | None) -> dict:
    """校验并规范化 eval_rule；非法输入抛 ValueError（中文提示）。"""
    if not isinstance(raw, dict):
        raise ValueError("评标规则必须是一个对象")
    method = str(raw.get("method") or "").strip()
    if method not in VALID_METHODS:
        raise ValueError(f"未知的基准价计算办法：{method or '(空)'}。可用：{', '.join(sorted(VALID_METHODS))}")

    price_field = raw.get("price_field")
    if price_field not in (None, "") and price_field not in _PRICE_FIELDS:
        raise ValueError(f"price_field 只能是 {' / '.join(_PRICE_FIELDS)} 或留空")

    params_in = raw.get("params") or {}
    if not isinstance(params_in, dict):
        raise ValueError("params 必须是对象")
    params: dict[str, Any] = dict(_PARAM_DEFAULTS)
    for key, default in _PARAM_DEFAULTS.items():
        val = params_in.get(key)
        if val is None or (key == "pick" and not val):
            continue
        if key == "pick":
            if val not in ("second_low", "median"):
                raise ValueError("pick 只能是 second_low 或 median")
            params[key] = val
        elif key == "round_digits":
            params[key] = max(0, min(6, int(val)))
        elif key == "floor_price":
            params[key] = float(val)
        else:
            params[key] = float(val)

    exclude_bidders = raw.get("exclude_bidders") or []
    if not isinstance(exclude_bidders, list):
        raise ValueError("exclude_bidders 必须是名单数组")

    source = raw.get("source") or "preset"
    return {
        "method": method,
        "price_field": price_field or None,
        "params": params,
        "exclude_bidders": [str(n).strip() for n in exclude_bidders if str(n).strip()],
        "source": source,
    }


def _fmt(values: list[float], digits: int) -> list[float]:
    return [round(float(v), digits) for v in values]


def compute_benchmark_from_rule(rule: dict, bidders: list[dict], meta: dict) -> dict:
    """
    按规则计算评标基准价，返回完整中间量供对账。

    返回结构：
        {method, method_label, price_field, source,
         inputs{bidder_total, valid_count, max_price, d_value},
         effective_prices[{name, price}], excluded[{name, price, reason}],
         steps[{step, detail, numbers}], benchmark, sheet_benchmark}
    计算不了的硬性前置条件直接抛 ValueError；软性异常写进 steps 警告。
    """
    rule = normalize_rule(rule)
    method = rule["method"]
    params = rule["params"]
    digits = int(params["round_digits"])

    price_field = rule["price_field"] or next(
        (f for f in _PRICE_FIELDS if any((b.get(f) is not None) for b in bidders)),
        _PRICE_FIELDS[-1],
    )

    excluded: list[dict] = []
    manual_excluded = set(rule["exclude_bidders"])
    candidates: list[dict] = []
    for b in bidders:
        name = str(b.get("name") or "").strip()
        raw_price = b.get(price_field)
        price = float(raw_price) if raw_price is not None else None
        if name and name in manual_excluded:
            excluded.append({"name": name, "price": price, "reason": "手动判定无效"})
            continue
        if price is None:
            excluded.append({"name": name, "price": None, "reason": f"缺少{('最终报价' if price_field == 'final_price' else '投标价')}数据"})
            continue
        if price <= 0:
            excluded.append({"name": name, "price": price, "reason": "报价无效（非正数）"})
            continue
        candidates.append({"name": name, "price": price})

    if not candidates:
        raise ValueError(f"按所选价格口径（{price_field}）没有可用报价，无法计算基准价")

    prices = [c["price"] for c in candidates]

    def _step(step: str, detail: str, numbers: list[Any] | None = None) -> dict:
        return {"step": step, "detail": detail, "numbers": numbers or []}

    steps: list[dict] = [
        _step(
            "有效性过滤",
            f"共 {len(bidders)} 家，剔除 {len(excluded)} 条后剩 {len(candidates)} 家参与计算",
            [len(bidders), len(excluded), len(candidates)],
        )
    ]

    benchmark: float | None = None
    avg_full_precision: float | None = None

    def _mean(values: list[float]) -> float:
        return sum(values) / len(values)

    if method == "arithmetic_mean":
        avg_full_precision = _mean(prices)
        benchmark = round(avg_full_precision, digits)
        steps.append(_step("算术平均值", "基准价 = 有效报价之和 ÷ 有效家数", _fmt([avg_full_precision], digits)))

    elif method == "mean_discount_k":
        k_pct: float | None
        k_source = "手填 K%"
        if params["k_pct"] is not None:
            k_pct = float(params["k_pct"])
        elif meta.get("d_value") is not None:
            k_pct = float(meta["d_value"])
            k_source = "表内 D 值"
        else:
            raise ValueError("均值下浮法需要 K 值：请在参数填写 K%，或确认开标表内含 D 值行")
        avg_full_precision = _mean(prices)
        raw_benchmark = avg_full_precision * (1 - k_pct / 100)
        benchmark = round(raw_benchmark, digits)
        steps.append(_step("算术平均值", "先求有效报价的算术平均值", _fmt([avg_full_precision], digits)))
        steps.append(_step("下浮系数", f"K = {k_pct:g}%（来源：{k_source}）", [k_pct]))
        steps.append(_step("基准价", "基准价 = 平均值 × (1 − K%)", [benchmark]))

    elif method == "second_average":
        band = float(params["deviation_band"])
        if band <= 0:
            raise ValueError("二次平均法的偏差带必须大于 0")
        avg1 = _mean(prices)
        lo, hi = avg1 * (1 - band / 100), avg1 * (1 + band / 100)
        steps.append(_step("第一次平均", "对全部有效报价求平均值", _fmt([avg1], digits)))
        kept: list[dict] = []
        for c in candidates:
            if lo <= c["price"] <= hi:
                kept.append(c)
            else:
                side = "高于偏差带上限" if c["price"] > hi else "低于偏差带下限"
                excluded.append({
                    "name": c["name"], "price": c["price"],
                    "reason": f"超出 ±{band:g}% 偏差带（{side}）",
                })
        kept_prices = [c["price"] for c in kept]
        steps.append(_step(
            "偏差带筛选",
            f"保留 [{lo:.4g}, {hi:.4g}] 区间内 {len(kept)} 家，剔除 {len(candidates) - len(kept)} 家",
            [round(float(lo), digits), round(float(hi), digits), len(kept)],
        ))
        if kept_prices:
            avg2 = _mean(kept_prices)
            benchmark = round(avg2, digits)
            steps.append(_step("第二次平均", "基准价 = 偏差带内报价的平均值", _fmt([avg2], digits)))
        else:
            benchmark = round(avg1, digits)
            steps.append(_step(
                "偏差带筛选告警",
                "偏差带内没有留下任何报价，已退回第一次平均值作为基准价——请检查偏差带设置",
                [],
            ))

    elif method == "trimmed_mean":
        trim_high = max(0, int(params["trim_high"]))
        trim_low = max(0, int(params["trim_low"]))
        if trim_high + trim_low >= len(candidates):
            raise ValueError(f"去高去低合计 {trim_high + trim_low} 家不能少于有效投标总数 {len(candidates)} 家")
        ordered = sorted(candidates, key=lambda c: c["price"])
        low_cut, high_cut = ordered[:trim_low], ordered[len(ordered) - trim_high:] if trim_high else []
        trimmed_set = {(c["name"], c["price"]) for c in low_cut + high_cut}
        remaining = [c for c in candidates if (c["name"], c["price"]) not in trimmed_set]
        for c in sorted(low_cut, key=lambda c: c["price"]):
            excluded.append({"name": c["name"], "price": c["price"], "reason": "去低剔除"})
        for c in high_cut:
            excluded.append({"name": c["name"], "price": c["price"], "reason": "去高剔除"})
        avg_trimmed = _mean([c["price"] for c in remaining])
        benchmark = round(avg_trimmed, digits)
        removed_desc = "、".join(
            f"{c['name']}({c['price']:g})" for c in sorted(low_cut, key=lambda x: x["price"]) + high_cut
        ) or "无"
        steps.append(_step("去掉最高最低", f"去掉最低 {trim_low} 家、最高 {trim_high} 家：{removed_desc}", []))
        steps.append(_step("剩余均值", f"剩余 {len(remaining)} 家取算术平均值作为基准价", _fmt([avg_trimmed], digits)))

    elif method == "weighted_composite":
        wl = float(params["limit_price_weight"]) / 100
        wf = float(params["floor_weight"]) / 100
        limit_price = meta.get("max_price")
        floor_price = params.get("floor_price")
        if wl > 0 and limit_price is None:
            raise ValueError("加权复合法需要最高限价：确认开标表内含最高投标限价行，或调整权重")
        if wf > 0 and floor_price is None:
            raise ValueError("加权复合法配置了标底权重，但未提供标底数值，请在参数填写标底")
        w_mean = 1 - wl - wf
        if w_mean < 0:
            raise ValueError("限价权重 + 标底权重 合计超过 100%")
        avg_full_precision = _mean(prices)
        parts: list[tuple[str, float]] = []
        if wl > 0:
            parts.append(("最高限价", float(limit_price) * wl))
        if wf > 0:
            parts.append(("标底", float(floor_price) * wf))
        if w_mean > 0:
            parts.append(("报价均值", avg_full_precision * w_mean))
        benchmark = round(sum(v for _, v in parts), digits)
        weights_desc = (
            f"限价 × {wl * 100:g}%"
            + (f" + 标底 × {wf * 100:g}%" if wf > 0 else "")
            + (f" + 报价均值 × {w_mean * 100:g}%" if w_mean > 0 else "")
        )
        steps.append(_step("算术平均值", "先求有效报价的算术平均值", _fmt([avg_full_precision], digits)))
        steps.append(_step("加权合成", f"基准价 = {weights_desc}（分项见 numbers：依次为合成结果）", [benchmark]))

    elif method == "median_or_second_low":
        ordered = sorted(prices)
        pick = params["pick"]
        if pick == "second_low":
            if len(ordered) < 2:
                raise ValueError("次低价至少需要 2 家有效报价")
            picked = ordered[1]
            detail = "排序后取第二低的报价作为基准价（低价优先）"
        else:
            n = len(ordered)
            mid = n // 2
            picked = ordered[mid] if n % 2 == 1 else (ordered[mid - 1] + ordered[mid]) / 2
            detail = f"{n} 家取中位数（偶数家数取中间两家均值）"
        benchmark = round(picked, digits)
        steps.append(_step("选取基准", detail, _fmt([picked], digits)))

    assert benchmark is not None
    return {
        "method": method,
        "method_label": METHOD_LABELS[method],
        "price_field": price_field,
        "source": rule["source"],
        "inputs": {
            "bidder_total": len(bidders),
            "valid_count": len(candidates),
            "max_price": meta.get("max_price"),
            "d_value": meta.get("d_value"),
        },
        "effective_prices": [{"name": c["name"], "price": c["price"]} for c in candidates],
        "excluded": excluded,
        "steps": steps,
        "benchmark": benchmark,
        "sheet_benchmark": meta.get("benchmark_price"),
    }
