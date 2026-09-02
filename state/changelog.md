# Bid Master Web · 演化记录（给人类）

> 每条只答三问：**变了什么 · 为什么变 · 对你意味着什么**。每里程碑一条，倒序追加；细节见 `state/board.md` 与 git log。

## 2026-08-27 · 对齐 aias-meta-init 六组骨架

**变了什么**：跑 `aias-meta-init` 把项目元结构对齐到「六组」骨架——
① `.42cog/` 走方向 A（保留目录制 meta/real/cog/work/others，新增 `intent.md` 收敛方向，删 AI 散文件 real.md/cog.md/meta.md，把 AI 新维度补进各目录版）；
② `CLAUDE.md` 融合（吸收分工线 / 提交链五行 / 铁律补充，路径 spec→specs、resource→resources 更新）；
③ `.gitignore` 补六组过程材料与 resources 忽略规则；
④ `.42cog/spec/` 迁根级 `specs/`，`resource/` 迁 `resources/`，修正 spec 内部自引用与 vitest 配置；
⑤ 保留 vault/state/scripts/plugin.json/.claude/workflows 等无重叠新骨架。
AI 版 README/CLAUDE/.gitignore 同名存档对比后丢弃；原件改动前已备份到 `/Users/yaojingboV2/1.Mynote/_backups/bid-master-web-meta-20260827/`。

**为什么变**：项目原有 `.42cog` 目录制与 skill 的文件制冲突；用「保留真实内容 + 吸收 AI 方法论维度」的最小代价方式对齐，而非整份替换。

**对你意味着什么**：收敛方向（`.42cog/intent.md` 第一句）是这次唯一需要你过目拍板的；其余是结构对齐，已落地。下一步可进 `bm-research` 找依据、排真相源权重，回来改那句。
