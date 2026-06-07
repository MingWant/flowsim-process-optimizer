# FlowSim 模拟算法详解

语言：简体中文  
更新：2026-06-07

## 1. 总体执行模型

FlowSim 的模拟核心在 `hooks/useProcessSimulation.ts`。它不是离散事件引擎的完整优先队列实现，而是以浏览器动画帧为驱动，在每个 tick 中推进模拟时间、生成到达、分配资源、推进处理、结算完成和刷新统计。

每个 tick 的核心顺序：

1. 计算真实时间差 `rawDt`。
2. 将单帧真实时间差限制到最多 100 ms，避免浏览器后台或卡顿后一次性跳太远。
3. 计算模拟推进量：
   - `visualDt = clampedRealDt × speedMultiplier`
   - `dt = visualDt × timeCompression`
4. 生成 Start 到达事件。
5. 统计当前资源占用。
6. 启动可处理的队列 item。
7. 推进 transmission、processing、terminal 状态。
8. 处理同一 tick 内已到期的业务事件，最多 `MAX_BUSINESS_EVENTS_PER_TICK = 5000`。
9. 检查排队取消、完成结算、清理终态 item。
10. 每约 33 ms 刷新 React UI 和统计。

---

## 2. 时间推进算法

| 参数 | 代码含义 | 说明 |
| --- | --- | --- |
| `speedMultiplier` | UI 与模拟速度倍率 | Sidebar 的 Speed |
| `timeCompression` | 每真实 ms 推进多少模拟 ms | Sim Clock / Time Compression |
| `clampedRealDt` | `min(rawDt, 100)` | 避免卡顿后模拟跳跃过大 |

公式：

$$
\Delta t_{sim}=\min(\Delta t_{real},100ms)\times speedMultiplier\times timeCompression
$$

例：Speed = 2，Time Compression = 3600，则真实 1 ms 推进 7200 ms 模拟时间；真实 1 秒理论上推进 2 小时模拟时间。

---

## 3. WorkItem 状态机

| 状态 | 含义 | 进入方式 | 离开方式 |
| --- | --- | --- | --- |
| `transmitting` | item 正在视觉移动到下一节点 | Start 创建或 Process 完成后 `beginTransmission` | 到达目标节点或 finished |
| `queued` | 等待 Process 资源或工作时间 | 到达 Resource Mode Process | 获得资源、取消 |
| `processing` | 正在处理或延迟 | `beginProcessing` | 完成、失败 |
| `finished` | 正常完成 | 到达 End 或无下游 | 结算后短暂保留再清理 |
| `cancelled` | 排队取消；非工作时间 reject 只增加 Cancelled 计数，不创建 WorkItem | cancellation | 结算后清理 |
| `error` | 处理失败 | Failure Probability 命中 | 结算后清理 |

传输的业务时间是 0：`BUSINESS_TRANSMISSION_SIM_MS = 0`。视觉上仍有约 900 ms 动画，所以看起来会移动，但不会增加业务周期时间。

---

## 4. Start 到达算法

### 4.1 Simple 模式

Simple 使用 `nextSpawnTimeRef` 保存每个 Start 下一次到达的绝对模拟时间。

#### Rate 模式

固定模式：

$$
nextDelay=\frac{unitMs\times batchSize}{arrivalRate\times demandMultiplier}
$$

Range 模式会在 `minArrivalRate` 和 `maxArrivalRate` 间随机取 rate，再代入公式。

#### Interval 模式

固定模式：

$$
nextDelay=\frac{arrivalInterval\times unitMs}{demandMultiplier}
$$

Range 模式会在最小和最大 interval 之间随机取值。Demand multiplier 会缩短间隔，所以需求高峰会更频繁地产生 item。

### 4.2 Schedule 模式

Schedule 使用 `arrivalSchedule`。每个窗口按日历天展开：

- `burst`：窗口开始时一次投放 `quantity × demandMultiplier`。
- `spread`：将调整后的数量均匀分布到窗口内。

过滤条件包括 weekdays、months、startDate、endDate。

### 4.3 Events 模式

Events 使用 `arrivalEvents`。事件可以按 `dayOffset + hour` 或 `startDate + hour` 确定基准时间。重复间隔：

| Repeat | 间隔 |
| --- | --- |
| none | 不重复 |
| daily | N × 1 day |
| workingDay | N × 1 day，但只在工作日历的工作星期生效 |
| weekly | N × 7 days |
| monthly | N × 30 days |
| yearly | N × 365 days |

`dispatchMode = sequence` 时，会按 `itemInterval × itemIntervalUnit` 逐个投放；否则 burst 一次投放。

---

## 5. 非工作时间到达策略

Start 到达会先检查该 Start 的有效日历。若当前不是工作时间：

| 策略 | 算法行为 |
| --- | --- |
| `queue` | 仍创建 item 并进入后续流程 |
| `delay` | 将 arrival slot 推迟到下一段工作时间 |
| `reject` | 不创建 item，增加 cancelled 计数 |

Start 可使用 Calendar Override；否则继承全局 Business Hours。

---

## 6. 路由算法

Process 或 Start 的 Connections 用概率路由。代码会先计算所有出口概率总和，然后按归一化概率抽样：

