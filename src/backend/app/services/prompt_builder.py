from __future__ import annotations
"""
Prompt Builder: 组装 system/user prompt，注入领域知识和输出模板。

从旧项目迁移，适配新项目架构（JSON 输出格式 + LiteLLM 调用）。
"""
import re
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts"

# 模板类型 → extract_templates.md 中的 section 标题
TEMPLATE_SECTION_MAP = {
    "standard": "模板一：标准五要素模板（含评分细则）",
    "brief": "模板二：简版速查模板",
    "batch": "模板三：批量对比模板（按类型分组）",
    "threshold": "模板四：门槛分析模板",
}

# 要素 key → 中文名称
ELEMENT_NAMES: dict[str, str] = {
    "basic_info": "项目基本信息",
    "qualification": "资质要求",
    "experience": "业绩要求",
    "personnel": "人员要求",
    "evaluation_method": "评标办法",
    "scoring_details": "分值分配与评分细则",
    "selection_method": "定标方法",
    "contract_terms": "合同条款",
}


class PromptBuilder:
    """构建 LLM prompt，注入领域知识 + 提取规则 + 输出模板。"""

    def __init__(self):
        self._extract_main = self._read("extract_main.md")
        self._extract_templates = self._read("extract_templates.md")
        self._bid_knowledge = self._read("bid-knowledge.md")
        self._opening_main = self._read("opening_main.md")
        self._opening_templates = self._read("opening_templates.md")
        self._simulate_main = self._read("simulate_main.md")
        self._comparison_framework = self._read("comparison-framework.md")
        self._simulation_templates = self._read("simulation-templates.md")

    @staticmethod
    def _read(filename: str) -> str:
        path = PROMPTS_DIR / filename
        try:
            return path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return ""

    @staticmethod
    def _extract_section(text: str, section_title: str) -> str:
        """提取 ## 标题下的内容，直到下一个 ## 标题。"""
        pattern = rf"^## {re.escape(section_title)}\s*\n(.*?)(?=^## |\Z)"
        match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
        return match.group(1).strip() if match else ""

    # =========================================================================
    # Extract 模块
    # =========================================================================

    def build_extract_system_prompt(
        self,
        template_type: str = "standard",
        elements: list[str] | None = None,
    ) -> str:
        """构建要素提取的 system prompt。

        Args:
            template_type: standard | brief | batch | threshold
            elements: 要提取的要素 key 列表，None 表示全部提取
        """
        role = self._extract_main
        knowledge = self._bid_knowledge

        # 只取对应模板 section
        title = TEMPLATE_SECTION_MAP.get(template_type, TEMPLATE_SECTION_MAP["standard"])
        target_template = self._extract_section(self._extract_templates, title)
        if not target_template:
            target_template = self._extract_section(
                self._extract_templates, TEMPLATE_SECTION_MAP["standard"]
            )

        # 要素选择约束
        element_instruction = ""
        if elements:
            selected = [ELEMENT_NAMES.get(e, e) for e in elements if e in ELEMENT_NAMES]
            excluded = [v for k, v in ELEMENT_NAMES.items() if k not in elements]
            if selected:
                element_instruction = (
                    f"\n\n**重要约束**：请仅提取以下指定要素：{'、'.join(selected)}。\n"
                    f"以下要素已被排除，不要输出这些要素的任何内容：{'、'.join(excluded)}。\n"
                    f"对于被排除的要素，直接跳过不写，不要用'未明确'或'略'等占位符。"
                )

        # JSON 输出格式（新项目前端需要结构化 JSON）
        all_elements = elements or list(ELEMENT_NAMES.keys())
        element_names_json = [ELEMENT_NAMES[k] for k in all_elements if k in ELEMENT_NAMES]
        json_format = (
            f"\n\n# JSON 输出格式\n\n"
            f'请只输出 JSON，不要输出 Markdown 代码块、解释文字或额外前后缀。必须包含 "elements" 数组，每个元素有 "name" 和 "content" 字段：\n'
            f'{{"elements": [\n'
            + ",\n".join(f'  {{"name": "{n}", "content": "..."}}' for n in element_names_json)
            + "\n]}}\n\n"
            f"content 字段使用 Markdown 格式（可含表格），内容参考上方模板的结构，信息完整详实。"
            f"如果文档内容中包含以 '--- 第 N 页表格 ---' 标记的表格文本，必须优先依据这些表格抽取评分细则；"
            f"表格行内被换行拆开的词语需要合并识别，例如 '企业业\\n绩' 视为 '企业业绩'，'项目负\\n责人业\\n绩' 视为 '项目负责人业绩'。"
        )
        if template_type == "batch":
            json_format += (
                "\n\n# 批量对比结构化要求\n\n"
                f"必须按要素拆分输出 {len(element_names_json)} 个独立对象，name 必须分别为：{'、'.join(element_names_json)}。"
                "每个 content 内部再横向对比多份文件；禁止把所有内容合并到一个 '分析结果'、'批量对比' 或任意单一要素中。"
                "如果某个要素在部分文件中未明确，也必须保留该要素对象，并在对应文件列中写“未明确”。"
            )
        elif template_type in {"standard", "brief"}:
            json_format += (
                "\n\n# 单文件分板块结构化要求\n\n"
                f"必须按要素拆分输出 {len(element_names_json)} 个独立对象，name 必须分别为：{'、'.join(element_names_json)}。"
                "每个对象的 content 只写该要素对应内容；禁止把所有要素混在一个 JSON 字符串、一个 '分析结果' 或任意单一对象中。"
                "如果某个要素在文件中未明确，也必须保留该要素对象，并在 content 中写“未明确”。"
            )

        return f"""{role}

---

# 参考领域知识

{knowledge}

---

# 输出模板参考（按此结构组织 content 内容）
{element_instruction}

{target_template}
{json_format}
"""

    def build_extract_user_prompt(
        self,
        file_content: str,
        mode: str = "single",
        params: dict | None = None,
    ) -> str:
        """构建要素提取的 user prompt。"""
        mode_instructions = {
            "single": "请从以下招标文件中提取完整的要素，参照系统提示中的模板结构输出。",
            "batch": "请从以下招标文件中提取关键要素，使用批量对比模板格式输出。注意按项目类型分组，禁止跨类型混比。",
            "threshold": "请从以下招标文件中提取门槛要求，并与用户提供的自身条件逐项比对，使用门槛分析模板格式输出。",
        }
        instruction = mode_instructions.get(mode, mode_instructions["single"])

        parts = [instruction]

        if mode == "threshold" and params and "user_qualifications" in params:
            parts.append(
                f"\n## 用户提供的自身条件\n\n"
                f"请根据用户提供的以下条件，与招标文件门槛进行逐项比对：\n\n{params['user_qualifications']}"
            )

        parts.append("\n---\n\n# 招标文件内容\n")
        parts.append(file_content)
        return "\n".join(parts)

    # =========================================================================
    # Simulate 模块
    # =========================================================================

    def build_simulate_system_prompt(self, step: str = "step3_compare") -> str:
        """构建模拟编制的 system prompt。"""
        role = self._simulate_main
        knowledge = self._bid_knowledge

        template_map = {
            "step3_compare": self._comparison_framework,
            "step4_simulate": self._simulation_templates,
        }
        template = template_map.get(step, "")

        return f"""{role}

---

# 参考领域知识

{knowledge}

---

# 输出格式要求

请严格按照以下模板格式输出：

{template}
"""

    def build_simulate_user_prompt(
        self,
        extraction_results: str,
        step: str = "step3_compare",
        params: dict | None = None,
    ) -> str:
        if step == "step3_compare":
            return (
                f"请对以下多份招标文件提取结果进行六维度对比分析并总结区域规律：\n\n"
                f"---\n\n# 多份招标文件提取结果\n\n{extraction_results}"
            )
        elif step == "step4_simulate":
            params_text = ""
            if params:
                params_text = "\n".join(f"- {k}: {v}" for k, v in params.items())
            return (
                f"请基于以下区域规律分析结果和目标项目参数，编制模拟招标文件：\n\n"
                f"---\n\n# 区域规律分析结果\n\n{extraction_results}\n\n"
                f"---\n\n# 目标项目参数\n\n{params_text}"
            )
        return extraction_results

    # =========================================================================
    # Opening 模块
    # =========================================================================

    def build_opening_system_prompt(self) -> str:
        role = self._opening_main
        knowledge = self._bid_knowledge
        template = self._opening_templates

        return f"""{role}

---

# 参考领域知识

{knowledge}

---

# 输出格式要求

请严格按照以下模板格式输出：

{template}
"""

    def build_opening_user_prompt(self, statistics_json: str) -> str:
        return (
            f"请基于以下开标数据统计分析结果，撰写综合分析报告：\n\n---\n\n"
            f"# 开标数据统计分析结果\n\n{statistics_json}\n\n"
            f"请包括：价格梯队划分、降价策略分析、离散度变化、排名变化分析。"
        )


# 全局单例
_prompt_builder: PromptBuilder | None = None


def get_prompt_builder() -> PromptBuilder:
    global _prompt_builder
    if _prompt_builder is None:
        _prompt_builder = PromptBuilder()
    return _prompt_builder
