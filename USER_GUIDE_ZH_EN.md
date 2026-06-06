# FlowSim 用户文档 / User Guide

更新时间 / Last updated: 2026-06-06

---

## 中文版

### 1. FlowSim 是什么？

FlowSim 用来把一个业务流程画成“起点 → 处理步骤 → 终点”的流程图，并模拟工作项在流程中的流动、排队、处理、失败、取消和完成情况。

通俗例子：

- **起点 Start**：客户下单、工单进入、病人到达。
- **处理步骤 Process**：接单、审核、制作、质检、打包。
- **终点 End**：订单发货、工单关闭、病人离开。
- **工作项 Item**：一个订单、一张工单、一位客户、一个病例。

---

### 2. 快速控制参数

| 参数 | 怎么设置 | 代表什么 | 通俗例子 |
|---|---|---|---|
| Start / Pause | 点击左侧按钮 | 开始或暂停模拟 | 像按下播放键，看订单如何流动 |
| Reset | 点击重置按钮 | 清空当前模拟结果，重新开始 | 重新开一局实验 |
| Speed | 1x 到 10x | 播放动画速度，也会加快模拟推进 | 设为 2x，画面和模拟都比 1x 快 |
| Sim Clock | 选择预设或输入自定义倍率 | 真实时间和模拟时间的换算 | “1 sim day / sec” 表示现实 1 秒推进模拟 1 天 |
| Sim Time | 只读显示 | 当前已经过去多少模拟时间 | 显示 03:00:00 表示模拟已经跑了 3 小时 |
| Simulation Mode | Realistic / Worst-Case | 模拟随机行为的方式 | 日常预测用 Realistic，压力测试用 Worst-Case |

实际模拟推进速度约等于：

$$
\text{每秒推进的模拟时间}=\text{Speed}\times\text{Sim Clock}
$$

例子：Speed = 2x，Sim Clock = 1 sim hour / sec，则现实 1 秒大约推进模拟 2 小时。

---

### 3. 各种时间单位代表什么？

FlowSim 内部使用毫秒保存时间，但界面可以选择更容易理解的单位。

| 单位 | 含义 | 换算 |
|---|---|---|
| ms | 毫秒 | 1 ms |
| s | 秒 | 1,000 ms |
| min | 分钟 | 60 秒 |
| h | 小时 | 60 分钟 |
| workingDay | 工作日 | 固定按 8 小时计算 |
| day | 自然日 | 24 小时 |
| week | 周 | 7 天 |
| month | 月 | 固定按 30 天计算 |
| year | 年 | 固定按 365 天计算 |

注意：

- **workingDay 是 8 小时**，不是根据你设置的营业时间自动变化。
- **day 是 24 小时**，会包含夜晚和非工作时间。
- **Business Hours** 会影响“什么时候可以处理”，但时间单位换算仍按上表执行。

---

### 4. 业务时间和营业时间

#### 4.1 Business Time

左侧 Business Time 区域显示：

| 指标 | 含义 | 例子 |
|---|---|---|
| Date | 当前模拟日历时间 | 2026-01-05 10:30 |
| Open / Closed | 当前是否在营业时间内 | 周一 10:30 是 Open，周日是 Closed |
| Demand | 当前需求倍率 | x2.00 表示当前到达量翻倍 |
| Active peaks | 当前生效的需求高峰规则 | 午餐高峰 x1.8 正在生效 |

#### 4.2 Business Hours

| 参数 | 怎么设置 | 代表什么 | 通俗例子 |
|---|---|---|---|
| On / Off | 开关 | 是否启用营业时间限制 | 关闭时全天 24 小时都可处理 |
| Start date | 日期时间 | 模拟日历从哪一刻开始 | 从 2026-01-05 09:00 开始跑 |
| Working hours | 一个或多个时间段 | 每天可以工作的时间 | 9-12 和 13-18，中午休息 |
| Working days | 选择星期 | 哪些星期几上班 | 周一到周五工作，周末休息 |
| Non-working arrivals | queue / delay / reject | 非工作时间到达的工作项怎么处理 | 晚上来的订单是排队、延迟创建还是拒收 |

Non-working arrivals 的三种策略：

| 策略 | 含义 | 例子 |
|---|---|---|
| Queue | 工作项照常进入系统，但等到营业时间才处理 | 晚上 10 点下单，订单进入队列，第二天 9 点开始处理 |
| Delay | 到达本身推迟到下一个营业时间 | 晚上 10 点的订单视为第二天 9 点才进入系统 |
| Reject | 非工作时间到达的工作项不进入系统 | 只接受营业时间内预约，其他时间请求被拒绝 |

常见设置例子：

- 办公室：Working hours = 9-12、13-18；Working days = Mon-Fri。
- 餐厅：Working hours = 11-14、17-22；Working days = 全周。
- 24 小时客服：Working hours = 0-24；Working days = 全周。

---

### 5. Auto Pause 自动暂停

Auto Pause 用于让模拟到达某个条件后自动停止，便于做固定长度实验。

| 参数 | 含义 | 例子 |
|---|---|---|
| Sim time | 模拟经过多少时间后暂停 | 跑满 30 天后自动暂停 |
| Stop date | 到达某个模拟日历日期后暂停 | 到 2026-02-01 00:00 停止 |
| Created | 创建的工作项达到多少后暂停 | 创建 1,000 个订单后暂停 |
| Finished | 完成的工作项达到多少后暂停 | 完成 500 个订单后暂停 |
| Active | 系统内未完成工作项达到多少后暂停 | WIP 达到 100 时暂停观察拥堵 |
| Failed | 失败数量达到多少后暂停 | 出现 20 个缺陷后停止 |
| Cancelled | 取消数量达到多少后暂停 | 有 50 个客户放弃排队后停止 |

如果同时设置多个条件，任意一个条件先达到都会暂停。

补充说明：

- Sim time 可以选择单位（ms、sec、min、hours、days 等）。切换单位时会保留输入框里的数字语义，例如 `1 h` 切到 `min` 后会变成“1 分钟”的暂停目标。
- Stop date 必须晚于模拟的 Calendar start。如果早于或等于开始时间，界面会提示错误，自动暂停原因也会显示为需要修正停止日期。

---

### 6. Demand Peaks 需求高峰

Demand Peaks 用于描述“某些时间需求更多或更少”。全局 Demand Peaks 影响所有起点；Start 节点里的 Demand Peaks 只影响该起点。

| 参数 | 含义 | 例子 |
|---|---|---|
| Enabled | 是否启用该规则 | 临时关闭春节活动高峰 |
| Name | 规则名称 | Lunch Peak 午餐高峰 |
| Multiplier / Mult | 到达量倍率 | 2.0 表示到达量翻倍，0.5 表示减半 |
| Start / End | 每天生效小时 | 11 到 14 表示 11:00-14:00 |
| Weekdays / Days | 生效星期 | 只在周一到周五生效 |
| Months | 生效月份 | 只在 11 月购物季生效 |
| Start date / End date | 生效日期范围 | 2026-11-01 到 2026-11-11 |

多个高峰会相乘叠加。

例子：全局“黑五”x2，某起点“午餐高峰”x1.5，同时生效时总倍率为 x3。

---

### 7. Start 节点参数

Start 节点负责创建工作项。

#### 7.1 Arrival Model 到达模型

| 模型 | 适用场景 | 怎么理解 | 例子 |
|---|---|---|---|
| Simple | 稳定连续到达 | 按频率或间隔持续产生工作项 | 每小时 12 单 |
| Schedule | 每天固定窗口有固定数量 | 按时间段投放 | 9-11 点共 100 单 |
| Events | 指定日期/时间/重复计划 | 精确投放一批或连续投放 | 每周一 9:00 发 500 张工单 |

#### 7.2 Arrival Input：Rate 和 Interval

Simple 模式下可选择两种输入方式：

| 模式 | 含义 | 例子 |
|---|---|---|
| Rate | 每个时间单位到达多少个 | 12 items / hour = 每小时 12 个 |
| Interval | 每隔多久到达一批 | 5 min / batch = 每 5 分钟来一批 |

