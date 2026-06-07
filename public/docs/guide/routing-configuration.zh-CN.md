# Routing 配置与诊断指南

语言：简体中文  
更新：2026-06-07

## 1. 这个功能解决什么问题？

早期 FlowSim 的 `connections` 只使用固定概率分流，例如 50% 去 A、50% 去 B。真实流程通常不是这样：

- 会避开已经拥堵的处理站。
- VIP、急件或高优先级案件会走不同通道。
- 没有完全匹配规则时，系统仍需要安全 fallback，避免 item 卡住。

新的 Routing 功能保留原本概率模型，同时加入 **Load-aware**、**Time-aware / ETA**、**Item Profile filter**、**Priority filter** 和 **Routing Diagnostics**。

---

## 2. Routing Strategy

在节点的 **Connections / Routing** 区块，可以选择 routing strategy。

| Strategy | 行为 | 适合场景 |
| --- | --- | --- |
| `Probability` | 只按照每条 route 的 base weight 抽选 | 稳定比例分流、规则简单的流程 |
| `Load-aware` | 先保留 base weight，再根据目标节点拥堵度动态降低有效权重 | 多个服务台、共享资源池、希望自动避开拥堵节点 |
| `Time-aware / ETA` | 先保留 base weight，再偏向预计完成时间更短的 route | queue、capacity、processing time、calendar 都会影响决策的真实流程 |

### Probability

假设某节点有两条 route：

| Route | Probability |
| --- | --- |
| Team A | 0.5 |
| Team B | 0.5 |

长期来看，item 约一半去 A、一半去 B。即使 A 已经排队，仍然可能继续分到 A。

### Load-aware

Load-aware 会把每条 route 的 `probability` 视为 **base weight**，再根据目标节点负载计算 effective weight。

概念公式：

```text
effective weight = base weight / (1 + load sensitivity × congestion)
```

`congestion` 会考虑：

- 目标节点 queue 中的 item 数量
- 目标节点正在 processing 的 item 数量
- 正在传输到该节点的 inbound item
- 目标节点 capacity

`Load sensitivity` 越高，越强烈避开拥堵目标；设为 0 时接近纯 base weight。

### Time-aware / ETA

Time-aware 会把每条 route 的 `probability` 视为 **base weight**，再估算目标 route 的完成时间。

估算会包含：

- 目标节点已排队的工作量
- 目标节点正在处理的剩余工作量
- 正在传输到该目标的 inbound item
- 目标节点 capacity 与 resource mode
- 预期 processing time，包含 item profile processing multiplier
- 可选的目标 business hours calendar delay

概念公式：

```text
effective weight = base weight / (1 + ETA sensitivity × relative delay)
```

`ETA sensitivity` 越高，越偏向预计最快完成的 route；设为 0 时接近 base weight。启用 **Calendar-aware ETA** 时，如果目标节点当前非工作时间，或工作时段较短，该 route 会变得不那么有吸引力。

---

## 3. Route Filters

每条 connection 都可以额外限制哪些 item 可以走该 route。

| Filter | 说明 | 例子 |
| --- | --- | --- |
| Item Profiles | 只允许特定 Start node profile | VIP 走 Fast Lane，Standard 走普通队列 |
| Min Priority | 只允许 priority 大于等于指定值 | priority >= 5 才能走紧急通道 |
| Max Priority | 只允许 priority 小于等于指定值 | priority <= 3 走标准处理 |

Filter 可以一起使用。若同一条 route 设置了 profile 和 priority，item 需要同时符合两者。

---

## 4. Fallback 逻辑

FlowSim 会避免因为规则过严导致 item 没路可走。每次 routing 时会依次尝试：

1. **符合 filter 的 route**
2. **没有任何 filter 的 route**
3. **所有有效 route**
4. 若仍无有效 route，item 结束于 `finished`

因此建议：

- 对特殊 route 加 filter，例如 VIP Fast Lane。
- 保留至少一条无 filter 的 route 作为普通 fallback。
- 用 Routing Diagnostics 观察 fallback 是否过多。

---

## 5. Routing Demo Walkthrough

