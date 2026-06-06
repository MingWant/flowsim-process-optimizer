# Dual Wait Time Metrics Implementation

## 概述

系统现在提供**两种等待时间指标**，分别用于不同的分析场景：

### 1. `avgWaitTime` - 日历等待时间（Calendar Wait Time）
**定义**：从任务入队到开始处理的完整日历时间（包含非工作时间）

**用途**：
- 📊 客户体验分析
- ⏰ SLA / 响应时间监控
- 📈 对外报告和承诺

**示例**：
```
周五 17:00 入队 → 周一 9:00 开始处理
avgWaitTime = 64 小时
```

### 2. `avgWorkingWaitTime` - 工作等待时间（Working Wait Time）
**定义**：任务在工作时间内实际等待的时长（排除非工作时间）

**用途**：
- 🔧 内部运营效率分析
- 📉 队列积压监控
- 💡 容量规划和资源优化
- 📊 不同工作时间配置的公平对比

**示例**：
```
周五 17:00 入队 → 周一 9:00 开始处理
avgWorkingWaitTime = 0 小时（周末不算等待）

周五 16:50 入队 → 周五 17:00 下班 → 周一 9:00 处理
avgWorkingWaitTime = 10 分钟（只算周五下班前的等待）
```

## 数据结构

### WorkItem
```typescript
interface WorkItem {
  // ...
  totalWaitTime: number;         // 累计日历等待时间
  totalWorkingWaitTime: number;  // 累计工作等待时间
  // ...
}
```

### StepStats
```typescript
interface StepStats {
  // ...
  avgWaitTime: number;           // 平均日历等待时间
  avgWorkingWaitTime: number;    // 平均工作等待时间
  // ...
}
```

## 计算逻辑

### 在 `beginProcessing` 中计算

```typescript
// 1. 日历等待时间（简单减法）
const calendarWaitTime = processingStartMs - queuedAtMs;

// 2. 工作等待时间（使用工作日历函数）
const workingWaitTime = getWorkingDurationBetween(
  stepCalendar,
  calendarStartIso,
  queuedAtMs,
  processingStartMs
);

// 同时记录两个指标
item.totalWaitTime += calendarWaitTime;
item.totalWorkingWaitTime += workingWaitTime;
```

## 使用场景

### 场景 1：客户 SLA 报告

**需求**：承诺"24小时内响应"

**使用指标**：`avgWaitTime`（日历时间）

**原因**：客户不关心你的工作时间，他们只知道等了多久

```typescript
// 检查是否违反 SLA
const SLA_HOURS = 24;
if (avgWaitTime / (60 * 60 * 1000) > SLA_HOURS) {
  alert('SLA violation!');
}
```

### 场景 2：队列效率分析

**需求**：评估队列处理是否高效

**使用指标**：`avgWorkingWaitTime`（工作时间）

**原因**：排除非工作时间的"虚假等待"

```typescript
// 分析队列效率
console.log(`平均队列等待：${avgWorkingWaitTime / (60 * 1000)} 分钟`);
console.log(`其中非工作时间：${(avgWaitTime - avgWorkingWaitTime) / (60 * 60 * 1000)} 小时`);
```

### 场景 3：容量规划

**需求**：决定是否需要增加资源

**使用指标**：`avgWorkingWaitTime`（工作时间）

**原因**：只有工作时间的等待才能通过增加资源解决

```typescript
const TARGET_WAIT_MINUTES = 30;
const actualWaitMinutes = avgWorkingWaitTime / (60 * 1000);

if (actualWaitMinutes > TARGET_WAIT_MINUTES) {
  const increase = Math.ceil(actualWaitMinutes / TARGET_WAIT_MINUTES);
  console.log(`建议增加 ${increase}x 资源`);
}
```

### 场景 4：配置对比

**需求**：比较不同工作时间配置的效率

**使用指标**：`avgWorkingWaitTime`（工作时间）

**原因**：公平对比，不受工作时间设置影响

```typescript
// 配置 A：24/7 运营
const configA_workingWait = 2; // 小时

// 配置 B：工作日 9-17
const configB_workingWait = 2; // 小时
const configB_calendarWait = 20; // 小时（包含夜间和周末）

// 结论：两个配置的队列效率相同
// 如果只看 calendarWait，会误以为配置 B 差很多
```

## UI 显示建议

### 选项 1：并排显示（推荐）

```
┌─────────────────────────────────┐
│ 平均等待时间                    │
├─────────────────────────────────┤
│ 日历时间：18.5 小时             │
│ 工作时间：2.3 小时              │
│                                 │
│ ℹ️ 日历时间包含非工作时间       │
└─────────────────────────────────┘
```

### 选项 2：带提示图标

```
平均等待时间：18.5 小时
  工作时间：2.3 小时
  
📅 包含周末和夜间
⏱️ 实际队列等待
```