如果 Batch size = 3：

- Rate = 12 items / hour：总到达量约每小时 12 个，按每批 3 个分组。
- Interval = 5 min / batch：每 5 分钟来一批，每批 3 个，即约每小时 36 个。

#### 7.3 Randomness：Fixed 和 Range

| 模式 | 含义 | 例子 |
|---|---|---|
| Fixed | 使用一个固定值 | 每小时固定 12 单 |
| Range | 在最小值和最大值之间随机 | 每小时 8 到 20 单之间波动 |

#### 7.4 Batch Dispatch 批量投放

| 参数 | 含义 | 例子 |
|---|---|---|
| Default batch size | 每次到达事件创建几个工作项 | 1 表示一个个来，10 表示一次来 10 个 |
| Interval inside batch | 同一批内部相邻工作项的时间间隔，单位 ms | 0 表示同时到达，1000 表示每隔 1 秒进一个 |

#### 7.5 Item Mix / Quality 工作项类型

用于定义不同类型的工作项。各类型概率必须合计 100%。

| 参数 | 含义 | 例子 |
|---|---|---|
| Probability | 该类型出现比例 | 普通订单 80%，复杂订单 20% |
| Time Factor | 处理时间倍数 | 复杂订单 2.0 = 处理时间翻倍 |
| Failure Factor | 失败概率倍数 | 高风险订单 1.5 = 更容易失败 |
| Cancel Factor | 排队取消概率倍数 | VIP 0.2 = 更不容易取消 |
| Priority | 排队优先级，越大越优先 | VIP 10，普通 1 |
| Color | 显示颜色 | 用不同颜色区分订单类型 |

#### 7.6 Scheduled Windows 定时窗口

Schedule 模式使用这些字段：

| 参数 | 含义 | 例子 |
|---|---|---|
| Start / End | 时间窗口 | 9 到 11 表示 09:00-11:00 |
| Qty | 窗口内总数量 | 100 表示这个窗口产生 100 个 |
| Mode = Spread | 均匀分布在窗口内 | 2 小时 100 个，平均每 1.2 分钟一个 |
| Mode = Burst | 窗口开始时一次性到达 | 9:00 一次来 100 个 |
| Weekdays / Months / Dates | 生效星期、月份、日期 | 只在工作日和 11 月生效 |

#### 7.7 Dispatch Plans 精确投放计划

Events 模式使用这些字段：

| 参数 | 含义 | 例子 |
|---|---|---|
| Start date | 计划起始日期 | 从 2026-06-01 开始 |
| Sim day | 从模拟开始后的第几天 | 0 = 第一天，1 = 第二天 |
| Time | 当天几点 | 9.5 = 09:30 |
| Items | 每次投放数量 | 每次 200 个 |
| Repeat | 重复方式 | Once、Daily、Working days、Weekly、Monthly、Yearly |
| Every | 每隔几个周期重复 | Repeat = Weekly，Every = 2 表示每两周一次 |
| End date | 重复结束日期 | 到 2026-12-31 停止 |
| Max runs | 最多执行次数 | 最多投放 10 次 |
| Dispatch = All at once | 一次性投放 | 9:00 立刻来 200 个 |
| Dispatch = One by one | 按间隔逐个投放 | 200 个订单每 10 秒进一个 |
| Item interval / Unit | 逐个投放的间隔 | 10 seconds |
| Weekdays / Months / Days of month | 更细的过滤条件 | 每月 1 日和 15 日投放 |

---

### 8. Process 节点参数

Process 节点负责排队和处理工作项。

#### 8.1 Simulation Type

| 类型 | 含义 | 适用场景 | 例子 |
|---|---|---|---|
| Resource Mode | 使用资源容量，会排队 | 人员、机器、柜台有限 | 只有 2 个客服，超出的人排队 |
| Time Delay | 不限制资源，不排队，进入后立即计时 | 固定等待、运输、系统延迟 | 物流运输 2 天，不需要占用人员 |

#### 8.2 Capacity 和 Execution Mode

| 参数 | 含义 | 例子 |
|---|---|---|
| Capacity | 此步骤可用资源数量 | 3 个审核员、2 台机器 |
| 1 resource / item | 每个工作项占用 1 个资源 | 1 个客服处理 1 个客户 |
| Team per item | 多个资源组成团队共同处理 1 个工作项 | 2 名技师一起修一辆车 |
| 1 resource / many items | 1 个资源可同时处理多个工作项 | 一个 AI 助手同时处理 5 张票据 |

Team per item 相关参数：

| 参数 | 含义 | 例子 |
|---|---|---|
| Auto teams | 按 Capacity 和默认团队大小自动拆队 | Capacity 6、团队大小 2 → 3 个团队 |
| Explicit teams | 手动命名每个团队并设置人数 | A 队 2 人，B 队 3 人 |
| Default team size | 自动团队中每队人数 | 每个订单默认 2 人处理 |
| Speed multiplier by assigned resources | 分配不同人数时的速度倍数 | 1 人 x1，2 人 x1.65，3 人 x2.3 |

Multitask 相关参数：

| 参数 | 含义 | 例子 |
|---|---|---|
| Max concurrent items / resource | 每个资源最多同时处理几个工作项 | 1 个 AI 同时处理 4 个请求 |
| Speed multiplier by concurrent load | 同时处理数量增加时，每个工作项的速度变化 | 1 个 x1，2 个 x0.8，3 个 x0.6 |

#### 8.3 Processing Duration 处理时长

| 参数 | 含义 | 例子 |
|---|---|---|
| Base Time | 固定模式下的基础处理时间 | 审核平均 10 分钟 |
| Unit | 时间单位 | min、h、day 等 |
| Variance | 固定模式下的随机波动，0 到 1 | 0 = 完全固定；0.3 = 大约上下波动 30% |
| Min Duration | Range 模式最短处理时间 | 最快 5 分钟 |
| Max Duration | Range 模式最长处理时间 | 最慢 20 分钟 |

例子：Base Time = 10 min，Variance = 0.2，表示大多数任务约在 8-12 分钟附近波动。若使用 Range，Min = 5 min、Max = 20 min，则每个任务随机落在 5-20 分钟之间。

#### 8.4 Calendar Override 日历覆盖

| 模式 | 含义 | 例子 |
|---|---|---|
| Inherit | 使用全局 Business Hours | 所有步骤统一 9-18 工作 |
| Custom | 该步骤使用自己的工作日历 | 仓库 24 小时运作，但财务只周一到周五 9-17 |

#### 8.5 Exceptions 异常

| 参数 | 含义 | 例子 |
|---|---|---|
| Failure / Defect Probability | 处理完成后失败的概率 | 0.05 = 5% 完成后报错或报废 |
| Cancellation Probability | 排队中每秒取消的大致概率 | 0.01 = 等得越久越可能放弃 |

失败的工作项不会进入下一步；取消的工作项会从队列中离开。

#### 8.6 Rules 来源规则

Rules 允许根据工作项来自哪个上游步骤，覆盖本步骤处理时间。

例子：

- 正常订单进入“质检”需要 5 分钟。
- 从“返工”回来的订单进入“质检”只需要 2 分钟，因为只查特定问题。

---

### 9. Routing 连接和概率

在 Routing 页签中选择工作项处理完后可以去哪些步骤。

| 参数 | 含义 | 例子 |
|---|---|---|
| Checkbox | 是否连接到某步骤 | 质检后可以去打包，也可以返工 |
| Prob | 走向该步骤的概率，0 到 1 | 0.9 去打包，0.1 返工 |
| Total Probability | 所有出口概率之和 | 建议等于 1.0，即 100% |

如果总概率不是 100%，界面会提示警告。通常应让所有出口概率合计为 1。

---

### 10. End 节点参数

| 参数 | 含义 | 例子 |
|---|---|---|
| Average Time Display Unit | 终点卡片显示平均总周期时间的单位 | 订单流程用 hours，项目流程用 days |

