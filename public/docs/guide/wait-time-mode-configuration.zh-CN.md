# 等待时间计算模式配置指南

语言：简体中文  
更新：2026-06-07

## 1. 概述

Wait Time Calculation 控制 StatsBoard 如何呈现等待时间。它**不改变模拟行为、不清空统计、不重新创建 item**，只改变等待时间的展示口径。这样同一组模拟结果可以用于三种沟通场景：客户 SLA、内部效率和瓶颈诊断。

| 模式 | 显示重点 | 适合对象 |
| --- | --- | --- |
| Both | Calendar Wait、Working Wait、Diagnostic Working Wait | 初次分析、运营复盘、方案比较 |
| Calendar Time | 客户实际感受到的完整等待 | 客户、业务负责人、SLA 报告 |
| Working Time | 工作时间内真实排队等待 | 运营、排班、容量规划 |

设置位置：Sidebar → Simulation Settings → **Wait Time Calculation**。

---

## 2. 三种模式详解

### 2.1 Both（推荐默认）

Both 会同时显示两种 item 视角等待时间，并额外保留步骤诊断指标。

| 指标 | 含义 | 用途 |
| --- | --- | --- |
| Queue Wait (Calendar) | 从进入队列到开始处理的完整日历等待 | 客户视角 |
| Queue Wait (Working) | 完成 item 在工作时间内经历的排队等待 | 运营视角 |
| Diagnostic Working Wait | 各步骤工作时间等待的步骤级平均 | 找瓶颈 |

适合：首次建模、找原因、比较配置、向团队解释为什么客户等待很长但内部排队未必严重。

### 2.2 Calendar Time

Calendar Time 只突出客户感受到的等待。夜晚、周末、节假日、午休等非工作时间都会被计入。

例：周五 17:00 入队，周一 09:00 开始处理。

- Calendar Wait ≈ 64 小时。
- 适合 SLA、响应时长承诺、客户体验报告。

不要把 Calendar Wait 高直接理解为资源不足。它可能只是工作时间策略导致的自然等待。

### 2.3 Working Time

Working Time 只计算工作时间内的排队等待，更适合内部效率分析。

同样例子：周五 17:00 入队，周一 09:00 开始处理。

- 如果 17:00 正好下班，Working Wait 可能是 0。
- 如果 16:50 入队、17:00 下班、周一 09:00 处理，Working Wait 约 10 分钟。

适合：是否需要加人、加机器、调整 Capacity、比较不同营业时间配置。

---

## 3. 与 Business Hours 的关系

等待时间模式依赖 Business Hours 的时间判断。

| 配置 | 对指标的影响 |
| --- | --- |
| Calendar start | 决定模拟第 0 毫秒对应的真实日历时间 |
| Working days | 决定哪些日期计入工作时间 |
| Working hours | 决定一天内哪些时段计入工作时间 |
| Non-working arrivals = queue | 非工作时间到达可进入队列，Calendar Wait 会累计，Working Wait 只在开门后累计 |
| Non-working arrivals = delay | 到达被推迟到下一段工作时间，off-hours 等待更少体现在队列中 |
| Non-working arrivals = reject | 非工作时间到达不创建 item，并增加 Cancelled 计数 |
| Calendar Override | 某个 Start 或 Process 可用自己的工作日历 |

如果 Calendar Wait 很高但 Working Wait 很低，优先检查 Business Hours 和 Non-working arrivals，而不是马上增加 Capacity。

---

## 4. 决策流程

1. 先用 **Both** 跑基准。
2. 查看 Calendar Wait 与 Working Wait 的差距。
3. 如果 Calendar 高、Working 低：问题多半在营业时间、到达策略或 SLA 口径。
4. 如果 Calendar 高、Working 也高：问题多半在资源、处理时长、返工路由或需求高峰。
5. 查看 Diagnostic Working Wait，定位哪个 Process 最可能是瓶颈。
6. 根据场景切换展示模式：客户报告用 Calendar，内部优化用 Working。

---

## 5. 场景示例

### 客服 SLA 报告

目标：回答「客户从提交工单到被处理前等了多久」。

建议：使用 Calendar Time。  
原因：客户不会把周末和夜晚从等待体验中扣除。

### 内部排班会议

目标：判断是否要增加客服或调整班次。

建议：使用 Working Time，并观察 Resource Util.、Oldest Queue、Throughput。  
原因：需要知道工作时间内是否真的处理不过来。

### 营业时间策略评估

目标：比较 9-17、9-20、周末开门三种方案。

建议：使用 Both。  
原因：Calendar Wait 会显示客户体验改善，Working Wait 会显示内部队列压力是否变化。

### 瓶颈定位

目标：找出哪个步骤拖慢流程。

建议：Both + Diagnostic Working Wait + Step Resource Util.。  
如果某步骤 Diagnostic Working Wait 高且 Resource Util. 高，通常是资源不足或处理时间过长。

---

## 6. 读数检查清单

| 现象 | 可能原因 | 下一步 |
| --- | --- | --- |
| Calendar 高、Working 低 | 非工作时间影响大 | 延长工作时间、调整到达策略、解释 SLA 口径 |
| Calendar 高、Working 高 | 工作时间内也排队 | 检查 Capacity、处理时间、返工、需求高峰 |
| Diagnostic 高但 Working 不高 | 少数步骤异常、步骤平均放大 | 看单步骤队列和利用率 |
| P90 远高于 Avg | 尾端体验差 | 检查复杂 item、返工、波动和高峰 |
| Resource Util. 低但队列长 | 可能关门、连接错误或 Calendar Override | 检查 Business Hours、Process 日历和连接 |

---

## 7. FAQ

**切换模式会影响模拟结果吗？**  
不会。它只改变 StatsBoard 的显示口径。

**哪个模式最准确？**  
三个都准确，只是回答的问题不同。Calendar 回答客户等多久；Working 回答工作时间内堵多久；Diagnostic 帮助找步骤瓶颈。

**为什么 Diagnostic Working Wait 和 Queue Wait (Working) 不一样？**  
Queue Wait (Working) 是按完成 item 的真实经历聚合；Diagnostic 是步骤级平均，不是 item-weighted。

**做报告用哪个？**  
对外默认 Calendar Time；内部改善默认 Working Time；不确定时用 Both。