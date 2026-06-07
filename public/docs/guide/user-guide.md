# FlowSim 用户文档 / User Guide

更新时间 / Last updated: 2026-06-07

---

## 中文版

### 1. FlowSim 是什么？

FlowSim 用来把一个业务流程画成「Start 起点 → Process 处理步骤 → End 终点」的流程图，并模拟工作项在流程中的到达、排队、处理、转移、失败、取消和完成。

| 概念 | 含义 | 例子 |
| --- | --- | --- |
| Start | 工作项进入系统的位置 | 客户下单、工单进入、病人到达 |
| Process | 需要时间、资源或等待的步骤 | 接单、审核、制作、质检、运输 |
| End | 流程结束点 | 发货、工单关闭、病人离开 |
| Item | 流程中移动的对象 | 一个订单、一张票、一位客户 |
| Capacity | 该步骤可同时处理的资源数量 | 2 个客服、3 台机器 |
| Queue | 等待资源或工作时间的 item | 排队中的客户或订单 |
| Flow | 一组连通的 Start、Process、End | 订单流程、客服流程 |

FlowSim 可以帮助回答：

- 哪个步骤是瓶颈？
- 增加 1 个资源是否能降低等待？
- 需求高峰是否会让队列爆掉？
- 客户看到的等待时间和内部真实排队时间差多少？
- 改变营业时间或非工作时间策略后，SLA 是否改善？

---

### 2. 界面总览

#### 2.1 Header 顶部栏

| 元素 | 说明 |
| --- | --- |
| Running / Paused | 当前模拟运行状态 |
| Simulation clock | 当前模拟日历或已运行时间 |
| Select API Key | 选择 Gemini API Key，用于 AI 场景生成与瓶颈分析 |
| Docs | 打开文档中心和应用内 Markdown 文档 |
| 移动端菜单 | 小屏幕打开侧栏 |

#### 2.2 Sidebar 侧栏

侧栏用于配置全局设置：

- Quick Controls：运行、暂停、重置、速度、视图模式。
- Simulation Settings：时间压缩、Realistic / Worst-Case、Wait Time Calculation。
- Business Time / Business Hours：当前业务日期、开关、工作日、工作时间段、非工作时间策略。
- Demand Peaks：全局需求高峰倍率。
- Auto Pause：到达指定时间、日期、数量或 WIP 后自动暂停。
- AI：Generate Scenario 与 Analyze Bottlenecks。

#### 2.3 Map 与 Metro

| 视图 | 用途 |
| --- | --- |
| Map | 建模、拖拽节点、编辑连接、复制粘贴流程 |
| Metro | 动态观察 item 移动、队列深度、瓶颈高亮、实时到达和完成 |

#### 2.4 StatsBoard

StatsBoard 显示全局指标、每个 flow 指标、每个 step 指标和队列图表。常用指标包括 Created、Finished、Failed、Cancelled、Avg Calendar、P90、Queue Wait、Resource Util.、Throughput 和 Active Work / WIP。

---

### 3. 快速控制参数

| 参数 | 怎么设置 | 代表什么 | 例子 |
| --- | --- | --- | --- |
| Play / Pause | 点击运行按钮 | 开始或暂停模拟 | 像播放流程动画 |
| Reset | 点击重置 | 清空 item 和统计，保留流程配置 | 重新跑一次实验 |
| Speed | 调整速度倍率 | 播放和模拟推进倍率 | 2x 比 1x 快 |
| Sim Clock / Time Compression | 选择预设或自定义 | 真实时间和模拟时间的换算 | `1 sim day / sec` 表示现实 1 秒推进模拟 1 天 |
| Simulation Mode | Realistic / Worst-Case | 控制随机和压力测试方式 | 平时预测用 Realistic，压力测试用 Worst-Case |
| Canvas Mode | Map / Metro | 切换建模或动态看板 | 建模用 Map，演示用 Metro |

近似推进速度：

$$
\text{每秒推进模拟时间}=\text{Speed}\times\text{Time Compression}
$$

例如 Speed = 2x，Time Compression = 1 sim hour / sec，则现实 1 秒约推进 2 个模拟小时。

---

### 4. 时间单位

FlowSim 内部用毫秒保存时间，界面可用业务友好的单位。

| 单位 | 含义 | 换算 |
| --- | --- | --- |
| ms | 毫秒 | 1 ms |
| s | 秒 | 1,000 ms |
| min | 分钟 | 60 秒 |
| h | 小时 | 60 分钟 |
| workingDay | 工作日 | 固定 8 小时 |
| day | 自然日 | 24 小时 |
| week | 周 | 7 天 |
| month | 月 | 固定 30 天 |
| year | 年 | 固定 365 天 |

注意：`workingDay` 固定是 8 小时，不会随 Business Hours 的每日工作时段长度变化。

---

### 5. Map 画布操作

| 操作 | 作用 |
| --- | --- |
| 点击节点 | 打开 Step Editor |
| 拖拽节点 | 移动位置并保存到配置 |
| Ctrl / Cmd + 点击 | 多选节点 |
| 框选 | 选择多个节点 |
| Ctrl / Cmd + C | 复制选中节点；未选中时复制全部步骤 |
| Ctrl / Cmd + V | 粘贴并自动偏移位置、重建 ID 和内部连接 |
| Delete / Backspace | 删除选中节点 |
| 滚轮 | 缩放 |
| 中键拖拽 | 平移 |

建议：先在 Map 中搭建流程，再切到 Metro 观察运行效果。

---

### 6. Step Editor 节点编辑器

| 页签 | 功能 |
| --- | --- |
| Basic | 节点名称、颜色、Start 到达设置、Process 资源与时长、End 显示单位 |
| Connections | 选择下游节点和路由概率 |
| Rules | 按来源步骤覆盖处理时间 |
| Exceptions | 设置失败概率和排队取消概率 |

常见校验：

- Item Mix 概率应合计 100%。
- Connections 出口概率通常应合计 1.0。
- Explicit teams 的团队资源总数必须等于 Capacity。
- 概率必须在 0 到 1 之间。

---

### 7. Start 节点：到达逻辑

Start 节点负责创建 item。

#### 7.1 Arrival Model

| 模型 | 含义 | 场景 |
| --- | --- | --- |
| Simple | 按稳定 rate 或 interval 到达 | 每小时 12 单、每 5 分钟一批 |
| Schedule | 每天固定时间窗投放指定数量 | 9-11 点共 100 单 |
| Events | 指定日期、模拟第几天或重复计划 | 每周一 9:00 投放 500 张工单 |