该设置只影响显示，不改变内部模拟计算。

---

### 11. Simulation Mode 模拟模式

| 模式 | 适合场景 | 行为 |
|---|---|---|
| Realistic | 日常运营分析、平均表现预测 | 处理时间更接近现实分布，极端值较少 |
| Worst-Case | 容量规划、压力测试、保守估算 | 更容易出现极端压力、同步到达和更激进的取消 |

建议：

- 想知道“平时大概表现如何”：用 Realistic。
- 想知道“最糟糕会不会爆掉”：用 Worst-Case。
- 做采购或招聘决策：先用 Realistic，再用 Worst-Case 留安全边际。

---

### 12. 统计指标里的各种时间

| 指标 | 含义 | 通俗解释 |
|---|---|---|
| Avg Calendar / Avg Cycle Time | 从创建到完成经过的总日历时间 | 客户从下单到收到结果的总等待时间 |
| Median Calendar | 一半工作项低于该总周期时间 | 比平均值更不容易被极端值影响 |
| P90 Calendar | 90% 工作项低于该总周期时间 | 用来看较慢的 10% 客户体验 |
| Avg Working | 只计算工作日历内的周期时间 | 排除夜晚、周末等非工作时间后的周期 |
| Touch / Work | 实际被处理的时间 | 员工或机器真正花在这个工作项上的时间 |
| Queue Wait (Calendar) | 按完成工作项聚合的日历排队等待 | 客户真实等了多久，包含夜晚、周末等非工作时间 |
| Queue Wait (Working) | 按完成工作项真实经历聚合的工作时间排队等待 | 排除非工作时间后，每个工作项实际在工作时间内等了多久 |
| Diagnostic Working Wait | 步骤级工作等待时间的诊断平均 | 用来找哪个步骤可能堵，不代表每个工作项的真实平均体验 |
| Transfer | 步骤之间移动或传递的时间 | 从一个工位移到另一个工位的时间 |
| Off-hours Delay / Non-working Delay | 因非工作时间产生的延迟 | 周五下班后提交，周一才处理的等待 |
| Flow Efficiency | 工作时间占总周期时间的比例 | 10 小时周期里只有 2 小时在处理，效率约 20% |
| Oldest WIP | 当前系统内最老未完成工作项年龄 | 最久没完成的订单已经等多久 |
| Oldest Queue | 当前队列里最老排队项等待时间 | 最久排队的客户等了多久 |
| Resource Util. | 资源利用率 | 员工/机器有多少比例时间在忙 |
| Throughput | 单位模拟时间完成数量 | 每小时完成 20 单 |
| Active Work / WIP | 当前系统内还没完成的数量 | 正在处理或排队的订单总数 |
| Errors | 失败数量 | 报废、缺陷、处理失败的数量 |
| Cancelled | 取消数量 | 等不及离开或撤单的数量 |

---

### 13. 推荐建模步骤

1. 先画流程：Start → Process → End。
2. 给 Start 设置到达量：例如每小时 20 单。
3. 给每个 Process 设置处理时间和 Capacity。
4. 设置 Routing 概率，确保出口概率合计约 100%。
5. 设置 Business Hours，例如周一到周五 9-18。
6. 运行 Realistic 模式，观察队列、周期时间和资源利用率。
7. 如果要做容量规划，再运行 Worst-Case 模式。
8. 根据瓶颈调整 Capacity、处理时间或流程分支。

---

### 14. 简单业务例子

#### 例子 A：在线订单

- Start：Online Orders，Rate = 12 items / hour。
- Order Taking：Capacity = 2，Processing = 2 min。
- Preparation：Capacity = 3，Processing = 4 min，Failure = 10%。
- Quality Check：Capacity = 1，Processing = 1.5 min，90% 去 Packaging，10% 返工到 Preparation。
- Packaging：Capacity = 2，Processing = 1 min。
- End：Shipment。

看什么：如果 Quality Check 队列越来越长，说明质检是瓶颈，可以增加 Capacity 或减少返工率。

#### 例子 B：客服工单

- Start：每 5 分钟来一批，每批 3 张工单。
- Demand Peak：周一 9-11 点 x2。
- Triage：Capacity = 2，Processing = 3 min。
- Resolve：Capacity = 5，Range = 10-30 min。
- Item Mix：普通工单 80%，复杂工单 20%，复杂工单 Time Factor = 2。

看什么：P90 Calendar 和 Oldest Queue 可以帮助判断高峰时客户体验是否过差。

---

## 繁體中文版

### 1. FlowSim 是什麼？

FlowSim 用來把一個業務流程畫成「起點 → 處理步驟 → 終點」的流程圖，並模擬工作項目在流程中的流動、排隊、處理、失敗、取消和完成情況。

通俗例子：

- **起點 Start**：客戶下單、工單進入、病人到達。
- **處理步驟 Process**：接單、審核、製作、質檢、打包。
- **終點 End**：訂單出貨、工單關閉、病人離開。
- **工作項目 Item**：一筆訂單、一張工單、一位客戶、一個病例。

---

### 2. 快速控制參數

| 參數 | 怎麼設定 | 代表什麼 | 通俗例子 |
|---|---|---|---|
| Start / Pause | 點擊左側按鈕 | 開始或暫停模擬 | 像按下播放鍵，看訂單如何流動 |
| Reset | 點擊重設按鈕 | 清空目前模擬結果，重新開始 | 重新開一局實驗 |
| Speed | 1x 到 10x | 播放動畫速度，也會加快模擬推進 | 設為 2x，畫面和模擬都比 1x 快 |
| Sim Clock | 選擇預設或輸入自訂倍率 | 真實時間和模擬時間的換算 | 「1 sim day / sec」表示現實 1 秒推進模擬 1 天 |
| Sim Time | 只讀顯示 | 目前已經過去多少模擬時間 | 顯示 03:00:00 表示模擬已經跑了 3 小時 |
| Simulation Mode | Realistic / Worst-Case | 模擬隨機行為的方式 | 日常預測用 Realistic，壓力測試用 Worst-Case |

實際模擬推進速度約等於：Speed × Sim Clock。

例子：Speed = 2x，Sim Clock = 1 sim hour / sec，則現實 1 秒大約推進模擬 2 小時。

---

### 3. 各種時間單位代表什麼？

FlowSim 內部使用毫秒保存時間，但介面可以選擇更容易理解的單位。

| 單位 | 含義 | 換算 |
|---|---|---|
| ms | 毫秒 | 1 ms |
| s | 秒 | 1,000 ms |
| min | 分鐘 | 60 秒 |
| h | 小時 | 60 分鐘 |
| workingDay | 工作日 | 固定按 8 小時計算 |
| day | 自然日 | 24 小時 |
| week | 週 | 7 天 |
| month | 月 | 固定按 30 天計算 |
| year | 年 | 固定按 365 天計算 |

注意：

- **workingDay 是 8 小時**，不是根據你設定的營業時間自動變化。
- **day 是 24 小時**，會包含夜晚和非工作時間。
- **Business Hours** 會影響「什麼時候可以處理」，但時間單位換算仍按上表執行。

---

### 4. 業務時間和營業時間

#### 4.1 Business Time

左側 Business Time 區域顯示：

| 指標 | 含義 | 例子 |
|---|---|---|
| Date | 目前模擬日曆時間 | 2026-01-05 10:30 |
| Open / Closed | 目前是否在營業時間內 | 週一 10:30 是 Open，週日是 Closed |
| Demand | 目前需求倍率 | x2.00 表示目前到達量翻倍 |
| Active peaks | 目前生效的需求高峰規則 | 午餐高峰 x1.8 正在生效 |

#### 4.2 Business Hours