工具栏的 **Routing Demo** 会载入一个示例：

```text
Customer Demand Mix
├─ Standard → Standard Intake Router → General Team A / General Team B → Quality Check → End
└─ VIP      → VIP Intake Gate         → VIP Fast Lane                 → Quality Check → End
```

示例重点：

| 设计 | 观察方式 |
| --- | --- |
| Start node 产生 Standard 与 VIP item profiles | 在 Start node 的 profile 设置中查看比例与 priority |
| VIP route 使用 profile / priority filter | VIP item 会走 VIP Intake Gate 和 VIP Fast Lane |
| Standard Intake Router 使用 Time-aware / ETA | Team A 下午才开始工作，因此 calendar-aware ETA 可能在早上偏向 Team B |
| VIP Intake Gate 使用 Load-aware | VIP 优先走 VIP Fast Lane，但必要时可使用 overflow route |
| Routing Diagnostics 显示实际分流 | 观察 Actual Share、Effective、Congestion、Fallback |

建议操作：

1. 点击 **Routing Demo**。
2. 点击 **Start**。
3. 等待数十秒模拟时间。
4. 观察 map connection badge。
5. 查看下方 **Routing Diagnostics** 表格。
6. 修改 General Team A capacity、processing time 或 business hours，再比较 route share 与 ETA。

---

## 6. 如何解读 Routing Diagnostics

| 字段 | 含义 |
| --- | --- |
| Selected | 该 route 实际被选中的次数 |
| Actual Share | 同一来源节点中，此 route 实际占比 |
| Base | 用户设置的 base probability / weight |
| Effective | 动态调整后的即时有效占比 |
| ETA | Time-aware route 最近估算的 queue + processing + calendar time |
| Congestion | 目标节点当前的拥堵程度估计 |
| Fallback | 有多少次是因为 filter fallback 被选中 |
| Profile Hits | 选中时符合 profile filter 的次数 |
| Priority Hits | 选中时符合 priority filter 的次数 |
| Mode | 该 route 最近一次决策使用 Probability、Load-aware 或 Time-aware |

判读口诀：

- **Base ≠ Actual Share**：正常，因为随机波动、filter 或 load-aware 会影响结果。
- **Effective 低于 Base**：代表目标可能比较拥堵。
- **ETA calendar delay 很高**：目标 calendar 可能关闭或工作时段有限。
- **Fallback 很高**：代表 filter 可能太严或缺少普通 fallback route。
- **Congestion 长期偏高**：代表目标节点 capacity 不足或 processing time 太长。

---

## 7. 建模建议

| 目的 | 建议配置 |
| --- | --- |
| 固定比例分配 | 使用 `Probability`，确保总 weight 接近 100% |
| 平衡多个服务台 | 使用 `Load-aware`，sensitivity 从 1-4 开始 |
| 选择真实最快通道 | 使用 `Time-aware / ETA`，sensitivity 从 2-5 开始，并启用 Calendar-aware ETA |
| VIP / 急件优先 | 用 item profile 或 min priority 建立专用 route |
| 避免 item 卡住 | 保留至少一条无 filter route |
| 找 routing 规则问题 | 跑模拟后查看 Routing Diagnostics 的 Fallback 和 Actual Share |

---

## 8. 常见问题

### Q: Load-aware 会完全选择最短队列吗？

不会。FlowSim 仍采用 weighted random，只是降低拥堵目标的权重。这比永远选最短队列更稳定，可避免所有 item 同时涌向同一个刚变空的节点。

### Q: Probability 加起来一定要等于 1 吗？

建议接近 1，但不强制。模拟时会将有效候选 route 归一化。

### Q: 为什么 VIP 没走 VIP lane？

请检查：

1. Start node 是否真的产生 VIP profile。
2. VIP route 的 `itemProfileIds` 是否包含正确 profile id。
3. priority filter 是否过高。
4. 是否因 route target 被删除或未连接。

### Q: Fallback 为什么出现？

代表第一次找不到符合 filter 的 route。这不一定是错误；可能是系统使用普通 route 作为安全出口。但如果 fallback 很高，建议检查 filter 规则。