#### 7.2 Rate 与 Interval

| 模式 | 含义 | 例子 |
| --- | --- | --- |
| Rate | 每个时间单位到达多少 item | 12 items / hour |
| Interval | 每隔多久来一批 | 5 min / batch |

如果 Batch size = 3：

- Rate = 12 items / hour：总量约每小时 12 个，按每批 3 个创建。
- Interval = 5 min / batch：每 5 分钟 3 个，总量约每小时 36 个。

#### 7.3 Fixed 与 Range

| 模式 | 含义 |
| --- | --- |
| Fixed | 使用固定到达率或固定间隔 |
| Range | 在最小值和最大值之间随机波动 |

#### 7.4 Batch Dispatch

| 参数 | 含义 |
| --- | --- |
| Default batch size | 每次到达事件创建几个 item |
| Interval inside batch | 同一批 item 的内部间隔，单位 ms；0 表示同时到达 |

#### 7.5 Item Mix / Quality

Item Mix 用于描述不同类型的 item。

| 参数 | 含义 | 例子 |
| --- | --- | --- |
| Probability | 该类型出现比例 | 普通 80%，复杂 20% |
| Time Factor | 处理时间倍数 | 复杂订单 2.0 = 处理时间翻倍 |
| Failure Factor | 失败概率倍数 | 高风险 1.5 = 更容易失败 |
| Cancel Factor | 排队取消概率倍数 | VIP 0.2 = 更不容易取消 |
| Priority | 排队优先级，越大越优先 | VIP 10，普通 1 |
| Color | 可视化颜色 | 不同订单类型不同颜色 |

#### 7.6 Scheduled Windows

| 参数 | 含义 | 例子 |
| --- | --- | --- |
| Start / End | 时间窗口 | 9 到 11 表示 09:00-11:00 |
| Qty | 窗口内总数量 | 100 个 |
| Spread | 均匀分布到窗口内 | 2 小时 100 个 |
| Burst | 窗口开始时一次到达 | 9:00 来 100 个 |
| Weekdays / Months / Dates | 生效过滤条件 | 只在工作日和 11 月生效 |

#### 7.7 Dispatch Plans

| 参数 | 含义 |
| --- | --- |
| Start date | 计划起始日期 |
| Sim day | 从模拟开始后的第几天 |
| Time | 当天几点，9.5 表示 09:30 |
| Items | 每次投放数量 |
| Repeat | Once、Daily、Working days、Weekly、Monthly、Yearly |
| Every | 每隔几个周期重复 |
| End date / Max runs | 重复结束日期或最多执行次数 |
| All at once | 一次性投放 |
| One by one | 按间隔逐个投放 |

---

### 8. Process 节点：资源、队列与处理

#### 8.1 Simulation Type

| 类型 | 行为 | 适合 |
| --- | --- | --- |
| Resource Mode | 使用 Capacity，资源不足会排队 | 人员、机器、柜台 |
| Time Delay | 不占用资源；若当前日历关闭，会从下一段工作时间开始计时 | 运输、冷却、系统等待 |

#### 8.2 Capacity 与 Execution Mode

| 模式 | 含义 | 例子 |
| --- | --- | --- |
| 1 resource / item | 一个 item 占一个资源 | 一位客服服务一位客户 |
| Team per item | 多个资源共同处理一个 item | 两名技师修一辆车 |
| 1 resource / many items | 一个资源同时处理多个 item | AI 助手并发处理票据 |

Team per item：

- Auto teams：按 Capacity 和 Default team size 自动拆队。
- Explicit teams：手动设置团队名称和人数；总人数必须等于 Capacity。
- Speed multiplier by assigned resources：不同团队人数对应不同速度倍率。

Multitask：

- Max concurrent items / resource：每个资源最多同时处理多少 item。
- Speed multiplier by concurrent load：并发越多，每个 item 的速度可能下降。

#### 8.3 Processing Duration

| 参数 | 含义 |
| --- | --- |
| Base Time | Fixed 模式下基础处理时间 |
| Unit | 时间单位 |
| Variance | 固定时间的随机波动，0 到 1 |
| Min / Max Duration | Range 模式的最短和最长处理时间 |

例：Base Time = 10 min、Variance = 0.2，表示多数 item 大约在 8-12 分钟附近。

#### 8.4 Calendar Override

| 模式 | 含义 |
| --- | --- |
| Inherit | 使用全局 Business Hours |
| Custom | 当前 Start 或 Process 使用自己的工作日历 |

例：线上订单 Start 可 24/7 接收，仓库 Process 可周一到周六 8-20，财务 Process 可工作日 9-17。

#### 8.5 Rules 与 Exceptions

Rules：根据 item 来自哪个上游步骤，覆盖当前步骤处理时间。  
Exceptions：设置处理失败概率和排队取消概率。

- Failure / Defect Probability：处理完成后失败，失败 item 不进入下一步。
- Cancellation Probability：排队中每秒取消的大致概率，等待越久越可能取消。

---

### 9. Connections 与 End

Connections 决定 item 完成当前步骤后去哪里。

| 参数 | 含义 |
| --- | --- |
| Checkbox | 是否连接到目标步骤 |
| Probability | 走向该目标的概率，0 到 1 |
| Total Probability | 所有出口概率之和，通常应为 1.0 |

例：质检后 90% 去打包，10% 回返工，分别设置 0.9 和 0.1。

End 节点代表流程结束，主要设置 Average Time Display Unit，只影响显示，不改变计算。

---

### 10. Business Time、Business Hours 与 Demand Peaks

#### 10.1 Business Time 面板

| 指标 | 含义 |
| --- | --- |
| Date | 当前模拟日历时间 |
| Open / Closed | 当前是否在工作时间 |
| Demand | 当前到达倍率 |
| Active peaks | 当前生效的高峰规则 |

#### 10.2 Business Hours

| 设置 | 含义 |
| --- | --- |
| Enabled | 是否启用工作日历 |
| Calendar start | 模拟时间 0 对应的日期时间 |
| Working days | 哪些星期工作 |
| Working hours | 每天一个或多个工作时段 |
| Non-working arrivals | 非工作时间到达策略 |

| 策略 | 行为 |
| --- | --- |
| Queue | item 照常进入队列，但等到工作时间处理 |
| Delay | 到达本身延迟到下一个工作时间 |
| Reject | 非工作时间到达不创建 item，并增加 Cancelled 计数 |