| 參數 | 怎麼設定 | 代表什麼 | 通俗例子 |
|---|---|---|---|
| On / Off | 開關 | 是否啟用營業時間限制 | 關閉時全天 24 小時都可處理 |
| Start date | 日期時間 | 模擬日曆從哪一刻開始 | 從 2026-01-05 09:00 開始跑 |
| Working hours | 一個或多個時間段 | 每天可以工作的時間 | 9-12 和 13-18，中午休息 |
| Working days | 選擇星期 | 哪些星期幾上班 | 週一到週五工作，週末休息 |
| Non-working arrivals | queue / delay / reject | 非工作時間到達的工作項目怎麼處理 | 晚上來的訂單是排隊、延遲建立還是拒收 |

Non-working arrivals 的三種策略：

| 策略 | 含義 | 例子 |
|---|---|---|
| Queue | 工作項目照常進入系統，但等到營業時間才處理 | 晚上 10 點下單，訂單進入佇列，隔天 9 點開始處理 |
| Delay | 到達本身推遲到下一個營業時間 | 晚上 10 點的訂單視為隔天 9 點才進入系統 |
| Reject | 非工作時間到達的工作項目不進入系統 | 只接受營業時間內預約，其他時間請求被拒絕 |

常見設定例子：

- 辦公室：Working hours = 9-12、13-18；Working days = Mon-Fri。
- 餐廳：Working hours = 11-14、17-22；Working days = 全週。
- 24 小時客服：Working hours = 0-24；Working days = 全週。

---

### 5. Auto Pause 自動暫停

Auto Pause 用於讓模擬到達某個條件後自動停止，便於做固定長度實驗。

| 參數 | 含義 | 例子 |
|---|---|---|
| Sim time | 模擬經過多少時間後暫停 | 跑滿 30 天後自動暫停 |
| Stop date | 到達某個模擬日曆日期後暫停 | 到 2026-02-01 00:00 停止 |
| Created | 建立的工作項目達到多少後暫停 | 建立 1,000 筆訂單後暫停 |
| Finished | 完成的工作項目達到多少後暫停 | 完成 500 筆訂單後暫停 |
| Active | 系統內未完成工作項目達到多少後暫停 | WIP 達到 100 時暫停觀察壅塞 |
| Failed | 失敗數量達到多少後暫停 | 出現 20 個缺陷後停止 |
| Cancelled | 取消數量達到多少後暫停 | 有 50 位客戶放棄排隊後停止 |

如果同時設定多個條件，任一條件先達到都會暫停。

補充說明：

- Sim time 可以選擇單位（ms、sec、min、hours、days 等）。切換單位時會保留輸入框裡的數字語義，例如 `1 h` 切到 `min` 後會變成「1 分鐘」的暫停目標。
- Stop date 必須晚於模擬的 Calendar start。如果早於或等於開始時間，介面會提示錯誤，自動暫停原因也會顯示為需要修正停止日期。

---

### 6. Demand Peaks 需求高峰

Demand Peaks 用於描述「某些時間需求更多或更少」。全域 Demand Peaks 影響所有起點；Start 節點裡的 Demand Peaks 只影響該起點。

| 參數 | 含義 | 例子 |
|---|---|---|
| Enabled | 是否啟用該規則 | 暫時關閉春節活動高峰 |
| Name | 規則名稱 | Lunch Peak 午餐高峰 |
| Multiplier / Mult | 到達量倍率 | 2.0 表示到達量翻倍，0.5 表示減半 |
| Start / End | 每天生效小時 | 11 到 14 表示 11:00-14:00 |
| Weekdays / Days | 生效星期 | 只在週一到週五生效 |
| Months | 生效月份 | 只在 11 月購物季生效 |
| Start date / End date | 生效日期範圍 | 2026-11-01 到 2026-11-11 |

多個高峰會相乘疊加。

例子：全域「黑五」x2，某起點「午餐高峰」x1.5，同時生效時總倍率為 x3。

---

### 7. Start 節點參數

Start 節點負責建立工作項目。

#### 7.1 Arrival Model 到達模型

| 模型 | 適用場景 | 怎麼理解 | 例子 |
|---|---|---|---|
| Simple | 穩定連續到達 | 按頻率或間隔持續產生工作項目 | 每小時 12 單 |
| Schedule | 每天固定視窗有固定數量 | 按時間段投放 | 9-11 點共 100 單 |
| Events | 指定日期/時間/重複計畫 | 精確投放一批或連續投放 | 每週一 9:00 發 500 張工單 |

#### 7.2 Arrival Input：Rate 和 Interval

Simple 模式下可選擇兩種輸入方式：

| 模式 | 含義 | 例子 |
|---|---|---|
| Rate | 每個時間單位到達多少個 | 12 items / hour = 每小時 12 個 |
| Interval | 每隔多久到達一批 | 5 min / batch = 每 5 分鐘來一批 |

如果 Batch size = 3：

- Rate = 12 items / hour：總到達量約每小時 12 個，按每批 3 個分組。
- Interval = 5 min / batch：每 5 分鐘來一批，每批 3 個，即約每小時 36 個。

#### 7.3 Randomness：Fixed 和 Range

| 模式 | 含義 | 例子 |
|---|---|---|
| Fixed | 使用一個固定值 | 每小時固定 12 單 |
| Range | 在最小值和最大值之間隨機 | 每小時 8 到 20 單之間波動 |

#### 7.4 Batch Dispatch 批次投放

| 參數 | 含義 | 例子 |
|---|---|---|
| Default batch size | 每次到達事件建立幾個工作項目 | 1 表示一個個來，10 表示一次來 10 個 |
| Interval inside batch | 同一批內相鄰工作項目的時間間隔，單位 ms | 0 表示同時到達，1000 表示每隔 1 秒進一個 |

#### 7.5 Item Mix / Quality 工作項目類型

用於定義不同類型的工作項目。各類型機率必須合計 100%。

| 參數 | 含義 | 例子 |
|---|---|---|
| Probability | 該類型出現比例 | 普通訂單 80%，複雜訂單 20% |
| Time Factor | 處理時間倍數 | 複雜訂單 2.0 = 處理時間翻倍 |
| Failure Factor | 失敗機率倍數 | 高風險訂單 1.5 = 更容易失敗 |
| Cancel Factor | 排隊取消機率倍數 | VIP 0.2 = 更不容易取消 |
| Priority | 排隊優先級，越大越優先 | VIP 10，普通 1 |
| Color | 顯示顏色 | 用不同顏色區分訂單類型 |

#### 7.6 Scheduled Windows 定時視窗

Schedule 模式使用這些欄位：

| 參數 | 含義 | 例子 |
|---|---|---|
| Start / End | 時間視窗 | 9 到 11 表示 09:00-11:00 |
| Qty | 視窗內總數量 | 100 表示這個視窗產生 100 個 |
| Mode = Spread | 均勻分布在視窗內 | 2 小時 100 個，平均每 1.2 分鐘一個 |
| Mode = Burst | 視窗開始時一次性到達 | 9:00 一次來 100 個 |
| Weekdays / Months / Dates | 生效星期、月份、日期 | 只在工作日和 11 月生效 |

#### 7.7 Dispatch Plans 精確投放計畫

Events 模式使用這些欄位：

| 參數 | 含義 | 例子 |
|---|---|---|
| Start date | 計畫起始日期 | 從 2026-06-01 開始 |
| Sim day | 從模擬開始後的第幾天 | 0 = 第一天，1 = 第二天 |
| Time | 當天幾點 | 9.5 = 09:30 |
| Items | 每次投放數量 | 每次 200 個 |
| Repeat | 重複方式 | Once、Daily、Working days、Weekly、Monthly、Yearly |
| Every | 每隔幾個週期重複 | Repeat = Weekly，Every = 2 表示每兩週一次 |
| End date | 重複結束日期 | 到 2026-12-31 停止 |
| Max runs | 最多執行次數 | 最多投放 10 次 |
| Dispatch = All at once | 一次性投放 | 9:00 立刻來 200 個 |
| Dispatch = One by one | 按間隔逐個投放 | 200 個訂單每 10 秒進一個 |
| Item interval / Unit | 逐個投放的間隔 | 10 seconds |
| Weekdays / Months / Days of month | 更細的篩選條件 | 每月 1 日和 15 日投放 |

