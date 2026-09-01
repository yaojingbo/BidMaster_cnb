---
name: opening-analysis-eval-rule-prd
description: 开标分析·评标基准价计算规则功能 PRD（方案 D 分层混合，首批六办法 + 自定义逃生舱）
created: 2026-08-27
depends: intent.md, real.md
---

# 开标分析 · 评标基准价规则（PRD）

## 一、背景与问题

开标表格中的报价是确定的，但不同项目计算评标基准价的办法不同（算术平均 / 二次平均 / 去高去低等）。
现状：`benchmark` 模块只会**被动读取表内现成的基准价行**，表里没有就无法做基准价对比，
也无法按办法主动计算。用户被迫手算。

## 二、方案：分层混合（用户已拍板）

**B 预设库做底座 + C 提取做加速器 + A 自定义做逃生舱**，三层共用同一结构化规则对象。

关键架构原则：

1. **AI 不碰数值**。AI 只负责"文字 → 结构化参数"；基准价由服务端纯函数确定性计算。
2. **中间量必须展示**。剔除谁、为什么、第一均值、第二均值……逐项可对账（验证闭环：数字与人工核算一致）。
3. 三层入口殊途同归：最后都落成同一个 `eval_rule` 对象。

## 三、结构化规则对象（唯一真相源）

```jsonc
{
  "method": "arithmetic_mean | mean_discount_k | second_average | trimmed_mean |
             weighted_composite | median_or_second_low",
  "price_field": "final_price | bid_price",        // 用哪个价参与计算，默认 final_price，缺则 bid_price
  "params": {
    "k_pct": 2.0,               // 均值下浮法：下浮百分比 K%
    "deviation_band": 5.0,      // 二次平均法：第一均值 ±N% 偏差带
    "trim_high": 1,             // 去高去低法：去最高 N 家
    "trim_low": 1,              // 去高去低法：去最低 N 家
    "limit_price_weight": 60,   // 加权复合法：最高限价权重 W%（其余给报价均值）
    "floor_weight": 0,          // 加权复合法：标底权重（三方加权时用）
    "pick": "second_low",       // 次低价/中位数："second_low" | "median"
    "round_digits": 2           // 基准价取整位数
  },
  "exclude_bidders": [],         // 手动判定无效的投标人名单（先剔除再算）
  "source": "preset | extracted | parsed_custom"  // 规则从哪来（对账溯源用）
}
```

## 四、六种内置办法的精确语义

| # | method | 名称 | 计算 | 关键参数 |
|---|--------|------|------|---------|
| 1 | arithmetic_mean | 算术平均法 | 有效报价算术平均值 | price_field |
| 2 | mean_discount_k | 均值下浮法（K值） | 平均值 × (1 − K%)；K 可读表内 D值 或手填 | k_pct |
| 3 | second_average | 二次平均法 | 第一均值 → 仅保留偏差带 ±N% 内报价 → 第二均值即基准价 | deviation_band |
| 4 | trimmed_mean | 去高去低法 | 排序后去掉最高 trim_high 家、最低 trim_low 家再平均 | trim_high / trim_low |
| 5 | weighted_composite | 加权复合法 | 限价×W% + 报价均值×(100−W)%（+ 标底×F% 三方加权可选） | limit_price_weight / floor_weight |
| 6 | median_or_second_low | 次低价 / 中位数 | 直接以次低价或中位数作基准价 | pick |

有效性前置过滤（所有办法通用）：报价 ≤0 自动无效；`exclude_bidders` 手动剔除；
最高限价超限者是否剔除作为参数暴露于 UI（默认保留，仅标注）。

## 五、三层入口

1. **预设（底座）**：六办法卡片点选 → 动态参数表单 → 试算预览。
2. **从招标文件提取（加速器）**：贴评标办法原文（或后续接项目内已上传招标文件的要素结果），AI 解析成上述枚举参数 + 原文出处，进同一确认界面校正后采用。无法映射到枚举时如实告知，退回手动选最近办法调参。
3. **自定义逃生舱** = 入口 2 的贴原文路径（用户拍板要求增加「其他」填空栏）。

## 六、改动清单

| 层 | 文件 | 改动 |
|---|---|---|
| 后端内核 | `app/services/eval_rule_service.py`（新） | 规则 schema 校验 + 六办法纯函数计算器，返回 `{benchmark, steps[], excluded[], method_label}` |
| 后端 API | `app/api/statistics.py` | `OpeningAnalysisRequest` 增 `evalRule`；benchmark 模块优先用计算基准价（表内值仍展示对比）；新增 `/statistics/benchmark/suggest`（原文→规则草案）；新增试算预览入口 |
| 存储 | `pg_storage.py` | 规则持久化进 openings.meta.eval_rule（复用现有 JSON 列，免迁移） |
| 提示词 | `prompts/opening_main.md` | 注入所选办法与其结果上下文，让 AI 解读引用一致 |
| 提示词 | `prompts/opening_rule_extract.md`（新） | 原文→结构化规则的解析提示词，输出约束为已知枚举，附原文出处字段 |
| 前端 | `(main)/statistics/page.tsx` + 新组件 | 「评标基准价设置」卡：位于列勾选之后、开始分析之前；办法选择卡网格 + 动态参数 + 贴原文抽屉 + 中间量对账表 |

## 七、验收判据

1. 黄金用例：每种办法至少 2 个手工核算过的样例（含 K 值法读表内 D 值场景），服务端输出与人工计算完全一致。
2. 中间量完整：任何一条被剔除的报价都有明确原因；步骤数列在 UI 可查。
3. 表内已有基准价时新旧并存显示，冲突以计算值为准并明示。
4. AI 解析失败不静默：无法映射时报错并保留手动入口，绝不编造参数。
