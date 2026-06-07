# FlowSim 文档索引

语言：简体中文  
更新：2026-06-07

## 1. 文档入口

| 文档 | 说明 | 繁體中文 | 简体中文 | English |
| --- | --- | --- | --- | --- |
| 完整使用手册 | 全系统操作、节点配置、指标、模板 | [開啟](user-guide.md) | [打开](user-guide.md) | [Open](user-guide.md) |
| Routing 配置与诊断 | Load-aware、profile/priority 分流、fallback 与诊断表 | [開啟](routing-configuration.zh-TW.md) | [打开](routing-configuration.zh-CN.md) | [Open](routing-configuration.en.md) |
| 等待时间快速参考 | 5 分钟决策表和读数口诀 | [開啟](wait-time-quick-reference.zh-TW.md) | [打开](wait-time-quick-reference.zh-CN.md) | [Open](wait-time-quick-reference.en.md) |
| 等待时间模式配置 | 三种模式、场景、FAQ | [開啟](wait-time-mode-configuration.zh-TW.md) | [打开](wait-time-mode-configuration.zh-CN.md) | [Open](wait-time-mode-configuration.en.md) |
| 双等待时间指标 | 指标口径、聚合方式、技术解读 | [開啟](../technical/dual-wait-time-metrics.zh-TW.md) | [打开](../technical/dual-wait-time-metrics.zh-CN.md) | [Open](../technical/dual-wait-time-metrics.en.md) |
| 模拟算法详解 | Tick、到达、资源、日历与统计算法 | [開啟](../technical/simulation-algorithm.zh-TW.md) | [打开](../technical/simulation-algorithm.zh-CN.md) | [Open](../technical/simulation-algorithm.en.md) |
| 模拟模式指南 | Realistic、Worst-Case、资源执行模式 | [開啟](../technical/simulation-mode-guide.zh-TW.md) | [打开](../technical/simulation-mode-guide.zh-CN.md) | [Open](../technical/simulation-mode-guide.en.md) |
| 多段工作时间 | Business Hours、queue/delay/reject、Override | [開啟](../technical/multi-segment-business-hours.zh-TW.md) | [打开](../technical/multi-segment-business-hours.zh-CN.md) | [Open](../technical/multi-segment-business-hours.en.md) |
| 排障指南 | 症状 → 检查 → 修复 | [開啟](../technical/troubleshooting.zh-TW.md) | [打开](../technical/troubleshooting.zh-CN.md) | [Open](../technical/troubleshooting.en.md) |
| 配置与数据模型 | 配置结构、导入清理、文档入口维护 | [開啟](../technical/configuration-reference.zh-TW.md) | [打开](../technical/configuration-reference.zh-CN.md) | [Open](../technical/configuration-reference.en.md) |

---

## 2. 推荐阅读路径

| 场景 | 阅读顺序 |
| --- | --- |
| 第一次使用 | 完整使用手册 → 等待时间快速参考 → 排障指南 |
| 做 SLA 报告 | 等待时间模式配置 → 双等待时间指标 → 快速参考 |
| 做容量规划 | 完整使用手册 → 模拟模式指南 → 双等待时间指标 |
| 设置动态分流 | Routing 配置与诊断 → Routing Demo → 排障指南 |
| 理解算法口径 | 模拟算法详解 → 双等待时间指标 → 配置与数据模型 |
| 调整营业时间 | 多段工作时间 → 等待时间模式配置 → 双等待时间指标 |
| 找瓶颈 | 快速参考 → 双等待时间指标 → 排障指南 |
| 维护文档系统 | 本索引 → `public/docs/README.md` → `constants/documents.ts` |

---

## 3. 文档目录规范

| 目录 | 用途 |
| --- | --- |
| `public/docs/guide/` | 面向用户的操作指南和快速参考 |
| `public/docs/technical/` | 指标口径、模式说明、排障和实现相关概念 |
| `public/docs/archive/` | 历史修复记录和旧版资料，只作追溯，不作主入口 |

新增主文档后必须同步：

1. 添加三语文件。
2. 更新 `constants/documents.ts`。
3. 更新本文档索引。
4. 检查应用内 Docs 菜单和 Markdown 语言切换。