#### 10.3 Demand Peaks

Demand Peaks 可按时间、星期、月份、日期范围修改到达量。全局规则影响所有 Start；Start 本地规则只影响该 Start。多个规则同时生效时倍率相乘。

---

### 11. Auto Pause

Auto Pause 用于固定实验边界。

| 条件 | 含义 |
| --- | --- |
| Simulation Time | 运行指定模拟时长后暂停 |
| Stop Date | 到指定模拟日历日期后暂停 |
| Total Items Created | 创建数量达到目标后暂停 |
| Total Items Finished | 完成数量达到目标后暂停 |
| Total Items Failed | 失败数量达到目标后暂停 |
| Total Items Cancelled | 取消数量达到目标后暂停 |
| Active Items | 系统内未完成 item 达到目标后暂停 |

多个条件同时设置时，任一条件先达成就暂停。Stop Date 必须晚于 Calendar start。

---

### 12. Simulation Mode 与 Wait Time Calculation

| Simulation Mode | 用途 |
| --- | --- |
| Realistic | 日常运营和平均表现预测 |
| Worst-Case | 压力测试和保守容量规划 |

| Wait Time 模式 | 适合 |
| --- | --- |
| Both | 完整分析、初次诊断 |
| Calendar Time | SLA、客户报告 |
| Working Time | 内部效率、资源规划 |

关键区别：

- Queue Wait (Calendar)：客户真实等了多久，包含夜晚和周末。
- Queue Wait (Working)：完成 item 在工作时间内的真实排队等待。
- Diagnostic Working Wait：步骤级平均，用于找瓶颈，不代表 item 平均体验。

---

### 13. 统计指标解读

| 指标 | 含义 |
| --- | --- |
| Created / Finished | 创建和完成数量 |
| Failed / Cancelled | 失败和取消数量 |
| Avg Calendar / Avg Cycle Time | 从创建到完成的总日历周期 |
| Median / P90 | 中位数和 90 分位周期时间 |
| Avg Global Working | 使用全局 Business Calendar 计算的完成 item 工作时间周期 |
| Touch / Work | 实际处理时间 |
| Queue Wait (Calendar) | 日历排队等待 |
| Queue Wait (Working) | 工作时间排队等待 |
| Off-hours Delay / Non-working Delay | `Calendar Cycle - Global Working Cycle`，即全局日历关闭时段造成的差值 |
| Flow Efficiency | Touch / Work 占 Avg Calendar 的比例，即 `avgWorkTime / avgCycleTime` |
| Oldest WIP | 当前最老未完成 item 的年龄 |
| Oldest Queue | 当前队列中等待最久 item 的等待时间 |
| Resource Util. | 资源利用率 |
| Throughput | 单位模拟时间完成数量 |
| Active Work / WIP | 当前未完成数量 |

判断建议：

- Queue 长且 Resource Util. 高：资源不足。
- Queue 长但 Resource Util. 低：检查 Business Hours、Calendar Override、连接或 arrival policy。
- Calendar Wait 远大于 Working Wait：非工作时间影响大。
- P90 远大于 Avg：尾端体验差，检查高峰、返工或复杂 item。

---

### 14. Import / Export / Draft 与 AI

| 功能 | 说明 |
| --- | --- |
| Auto-save Draft | 自动保存完整配置到浏览器 localStorage |
| Export | 下载 JSON 配置，包含版本和导出时间 |
| Import | 导入 JSON，会替换当前流程并重置模拟 |
| Copy / Paste | 复制选中节点并重建 ID 与连接 |
| Clear Canvas | 清空流程图，需要确认 |
| Generate Scenario | 用 AI 根据文字生成流程 |
| Analyze Bottlenecks | 用 AI 根据当前统计分析瓶颈 |

AI 生成后仍需人工检查 Connections、Capacity、Processing Duration 和业务日历。

---

### 15. 建模模板

#### 在线订单

- Start：Online Orders，Rate = 12 items / hour。
- Process：Order Taking，Capacity = 2，Processing = 2 s，Queue Cancellation = 5% / sec。
- Process：Preparation，Capacity = 3，Processing = 4 s，Failure = 10%。
- Process：Quality Check，Capacity = 1，Processing = 1.5 s，Failure = 5%，90% 去 Packaging，10% 返工到 Preparation。
- Process：Packaging，Capacity = 2，Processing = 1 s。
- End：Shipment。

观察：Quality Check 是否形成长队；返工是否导致 Preparation 堵塞。

#### 客服工单

- Start：每 5 分钟一批，每批 3 张。
- Demand Peak：周一 9-11 点 x2。
- Process：Triage，Capacity = 2，Processing = 3 min。
- Process：Resolve，Capacity = 5，Range = 10-30 min。
- Item Mix：普通 80%，复杂 20%，复杂 Time Factor = 2。

观察：P90 Calendar、Oldest Queue、Resource Util.。

---

### 16. 从 0 到 1 建模流程

#### 16.1 建模前先定义边界

开始画图前，先明确四件事：

| 问题 | 建议写法 | 为什么重要 |
| --- | --- | --- |
| 流程从哪里开始？ | “订单提交成功”或“工单创建” | 决定 Start 节点创建 item 的时刻 |
| 流程在哪里结束？ | “已发货”或“客户确认解决” | 决定 cycle time 的终点 |
| 统计时间口径是什么？ | Calendar、Working 或 Both | 决定 SLA 与内部效率如何解释 |
| 模拟多长时间？ | 7 天、30 天、创建 10000 件 | 决定 Auto Pause 和样本量 |

建议不要一开始就把所有细节都放进去。先画主流程，确认 item 能顺利从 Start 到 End，再逐步加入返工、失败、取消、营业时间和需求高峰。

#### 16.2 推荐建模步骤

1. 在 Map 中创建一个 Start、若干 Process、一个 End。
2. 打开每个节点，命名并设置颜色，让流程图可读。
3. 在 Connections 中连接下游，并设置路由概率。
4. 设置 Start 的到达量，先用 Simple Rate。
5. 设置 Process 的 Capacity 和 Processing Duration。
6. 运行 1-2 分钟现实时间，确认 Created、Finished、Queue、Errors 都符合预期。
7. 加入 Business Hours 和 Non-working arrivals。
8. 加入 Demand Peaks、Item Mix、Failure、Cancellation。
9. 用 Auto Pause 固定实验长度，重复比较不同方案。

#### 16.3 第一次运行时看什么？