---

### 8. Process 節點參數

Process 節點負責排隊和處理工作項目。

#### 8.1 Simulation Type

| 類型 | 含義 | 適用場景 | 例子 |
|---|---|---|---|
| Resource Mode | 使用資源容量，會排隊 | 人員、機器、櫃檯有限 | 只有 2 個客服，超出的人排隊 |
| Time Delay | 不限制資源，不排隊，進入後立即計時 | 固定等待、運輸、系統延遲 | 物流運輸 2 天，不需要占用人員 |

#### 8.2 Capacity 和 Execution Mode

| 參數 | 含義 | 例子 |
|---|---|---|
| Capacity | 此步驟可用資源數量 | 3 位審核員、2 台機器 |
| 1 resource / item | 每個工作項目占用 1 個資源 | 1 位客服處理 1 位客戶 |
| Team per item | 多個資源組成團隊共同處理 1 個工作項目 | 2 名技師一起修一輛車 |
| 1 resource / many items | 1 個資源可同時處理多個工作項目 | 一個 AI 助手同時處理 5 張票據 |

Team per item 相關參數：

| 參數 | 含義 | 例子 |
|---|---|---|
| Auto teams | 按 Capacity 和預設團隊大小自動拆隊 | Capacity 6、團隊大小 2 → 3 個團隊 |
| Explicit teams | 手動命名每個團隊並設定人數 | A 隊 2 人，B 隊 3 人 |
| Default team size | 自動團隊中每隊人數 | 每個訂單預設 2 人處理 |
| Speed multiplier by assigned resources | 分配不同人數時的速度倍數 | 1 人 x1，2 人 x1.65，3 人 x2.3 |

Multitask 相關參數：

| 參數 | 含義 | 例子 |
|---|---|---|
| Max concurrent items / resource | 每個資源最多同時處理幾個工作項目 | 1 個 AI 同時處理 4 個請求 |
| Speed multiplier by concurrent load | 同時處理數量增加時，每個工作項目的速度變化 | 1 個 x1，2 個 x0.8，3 個 x0.6 |

#### 8.3 Processing Duration 處理時長

| 參數 | 含義 | 例子 |
|---|---|---|
| Base Time | 固定模式下的基礎處理時間 | 審核平均 10 分鐘 |
| Unit | 時間單位 | min、h、day 等 |
| Variance | 固定模式下的隨機波動，0 到 1 | 0 = 完全固定；0.3 = 大約上下波動 30% |
| Min Duration | Range 模式最短處理時間 | 最快 5 分鐘 |
| Max Duration | Range 模式最長處理時間 | 最慢 20 分鐘 |

例子：Base Time = 10 min，Variance = 0.2，表示大多數任務約在 8-12 分鐘附近波動。若使用 Range，Min = 5 min、Max = 20 min，則每個任務隨機落在 5-20 分鐘之間。

#### 8.4 Calendar Override 日曆覆蓋

| 模式 | 含義 | 例子 |
|---|---|---|
| Inherit | 使用全域 Business Hours | 所有步驟統一 9-18 工作 |
| Custom | 該步驟使用自己的工作日曆 | 倉庫 24 小時運作，但財務只週一到週五 9-17 |

#### 8.5 Exceptions 異常

| 參數 | 含義 | 例子 |
|---|---|---|
| Failure / Defect Probability | 處理完成後失敗的機率 | 0.05 = 5% 完成後報錯或報廢 |
| Cancellation Probability | 排隊中每秒取消的大致機率 | 0.01 = 等得越久越可能放棄 |

失敗的工作項目不會進入下一步；取消的工作項目會從佇列中離開。

#### 8.6 Rules 來源規則

Rules 允許根據工作項目來自哪個上游步驟，覆蓋本步驟處理時間。

例子：正常訂單進入「質檢」需要 5 分鐘；從「返工」回來的訂單進入「質檢」只需要 2 分鐘，因為只查特定問題。

---

### 9. Routing 連線和機率

在 Routing 頁籤中選擇工作項目處理完後可以去哪些步驟。

| 參數 | 含義 | 例子 |
|---|---|---|
| Checkbox | 是否連線到某步驟 | 質檢後可以去打包，也可以返工 |
| Prob | 走向該步驟的機率，0 到 1 | 0.9 去打包，0.1 返工 |
| Total Probability | 所有出口機率之和 | 建議等於 1.0，即 100% |

如果總機率不是 100%，介面會提示警告。通常應讓所有出口機率合計為 1。

---

### 10. End 節點參數

| 參數 | 含義 | 例子 |
|---|---|---|
| Average Time Display Unit | 終點卡片顯示平均總週期時間的單位 | 訂單流程用 hours，專案流程用 days |

該設定只影響顯示，不改變內部模擬計算。

---

### 11. Simulation Mode 模擬模式

| 模式 | 適合場景 | 行為 |
|---|---|---|
| Realistic | 日常營運分析、平均表現預測 | 處理時間更接近現實分布，極端值較少 |
| Worst-Case | 容量規劃、壓力測試、保守估算 | 更容易出現極端壓力、同步到達和更激進的取消 |

建議：

- 想知道「平時大概表現如何」：用 Realistic。
- 想知道「最糟糕會不會爆掉」：用 Worst-Case。
- 做採購或招聘決策：先用 Realistic，再用 Worst-Case 留安全邊際。

---

### 12. 統計指標裡的各種時間

| 指標 | 含義 | 通俗解釋 |
|---|---|---|
| Avg Calendar / Avg Cycle Time | 從建立到完成經過的總日曆時間 | 客戶從下單到收到結果的總等待時間 |
| Median Calendar | 一半工作項目低於該總週期時間 | 比平均值更不容易被極端值影響 |
| P90 Calendar | 90% 工作項目低於該總週期時間 | 用來看較慢的 10% 客戶體驗 |
| Avg Working | 只計算工作日曆內的週期時間 | 排除夜晚、週末等非工作時間後的週期 |
| Touch / Work | 實際被處理的時間 | 員工或機器真正花在這個工作項目上的時間 |
| Queue Wait (Calendar) | 按完成工作項目聚合的日曆排隊等待 | 客戶真實等了多久，包含夜晚、週末等非工作時間 |
| Queue Wait (Working) | 按完成工作項目真實經歷聚合的工作時間排隊等待 | 排除非工作時間後，每個工作項目實際在工作時間內等了多久 |
| Diagnostic Working Wait | 步驟級工作等待時間的診斷平均 | 用來找哪個步驟可能堵，不代表每個工作項目的真實平均體驗 |
| Transfer | 步驟之間移動或傳遞的時間 | 從一個工位移到另一個工位的時間 |
| Off-hours Delay / Non-working Delay | 因非工作時間產生的延遲 | 週五下班後提交，週一才處理的等待 |
| Flow Efficiency | 工作時間占總週期時間的比例 | 10 小時週期裡只有 2 小時在處理，效率約 20% |
| Oldest WIP | 目前系統內最老未完成工作項目年齡 | 最久沒完成的訂單已經等多久 |
| Oldest Queue | 目前佇列裡最老排隊項等待時間 | 最久排隊的客戶等了多久 |
| Resource Util. | 資源利用率 | 員工/機器有多少比例時間在忙 |
| Throughput | 單位模擬時間完成數量 | 每小時完成 20 單 |
| Active Work / WIP | 目前系統內還沒完成的數量 | 正在處理或排隊的訂單總數 |
| Errors | 失敗數量 | 報廢、缺陷、處理失敗的數量 |
| Cancelled | 取消數量 | 等不及離開或撤單的數量 |

---

### 13. 推薦建模步驟

1. 先畫流程：Start → Process → End。
2. 給 Start 設定到達量：例如每小時 20 單。
3. 給每個 Process 設定處理時間和 Capacity。
4. 設定 Routing 機率，確保出口機率合計約 100%。
5. 設定 Business Hours，例如週一到週五 9-18。
6. 執行 Realistic 模式，觀察佇列、週期時間和資源利用率。
7. 如果要做容量規劃，再執行 Worst-Case 模式。
8. 根據瓶頸調整 Capacity、處理時間或流程分支。

