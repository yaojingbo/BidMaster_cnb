# Bid Master Web - 认知模型

<cog>
本系统包括以下关键实体：
- user：用户（招投标方）
- tender_doc：招标文件
- analysis：分析结果
  - element_extract：要素提取结果
  - opening_analysis：开标分析结果
  - simulated_doc：模拟编制结果
- ai_config：AI 供应商配置
</cog>

<user>
- 唯一编码：注册/登录生成的用户 ID
- 常见分类：投标方；招标方；评标专家
</user>

<document>
- 唯一编码：上传时生成的 UUID + 时间戳
- 常见分类：招标公告；招标文件
- 格式：PDF、Markdown
</document>

<analysis>
- 唯一编码：关联 document UUID + 分析类型
- 常见分类：要素提取；开标分析；模拟编制
</analysis>

<rel>
- user-document：一对多（一个用户可上传多个招标文件）
- document-analysis：一对多（一个文件可进行多种分析）
- user-ai_config：一对多（一个用户可配置多个 AI 供应商）
</rel>

## 参与者

| 角色 | 负责 | 不负责 |
|---|---|---|
| 人 | 意图的源头 · 挑错 · 定标 · 最终拍板 | 不做能被规则判对错的检查 |
| AI | 源头之后的一切：整理 / 生成 / 检查 | 不定方向、不定标准 |

## 关键关系

- **谁是谁的输入**：`tender_doc` 是 `analysis` 的原料（一份文件喂多种分析），`analysis` 又是后续编制/报价决策的原料。
- **谁定谁的标准**：人亲手改的那一版，定了后面所有版本的标准。
- **真相是角色不是属性**：上游的招标文件原件流进 `resources/` / `vault/raw/`，才成为本系统的真相源。