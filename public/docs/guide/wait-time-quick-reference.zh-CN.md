# 等待时间模式快速参考

语言：简体中文  
更新：2026-06-07

## 1. 五分钟决策表

| 你要回答的问题 | 选择模式 | 重点看 |
| --- | --- | --- |
| 客户到底等了多久？ | Calendar Time | Queue Wait、Avg Calendar、P90 |
| 工作时间内是否真的堵？ | Working Time | Queue Wait、Resource Util.、Throughput |
| 第一次分析，不确定原因 | Both | Calendar vs Working 差距、Diagnostic Working Wait |
| 是否需要加人或加机器？ | Working Time | Working Wait、Capacity、Oldest Queue |
| 营业时间是否太短？ | Both | Calendar Wait - Working Wait、Non-working Delay |
| 哪个步骤是瓶颈？ | Both | Diagnostic Working Wait、Step Utilization |

---

## 2. 三个模式一句话

- **Both**：最完整，适合诊断和解释差异。
- **Calendar Time**：客户视角，包含夜晚和周末。
- **Working Time**：运营视角，只看工作时间内排队。

设置位置：Sidebar → Simulation Settings → **Wait Time Calculation**。

---

## 3. 快速例子

周五 17:00 入队，周一 09:00 开始处理：

| 指标 | 结果 | 解读 |
| --- | --- | --- |
| Calendar Wait | 约 64 小时 | 客户实际等待了整个周末 |
| Working Wait | 可能 0 小时 | 工作时间内没有真正排队 |
| Diagnostic Working Wait | 看步骤平均 | 用于找哪个 Process 可能堵 |

结论：如果只有 Calendar 高，不一定要加人；可能需要调整营业时间、SLA 说明或非工作时间到达策略。

---

## 4. 读数口诀

| 现象 | 口诀 | 行动 |
| --- | --- | --- |
| Calendar 高、Working 低 | 关门造成等待 | 看 Business Hours |
| Calendar 高、Working 高 | 开门也堵 | 看 Capacity 和处理时间 |
| P90 远高于 Avg | 尾部有问题 | 看复杂 item、高峰、返工 |
| Util. 高、Queue 长 | 资源忙不过来 | 加资源或缩短处理时间 |
| Util. 低、Queue 长 | 可能没开门或连接错 | 看日历、连接、Override |

---

## 5. 最小操作流程

1. 先选择 **Both**。
2. 运行到有足够 Finished item。
3. 观察 Calendar Wait 与 Working Wait。
4. 看 P90 是否明显高于 Avg。
5. 看哪个 Process 的 Diagnostic Working Wait 和 Resource Util. 高。
6. 根据用途切换模式输出报告。

---

## 6. 常见选择

- 客户报告：Calendar Time。
- 内部排班：Working Time。
- 管理层复盘：Both。
- 配置比较：Both 或 Working Time。
- 快速排障：Both。