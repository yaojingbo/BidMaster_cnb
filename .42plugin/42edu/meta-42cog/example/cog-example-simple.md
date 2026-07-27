---
name: cog-example-simple
description: Simple cognitive model example
---

# 认知模型示例 - 简明写法

## 示例：咨询平台

<cog>
本系统包括以下关键实体：
- user：用户
  - counselor：咨询师，一种特殊的user
  - admin：管理员，一种特殊的user
- content：内容
</cog>

<user>
- 唯一编码：按照注册时间次序生成的UUID号
- 常见分类：游客；注册用户；来访者（短程、长程）
</user>

<counselor>
- 唯一编码：每个咨询师有个独立的slug，例如lintong
- 常见分类：咨询师（实习咨询师、助理咨询师、正式咨询师、资深咨询师）；咨询助理（配合咨询师接待来访者，但没有一些保密权限）
</counselor>

<content>
- 唯一编码：按照文章的日期编码，例如20251204
- 常见分类：咨询师专栏；东木动态
</content>

<rel>
- user-content：一对多（一个用户可创建多个内容）
- user-user：多对多（咨询关系、督导关系）
</rel>