| 看板位置 | 观察项 | 说明 |
| --- | --- | --- |
| Metro | item 是否按预期路径移动 | 如果停在某节点，检查连接、工作时间和资源 |
| Global Summary | Finished / Created | 如果 Created 增长但 Finished 不增长，流程可能堵住 |
| Live Metrics by Flow | Queue、Active Work、Resource Util. | 判断瓶颈和资源占用 |
| Real-time Step Load | 每个步骤 Queue / Processing | 找出队列增长最快的位置 |

---

### 17. 参数设置实用建议

#### 17.1 到达量怎么设

| 业务描述 | 建议设置 |
| --- | --- |
| “平均每小时 30 单” | Simple → Rate → 30 items / hour |
| “每 10 分钟系统批量导入一次，每次 50 条” | Simple → Interval → 10 min / batch，Batch size = 50 |
| “每天 9 点一次性导入 200 条” | Schedule 或 Events，Dispatch = Burst |
| “9-11 点陆续进来 300 条” | Schedule，Start = 9，End = 11，Qty = 300，Spread |
| “每周一上午有工单潮” | Events，Repeat = Weekly，Weekdays 选择 Monday |

Rate 与 Interval 的区别很重要：Rate 控制单位时间总量；Interval 控制每隔多久来一批。Batch size 在 Rate 模式下不会改变长期总量，只改变批次形态；在 Interval 模式下会直接影响总量。

#### 17.2 Capacity 怎么估

先用一个简单估算：

$$
resources\approx\frac{arrivalRate\times averageProcessingTime}{targetUtilization}
$$

例：每小时 30 件，每件处理 6 分钟，即每小时需要 180 分钟工作量。如果目标利用率 80%，需要约 `180 / 60 / 0.8 = 3.75`，可先设置 Capacity = 4。

#### 17.3 Processing Duration 怎么设

| 情况 | 建议 |
| --- | --- |
| 时间稳定 | Fixed，Variance 设低，例如 0-0.1 |
| 有明显波动 | Fixed + Variance 0.2-0.5 |
| 只知道最短和最长 | Range，填写 Min / Max |
| 不同来源耗时不同 | Rules 中按来源步骤覆盖处理时间 |
| 不同 item 类型耗时不同 | Start 的 Item Mix 设置 Time Factor |

Realistic 模式下 Fixed + Variance 更像日常随机波动；Worst-Case 更适合压力测试，尾端和波动会更保守。

#### 17.4 什么时候用三种资源执行模式

| 模式 | 适合 | 不适合 |
| --- | --- | --- |
| Single | 一人/一机处理一件 | 需要多人协作的任务 |
| Collaborative | 多人共同完成一件 | 可完全独立并发的小任务 |
| Multitask | 一个资源可并发处理多件 | 强顺序、必须独占资源的任务 |

如果不确定，先用 Single；确认瓶颈后再切 Collaborative 或 Multitask 做场景比较。

---

### 18. 诊断瓶颈的标准流程

| 现象 | 可能原因 | 操作 |
| --- | --- | --- |
| Queue 持续增长，Resource Util. 接近 100% | 资源不足 | 增加 Capacity 或缩短处理时间 |
| Queue 增长，但 Resource Util. 不高 | 非工作时间、Calendar Override、连接或到达策略问题 | 检查 Business Hours、Process 日历和 Routing |
| Created 很高，Finished 很低 | 流程中存在瓶颈或无出口 | 查 Real-time Step Load 和 Connections |
| Errors 高 | Failure Probability 或 Failure Factor 过高 | 降低失败率或增加返工路径 |
| Cancelled 高 | Cancellation Probability、Reject 或等待过长 | 检查 Non-working arrivals 和队列等待 |

如果 P90 Calendar 明显高于 Avg Calendar，说明少数 item 等很久。常见原因是高峰、返工、复杂 item 或非工作时间跨夜。

---

### 19. 常见问题与排查

| 问题 | 优先检查 |
| --- | --- |
| item 不产生 | Start 是否连接、Arrival rate 是否大于 0、Business Hours 是否关闭且策略为 reject |
| item 到某一步不动 | Process 是否没有 Capacity、是否处于非工作时间、是否无下游连接 |
| 队列无限增长 | 到达量是否大于处理能力、是否高峰倍率叠加过高 |
| 等待时间看起来太大 | 当前是否使用 Calendar Time，是否跨夜/周末 |
| Working Wait 为 0 但 Calendar Wait 很大 | item 多数在非工作时间等待，工作时间一开就处理 |
| Throughput 单位奇怪 | 系统会根据 Start 常用 arrival unit 推断显示单位 |
| Explicit teams 无法保存 | 团队总 resources 必须等于 Capacity，团队名称不能重复 |
| 导入后连接消失 | 导入清理会删除无效目标、自连接和非法步骤 |

---

### 20. 维护与协作建议

- 重要实验前使用 Export 保存 JSON。
- 每次改模型只改一个关键变量，方便比较。
- 文档、截图和 JSON 配置一起保存，便于复盘。
- 分享给他人前，先 Reset 再 Export，避免运行状态干扰理解。
- AI 生成的场景适合做草稿，不应直接当作最终业务模型。

---

## 繁體中文版

### 1. FlowSim 是什麼？

FlowSim 是流程模擬與容量優化工具。你可以把業務畫成「Start 起點 → Process 處理步驟 → End 終點」，再觀察工作項目如何到達、排隊、處理、轉移、失敗、取消和完成。

| 概念 | 含義 | 例子 |
| --- | --- | --- |
| Start | 工作項目進入系統的位置 | 客戶下單、工單進入、病人到達 |
| Process | 需要時間、資源或等待的步驟 | 接單、審核、製作、質檢、運輸 |
| End | 流程結束點 | 出貨、工單關閉、病人離開 |
| Item | 流程中移動的對象 | 一筆訂單、一張票、一位客戶 |
| Capacity | 該步驟可同時處理的資源數 | 2 位客服、3 台機器 |
| Queue | 等待資源或工作時間的 item | 排隊中的客戶或訂單 |

FlowSim 適合回答：瓶頸在哪裡、資源夠不夠、高峰期是否塞車、SLA 是否達標、營業時間策略是否合理，以及客戶等待與內部排隊時間差多少。

---

### 2. 介面總覽

