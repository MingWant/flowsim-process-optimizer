# FlowSim Documentation System

文档已集中放在 `public/docs/`，并按 `zh-TW`、`zh-CN`、`en` 三种语言维护当前有效文档。当前主文档已从摘要版恢复为详细版，应保留操作步骤、场景案例、决策流程、FAQ 与排障表，不要只保留短摘要。

## 目录规范

```text
public/docs/
├─ index.html                 # 浏览器版文档中心
├─ guide/                     # 面向用户的指南、快速参考、索引（三语）
├─ technical/                 # 技术说明、概念解释、排障材料（三语）
└─ archive/                   # 历史修复记录、完成总结、迁移记录
```

## 命名规范

- 使用小写 kebab-case：`wait-time-mode-configuration`
- 语言后缀放在扩展名前：`.zh-TW.md`、`.zh-CN.md`、`.en.md`
- 多语言合并文件可不加语言后缀，例如 `user-guide.md`
- 新增面向用户的 Markdown 后，同步更新 `constants/documents.ts`

## 语言策略

- 当前活跃文档应尽量提供 `zh-TW`、`zh-CN`、`en` 三个版本
- `user-guide.md` 是三语合并文档；其他活跃文档采用语言后缀拆分
- 语言映射集中在 `constants/documents.ts`
- 不再在根目录放置临时总结或修复记录

## 内容深度策略

- `guide/user-guide.md` 保留完整操作说明，至少覆盖界面、Start、Process、Connections、Business Hours、Demand Peaks、Auto Pause、指标、导入导出和 AI。
- 快速参考可以短，但必须包含决策表、例子和读数口诀。
- 完整指南和技术文档必须包含场景、指标口径、误区和排查建议。
- 新增或翻译文档时，不应以三语覆盖为理由删除细节；若需要压缩，应另建 quick reference。
- `archive/` 可用于追溯旧版说明，但当前入口应指向 `guide/` 和 `technical/`。

## 当前活跃文档

| 文档 | 路径模式 |
| --- | --- |
| 用户指南 | `guide/user-guide.md` |
| 文档索引 | `guide/documentation-index.{lang}.md` |
| Routing 配置与诊断 | `guide/routing-configuration.{lang}.md` |
| 等待时间快速参考 | `guide/wait-time-quick-reference.{lang}.md` |
| 等待时间模式配置 | `guide/wait-time-mode-configuration.{lang}.md` |
| 双等待时间指标 | `technical/dual-wait-time-metrics.{lang}.md` |
| 模拟算法详解 | `technical/simulation-algorithm.{lang}.md` |
| 模拟模式指南 | `technical/simulation-mode-guide.{lang}.md` |
| 多段工作时间 | `technical/multi-segment-business-hours.{lang}.md` |
| 排障指南 | `technical/troubleshooting.{lang}.md` |
| 配置与数据模型 | `technical/configuration-reference.{lang}.md` |

## 应用入口

- HTML 文档中心：`/docs/index.html`
- 应用内 Markdown 入口：顶部 `Docs` 菜单