### 选项 3：交互式切换

```
平均等待时间：[18.5 小时 ▼]
              ┌─────────────────┐
              │ 日历时间：18.5h │
              │ 工作时间：2.3h  │
              └─────────────────┘
```

### 选项 4：仪表盘分栏

```
┌──────────────┬──────────────┐
│  客户视角    │  内部视角    │
├──────────────┼──────────────┤
│ 响应时间     │ 队列效率     │
│ 18.5 小时    │ 2.3 小时     │
│              │              │
│ avgWaitTime  │ avgWorking.. │
└──────────────┴──────────────┘
```

## 实际案例分析

### 案例 1：周五下午高峰

```
时间轴：
周五 16:00 - 大量任务涌入
周五 17:00 - 下班，队列积压 50 个任务
周一 09:00 - 开始处理队列

指标：
avgWaitTime = 65 小时
avgWorkingWaitTime = 1 小时

解读：
- 客户视角：等了快3天 ❌
- 运营视角：队列效率正常，只积压1小时工作量 ✅
- 决策：不需要增加资源，但可以考虑周末值班以提升客户体验
```

### 案例 2：工作日内积压

```
时间轴：
周一 09:00 - 任务入队
周一 17:00 - 下班，仍未处理
周二 09:00 - 开始处理
周二 17:00 - 完成

指标：
avgWaitTime = 32 小时
avgWorkingWaitTime = 8 小时

解读：
- 客户视角：等了1天多 ⚠️
- 运营视角：队列积压严重，等了一整个工作日 ❌
- 决策：需要增加处理资源
```

### 案例 3：高效队列（有工作时间限制）

```
时间轴：
周五 16:55 - 任务入队
周五 17:00 - 下班
周一 09:00 - 立即开始处理

指标：
avgWaitTime = 64 小时
avgWorkingWaitTime = 0 小时

解读：
- 客户视角：等了整个周末 ⚠️
- 运营视角：队列完全高效，无积压 ✅
- 决策：队列管理优秀，如需改善客户体验可考虑扩展工作时间
```

## 性能考虑

### `avgWaitTime` 计算成本
```typescript
// O(1) - 简单减法
const calendarWaitTime = endMs - startMs;
```

### `avgWorkingWaitTime` 计算成本
```typescript
// O(days) - 需要遍历日历
const workingWaitTime = getWorkingDurationBetween(...);
```

**影响**：
- 每个任务开始处理时调用一次
- 对于典型场景（跨越1-7天），性能影响可忽略
- 如果担心性能，可以考虑采样计算（只计算部分任务）

## 向后兼容性

✅ **完全兼容** - 现有代码继续工作

- `avgWaitTime` 保持原有行为
- `avgWorkingWaitTime` 是新增字段，默认值为 0
- 旧数据自动初始化为 0

## 测试建议

### 测试用例 1：周末跨越
```typescript
test('weekend wait time calculation', () => {
  // 周五 17:00 入队
  const queuedAt = getFridayAt17();
  // 周一 9:00 开始
  const startAt = getMondayAt9();
  
  expect(calendarWaitTime).toBe(64 * HOUR_MS);
  expect(workingWaitTime).toBe(0);
});
```

### 测试用例 2：工作日内等待
```typescript
test('weekday wait time calculation', () => {
  // 周一 10:00 入队
  const queuedAt = getMondayAt10();
  // 周一 15:00 开始
  const startAt = getMondayAt15();
  
  expect(calendarWaitTime).toBe(5 * HOUR_MS);
  expect(workingWaitTime).toBe(5 * HOUR_MS);
});
```

### 测试用例 3：跨工作日
```typescript
test('cross-day wait time calculation', () => {
  // 周一 16:00 入队
  const queuedAt = getMondayAt16();
  // 周二 10:00 开始
  const startAt = getTuesdayAt10();
  
  expect(calendarWaitTime).toBe(18 * HOUR_MS);
  expect(workingWaitTime).toBe(2 * HOUR_MS); // 周一1h + 周二1h
});
```

## 总结

✅ **双指标系统的优势**：
1. **全面性**：同时提供客户视角和运营视角
2. **灵活性**：根据场景选择合适的指标
3. **准确性**：避免被非工作时间误导
4. **兼容性**：保持现有功能不受影响

📊 **使用建议**：
- 对外报告 → 使用 `avgWaitTime`
- 内部优化 → 使用 `avgWorkingWaitTime`
- 完整分析 → 同时查看两个指标

🎯 **关键洞察**：
```
avgWaitTime - avgWorkingWaitTime = 非工作时间占用

这个差值告诉你：
- 如果很大 → 客户体验受非工作时间影响严重
- 如果很小 → 队列积压是主要问题，需要增加资源
```