| 區域 | 功能 |
| --- | --- |
| Header | 顯示 Running / Paused、Simulation clock、API Key、Docs 與行動選單 |
| Sidebar | 設定速度、時間壓縮、Business Hours、Demand Peaks、Auto Pause、AI |
| Map | 建模、拖曳節點、編輯連線、複製貼上流程 |
| Metro | 動態觀察 item 流動、佇列深度、瓶頸高亮、到達和完成 |
| StatsBoard | 顯示全域、Flow 與 Step 指標 |
| Step Editor | 編輯 Basic、Connections、Rules、Exceptions |

推薦流程：先在 Map 建立流程，再切到 Metro 觀察動態流動，最後用 StatsBoard 判斷瓶頸。

---

### 3. 快速控制與畫布操作

| 功能 | 說明 |
| --- | --- |
| Play / Pause | 開始或暫停模擬 |
| Reset | 清空 item 和統計，保留流程配置 |
| Speed | 播放與模擬推進倍率 |
| Sim Clock / Time Compression | 真實時間與模擬時間換算，例如 `1 sim day / sec` |
| Simulation Mode | Realistic 用於日常預測；Worst-Case 用於壓力測試 |
| Ctrl / Cmd + C / V | 複製、貼上節點，系統會重建 ID 和有效連線 |
| Delete / Backspace | 刪除選中節點 |
| 滾輪 / 中鍵拖曳 | 縮放與平移畫布 |

實際推進速度約為：

$$
simTimePerSecond=Speed\times TimeCompression
$$

---

### 4. Step Editor

| 頁籤 | 功能 |
| --- | --- |
| Basic | 節點名稱、顏色、Start 到達設定、Process 資源與時長、End 顯示單位 |
| Connections | 選擇下游節點和路由機率 |
| Rules | 按來源步驟覆蓋處理時間 |
| Exceptions | 設定失敗機率和排隊取消機率 |

常見校驗：Item Mix 機率應合計 100%；Connections 出口機率通常合計 1.0；Explicit teams 的團隊資源總數必須等於 Capacity。

---

### 5. Start 節點：到達邏輯

| Arrival Model | 用途 | 例子 |
| --- | --- | --- |
| Simple | 持續穩定到達 | 每小時 12 單、每 5 分鐘一批 |
| Schedule | 每天固定時間窗投放 | 9-11 點共 100 單 |
| Events | 指定日期或週期性投放 | 每週一 9:00 投放 500 張工單 |

Simple 支援 Rate 和 Interval。若 Batch size = 3，`Rate = 12 items / hour` 表示總量約每小時 12 個；`Interval = 5 min / batch` 表示每 5 分鐘來 3 個，約每小時 36 個。

| 設定 | 含義 |
| --- | --- |
| Fixed / Range | 固定到達或在最小值與最大值間波動 |
| Default batch size | 每次到達建立幾個 item |
| Interval inside batch | 同批 item 的內部間隔，0 表示同時到達 |
| Item Mix | 定義 item 類型、比例、處理倍數、失敗倍數、取消倍數、優先級和顏色 |
| Demand Peaks | Start 層級需求倍率，會與全域倍率相乘 |

Schedule 使用 Scheduled Windows：Start / End、Qty、Spread / Burst、Weekdays、Months、日期範圍。Events 使用 Dispatch Plans：Start date、Sim day、Time、Items、Repeat、Every、End date、Max runs、All at once / One by one。

---

### 6. Process 節點：資源、佇列與處理

| Simulation Type | 行為 | 適合 |
| --- | --- | --- |
| Resource Mode | 使用 Capacity，資源不足會排隊 | 人員、機器、櫃台 |
| Time Delay | 不占用資源；若目前日曆關閉，會從下一段工作時間開始計時 | 運輸、冷卻、系統等待 |

| Execution Mode | 含義 | 例子 |
| --- | --- | --- |
| 1 resource / item | 一個 item 占用一個資源 | 一位客服服務一位客戶 |
| Team per item | 多個資源共同處理一個 item | 維修團隊、手術團隊 |
| 1 resource / many items | 一個資源同時處理多個 item | AI 助手、批處理系統 |

Team per item 可用 Auto teams 或 Explicit teams；Explicit teams 的總人數必須等於 Capacity。Multitask 可設定每個資源最多同時處理幾個 item，以及並發負載下的速度倍率。

處理時間可用 Fixed + Variance，或 Range 的 Min / Max Duration。Start 和 Process 也可設定 Calendar Override，讓單一步驟使用不同於全域的工作日曆。

---

### 7. Connections、Rules、Exceptions、End

Connections 決定 item 完成後去哪裡。每條連線有 Probability，通常所有出口合計為 1.0。例如質檢後 90% 去打包、10% 返工，兩條連線分別設 0.9 和 0.1。

Rules 可依來源步驟覆蓋處理時間；Exceptions 可設定 Failure / Defect Probability 與 Cancellation Probability。End 節點代表流程終點，Average Time Display Unit 只影響顯示，不改變計算。

---

### 8. Business Hours、Demand Peaks、Auto Pause

| Business Hours 設定 | 含義 |
| --- | --- |
| Calendar start | 模擬時間 0 對應的日期時間 |
| Working days | 哪些星期工作 |
| Working hours | 每天一個或多個工作時段 |
| Non-working arrivals | 非工作時間到達策略：queue、delay、reject |

| 策略 | 行為 |
| --- | --- |
| queue | item 照常進入佇列，等工作時間再處理 |
| delay | 到達本身延遲到下一個工作時間 |
| reject | 非工作時間到達不建立 item，並增加 Cancelled 計數 |

Demand Peaks 可按時間、星期、月份、日期範圍修改到達倍率；全域規則影響所有 Start，Start 本地規則只影響該 Start，多個規則同時生效時相乘。

Auto Pause 可依 Simulation Time、Stop Date、Created、Finished、Failed、Cancelled、Active Items 自動暫停；多個條件同時設定時，任一條件先達成就暫停。

---

### 9. 指標與等待時間

| Wait Time 模式 | 適合 |
| --- | --- |
| Both | 完整分析、初次診斷 |
| Calendar Time | SLA、客戶報告 |
| Working Time | 內部效率、資源規劃 |

| 指標 | 含義 |
| --- | --- |
| Avg Calendar / Avg Cycle Time | 從建立到完成的總日曆週期 |
| Median / P90 | 中位數與 90 分位，適合看尾端體驗 |
| Queue Wait (Calendar) | 包含夜晚和週末的真實等待 |
| Queue Wait (Working) | 只計工作時間內的排隊等待 |
| Diagnostic Working Wait | 步驟級診斷平均，用於找瓶頸 |
| Off-hours Delay / Non-working Delay | `Calendar Cycle - Global Working Cycle`，即全域日曆關閉時段造成的差值 |
| Flow Efficiency | Touch / Work 占 Avg Calendar 的比例，即 `avgWorkTime / avgCycleTime` |
| Resource Util. | 資源忙碌比例 |
| Throughput | 單位模擬時間完成量 |