---

### 14. 簡單業務例子

#### 例子 A：線上訂單

- Start：Online Orders，Rate = 12 items / hour。
- Order Taking：Capacity = 2，Processing = 2 min。
- Preparation：Capacity = 3，Processing = 4 min，Failure = 10%。
- Quality Check：Capacity = 1，Processing = 1.5 min，90% 去 Packaging，10% 返工到 Preparation。
- Packaging：Capacity = 2，Processing = 1 min。
- End：Shipment。

看什麼：如果 Quality Check 佇列越來越長，說明質檢是瓶頸，可以增加 Capacity 或減少返工率。

#### 例子 B：客服工單

- Start：每 5 分鐘來一批，每批 3 張工單。
- Demand Peak：週一 9-11 點 x2。
- Triage：Capacity = 2，Processing = 3 min。
- Resolve：Capacity = 5，Range = 10-30 min。
- Item Mix：普通工單 80%，複雜工單 20%，複雜工單 Time Factor = 2。

看什麼：P90 Calendar 和 Oldest Queue 可以幫助判斷高峰時客戶體驗是否過差。

---

## English Version

### 1. What is FlowSim?

FlowSim models a business process as “Start → Process steps → End” and simulates how work items arrive, queue, get processed, fail, cancel, and finish.

Plain examples:

- **Start**: a customer places an order, a ticket arrives, a patient checks in.
- **Process**: intake, review, preparation, quality check, packaging.
- **End**: shipment, ticket closed, patient discharged.
- **Item**: one order, one ticket, one customer, one case.

---

### 2. Quick Controls

| Setting | How to set it | Meaning | Simple example |
|---|---|---|---|
| Start / Pause | Click the sidebar button | Starts or pauses the simulation | Like pressing play to watch orders move |
| Reset | Click reset | Clears current results and restarts | Start a fresh experiment |
| Speed | 1x to 10x | Speeds up animation and simulation progress | 2x runs faster than 1x |
| Sim Clock | Choose a preset or custom ratio | Converts real time into simulated time | “1 sim day / sec” means 1 real second advances 1 simulated day |
| Sim Time | Read-only | Current elapsed simulated time | 03:00:00 means 3 simulated hours have passed |
| Simulation Mode | Realistic / Worst-Case | Controls random behavior | Use Realistic for normal operations; Worst-Case for stress tests |

Approximate simulated time advanced per real second:

$$
\text{Simulated time per second}=\text{Speed}\times\text{Sim Clock}
$$

Example: Speed = 2x and Sim Clock = 1 sim hour / sec means 1 real second advances about 2 simulated hours.

---

### 3. Time Units

FlowSim stores time internally in milliseconds, but the UI can display and accept friendlier units.

| Unit | Meaning | Conversion |
|---|---|---|
| ms | millisecond | 1 ms |
| s | second | 1,000 ms |
| min | minute | 60 seconds |
| h | hour | 60 minutes |
| workingDay | working day | fixed as 8 hours |
| day | calendar day | 24 hours |
| week | week | 7 days |
| month | month | fixed as 30 days |
| year | year | fixed as 365 days |

Notes:

- **workingDay is always 8 hours**; it does not automatically change with Business Hours.
- **day is always 24 hours**, including nights and off-hours.
- **Business Hours** affects when work can be processed, not the unit conversion table above.

---

### 4. Business Time and Business Hours

#### 4.1 Business Time

| Metric | Meaning | Example |
|---|---|---|
| Date | Current simulated calendar date/time | 2026-01-05 10:30 |
| Open / Closed | Whether the global calendar is currently open | Monday 10:30 is Open; Sunday may be Closed |
| Demand | Current demand multiplier | x2.00 means arrivals are doubled |
| Active peaks | Demand peak rules currently active | Lunch Peak x1.8 is active |

#### 4.2 Business Hours

| Setting | Meaning | Example |
|---|---|---|
| On / Off | Enables calendar restrictions | Off means 24/7 processing |
| Start date | Starting point of simulated calendar time | Start from 2026-01-05 09:00 |
| Working hours | One or more daily working segments | 9-12 and 13-18, with lunch break |
| Working days | Days of week that are open | Monday to Friday |
| Non-working arrivals | queue / delay / reject | What happens when items arrive while closed |

Non-working arrival policies:

| Policy | Meaning | Example |
|---|---|---|
| Queue | Items enter the system but wait until open time to process | A 10 PM order queues and starts at 9 AM |
| Delay | The arrival itself is shifted to the next open time | A 10 PM order is treated as arriving at 9 AM |
| Reject | Items arriving off-hours do not enter the system | Only in-hours appointments are accepted |

Common examples:

- Office: Working hours = 9-12, 13-18; working days = Mon-Fri.
- Restaurant: Working hours = 11-14, 17-22; working days = all week.
- 24/7 support: Working hours = 0-24; working days = all week.

---

### 5. Auto Pause

Auto Pause stops the simulation automatically when one configured target is reached.

| Setting | Meaning | Example |
|---|---|---|
| Sim time | Pause after this much simulated time | Stop after 30 simulated days |
| Stop date | Pause at a simulated calendar date/time | Stop at 2026-02-01 00:00 |
| Created | Pause after this many items are created | Stop after 1,000 orders are created |
| Finished | Pause after this many items finish | Stop after 500 orders are completed |
| Active | Pause when WIP reaches this number | Stop when 100 items are active |
| Failed | Pause when failures reach this number | Stop after 20 defects |
| Cancelled | Pause when cancellations reach this number | Stop after 50 customers abandon the queue |

If multiple conditions are set, the simulation pauses when the first one is reached.

Notes:

- Sim time supports unit selection (ms, sec, min, hours, days, and more). Changing the unit preserves the number shown in the input, so switching `1 h` to `min` makes the target one minute.
- Stop date must be later than the simulation Calendar start. If it is earlier than or equal to the start, the UI shows a warning and the auto-pause reason asks you to fix the stop date.

---

### 6. Demand Peaks

Demand Peaks describe time periods where demand is higher or lower. Global Demand Peaks affect all Start nodes; Start-level Demand Peaks affect only that Start node.

| Setting | Meaning | Example |
|---|---|---|
| Enabled | Turns the rule on or off | Temporarily disable a holiday peak |
| Name | Rule name | Lunch Peak |
| Multiplier / Mult | Arrival volume multiplier | 2.0 doubles arrivals; 0.5 halves them |
| Start / End | Daily active hour range | 11 to 14 means 11:00-14:00 |
| Weekdays / Days | Active weekdays | Only Monday to Friday |
| Months | Active months | Only November shopping season |
| Start date / End date | Active date range | 2026-11-01 to 2026-11-11 |

Multiple active peaks multiply together.

Example: global “Black Friday” x2 and local “Lunch Peak” x1.5 are both active, so total demand is x3.

---

### 7. Start Node Settings

Start nodes create work items.

#### 7.1 Arrival Model

| Model | Use case | Meaning | Example |
|---|---|---|---|
| Simple | Continuous flow | Items arrive by rate or interval | 12 orders per hour |
| Schedule | Fixed quantities in daily windows | Items are generated during time windows | 100 orders from 9-11 |
| Events | Exact dated or recurring dispatches | Send a batch at precise times | 500 tickets every Monday at 9:00 |

#### 7.2 Arrival Input: Rate vs Interval

| Mode | Meaning | Example |
|---|---|---|
| Rate | How many items arrive per time unit | 12 items / hour |
| Interval | How much time passes before each batch | 5 min / batch |

If Batch size = 3:

- Rate = 12 items / hour: about 12 total items per hour, grouped into batches of 3.
- Interval = 5 min / batch: one batch every 5 minutes, 3 items per batch, about 36 items per hour.

#### 7.3 Randomness: Fixed vs Range

