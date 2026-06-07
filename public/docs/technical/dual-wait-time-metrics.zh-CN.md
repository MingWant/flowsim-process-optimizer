# 双等待时间指标技术说明

语言：简体中文  
更新：2026-06-07

## 1. 设计目的

FlowSim 同时保留 Calendar Wait 与 Working Wait，是为了避免把两种不同问题混在一起：

- 客户视角：从提交到被处理前，真实过了多久？
- 运营视角：在公司开门、有资源可工作的时间里，队列真正积压了多久？

如果只看 Calendar Wait，可能误判为资源不足；如果只看 Working Wait，可能低估客户体验问题。因此系统提供双指标，并额外提供 Diagnostic Working Wait 做步骤级瓶颈诊断。

---

## 2. 指标定义

| 指标 | 口径 | 聚合方式 | 主要用途 |
| --- | --- | --- | --- |
| Queue Wait (Calendar) | item 从入队到开始处理的完整日历时间 | item-weighted | SLA、客户体验、对外报告 |
| Queue Wait (Working) | item 在工作时间内实际等待处理的时间 | item-weighted | 内部效率、排班、容量规划 |
| Diagnostic Working Wait | 各 Process 步骤 Working Wait 的步骤级平均 | step average | 找瓶颈、定位异常步骤 |
| Non-working Delay | `Calendar Cycle - Global Working Cycle`，基于全局 Business Calendar 的非工作时间差 | item/flow 统计 | 评估营业时间策略 |

### 2.1 Calendar Wait

包含夜晚、周末、午休、假日和任何非工作时间。

例：周五 17:00 入队，周一 09:00 开始处理。

```text
Calendar Wait = 周五 17:00 到周一 09:00 ≈ 64 小时
```

### 2.2 Working Wait

只统计 Business Hours 打开时 item 在队列中等待的时间。

```text
周五 16:50 入队 → 17:00 下班 → 周一 09:00 处理
Working Wait ≈ 10 分钟
```

### 2.3 Diagnostic Working Wait

Diagnostic Working Wait 是步骤诊断指标，不是客户平均体验。它会把每个步骤的工作时间等待平均起来，用来突出某个小步骤的异常。

例：

```text
步骤 A：100 个 item，平均 Working Wait = 1 分钟
步骤 B：1 个 item，平均 Working Wait = 100 分钟

Queue Wait (Working) ≈ (100*1 + 1*100) / 101 = 1.98 分钟
Diagnostic Working Wait = (1 + 100) / 2 = 50.5 分钟
```

这说明 B 步骤值得排查，但不代表平均每个 item 等了 50.5 分钟。

---

## 3. 与模拟逻辑的关系

| 模块 | 对等待指标的影响 |
| --- | --- |
| Start | 决定 item 何时进入系统，受 Arrival Model、Batch、Item Mix、Demand Peaks 影响 |
| Process Resource Mode | 资源不足会形成 queue，等待指标主要在这里产生 |
| Process Time Delay | 不使用资源，一般不产生资源队列等待，但会增加周期时间 |
| Business Hours | 决定 Working Wait 的计时窗口 |
| Calendar Override | 让单个 Start 或 Process 使用与全局不同的工作日历 |
| Non-working arrivals | 决定非工作时间 arrival 是 queue、delay 还是 reject |
| Connections | 返工路径会增加多次排队和周期时间 |
| Exceptions | 失败和取消会影响完成 item 的统计样本 |

---

## 4. 典型读数

| Calendar Wait | Working Wait | 可能含义 |
| --- | --- | --- |
| 高 | 低 | 非工作时间占比高，客户等很久但开门时不一定堵 |
| 高 | 高 | 开门时也排队，资源或处理时长可能不足 |
| 低 | 高 | 短时间高峰内排队明显，但总体日历跨度不长 |
| 低 | 低 | 等待压力较小 |

进一步结合：

- Resource Util. 高 + Working Wait 高：资源不足或处理时间过长。
- P90 高 + Avg 正常：尾端体验差，检查复杂 item、高峰、返工。
- Non-working Delay 高：营业时间、午休、周末影响明显。

---

## 5. 多步骤与返工

一个 item 可能经过多个 Process，每次进入资源队列都会产生一次等待。Flow-level 指标会汇总 item 的实际经历；Step-level 指标用于显示每个步骤自己的队列情况。

返工示例：

```text
Preparation → Quality Check → 10% 回 Preparation → Quality Check → Packaging
```

返工会同时增加：

- 总周期时间。
- 队列等待次数。
- 资源负载。
- P90 和尾端风险。

---

## 6. 报告建议

| 报告对象 | 推荐指标 | 说明 |
| --- | --- | --- |
| 客户 / 外部 SLA | Calendar Wait、Avg Calendar、P90 | 与真实体验一致 |
| 运营 / 排班 | Working Wait、Resource Util.、Throughput | 判断工作时间内是否处理不过来 |
| 流程改善小组 | Both + Diagnostic | 同时看体验、效率和瓶颈 |
| 技术调试 | Step metrics + queue snapshots | 定位连接、日历、容量问题 |

---

## 7. 常见误区

- Calendar Wait 高不是 bug，也不一定是资源不足。
- Working Wait 低不代表客户满意；客户可能仍等过夜或过周末。
- Diagnostic Working Wait 不是 item 平均体验。
- 切换 Wait Time Calculation 不会改变模拟结果，只改变显示。
- 比较方案时应保持同样的到达逻辑和时间边界。