判斷建議：Queue 長且 Resource Util. 高通常代表資源不足；Calendar Wait 遠大於 Working Wait 通常代表非工作時間影響大；P90 遠高於 Avg 代表尾端體驗差。

---

### 10. 匯入匯出、草稿與 AI

| 功能 | 說明 |
| --- | --- |
| Auto-save Draft | 自動保存配置到瀏覽器 localStorage |
| Export / Import | 匯出或匯入 JSON；匯入會取代目前流程並重設模擬 |
| Copy / Paste | 複製貼上節點，系統會重建 ID 和內部連線 |
| Clear Canvas | 清空流程圖，需要確認 |
| Generate Scenario | 用 AI 根據文字生成流程 |
| Analyze Bottlenecks | 用 AI 根據目前統計分析瓶頸 |

AI 生成後仍需人工檢查 Connections、Capacity、Processing Duration 和 Business Hours。

---

### 11. 建模模板

#### 線上訂單

- Start：Online Orders，12 items / hour。
- Process：Order Taking，Capacity 2，Processing 2 s，Queue Cancellation 5% / sec。
- Process：Preparation，Capacity 3，Processing 4 s，Failure 10%。
- Process：Quality Check，Capacity 1，Processing 1.5 s，Failure 5%，90% 去 Packaging，10% 回 Preparation。
- End：Shipment。

觀察：Quality Check 是否形成長隊，返工是否導致 Preparation 堵塞。

#### 客服工單

- Start：每 5 分鐘一批，每批 3 張。
- Demand Peak：週一 9-11 點 x2。
- Process：Triage，Capacity 2，Processing 3 min。
- Process：Resolve，Capacity 5，Range 10-30 min。
- Item Mix：普通 80%，複雜 20%，複雜 Time Factor 2.0。

觀察：P90 Calendar、Oldest Queue、Resource Util.。

---

### 12. 從 0 到 1 建模流程

#### 12.1 先定義流程邊界

| 問題 | 建議寫法 | 重要性 |
| --- | --- | --- |
| 從哪裡開始？ | 訂單提交、工單建立、病人報到 | 決定 Start 何時建立 item |
| 到哪裡結束？ | 出貨完成、工單關閉、病人離開 | 決定 cycle time 終點 |
| 使用哪種時間口徑？ | Calendar、Working 或 Both | 影響 SLA 與內部效率解讀 |
| 模擬多長？ | 7 天、30 天、建立 10000 件 | 決定 Auto Pause 和樣本量 |

建議先畫主流程，確認 item 能從 Start 到 End，再逐步加入返工、失敗、取消、營業時間和需求高峰。

#### 12.2 推薦操作順序

1. 在 Map 建立 Start、Process、End。
2. 命名節點並設定顏色。
3. 在 Connections 設定下游和路由機率。
4. Start 先用 Simple Rate 設定到達量。
5. Process 設定 Capacity 和 Processing Duration。
6. 先短跑一次，確認 Created、Finished、Queue、Errors 正常。
7. 加入 Business Hours 和 Non-working arrivals。
8. 加入 Demand Peaks、Item Mix、Failure、Cancellation。
9. 用 Auto Pause 固定實驗長度，比較不同方案。

---

### 13. 參數設定實用建議

| 業務描述 | 建議設定 |
| --- | --- |
| 平均每小時 30 單 | Simple → Rate → 30 items / hour |
| 每 10 分鐘批量匯入 50 條 | Simple → Interval → 10 min / batch，Batch size = 50 |
| 每天 9 點一次投放 200 條 | Schedule 或 Events，Burst |
| 9-11 點陸續進來 300 條 | Schedule，Start 9，End 11，Qty 300，Spread |
| 每週一上午有工單潮 | Events，Repeat Weekly，選 Monday |

Rate 控制單位時間總量；Interval 控制每隔多久來一批。Batch size 在 Rate 模式下主要改變批次形態；在 Interval 模式下會直接影響總量。

容量可先用：

$$
resources\approx\frac{arrivalRate\times averageProcessingTime}{targetUtilization}
$$

例：每小時 30 件，每件 6 分鐘，每小時工作量是 180 分鐘。目標利用率 80% 時，需要約 `180 / 60 / 0.8 = 3.75`，可先設 Capacity = 4。

---

### 14. 瓶頸診斷流程

| 現象 | 可能原因 | 操作 |
| --- | --- | --- |
| Queue 持續增長，Resource Util. 接近 100% | 資源不足 | 增加 Capacity 或縮短處理時間 |
| Queue 增長但 Util. 不高 | 非工作時間、日曆覆蓋、連線問題 | 檢查 Business Hours、Calendar Override、Routing |
| Created 高但 Finished 低 | 中間堵塞或無出口 | 看 Real-time Step Load 和 Connections |
| Errors 高 | Failure Probability 或 Failure Factor 太高 | 降低失敗率或加入返工路徑 |
| Cancelled 高 | 等待太久、取消率高或 off-hours reject | 檢查 Cancellation 和 Non-working arrivals |

SLA 建議看 P90 Calendar；內部改善建議看 Queue Wait (Working)、Resource Util.、Oldest Queue。若 Calendar Wait 遠大於 Working Wait，多半是夜晚、週末或午休造成。

---

### 15. 常見問題與排查

| 問題 | 優先檢查 |
| --- | --- |
| item 不產生 | Start 到達率、連線、Business Hours 是否 reject |
| item 到某步不動 | Capacity、工作時間、下游連線 |
| Queue 無限增長 | 到達量是否超過處理能力，Demand Peaks 是否疊太高 |
| 等待時間太大 | 是否使用 Calendar Time，是否跨夜或週末 |
| Working Wait 為 0 但 Calendar Wait 很大 | 多數等待發生在非工作時間 |
| Explicit teams 無法保存 | 團隊 resources 總和必須等於 Capacity，名稱不能重複 |
| 匯入後連線消失 | 匯入清理會刪除無效目標、自連線和非法步驟 |

---

### 16. 維護與協作建議

- 重要實驗前先 Export JSON。
- 每次只改一個關鍵變數，方便比較。
- 使用相同 Auto Pause 條件比較不同方案。
- 分享模型前先 Reset 再 Export。
- AI 生成場景只作草稿，仍需人工檢查 Connections、Capacity、Processing Duration 和 Business Hours。

