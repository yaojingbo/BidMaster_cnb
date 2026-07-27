# Bid Master Web - 认知模型

<cog>
本系统包括以下关键实体：
- user：用户（招投标方）
- tender_doc：招标文件
- analysis：分析结果
  - element_extract：要素提取结果
  - opening_analysis：开标分析结果
  - simulated_doc：模拟编制结果
</cog>

<user>
- 常见分类：投标方；招标方；评标专家
</user>

<document>
- 唯一编码：上传时生成的UUID + 时间戳
- 常见分类：招标公告；招标文件
- 格式：PDF、Markdown
</document>

<analysis>
- 唯一编码：关联document UUID + 分析类型
- 常见分类：要素提取；开标分析；模拟编制
</analysis>

<rel>
- user-document：一对多（一个用户可上传多个招标文件）
- document-analysis：一对多（一个文件可进行多种分析）
- user-ai_config：一对多（一个用户可配置多个AI供应商）
</rel>