| Mode | Meaning | Example |
|---|---|---|
| Fixed | Uses one fixed value | Exactly 12 orders per hour |
| Range | Randomly chooses between min and max | Between 8 and 20 orders per hour |

#### 7.4 Batch Dispatch

| Setting | Meaning | Example |
|---|---|---|
| Default batch size | Items created per arrival event | 1 = one at a time; 10 = ten at once |
| Interval inside batch | Gap between items inside the same batch, in ms | 0 = simultaneous; 1000 = one item every second |

#### 7.5 Item Mix / Quality

Defines different types of items. Probabilities must total 100%.

| Setting | Meaning | Example |
|---|---|---|
| Probability | Share of this item type | Standard 80%, Complex 20% |
| Time Factor | Processing time multiplier | Complex 2.0 = takes twice as long |
| Failure Factor | Failure probability multiplier | Risky 1.5 = more likely to fail |
| Cancel Factor | Queue cancellation multiplier | VIP 0.2 = less likely to cancel |
| Priority | Queue priority; higher goes first | VIP 10, normal 1 |
| Color | Display color | Different colors for different item types |

#### 7.6 Scheduled Windows

Used by Schedule mode.

| Setting | Meaning | Example |
|---|---|---|
| Start / End | Time window | 9 to 11 means 09:00-11:00 |
| Qty | Total quantity in the window | 100 items |
| Mode = Spread | Distribute evenly through the window | 100 items over 2 hours |
| Mode = Burst | Arrive all at the beginning | 100 items at 09:00 |
| Weekdays / Months / Dates | Active filters | Only weekdays in November |

#### 7.7 Dispatch Plans

Used by Events mode.

| Setting | Meaning | Example |
|---|---|---|
| Start date | Plan start date | Start from 2026-06-01 |
| Sim day | Day offset from simulation start | 0 = first day, 1 = second day |
| Time | Hour of the day | 9.5 = 09:30 |
| Items | Quantity per dispatch | 200 items each time |
| Repeat | Recurrence pattern | Once, Daily, Working days, Weekly, Monthly, Yearly |
| Every | Repeat interval | Weekly + Every 2 = every two weeks |
| End date | End of recurrence | Stop at 2026-12-31 |
| Max runs | Maximum occurrences | Run at most 10 times |
| Dispatch = All at once | Batch arrives instantly | 200 items at 09:00 |
| Dispatch = One by one | Items arrive sequentially | 200 items, one every 10 seconds |
| Item interval / Unit | Sequential dispatch interval | 10 seconds |
| Weekdays / Months / Days of month | Additional filters | Dispatch on the 1st and 15th of each month |

---

### 8. Process Node Settings

Process nodes queue and process work items.

#### 8.1 Simulation Type

| Type | Meaning | Use case | Example |
|---|---|---|---|
| Resource Mode | Uses limited capacity and can create queues | People, machines, service counters | 2 agents serve customers; others wait |
| Time Delay | No capacity limit; timing starts immediately | Waiting, transport, system delay | Shipping takes 2 days without occupying staff |

#### 8.2 Capacity and Execution Mode

| Setting | Meaning | Example |
|---|---|---|
| Capacity | Number of resources available at the step | 3 reviewers, 2 machines |
| 1 resource / item | Each item uses 1 resource | 1 agent handles 1 customer |
| Team per item | Multiple resources work together on one item | 2 technicians repair one car |
| 1 resource / many items | One resource can handle multiple items at once | One AI agent handles 5 tickets |

Team per item settings:

| Setting | Meaning | Example |
|---|---|---|
| Auto teams | Split Capacity into teams by default team size | Capacity 6, team size 2 → 3 teams |
| Explicit teams | Manually name teams and sizes | Team A has 2, Team B has 3 |
| Default team size | People/resources per auto team | 2 people per order |
| Speed multiplier by assigned resources | Speed by team size | 1 resource x1, 2 resources x1.65, 3 resources x2.3 |

Multitask settings:

| Setting | Meaning | Example |
|---|---|---|
| Max concurrent items / resource | Maximum simultaneous items per resource | One AI handles 4 requests |
| Speed multiplier by concurrent load | Per-item speed as load increases | 1 item x1, 2 items x0.8, 3 items x0.6 |

#### 8.3 Processing Duration

| Setting | Meaning | Example |
|---|---|---|
| Base Time | Base duration in Fixed mode | Review takes 10 minutes |
| Unit | Time unit | min, h, day, etc. |
| Variance | Random noise in Fixed mode, 0 to 1 | 0 = exact; 0.3 = roughly ±30% noise |
| Min Duration | Shortest duration in Range mode | Fastest 5 minutes |
| Max Duration | Longest duration in Range mode | Slowest 20 minutes |

Example: Base Time = 10 min and Variance = 0.2 means most tasks take around 8-12 minutes. In Range mode, Min = 5 min and Max = 20 min means each item randomly takes between 5 and 20 minutes.

#### 8.4 Calendar Override

| Mode | Meaning | Example |
|---|---|---|
| Inherit | Use global Business Hours | All steps work 9-18 |
| Custom | Use a step-specific calendar | Warehouse is 24/7, Finance is Mon-Fri 9-17 |

#### 8.5 Exceptions

| Setting | Meaning | Example |
|---|---|---|
| Failure / Defect Probability | Chance that an item fails after processing | 0.05 = 5% defect/failure rate |
| Cancellation Probability | Approximate per-second chance that queued items cancel | 0.01 = waiting customers may abandon |

Failed items do not move to the next step. Cancelled items leave the queue.

#### 8.6 Rules

Rules override processing time based on the item’s previous step.

Example:

- Normal items need 5 minutes for Quality Check.
- Reworked items only need 2 minutes because only one issue is checked.

---

### 9. Routing and Probabilities

Use the Routing tab to choose where items go after a step finishes.

| Setting | Meaning | Example |
|---|---|---|
| Checkbox | Whether this outgoing route exists | Quality Check can go to Packaging or Rework |
| Prob | Probability of choosing that route, 0 to 1 | 0.9 to Packaging, 0.1 to Rework |
| Total Probability | Sum of all outgoing probabilities | Should usually equal 1.0, or 100% |

The UI warns if total probability is not 100%. In most models, keep all outgoing probabilities summing to 1.

---

### 10. End Node Settings

| Setting | Meaning | Example |
|---|---|---|
| Average Time Display Unit | Unit used by the End card to show average end-to-end cycle time | Use hours for order flow; days for project flow |

This affects display only; internal simulation calculations remain unchanged.

---

### 11. Simulation Mode

| Mode | Best for | Behavior |
|---|---|---|
| Realistic | Normal operations and average performance | More realistic randomness; fewer extreme values |
| Worst-Case | Capacity planning, stress tests, conservative estimates | More severe pressure, bursty arrivals, and more aggressive cancellation behavior |

Recommendations:

- To answer “What usually happens?” use Realistic.
- To answer “Can the system survive a bad day?” use Worst-Case.
- For staffing or purchasing decisions, run Realistic first, then validate with Worst-Case.

---

### 12. Time Metrics in the Statistics

| Metric | Meaning | Plain explanation |
|---|---|---|
| Avg Calendar / Avg Cycle Time | Total calendar time from creation to completion | Customer’s total time from request to result |
| Median Calendar | 50% of items finish below this cycle time | Less affected by extreme outliers than average |
| P90 Calendar | 90% of items finish below this cycle time | Shows experience of slower customers/items |
| Avg Working | Cycle time counted only during working calendar time | Excludes nights/weekends/off-hours |
| Touch / Work | Time actually being processed | Time staff or machines actively spend on the item |
| Queue Wait (Calendar) | Item-weighted calendar queue wait from completed items | How long customers/items really waited, including off-hours |
| Queue Wait (Working) | Item-weighted working-hour queue wait from completed items | Each item’s real queue experience during working time only |
| Diagnostic Working Wait | Step-level diagnostic average of working wait | Useful for bottleneck diagnosis; not the item-weighted customer/item average |
| Transfer | Time moving between steps | Handoff or movement from one station to another |
| Off-hours Delay / Non-working Delay | Delay caused by closed business hours | Submitted Friday evening, processed Monday morning |
| Flow Efficiency | Work time divided by total cycle time | 2 hours of work in a 10-hour cycle = about 20% |
| Oldest WIP | Age of the oldest unfinished item | How long the oldest open order has been waiting |
| Oldest Queue | Wait time of the oldest queued item | Longest-waiting customer in line |
| Resource Util. | Resource utilization | Percentage of people/machines busy |
| Throughput | Completed items per simulated time unit | 20 orders per hour |
| Active Work / WIP | Items currently unfinished in the system | Orders processing or waiting |
| Errors | Failed items | Defects, scrap, processing failures |
| Cancelled | Cancelled items | Customers abandon or orders are withdrawn |

