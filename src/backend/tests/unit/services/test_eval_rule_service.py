"""评标基准价规则内核黄金用例：所有期望值均为人工核算结果，禁止反向从实现生成。"""

import pytest

from app.services.eval_rule_service import (
    METHOD_LABELS,
    compute_benchmark_from_rule,
    normalize_rule,
)


def bidders(*specs) -> list[dict]:
    """specs 元素为 (名称, bid_price) 或 (名称, bid_price, final_price)。"""
    out = []
    for spec in specs:
        name, bid = spec[0], spec[1]
        final = spec[2] if len(spec) > 2 else None
        out.append({"name": name, "bid_price": bid, "final_price": final})
    return out


def test_算术平均法_基准值():
    rule = {"method": "arithmetic_mean", "price_field": "bid_price"}
    r = compute_benchmark_from_rule(rule, bidders(("甲", 100), ("乙", 110), ("丙", 120)), {})
    assert r["benchmark"] == 110.00
    assert r["method_label"] == "算术平均法"


def test_k值下浮法_手填k():
    rule = {"method": "mean_discount_k", "price_field": "bid_price",
            "params": {"k_pct": 3}}
    r = compute_benchmark_from_rule(rule, bidders(("甲", 100), ("乙", 110), ("丙", 120)), {})
    assert r["benchmark"] == 106.70


def test_k值下浮法_缺d值缺k报错():
    rule = {"method": "mean_discount_k"}
    with pytest.raises(ValueError, match="K 值"):
        compute_benchmark_from_rule(rule, bidders(("甲", 100)), {})


def test_d值回退_表内d_value优先使用():
    rule = {"method": "mean_discount_k"}
    meta = {"d_value": 5}
    r = compute_benchmark_from_rule(rule, bidders(("甲", 100), ("乙", 110), ("丙", 120)), meta)
    assert r["benchmark"] == 104.50
    assert any("D 值" in s["detail"] for s in r["steps"])


def test_二次平均法_偏差带剔除并二次平均():
    rule = {
        "method": "second_average",
        "price_field": "bid_price",
        "params": {"deviation_band": 10},
    }
    data = bidders(("A", 70), ("B", 95), ("C", 100), ("D", 108), ("E", 180))
    r = compute_benchmark_from_rule(rule, data, {})
    # 第一均值 110.6；±10% => [99.54, 121.66]；保留 C/D，二次均值 104.00
    assert r["benchmark"] == 104.00
    dropped = {e["name"] for e in r["excluded"]}
    assert dropped == {"A", "B", "E"}
    assert all("偏差带" in e["reason"] for e in r["excluded"])


def test_去高去低法():
    rule = {"method": "trimmed_mean", "price_field": "bid_price"}
    r = compute_benchmark_from_rule(
        rule,
        bidders(("A", 80), ("B", 100), ("C", 110), ("D", 120), ("E", 999)),
        {},
    )
    assert r["benchmark"] == 110.00
    trimmed_names = {e["name"] for e in r["excluded"]}
    assert trimmed_names == {"A", "E"}


def test_去高去低法_去太少家数报错():
    rule = {"method": "trimmed_mean", "params": {"trim_high": 2, "trim_low": 2}}
    with pytest.raises(ValueError):
        compute_benchmark_from_rule(rule, bidders(("A", 100), ("B", 110), ("C", 120)), {})


def test_加权复合法_限价与均值二元加权():
    rule = {
        "method": "weighted_composite",
        "price_field": "bid_price",
        "params": {"limit_price_weight": 60},
    }
    r = compute_benchmark_from_rule(
        rule, bidders(("甲", 100), ("乙", 110), ("丙", 120)),
        {"max_price": 120},
    )
    # 限价 120×60% + 均值 110×40% = 116.00
    assert r["benchmark"] == 116.00


def test_加权复合法_含标底三方加权():
    rule = {
        "method": "weighted_composite",
        "params": {"limit_price_weight": 50, "floor_weight": 20, "floor_price": 98},
    }
    r = compute_benchmark_from_rule(
        rule, bidders(("甲", 100), ("乙", 110), ("丙", 120)),
        {"max_price": 120},
    )
    # 限价 60 + 标底 19.6 + 均值 33 = 112.60
    assert r["benchmark"] == 112.60


def test_加权复合法_缺最高限价报错():
    rule = {"method": "weighted_composite"}
    with pytest.raises(ValueError, match="最高限价"):
        compute_benchmark_from_rule(rule, bidders(("甲", 100)), {})


def test_次低价与中位数():
    second_low = {"method": "median_or_second_low", "price_field": "bid_price"}
    r1 = compute_benchmark_from_rule(second_low, bidders(("A", 98), ("B", 100), ("C", 105)), {})
    assert r1["benchmark"] == 100.00

    median = {"method": "median_or_second_low", "params": {"pick": "median"}}
    r2 = compute_benchmark_from_rule(median, bidders(("A", 98), ("B", 100), ("C", 105), ("D", 120)), {})
    assert r2["benchmark"] == 102.50

    r3 = compute_benchmark_from_rule(median, bidders(("A", 90), ("B", 100), ("C", 120)), {})
    assert r3["benchmark"] == 100.00


def test_手动剔除与非正数报价过滤():
    rule = {
        "method": "arithmetic_mean",
        "exclude_bidders": ["废标"],
        "price_field": "bid_price",
    }
    data = bidders(("甲", 100), ("乙", 110), ("废标", 50), ("坏价", -8))
    r = compute_benchmark_from_rule(rule, data, {})
    assert r["benchmark"] == 105.00
    reasons = {e["name"]: e["reason"] for e in r["excluded"]}
    assert reasons["废标"] == "手动判定无效"
    assert "非正数" in reasons["坏价"]


def test_price_field自动选择_有最终报价则用最终报价():
    rule = {"method": "arithmetic_mean"}  # 不指定 price_field
    data = bidders(
        ("甲", 100, 96),
        ("乙", 110, 108),
    )
    r = compute_benchmark_from_rule(rule, data, {})
    assert r["price_field"] == "final_price"
    assert r["benchmark"] == 102.00


def test_未知办法与非法字段校验():
    with pytest.raises(ValueError, match="未知的基准价计算办法"):
        normalize_rule({"method": "玄学平均"})
    with pytest.raises(ValueError, match="price_field"):
        normalize_rule({"method": "arithmetic_mean", "price_field": "均价"})
    with pytest.raises(ValueError, match="pick"):
        normalize_rule({"method": "median_or_second_low", "params": {"pick": "随便"}})
    assert sorted(METHOD_LABELS)[0]


def test_中间量完整可对账():
    rule = {"method": "second_average", "price_field": "bid_price", "params": {"deviation_band": 10}}
    r = compute_benchmark_from_rule(
        rule, bidders(("A", 70), ("B", 95), ("C", 100), ("D", 108), ("E", 180)), {}
    )
    assert r["sheet_benchmark"] is None
    assert r["inputs"]["valid_count"] == 5
    band_step = next(s for s in r["steps"] if s["step"] == "偏差带筛选")
    assert band_step["numbers"][2] == 2
    assert len(r["steps"]) >= 3
    assert {s["step"] for s in r["steps"]} >= {"有效性过滤", "第一次平均", "第二次平均"}