---

## English Version

### 1. What is FlowSim?

FlowSim is a process simulation and capacity-planning tool. You model a workflow as `Start → Process → End`, then observe how work items arrive, queue, process, transfer, fail, cancel, and finish.

| Term | Meaning | Example |
| --- | --- | --- |
| Start | Entry point into the system | Orders, tickets, patients |
| Process | Work, resource, or delay step | Review, preparation, QA, transport |
| End | Completion point | Shipment, ticket closed, customer leaves |
| Item | Object moving through the flow | One order, one ticket, one customer |
| Capacity | Number of resources available at a step | 2 agents, 3 machines |
| Queue | Items waiting for resources or working time | Waiting orders or customers |

FlowSim helps answer where bottlenecks are, whether capacity is sufficient, whether peaks will overload the system, whether SLAs are realistic, and how customer-visible waiting differs from internal working-time congestion.

---

### 2. Interface overview

| Area | Purpose |
| --- | --- |
| Header | Running/Paused state, simulation clock, API key, Docs, mobile menu |
| Sidebar | Speed, time compression, Business Hours, Demand Peaks, Auto Pause, AI |
| Map | Build the model, drag nodes, edit connections, copy/paste flows |
| Metro | Watch animated item movement, queue depth, bottleneck highlights |
| StatsBoard | Global, flow-level, and step-level metrics |
| Step Editor | Edit Basic, Connections, Rules, and Exceptions |

Recommended workflow: model in Map, observe in Metro, then diagnose with StatsBoard.

---

### 3. Controls and canvas operations

| Feature | Meaning |
| --- | --- |
| Play / Pause | Start or pause simulation |
| Reset | Clear items and stats while keeping the model |
| Speed | Playback and simulation multiplier |
| Sim Clock / Time Compression | Converts real time into simulated time, such as `1 sim day / sec` |
| Simulation Mode | Realistic for baseline; Worst-Case for stress testing |
| Ctrl/Cmd + C / V | Copy and paste nodes; IDs and valid internal connections are rebuilt |
| Delete / Backspace | Delete selected nodes |
| Mouse wheel / middle-drag | Zoom and pan |

$$
simTimePerSecond=Speed\times TimeCompression
$$

---

### 4. Step Editor

| Tab | Purpose |
| --- | --- |
| Basic | Node name, color, Start arrivals, Process resources/durations, End display unit |
| Connections | Downstream nodes and routing probabilities |
| Rules | Processing-time overrides based on previous step |
| Exceptions | Failure and queue-cancellation probabilities |

Validation checks: Item Mix probabilities should total 100%; outgoing route probabilities usually total 1.0; Explicit team resources must equal Capacity.

---

### 5. Start nodes: arrivals

| Arrival Model | Use case | Example |
| --- | --- | --- |
| Simple | Continuous arrivals | 12 orders/hour or one batch every 5 minutes |
| Schedule | Daily dispatch windows | 100 items from 09:00 to 11:00 |
| Events | Exact or recurring dispatches | 500 tickets every Monday at 09:00 |

Simple supports Rate and Interval. If Batch size = 3, `Rate = 12 items / hour` means about 12 total items per hour, while `Interval = 5 min / batch` means 3 items every 5 minutes, about 36 items per hour.

| Setting | Meaning |
| --- | --- |
| Fixed / Range | Stable arrival or random value between min and max |
| Default batch size | Number of items created per arrival event |
| Interval inside batch | Spacing inside one batch; 0 means simultaneous |
| Item Mix | Item types, probability, time factor, failure factor, cancel factor, priority, color |
| Demand Peaks | Start-level demand multipliers, multiplied with global peaks |

Schedule uses Scheduled Windows: Start / End, Qty, Spread / Burst, Weekdays, Months, and date ranges. Events uses Dispatch Plans: Start date, Sim day, Time, Items, Repeat, Every, End date, Max runs, All at once / One by one.

---

### 6. Process nodes: resources, queues, and duration

| Simulation Type | Behavior | Best for |
| --- | --- | --- |
| Resource Mode | Uses Capacity; items queue if resources are busy | Agents, machines, counters |
| Time Delay | Uses no resource; if the step calendar is closed, timing starts at the next working window | Transport, cooling, system delay |

| Execution Mode | Meaning | Example |
| --- | --- | --- |
| 1 resource / item | One item consumes one resource | One agent handles one customer |
| Team per item | Multiple resources collaborate on one item | Repair team, clinical team |
| 1 resource / many items | One resource handles several items concurrently | AI assistant, batch processor |

Team per item supports Auto teams and Explicit teams. Explicit team totals must match Capacity. Multitask mode controls maximum concurrent items per resource and speed multipliers under concurrent load.

Processing duration can use Fixed + Variance or Range Min / Max. Calendar Override lets a Start or Process node use its own working calendar.

---

### 7. Connections, Rules, Exceptions, and End

Connections decide where an item goes after a step completes. Each route has a Probability; outgoing probabilities usually total 1.0. Example: after QA, 90% go to Packaging and 10% return to Rework, so routes are 0.9 and 0.1.

Rules override processing duration based on the previous step. Exceptions configure Failure / Defect Probability and Cancellation Probability. End nodes mark completion; Average Time Display Unit affects display only, not calculations.

---

### 8. Business Hours, Demand Peaks, and Auto Pause

| Business Hours setting | Meaning |
| --- | --- |
| Calendar start | Real date/time mapped to simulation time zero |
| Working days | Which weekdays are open |
| Working hours | One or more working segments per day |
| Non-working arrivals | Off-hours policy: queue, delay, reject |

| Policy | Behavior |
| --- | --- |
| queue | Items enter the queue while closed and process when open |
| delay | Arrivals are delayed until the next working segment |
| reject | Off-hours arrivals do not create items and increment Cancelled |

Demand Peaks multiply arrivals by time, weekday, month, and date range. Global peaks affect all Start nodes; Start-level peaks affect only that Start. Active peaks multiply together.

Auto Pause can stop by simulation time, stop date, created, finished, failed, cancelled, or active items. If multiple conditions are enabled, the first one reached pauses the run.

---

### 9. Metrics and wait time

| Wait Time mode | Best for |
| --- | --- |
| Both | Full analysis and first diagnosis |
| Calendar Time | SLA and customer-facing reports |
| Working Time | Internal efficiency and capacity planning |