---

### 13. Recommended Modeling Workflow

1. Draw the flow: Start → Process → End.
2. Configure Start arrivals, for example 20 items per hour.
3. Configure each Process step’s duration and Capacity.
4. Configure Routing probabilities and keep outgoing routes near 100% total.
5. Configure Business Hours, for example Mon-Fri 9-18.
6. Run Realistic mode and observe queues, cycle time, and utilization.
7. For capacity planning, run Worst-Case mode as well.
8. Adjust Capacity, durations, or routing based on bottlenecks.

---

### 14. Simple Business Examples

#### Example A: Online Orders

- Start: Online Orders, Rate = 12 items / hour.
- Order Taking: Capacity = 2, Processing = 2 min.
- Preparation: Capacity = 3, Processing = 4 min, Failure = 10%.
- Quality Check: Capacity = 1, Processing = 1.5 min, 90% to Packaging, 10% back to Preparation.
- Packaging: Capacity = 2, Processing = 1 min.
- End: Shipment.

What to watch: if Quality Check queue keeps growing, it is the bottleneck. Increase Capacity or reduce rework rate.

#### Example B: Support Tickets

- Start: one batch every 5 minutes, 3 tickets per batch.
- Demand Peak: Monday 9-11 x2.
- Triage: Capacity = 2, Processing = 3 min.
- Resolve: Capacity = 5, Range = 10-30 min.
- Item Mix: Standard 80%, Complex 20%, Complex Time Factor = 2.

What to watch: P90 Calendar and Oldest Queue show whether peak-time customer experience is getting too poor.
---

## 等待時間計算模式 / Wait Time Calculation Modes

FlowSim 提供三種等待時間計算模式，讓你根據分析需求選擇最適合的視角。

FlowSim provides three wait time calculation modes, allowing you to choose the most suitable perspective for your analysis needs.

---

### 三種模式 / Three Modes

#### 📊 Both（推薦 / Recommended）

**繁中**：顯示兩種等待時間指標，提供完整分析。

**EN**: Display both wait time metrics for complete analysis.

**適合 / Best for**：
- 完整分析 / Complete analysis
- 學習階段 / Learning phase
- 不確定時 / When uncertain

---

#### 📅 Calendar Time（日曆時間）

**繁中**：僅顯示日曆等待時間（包含非工作時間）。從入隊到處理的完整日曆時間。

**EN**: Display only calendar wait time (including non-working hours). Full calendar time from queue to processing.

**適合 / Best for**：
- 客戶 SLA 報告 / Customer SLA reporting
- 對外承諾追蹤 / External commitment tracking
- 回應時間監控 / Response time monitoring

**範例 / Example**：
```
週五 17:00 入隊 → 週一 9:00 處理
Friday 17:00 queued → Monday 9:00 processed
Calendar Wait = 64 小時 / 64 hours
```

---

#### ⏱️ Working Time（工作時間）

**繁中**：僅顯示工作等待時間（排除非工作時間）。此 Flow 指標按完成 item 的真實經歷聚合，代表每個 item 實際在工作時間內排隊多久。

**EN**: Display only working wait time (excluding non-working hours). This Flow metric is item-weighted from completed items, representing each item’s real queue experience during working hours.

**適合 / Best for**：
- 佇列效率分析 / Queue efficiency analysis
- 容量規劃 / Capacity planning
- 資源優化決策 / Resource optimization decisions

**範例 / Example**：
```
週五 17:00 入隊 → 週一 9:00 處理
Friday 17:00 queued → Monday 9:00 processed
Working Wait = 0 小時 / 0 hours（週末不計算 / Weekend not counted）
```

**診斷補充 / Diagnostic note**：`Diagnostic Working Wait` 是步驟級平均，用於找瓶頸；它不是 item-weighted，不應解讀為平均每個 item 的真實等待。

**EN**: `Diagnostic Working Wait` is a step-level average for bottleneck diagnosis. It is not item-weighted and should not be read as the real average wait per item.

---

### 如何選擇模式？/ How to Choose?

| 情境 / Scenario | 推薦模式 / Recommended Mode |
|-----------------|----------------------------|
| 客戶報告 / Customer reporting | 📅 Calendar Time |
| 內部優化 / Internal optimization | ⏱️ Working Time |
| 資源規劃 / Resource planning | ⏱️ Working Time |
| SLA 檢查 / SLA checking | 📅 Calendar Time |
| 完整分析 / Complete analysis | 📊 Both |
| 不確定 / Uncertain | 📊 Both |

---

### 關鍵差異 / Key Difference

**繁中**：
```
Calendar Time - Working Time = 非工作時間的影響
差異大 → 主要是週末/夜間導致 → 考慮延長工作時間
差異小 → 主要是佇列積壓 → 需要增加資源
```

**EN**：
```
Calendar Time - Working Time = Impact of non-working hours
Large difference → Mainly weekends/nights → Consider extending working hours
Small difference → Mainly queue backlog → Need more resources
```

---

### 設定位置 / Configuration Location

**繁中**：左側邊欄 → "Wait Time Calculation"（在 Simulation Mode 下方）

**EN**: Left sidebar → "Wait Time Calculation" (below Simulation Mode)

**選項 / Options**：
- 📊 Both (Recommended) - 顯示 Calendar、Working 與診斷等待指標 / Show Calendar, Working, and diagnostic wait metrics
- 📅 Calendar Time - 日曆時間（含週末）/ Calendar time (includes weekends)
- ⏱️ Working Time - 工作時間（完成 item 的真實佇列經歷）/ Working time (completed items’ real queue experience)

---

### 統計面板顯示 / Statistics Panel Display

#### Both 模式 / Both Mode
```
Queue Wait (Calendar): 18.5 hours
Queue Wait (Working):  2.3 hours
Diagnostic Working Wait: 3.1 hours
```

#### Calendar Time 模式 / Calendar Time Mode
```
Queue Wait: 18.5 hours
```

#### Working Time 模式 / Working Time Mode
```
Queue Wait: 2.3 hours
```

---

### 常見問題 / FAQ

**Q: 切換模式會改變資料嗎？/ Does switching mode change data?**

A: ❌ 不會 / No. 後台始終計算兩種等待時間，切換只改變顯示。/ Backend always calculates both, switching only changes display.

**Q: 哪個模式最準確？/ Which mode is most accurate?**

A: ✅ 都準確，只是視角不同。/ All accurate, just different perspectives.
- Calendar Time = 客戶視角 / Customer perspective
- Working Time = 營運視角 / Operations perspective

**Q: 為什麼兩個指標差異很大？/ Why is there a large difference?**

A: ✅ 完全正常 / Completely normal. 差異大表示非工作時間影響大。/ Large difference indicates significant non-working hours impact.

---

### 詳細文檔 / Detailed Documentation

**繁中**：點擊應用程式頂部的 📖 Docs 按鈕，查看完整文檔中心。

**EN**: Click the 📖 Docs button at the top of the application to view the complete documentation center.

**包含 / Includes**：
- ⚡ 快速參考（5 分鐘）/ Quick reference (5 min)
- 📖 三種模式詳細對比 / Detailed mode comparison
- 🗂️ 常見問題解答 / FAQ
- 🔬 關鍵概念與案例 / Key concepts and examples

---
