# FlowSim 排障指南

语言：简体中文  
更新：2026-06-07

## 1. 文档打不开或语言不对

| 现象 | 检查 | 修复 |
| --- | --- | --- |
| Docs 首页打不开 | 路径是否为 `/docs/index.html` | 文档应放在 `public/docs/` 下 |
| Markdown 打不开 | 文件是否在 `guide/` 或 `technical/` | 检查 `constants/documents.ts` 的路径 |
| 语言切换无效 | 是否配置 alternates | 为 zh-TW、zh-CN、en 都添加文件 |
| 相对链接跳错 | 链接是否相对当前 Markdown | 使用 `../technical/file.md` 或同目录文件名 |

---

## 2. 模拟不产生 item

| 可能原因 | 检查点 | 修复 |
| --- | --- | --- |
| Start 未配置 | Arrival Model、Rate / Interval、Batch size | 设置正数到达率或间隔 |
| 非工作时间被拒绝 | Business Hours + Non-working arrivals | 改为 queue / delay 或调整工作时间 |
| Schedule / Events 不在当前日期 | Calendar start、Weekdays、Months、date range | 调整日期过滤或 Stop Date |
| Demand Peaks 误设为 0 | 全局或 Start 内部倍率 | 改为大于 0 的 multiplier |
| 没有连接到 Process | Connections | 设置下游和 Probability |

---

## 3. item 排队但不处理

| 可能原因 | 检查点 | 修复 |
| --- | --- | --- |
| 当前关门 | Business Time Open / Closed | 调整 Working days / hours |
| Process 自定义日历关闭 | Calendar Override | 改为 Inherit 或修正自定义时段 |
| Capacity 为 0 或太低 | Process Basic | 设置合理 Capacity |
| Team 配置不合法 | Explicit teams 总人数 | 总人数必须等于 Capacity |
| Execution Mode 限制并发 | Team size、Max concurrent | 增加并发或减少团队人数 |

---

## 4. 队列越来越长

| 现象 | 可能原因 | 行动 |
| --- | --- | --- |
| Queue 长且 Util. 高 | 资源忙不过来 | 增加 Capacity、缩短处理时间、减少返工 |
| Queue 长但 Util. 低 | 关闭、连接或日历问题 | 检查 Business Hours、Calendar Override、Connections |
| P90 上升很快 | 高峰或复杂 item | 检查 Demand Peaks、Item Mix、Range |
| 返工后堵塞 | 回路概率过高 | 检查 Connections 概率和 Failure |

---

## 5. Connections 警告或流程断开

| 问题 | 修复 |
| --- | --- |
| 出口概率合计不是 1.0 | 调整每条 Probability，常规流程合计 1.0 |
| End 没有上游 | 从最后一个 Process 连接到 End |
| Process 没有出口 | 添加下游 Process 或 End |
| 返工概率太高 | 降低返工概率或增加返工步骤 Capacity |
| 粘贴后连接不对 | 检查复制范围；系统只会重建内部连接和有效目标 |

---

## 6. 指标看起来异常

| 现象 | 解读 | 下一步 |
| --- | --- | --- |
| Calendar Wait 特别高 | 可能包含夜晚、周末、午休 | 切到 Both，对比 Working Wait |
| Working Wait 高 | 工作时间内真的排队 | 查 Capacity、处理时间、返工、高峰 |
| Diagnostic Working Wait 高 | 某个步骤可能堵 | 看 Step queue 和 Util. |
| Avg 低但 P90 高 | 少数 item 等很久 | 查复杂 item、返工、波动 |
| Finished 太少 | 样本不足 | 延长 Auto Pause 或加快时间压缩 |

---

## 7. Import / Export / Draft

| 现象 | 修复 |
| --- | --- |
| 导入后当前流程被覆盖 | 这是预期行为；导入前先 Export 备份 |
| 导入失败 | 确认 JSON 来自 FlowSim，格式未被手动破坏 |
| 草稿不是最新 | 浏览器 localStorage 可能被清理；使用 Export 做长期备份 |
| 复制粘贴后 ID 变化 | 预期行为，系统会重建 ID 避免冲突 |

---

## 8. AI 功能

| 问题 | 检查 |
| --- | --- |
| Generate Scenario 不可用 | 是否选择 API Key |
| 生成流程不符合业务 | AI 是草稿，需要人工检查 Capacity、Connections、时间 |
| Analyze Bottlenecks 结果空泛 | 模拟样本不足，先跑到有足够 Finished item |
| 建议与指标不一致 | 以 StatsBoard 和业务知识为准，AI 只做辅助解释 |

---

## 9. 快速定位流程

1. 没有 item：先查 Start。
2. 有 item 不动：查 Business Hours 和 Process Capacity。
3. 有队列：查 Resource Util.。
4. Util. 高：资源或处理时间问题。
5. Util. 低：日历、连接或模式问题。
6. 指标高：切 Both，区分 Calendar 与 Working。
7. 报告前：确认 Auto Pause 边界和样本量。