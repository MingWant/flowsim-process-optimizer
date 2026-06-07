# UI 更新总结 - 双等待时间指标显示

## 更新日期
2026-06-06

## 更新概述

成功在 UI 中实现了双等待时间指标的显示，用户现在可以同时看到**日历等待时间**和**工作等待时间**两个指标。

## 更新的组件

### 1. StatsBoard.tsx

#### 更新位置 1：顶部说明文字
**文件位置**：[components/StatsBoard.tsx:367-369](components/StatsBoard.tsx#L367-L369)

**更新内容**：
```tsx
<span className="font-semibold text-amber-200">Queue Wait (Calendar)</span> 
includes non-working hours for SLA tracking. 

<span className="font-semibold text-yellow-200">Queue Wait (Working)</span> 
excludes non-working hours for internal efficiency analysis.
```

**效果**：用户在查看统计面板时，立即了解两种等待时间的区别。

#### 更新位置 2：Flow Metrics 卡片
**文件位置**：[components/StatsBoard.tsx:351-352](components/StatsBoard.tsx#L351-L352)

**更新内容**：
```tsx
{ label: 'Queue Wait (Calendar)', value: flow.avgWaitTimeLabel, 
  suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-amber-300', 
  icon: <PauseCircle size={18} className="text-amber-300" /> },

{ label: 'Queue Wait (Working)', value: flow.avgWorkingWaitTimeLabel, 
  suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-yellow-300', 
  icon: <Clock3 size={18} className="text-yellow-300" /> },
```

**效果**：在详细指标卡片中显示两个等待时间指标。

#### 更新位置 3：Flow 摘要卡片
**文件位置**：[components/StatsBoard.tsx:548-563](components/StatsBoard.tsx#L548-L563)

**更新内容**：
```tsx
<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
    Calendar Wait
  </div>
  <div className="mt-1 font-mono text-sm text-amber-300">
    {formatDurationValue(flow.avgWaitTime, cycleTimeUnit)} 
    <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
  </div>
  <div className="mt-1 text-[9px] text-slate-500">Includes non-working hours</div>
</div>

<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
    Working Wait
  </div>
  <div className="mt-1 font-mono text-sm text-yellow-300">
    {formatDurationValue(flow.avgWorkingWaitTime, cycleTimeUnit)} 
    <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
  </div>
  <div className="mt-1 text-[9px] text-slate-500">Queue efficiency metric</div>
</div>
```

**效果**：在 Flow 摘要视图中并排显示两个指标，并附带说明文字。

## UI 显示效果

### 详细指标卡片视图
```
┌──────────────────────────────────────┐
│ Queue Wait (Calendar)                │
│ 🟡 18.5 hours                        │
│                                      │
│ Includes non-working hours          │
│ Use for: SLA, Customer Response     │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Queue Wait (Working)                 │
│ 🟡 2.3 hours                         │
│                                      │
│ Queue efficiency metric             │
│ Use for: Internal Optimization     │
└──────────────────────────────────────┘
```

### 摘要卡片视图
```
┌────────────────┬────────────────┐
│ Calendar Wait  │ Working Wait   │
├────────────────┼────────────────┤
│ 18.5 hours     │ 2.3 hours      │
│ (w/ non-work)  │ (queue only)   │
└────────────────┴────────────────┘
```

## 颜色编码

- **日历等待时间（Calendar Wait）**：`text-amber-300` 🟡 琥珀色
  - 视觉关联：提醒用户这是包含非工作时间的完整等待
  
- **工作等待时间（Working Wait）**：`text-yellow-300` 🟡 黄色
  - 视觉关联：更明亮的黄色，强调这是"纯"队列等待

## 数据流

### 从后端到前端的数据流

```
1. WorkItem 计算
   ├─ totalWaitTime (日历时间)
   └─ totalWorkingWaitTime (工作时间)

2. StepCounter 聚合
   ├─ totalWaitTime += item.totalWaitTime
   └─ totalWorkingWaitTime += item.totalWorkingWaitTime

3. StepStats 平均值
   ├─ avgWaitTime = totalWaitTime / totalStarted
   └─ avgWorkingWaitTime = totalWorkingWaitTime / totalStarted

4. Flow Metrics 计算
   ├─ flow.avgWaitTime (从 stepStats 聚合)
   └─ flow.avgWorkingWaitTime (从 stepStats 聚合)

5. UI 格式化显示
   ├─ avgWaitTimeLabel = formatDurationValue(avgWaitTime)
   └─ avgWorkingWaitTimeLabel = formatDurationValue(avgWorkingWaitTime)
```

## 用户使用指南

### 场景 1：评估客户体验
**关注指标**：Queue Wait (Calendar)

```
如果 Calendar Wait = 64 小时
→ 客户等了整个周末
→ 可能需要考虑周末值班或调整 SLA
```

### 场景 2：优化队列效率
**关注指标**：Queue Wait (Working)

```
如果 Working Wait = 0.5 小时
→ 队列处理非常高效
→ 不需要增加资源
```

### 场景 3：容量规划决策
**对比两个指标**：

```
Calendar Wait = 20 小时
Working Wait = 2 小时

差值 = 18 小时 = 非工作时间占用

决策：
- 如果差值很大 → 主要是非工作时间导致
  → 考虑扩展工作时间而非增加资源
  
- 如果差值很小 → 主要是队列积压
  → 需要增加处理资源
```

## 技术细节

### 类型定义
```typescript
// types.ts
interface WorkItem {
  totalWaitTime: number;         // 日历等待时间
  totalWorkingWaitTime: number;  // 工作等待时间
}

interface StepStats {
  avgWaitTime: number;           // 平均日历等待时间
  avgWorkingWaitTime: number;    // 平均工作等待时间
}
```

### 计算逻辑
```typescript
// useProcessSimulation.ts - beginProcessing()
const calendarWaitTime = processingStartMs - queuedAtMs;
const workingWaitTime = getWorkingDurationBetween(
  stepCalendar, 
  calendarStartIso, 
  queuedAtMs, 
  processingStartMs
);

item.totalWaitTime += calendarWaitTime;
item.totalWorkingWaitTime += workingWaitTime;
```

### 显示格式化
```typescript
// StatsBoard.tsx
avgWaitTimeLabel: formatDurationValue(flow.avgWaitTime, cycleTimeUnit)
avgWorkingWaitTimeLabel: formatDurationValue(flow.avgWorkingWaitTime, cycleTimeUnit)
```

## 验证测试

### 构建状态
✅ **通过** - `npm run build` 成功
- 输出文件大小：893.74 kB（压缩后 251.68 kB）
- 无编译错误
- 无类型错误

### 预期的 UI 行为

1. **页面加载**：
   - 顶部说明清楚解释两种指标
   - 两种等待时间指标并排显示

2. **工作日模拟**：
   - 周五 17:00 入队 → 周一 9:00 处理
   - Calendar Wait ≈ 64 小时
   - Working Wait ≈ 0 小时

3. **工作时间内模拟**：
   - 周一 9:00 入队 → 周一 9:30 处理
   - Calendar Wait = 30 分钟
   - Working Wait = 30 分钟
   - 两者相同 ✅

## 向后兼容性

✅ **完全兼容**
- 现有数据会自动初始化 `totalWorkingWaitTime = 0`
- 不会破坏现有功能
- 用户可以继续使用原有的 avgWaitTime

## 相关文档

- [dual-wait-time-metrics.zh-CN.md](../technical/dual-wait-time-metrics.zh-CN.md) - 双指标详细说明
- [multi-segment-business-hours.zh-CN.md](../technical/multi-segment-business-hours.zh-CN.md) - 工作日历与多段工作时间说明
- [wait-time-mode-configuration.zh-CN.md](../guide/wait-time-mode-configuration.zh-CN.md) - 等待时间模式配置说明

## 后续可能的改进

1. **可视化对比**：
   - 添加饼图显示等待时间的组成
   - 日历时间 = 工作时间 + 非工作时间

2. **趋势图**：
   - 显示两种等待时间随时间的变化
   - 帮助识别瓶颈趋势

3. **警报阈值**：
   - 当 Working Wait 超过阈值时高亮显示
   - 提示需要增加资源

4. **导出报告**：
   - CSV/PDF 导出时包含两种指标
   - 便于管理层查看

## 总结

✅ 成功实现双等待时间指标的完整显示  
✅ UI 清晰标注两者区别  
✅ 构建通过，无错误  
✅ 向后兼容  
✅ 文档完善  

用户现在可以根据不同的分析需求，选择查看相应的等待时间指标，从而做出更准确的决策。