$$
P_i=\frac{connection_i.probability}{\sum probability}
$$

如果没有出口，则流向 `finished`。导入配置时也会清理无效连接，并把有效出口概率归一化。

---

## 7. 资源分配算法

### 7.1 队列排序

Resource Mode Process 的 queued item 按以下顺序启动：

1. `priority` 高的先处理。
2. priority 相同，`queuedAtSimulationMs` 更早的先处理。
3. 仍相同，`createdAtSimulationMs` 更早的先处理。

### 7.2 Single

`1 resource / item` 中，一个 processing item 占用 1 个资源。并发上限约等于 Capacity。

### 7.3 Collaborative

Collaborative 代表一个 item 占用多个资源。

- Auto teams：根据 min / target / max resources 和空闲资源分配资源数。
- Explicit teams：每个 team 同时只能处理一个 item；系统选择满足最小资源要求且未被占用的可用 team。
- 占用资源数会计入 stepUsage。

处理速度由 `collaborativeEfficiency[assignedResources]` 决定；默认公式约为：

$$
speed=1+(resources-1)\times0.65
$$

### 7.4 Multitask

Multitask 中，一个资源可同时处理多个 item。步骤处理上限：

$$
capacity_{items}=capacity\times maxConcurrentItemsPerResource
$$

`resourceLoadFactor` 根据当前使用量估算，处理速度由 `multitaskEfficiency[load]` 决定；默认并发越高，单 item 速度越慢，最低约 0.25。

---

## 8. 处理时长算法

处理时长来源优先级：

1. Source Rule：当 fixed/resource 且 item 来自指定来源时，用 `sourceProcessingTimes[sourceId]`。
2. Range：在 Min / Max Duration 间均匀随机。
3. Fixed：Base Time + Variance。

Realistic 与 Worst-Case 的差异：

| 模式 | Fixed + Variance 算法 |
| --- | --- |
| Realistic | Box-Muller 正态随机，结果夹在 base × 0.2 到 base × 3 |
| Worst-Case | 均匀随机 `base × (1 ± variance)` |

最终时长还会乘以 item profile 的 `processingTimeMultiplier`，再除以执行模式的速度倍率：

$$
actualDuration=\frac{baseDuration\times profileTimeFactor}{executionSpeedMultiplier}
$$

---

## 9. 工作日历算法

Business Calendar 支持多段工作时间。核心函数在 `services/simulationCalendar.ts`：

| 函数 | 作用 |
| --- | --- |
| `normalizeBusinessCalendar` | 清理日历，迁移旧 startHour/endHour 到 workingHours |
| `isWorkingTime` | 判断某个模拟时间是否在工作时段内 |
| `getNextWorkingSimulationTime` | 若当前关闭，找到下一段工作时间开始 |
| `addWorkingDuration` | 从某时刻开始增加 N ms 工作时长，跨过非工作时段 |
| `getWorkingDurationBetween` | 计算两个模拟时间之间重叠的工作时长 |

处理开始时间会被推到下一段工作时间。处理结束时间使用 `addWorkingDuration`，所以一个 2 小时任务若跨午休，会在午休后继续。

---

## 10. 失败与取消算法

### Failure

Process 完成时检查失败概率：

$$
failChance=clamp(step.failureProbability\times item.failureMultiplier,0,1)
$$

命中后 item 进入 `error`，不会继续下游。

### Queue Cancellation

排队期间按曝光时间检查取消概率：

| 模式 | 算法 |
| --- | --- |
| Realistic | `1 - exp(-p × seconds)`，类似泊松过程 |
| Worst-Case | `min(1, p × seconds)`，线性压力测试 |

Item profile 的 `cancellationMultiplier` 会乘到步骤取消概率上。

---

## 11. 统计结算算法

item 到达 finished 后才计入完成样本。核心周期指标：

| 指标 | 计算 |
| --- | --- |
| Calendar Cycle | `completedAtSimulationMs - createdAtSimulationMs` |
| Global Working Cycle | 全局业务日历下 created 到 completed 的工作时长 |
| Operational Working Cycle | `totalWorkingWaitTime + totalProcessingTime` |
| Touch / Work | item 实际工作处理时长之和 |
| Queue Wait (Calendar) | 每次入队到开始处理的日历时间累加 |
| Queue Wait (Working) | 每次入队到开始处理的工作时间累加 |
| Off-hours Delay | `Calendar Cycle - Global Working Cycle` |
| Flow Efficiency | `avgWorkTime / avgCycleTime` |

Median 和 P90 基于完成 item 的样本数组计算，不是简单平均每个步骤。

---

## 12. 性能与保护限制

| 限制 | 值 | 目的 |
| --- | --- | --- |
| 单 tick 单 Start 最大生成 | 1000 | 避免一次生成过多 item 卡死 UI |
| 单 tick 业务事件最大处理 | 5000 | 避免事件风暴 |
| UI item 最大渲染 | 900 | 保护 React 渲染性能 |
| transmitting / processing / queued 渲染上限 | 420 / 320 / 120 | 保留关键可视化状态 |
| 安全时长上限 | `Number.MAX_SAFE_INTEGER / 2` | 防止时间计算溢出 |

这些限制不代表业务能力上限，而是浏览器实时模拟和可视化的安全边界。