| Metric | Meaning |
| --- | --- |
| Avg Calendar / Avg Cycle Time | Total calendar duration from creation to completion |
| Median / P90 | Median and 90th percentile, useful for tail experience |
| Queue Wait (Calendar) | Real waiting including nights and weekends |
| Queue Wait (Working) | Queue waiting during working time only |
| Diagnostic Working Wait | Step-level diagnostic average for bottleneck detection |
| Off-hours Delay / Non-working Delay | `Calendar Cycle - Global Working Cycle`, the difference caused by closed periods in the global calendar |
| Flow Efficiency | Touch / Work divided by Avg Calendar, i.e. `avgWorkTime / avgCycleTime` |
| Resource Util. | How busy resources are |
| Throughput | Finished items per simulated time unit |

Reading shortcuts: long Queue + high Resource Util. usually means insufficient capacity; Calendar Wait much larger than Working Wait usually means strong off-hours effects; P90 much higher than Avg means poor tail experience.

---

### 10. Import, export, draft, and AI

| Feature | Purpose |
| --- | --- |
| Auto-save Draft | Saves configuration to browser localStorage |
| Export / Import | Download or load JSON; import replaces the current model and resets simulation |
| Copy / Paste | Duplicate nodes and rebuild IDs/internal connections |
| Clear Canvas | Remove all nodes after confirmation |
| Generate Scenario | Use AI to generate a flow from text |
| Analyze Bottlenecks | Use AI to analyze current statistics |

AI output should be reviewed manually for Connections, Capacity, Processing Duration, and Business Hours.

---

### 11. Modeling templates

#### Online order flow

- Start: Online Orders, 12 items / hour.
- Process: Order Taking, Capacity 2, Processing 2 s, Queue Cancellation 5% / sec.
- Process: Preparation, Capacity 3, Processing 4 s, Failure 10%.
- Process: Quality Check, Capacity 1, Processing 1.5 s, Failure 5%, 90% to Packaging, 10% back to Preparation.
- End: Shipment.

Watch whether Quality Check forms a queue and whether rework blocks Preparation.

#### Support ticket flow

- Start: one batch every 5 minutes, 3 tickets per batch.
- Demand Peak: Monday 09:00-11:00 x2.
- Process: Triage, Capacity 2, Processing 3 min.
- Process: Resolve, Capacity 5, Range 10-30 min.
- Item Mix: normal 80%, complex 20%, complex Time Factor 2.0.

Watch P90 Calendar, Oldest Queue, and Resource Utilization.

---

### 12. Build a model from scratch

#### 12.1 Define boundaries first

| Question | Example answer | Why it matters |
| --- | --- | --- |
| Where does the flow start? | Order submitted, ticket created, patient checked in | Defines when Start creates items |
| Where does it end? | Shipped, ticket closed, patient leaves | Defines the cycle-time endpoint |
| Which time model matters? | Calendar, Working, or Both | Controls SLA vs internal-efficiency interpretation |
| How long should the run last? | 7 days, 30 days, 10000 created items | Defines Auto Pause and sample size |

Start with the main happy path. Verify items can travel from Start to End, then add rework, failure, cancellation, business hours, and demand peaks.

#### 12.2 Recommended workflow

1. Create one Start, several Process nodes, and one End in Map.
2. Name and color the nodes.
3. Configure downstream routes in Connections.
4. Set Start arrivals with Simple Rate first.
5. Set Process Capacity and Processing Duration.
6. Run briefly and verify Created, Finished, Queue, and Errors.
7. Add Business Hours and off-hours arrival policy.
8. Add Demand Peaks, Item Mix, Failure, and Cancellation.
9. Use Auto Pause to compare scenarios with the same run boundary.

---

### 13. Practical parameter guidance

| Business statement | Suggested setting |
| --- | --- |
| Average 30 orders per hour | Simple → Rate → 30 items / hour |
| Import 50 records every 10 minutes | Simple → Interval → 10 min / batch, Batch size = 50 |
| Dispatch 200 records at 09:00 every day | Schedule or Events, Burst |
| Spread 300 arrivals from 09:00 to 11:00 | Schedule, Start 9, End 11, Qty 300, Spread |
| Ticket surge every Monday morning | Events, Repeat Weekly, Monday |

Rate controls total volume per unit. Interval controls how often a batch arrives. Batch size mostly changes burst shape in Rate mode, but directly changes total volume in Interval mode.

Initial capacity estimate:

$$
resources\approx\frac{arrivalRate\times averageProcessingTime}{targetUtilization}
$$

Example: 30 items/hour and 6 minutes each creates 180 minutes of work per hour. With a target utilization of 80%, required resources are about `180 / 60 / 0.8 = 3.75`, so start with Capacity = 4.

---

### 14. Bottleneck diagnosis workflow

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Queue keeps growing and Resource Util. is near 100% | Insufficient capacity | Add Capacity or reduce processing time |
| Queue grows but Util. is low | Closed calendar, override, routing issue | Check Business Hours, Calendar Override, Routing |
| Created is high but Finished is low | Middle bottleneck or no valid exit | Inspect Real-time Step Load and Connections |
| Errors are high | High Failure Probability or Failure Factor | Reduce failure rate or add rework path |
| Cancelled is high | Long waits, high cancellation, or off-hours reject | Check Cancellation and Non-working arrivals |

For SLA, focus on P90 Calendar. For internal improvement, focus on Queue Wait (Working), Resource Util., and Oldest Queue. If Calendar Wait is much larger than Working Wait, off-hours time is probably the main driver.

---

### 15. Troubleshooting checklist

| Problem | Check first |
| --- | --- |
| No items are created | Start arrival rate, connections, Business Hours reject policy |
| Items stop at one step | Capacity, working time, downstream connection |
| Queue grows without bound | Arrival volume exceeds capacity, or Demand Peaks stack too high |
| Wait time looks too large | Calendar Time may include nights/weekends |
| Working Wait is 0 but Calendar Wait is high | Most waiting happened outside working hours |
| Explicit teams cannot be saved | Team resources must sum to Capacity; names must be unique |
| Connections disappear after import | Import sanitization removes invalid targets, self-links, and invalid steps |

---

### 16. Collaboration and maintenance tips

- Export JSON before important experiments.
- Change one major variable at a time.
- Compare scenarios using the same Auto Pause condition.
- Reset before exporting a model for sharing.
- AI-generated scenarios are useful drafts, but Connections, Capacity, Processing Duration, and Business Hours still need human review.
