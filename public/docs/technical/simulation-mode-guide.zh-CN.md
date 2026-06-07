# 模拟模式与 Process 执行模式指南

语言：简体中文  
更新：2026-06-07

## 1. 三类相关模式

FlowSim 有三类容易混淆的模式：

| 层级 | 设置 | 影响 |
| --- | --- | --- |
| 全局 Simulation Mode | Realistic / Worst-Case | 控制随机取值和压力测试口径 |
| Process Simulation Type | Resource Mode / Time Delay | 控制某个步骤是否使用资源和队列 |
| Process Execution Mode | 1 resource / item、Team per item、1 resource / many items | 控制 Capacity 如何被 item 占用 |

建议：先用 Realistic 建立基准，再用 Worst-Case 做保守容量评估。

---

## 2. Realistic 与 Worst-Case

| 模式 | 含义 | 使用场景 |
| --- | --- | --- |
| Realistic | 按配置中的随机分布、概率和波动正常运行 | 日常预测、平均表现、方案对比 |
| Worst-Case | 更偏向压力测试和保守评估 | 高峰验证、SLA 安全边际、容量下限 |

使用流程：

1. 先在 Realistic 下调到符合历史数据的基准。
2. 记录 Avg、P90、Queue、Util.、Throughput。
3. 切到 Worst-Case，观察高峰下队列是否失控。
4. 如果 Worst-Case 下 P90 或 Queue 过高，增加 Capacity、缩短处理时间或调整到达策略。

---

## 3. Process Simulation Type

### Resource Mode

Resource Mode 表示该步骤需要有限资源。若资源被占满，新 item 会进入队列。

适合：

- 客服处理。
- 人工审核。
- 柜台服务。
- 机器加工。
- 医护接诊。

重点指标：Queue、Oldest Queue、Queue Wait、Resource Util.。

### Time Delay

Time Delay 不占用 Capacity，也不因资源不足排队。item 到达后会进入处理计时；如果该步骤日历当前关闭，开始时间会被推到下一段工作时间。

适合：

- 运输等待。
- 冷却、沉淀、风干。
- 系统批处理延迟。
- 外部依赖等待。

注意：Time Delay 会增加 Cycle Time，但通常不是资源瓶颈。

---

## 4. Execution Mode

### 4.1 1 resource / item

最常见模式，一个 item 占用一个资源。

例：Capacity = 3 表示最多同时处理 3 个客户。

适合：客服、机器、柜台、人工审核。

### 4.2 Team per item

一个 item 需要多个资源共同处理。

| 子模式 | 说明 |
| --- | --- |
| Auto teams | 系统按 Capacity 和默认团队大小自动分组 |
| Explicit teams | 手动定义团队名称和人数，总人数必须等于 Capacity |

例：Capacity = 6，Team size = 2，则最多 3 个 item 同时处理。团队越大可设置更高速度倍率，但也会减少并发数量。

适合：手术团队、维修团队、复杂审核、多人协作。

### 4.3 1 resource / many items

一个资源可以同时处理多个 item。

| 参数 | 含义 |
| --- | --- |
| Max concurrent items / resource | 每个资源最多并发处理 item 数 |
| Speed multiplier by concurrent load | 并发负载下的速度倍率 |

适合：AI 助手、批处理系统、自动化工具、一个人同时监控多个任务。

---

## 5. 处理时间设置

| 模式 | 参数 | 说明 |
| --- | --- | --- |
| Fixed | Base Time + Variance | 围绕基础时间波动 |
| Range | Min / Max Duration | 在范围内取值 |

示例：Base Time = 10 min，Variance = 0.2，大多数处理时间约在 8-12 分钟附近。

若 P90 远高于 Avg，应检查处理时间波动、复杂 item 的 Time Factor、返工连接和需求高峰。

---

## 6. 选择指南

| 业务情况 | 推荐设置 |
| --- | --- |
| 一人处理一单 | Resource Mode + 1 resource / item |
| 两人一起处理一件事 | Resource Mode + Team per item |
| 一个系统并发处理多单 | Resource Mode + 1 resource / many items |
| 不占人也不占机器，只是等待 | Time Delay |
| 要做平时预测 | Realistic |
| 要看保守压力 | Worst-Case |

---

## 7. 排查建议

| 现象 | 检查 |
| --- | --- |
| Queue 很长、Util. 很高 | Capacity 太低、处理时间太长、返工太多 |
| Queue 很长、Util. 很低 | Business Hours 关闭、Calendar Override、连接错误 |
| Team 模式保存失败 | Explicit teams 总人数是否等于 Capacity |
| Multitask 效果不明显 | Max concurrent、速度倍率、到达量是否足够 |
| Worst-Case 结果过差 | 检查是否过度保守，再看安全边际是否可接受 |