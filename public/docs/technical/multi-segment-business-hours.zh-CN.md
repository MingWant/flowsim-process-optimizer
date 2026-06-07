# 多段工作时间指南

语言：简体中文  
更新：2026-06-07

## 1. 目的

Business Hours 用来描述系统什么时候可以处理 item。多段工作时间允许一天内设置多个开放时段，例如 `09:00-12:00` 和 `13:00-18:00`，适合午休、分班、门店营业、客服轮班和跨部门日历。

---

## 2. 核心设置

| 设置 | 含义 | 例子 |
| --- | --- | --- |
| Enabled | 是否启用工作日历 | 开启后非工作时间会影响处理 |
| Calendar start | 模拟第 0 毫秒对应的日期时间 | 2026-01-05 09:00 |
| Working days | 哪些星期工作 | 周一到周五 |
| Working hours | 每天一个或多个时段 | 9-12、13-18 |
| Non-working arrivals | 非工作时间到达策略 | queue、delay、reject |
| Calendar Override | 单个 Start 或 Process 的自定义日历 | 线上订单 24/7，财务工作日 9-17 |

`workingDay` 时间单位固定为 8 小时，不会自动等于你设置的每日工作小时数。

---

## 3. 非工作时间到达策略

| 策略 | 行为 | 适合 |
| --- | --- | --- |
| queue | item 可以进入队列，但等开门后处理 | 客户可随时提交订单或工单 |
| delay | 到达本身被推迟到下个工作时段 | 只在开门时接收现场客户 |
| reject | 非工作时间到达不创建 item，并增加 Cancelled 计数 | 严格营业窗口、无预约不接收 |

指标影响：

- queue 会让 Calendar Wait 增加，但 Working Wait 只在工作时段累计。
- delay 会减少 off-hours 队列等待，但会改变实际进入系统的时间。
- reject 不创建非工作时间 item，并增加 Cancelled 计数。

---

## 4. 常见配置

### 办公室

| 设置 | 值 |
| --- | --- |
| Working days | Mon-Fri |
| Working hours | 09:00-12:00、13:00-18:00 |
| Non-working arrivals | queue 或 delay |

### 餐厅

| 设置 | 值 |
| --- | --- |
| Working days | All days |
| Working hours | 11:00-14:00、17:00-22:00 |
| Demand Peaks | 午餐和晚餐 x2 |

### 24/7 支持

| 设置 | 值 |
| --- | --- |
| Working days | All days |
| Working hours | 00:00-24:00 |
| Non-working arrivals | 通常无影响 |

---

## 5. 与等待时间指标的关系

| 现象 | 解读 |
| --- | --- |
| Calendar Wait 高、Working Wait 低 | 多半是关门时间导致客户等待 |
| Non-working Delay 高 | 营业时间策略对周期影响大 |
| Oldest Queue 在开门前很高 | queue 策略让 off-hours item 先排队 |
| Working Wait 高 | 开门期间资源仍处理不过来 |

建议使用 Both 模式评估营业时间方案。

---

## 6. Start / Process Calendar Override

某些步骤可能不应继承全局日历。

例：

- Start 接收线上订单 24/7。
- 仓库拣货周一到周六 8-20。
- 财务审核只在周一到周五 9-17。

此时可以为对应 Start 或 Process 设置 Calendar Override，避免全流程被单一日历误导。

---

## 7. 排查清单

| 问题 | 检查 |
| --- | --- |
| item 不处理 | 当前 Business Time 是否 Closed；Process 是否有 Calendar Override |
| 非工作时间仍有 item 进入队列 | Non-working arrivals 是否为 queue |
| 周末数据异常 | Working days 是否包含周末 |
| 午休仍在处理 | Working hours 是否正确拆成两段 |
| workingDay 与预期不符 | workingDay 固定 8 小时，是单位换算，不是日历长度 |