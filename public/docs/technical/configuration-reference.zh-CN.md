# 配置、导入导出与数据模型参考

语言：简体中文  
更新：2026-06-07

## 1. 配置结构

FlowSim 的主配置类型是 `SimulationConfig`。它由全局设置和步骤数组组成。

| 字段 | 含义 |
| --- | --- |
| `steps` | 所有 Start、Process、End 节点 |
| `isRunning` | 是否正在运行；导入时会重置为 false |
| `speedMultiplier` | Speed 倍率，影响模拟推进 |
| `timeCompression` | Sim Clock，每真实 ms 推进多少模拟 ms |
| `simulationMode` | `realistic` 或 `worst-case` |
| `calendarStartIso` | 模拟 0 点对应的日历时间 |
| `businessCalendar` | 全局工作日历 |
| `demandModifiers` | 全局需求高峰 |
| `autoPause` | 自动暂停条件 |
| `waitTimeCalculationMode` | `both`、`calendar`、`working` |

---

## 2. 节点数据模型

所有节点都是 `ProcessStep`，通过 `type` 区分。

| type | 核心字段 | 用途 |
| --- | --- | --- |
| `start` | arrivalModel、arrivalRate、arrivalSchedule、arrivalEvents、itemProfiles | 创建 item |
| `process` | capacity、simulationMode、resourceExecutionMode、processingTime、failureProbability | 排队、处理、失败、取消 |
| `end` | endTimeUnit | 流程终点和显示单位 |

所有非 End 节点都可有 `connections`。所有节点都有 `id`、`name`、`color`、`x`、`y`。

---

## 3. 默认示例流程

默认配置是在线订单流程：

```text
Online Orders → Order Taking → Preparation → Quality Check → Packaging → Shipment
                         ↑                 |
                         └──── 10% rework ─┘
```

关键默认值：

- Start：12 items / hour。
- Order Taking：Capacity 2，2 秒，Queue Cancellation = 5% / sec。
- Preparation：Capacity 3，4 秒，10% failure。
- Quality Check：Capacity 1，1.5 秒，5% failure，90% 去 Packaging，10% 回 Preparation。
- Packaging：Capacity 2，1 秒。

---

## 4. 导入清理规则

导入入口是 `parseImportedConfig`，可接受两种格式：

1. 直接的 `SimulationConfig`。
2. 包含 `{ config: ... }` 的导出包装格式。

导入时会执行 sanitize：

| 项目 | 规则 |
| --- | --- |
| 节点类型 | 只接受 start/process/end |
| 概率 | 限制到 0-1 |
| Connections | 移除不存在目标和自连接，然后归一化概率 |
| Capacity | 至少为 1，仅 Process 使用 |
| Batch size | 1 到 1000 |
| Scheduled quantity | 最大 50000 |
| Teams | resources 限制为正整数 |
| Explicit teams | 保存前要求总资源数等于 Capacity |
| Working hours | 无效时段会被忽略，默认 9-17 |
| Demand multiplier | 最小 0.01 |
| Auto Pause target | 必须为正数 |

---

## 5. 多语言文档入口配置

应用内 Docs 菜单由 `constants/documents.ts` 管理。

| 字段 | 含义 |
| --- | --- |
| `id` | 文档唯一标识 |
| `title` | 菜单显示标题 |
| `shortTitle` | 简短标题 |
| `description` | 菜单描述 |
| `category` | guide 或 technical |
| `defaultPath` | 默认打开路径 |
| `alternates` | zh-TW、zh-CN、en 三语路径 |

新增主文档时，应同步添加三语文件、更新 `MARKDOWN_DOCS`、更新文档索引和 README。

---

## 6. 本地草稿和备份

FlowSim 会使用浏览器 localStorage 保存草稿。草稿适合短期恢复，不适合作为长期备份。

推荐做法：

- 重要实验前先 Export。
- 导入别人的 JSON 前先 Export 当前版本。
- 版本变更或分享模型时使用 JSON 文件，而不是依赖浏览器草稿。

---

## 7. 维护建议

| 任务 | 建议 |
| --- | --- |
| 新增字段 | 同步更新 `types.ts`、sanitize、默认值、文档 |
| 新增节点模式 | 同步 Step Editor、模拟核心、StatsBoard、导入清理 |
| 新增文档 | 三语补齐并更新 `constants/documents.ts` |
| 修改算法口径 | 更新算法文档、等待时间文档和排障指南 |
| 修改指标 | 更新 StatsBoard 说明和技术指标文档 |