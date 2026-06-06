# Working Hours Logic Fixes

## 修复日期
2026-06-06

## 修复的问题

### 1. 边界一致性问题
**问题描述**：工作时间段的边界定义在不同函数中不一致，可能导致边缘情况下的计算错误。

**修复内容**：
- 统一了所有函数中的边界定义：工作时间段 `[start, end)` 使用左闭右开区间
- 例如：`[9, 17)` 表示 9:00:00.000 到 16:59:59.999
- 17:00:00.000 **不算**工作时间，需要等到下一个工作日的开始

**受影响的函数**：
- `isWorkingTime()` - 添加了边界说明注释
- `getNextWorkingSimulationTime()` - 添加了边界处理注释
- `addWorkingDuration()` - 增强了边界条件检查和注释
- `getWorkingDurationBetween()` - 添加了区间说明注释

### 2. 等待时间计算说明
**问题描述**：`avgWaitTime` 包含了非工作时间（如周末），但没有明确说明这是预期行为。

**修复内容**：
- 在 `beginProcessing()` 函数中添加了详细注释
- 明确说明：等待时间包含**日历时间**（包括非工作时间）
- 如果需要只计算工作时间内的等待，可以使用 `getWorkingDurationBetween()`

**代码位置**：
- `hooks/useProcessSimulation.ts:876-905`

### 3. 边缘情况处理
**问题描述**：当事件恰好发生在工作时间段边界时，可能出现不一致。

**修复内容**：
- `addWorkingDuration()` 中增强了 `cursorMs === windowEndMs` 的处理
- 添加了双重检查，确保不会在边界处出错
- 改进了注释，说明了返回值的含义

## 技术细节

### 边界定义
所有工作时间相关的函数现在统一使用以下约定：
- 工作时间段使用左闭右开区间 `[start, end)`
- `start` 时刻**包含**在工作时间内
- `end` 时刻**不包含**在工作时间内
- 这与常见的编程习惯一致（如数组索引 `[0, length)`）

### 示例
```typescript
// 工作时间：9:00 - 17:00
const calendar = {
  enabled: true,
  daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
  workingHours: [{ start: 9, end: 17 }]
};

// 9:00:00.000 - 是工作时间
isWorkingTime(calendar, iso, timeAt9AM); // true

// 16:59:59.999 - 是工作时间
isWorkingTime(calendar, iso, timeAt1659PM); // true

// 17:00:00.000 - 不是工作时间
isWorkingTime(calendar, iso, timeAt5PM); // false
```

### 等待时间语义
```typescript
// 场景：周五 17:00 入队，周一 9:00 开始处理
// waitTime = 周一 9:00 - 周五 17:00 = 64 小时（包括整个周末）

// 如果需要只计算工作时间的等待：
const workingWaitTime = getWorkingDurationBetween(
  calendar, 
  calendarStartIso, 
  queuedAtSimulationMs, 
  processingStartSimulationMs
);
// workingWaitTime = 0（没有工作时间被浪费在等待上）
```

## 影响范围

### 向后兼容性
✅ **完全兼容** - 这些修复只是：
1. 澄清了现有行为
2. 增强了边缘情况的鲁棒性
3. 没有改变核心逻辑

### 性能影响
✅ **无性能影响** - 只是增加了注释和边界检查，没有增加计算复杂度

### 数据影响
✅ **无数据迁移** - 不需要修改任何保存的配置或数据

## 测试建议

建议测试以下场景：

1. **边界时刻测试**
   - 任务在工作日结束时刻（17:00:00.000）完成
   - 任务在工作日开始时刻（9:00:00.000）开始
   - 跨越多个工作时间段（如：上午 9-12，下午 14-17）

2. **周末跨越测试**
   - 周五晚上入队的任务
   - 周一早上开始处理
   - 验证等待时间计算

3. **多时间段测试**
   - 配置多个工作时间段（如：早班 6-14，晚班 18-2）
   - 验证跨越多个段的处理时间计算

4. **非工作日到达测试**
   - `nonWorkingArrivalPolicy: 'queue'`
   - `nonWorkingArrivalPolicy: 'delay'`
   - `nonWorkingArrivalPolicy: 'reject'`

## 相关文件

- `services/simulationCalendar.ts` - 核心日历计算函数
- `hooks/useProcessSimulation.ts` - 模拟主循环
- `types.ts` - 类型定义

## 注意事项

⚠️ 如果你需要修改边界定义（例如，让 `end` 时刻包含在工作时间内），需要同步修改：
1. `isWorkingTime()` - 改为 `hour <= segment.end`
2. `getNextWorkingSimulationTime()` - 改为 `candidateMs <= workEnd`
3. `addWorkingDuration()` - 改为 `cursorMs > windowEndMs`
4. `getWorkingDurationBetween()` - 改为 `overlapEndMs >= overlapStartMs`

建议：保持当前的左闭右开约定，因为这是编程中的常见习惯。
