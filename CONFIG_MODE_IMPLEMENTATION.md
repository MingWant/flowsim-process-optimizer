# 方案 A 实现总结 - 全局配置等待时间计算模式

## ✅ 实现完成

成功实现了**方案 A：全局配置**，允许用户自定义等待时间的计算和显示方式。

## 📋 实现内容

### 1. 类型定义（types.ts）

```typescript
// 新增类型
export type WaitTimeCalculationMode = 'calendar' | 'working' | 'both';

// 更新接口
export interface SimulationConfig {
  // ... 现有字段
  waitTimeCalculationMode?: WaitTimeCalculationMode; // 默认 'both'
}
```

**位置**：[types.ts:15](types.ts#L15)

---

### 2. 设置 UI（AppSidebar.tsx）

#### 新增配置面板

**位置**：[components/AppSidebar.tsx:690-747](components/AppSidebar.tsx#L690-L747)

```tsx
<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
  <h3>Wait Time Calculation</h3>
  
  {/* 说明 */}
  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-[10px]">
    Choose how queue wait time is calculated and displayed in metrics.
  </div>
  
  {/* 三个选项按钮 */}
  <button onClick={() => setConfig({ ...config, waitTimeCalculationMode: 'both' })}>
    📊 Both (Recommended)
    Show calendar and working time for complete analysis
  </button>
  
  <button onClick={() => setConfig({ ...config, waitTimeCalculationMode: 'calendar' })}>
    📅 Calendar Time
    Include non-working hours • Best for SLA/customer view
  </button>
  
  <button onClick={() => setConfig({ ...config, waitTimeCalculationMode: 'working' })}>
    ⏱️ Working Time
    Exclude non-working hours • Best for queue efficiency
  </button>
</div>
```

**特点**：
- ✅ 清晰的图标标识
- ✅ 每个选项都有说明
- ✅ 推荐默认选项
- ✅ 高亮显示当前选中

---

### 3. StatsBoard 显示逻辑更新

#### 3.1 添加 config 参数

**位置**：[components/StatsBoard.tsx:7-14](components/StatsBoard.tsx#L7-L14)

```typescript
interface Props {
  // ... 现有字段
  config: SimulationConfig; // 新增
}
```

#### 3.2 读取配置

**位置**：[components/StatsBoard.tsx:193](components/StatsBoard.tsx#L193)

```typescript
const waitTimeMode = config.waitTimeCalculationMode || 'both';
```

#### 3.3 动态构建指标卡片

**位置**：[components/StatsBoard.tsx:344-394](components/StatsBoard.tsx#L344-L394)

```typescript
const buildFlowMetricCards = (flow) => {
  const cards = [/* 基础指标 */];
  
  // 根据配置添加等待时间卡片
  if (waitTimeMode === 'calendar' || waitTimeMode === 'both') {
    cards.push({
      label: waitTimeMode === 'both' ? 'Queue Wait (Calendar)' : 'Queue Wait',
      value: flow.avgWaitTimeLabel,
      // ...
    });
  }
  
  if (waitTimeMode === 'working' || waitTimeMode === 'both') {
    cards.push({
      label: waitTimeMode === 'both' ? 'Queue Wait (Working)' : 'Queue Wait',
      value: flow.avgWorkingWaitTimeLabel,
      // ...
    });
  }
  
  cards.push(/* 其他指标 */);
  return cards;
};
```

**逻辑**：
- `'both'` → 显示两个卡片，标签带后缀区分
- `'calendar'` → 只显示日历时间卡片，标签为 "Queue Wait"
- `'working'` → 只显示工作时间卡片，标签为 "Queue Wait"

---

### 4. App.tsx 传递配置

**位置**：[App.tsx:2080](App.tsx#L2080)

```typescript
<StatsBoard 
  globalStats={globalStats} 
  stepStats={stepStats} 
  flowStats={flowStats} 
  steps={config.steps} 
  items={items} 
  simulationTimeMs={simulationTimeMs} 
  cycleTimeUnit={metricsCycleTimeUnit} 
  config={config} // 新增
/>
```

---

## 🎨 UI 效果

### 模式 1: Both (默认)

```
┌─────────────────────────────────────┐
│ Wait Time Calculation               │
├─────────────────────────────────────┤
│ [✓ 📊 Both (Recommended)]          │
│ [ ] 📅 Calendar Time                │
│ [ ] ⏱️ Working Time                 │
└─────────────────────────────────────┘

统计面板显示：
┌────────────────┬────────────────┐
│ Queue Wait     │ Queue Wait     │
│ (Calendar)     │ (Working)      │
│ 18.5 hours     │ 2.3 hours      │
└────────────────┴────────────────┘
```

### 模式 2: Calendar Time

```
┌─────────────────────────────────────┐
│ Wait Time Calculation               │
├─────────────────────────────────────┤
│ [ ] 📊 Both (Recommended)          │
│ [✓ 📅 Calendar Time]               │
│ [ ] ⏱️ Working Time                 │
└─────────────────────────────────────┘

统计面板显示：
┌────────────────┐
│ Queue Wait     │
│ 18.5 hours     │
└────────────────┘
```

### 模式 3: Working Time

```
┌─────────────────────────────────────┐
│ Wait Time Calculation               │
├─────────────────────────────────────┤
│ [ ] 📊 Both (Recommended)          │
│ [ ] 📅 Calendar Time                │
│ [✓ ⏱️ Working Time]                │
└─────────────────────────────────────┘

统计面板显示：
┌────────────────┐
│ Queue Wait     │
│ 2.3 hours      │
└────────────────┘
```

---

## 💻 代码变更汇总

### 修改的文件

1. **types.ts**
   - 新增 `WaitTimeCalculationMode` 类型
   - `SimulationConfig` 添加 `waitTimeCalculationMode` 字段

2. **components/AppSidebar.tsx**
   - 导入 `WaitTimeCalculationMode`
   - 新增配置面板（3 个按钮）

3. **components/StatsBoard.tsx**
   - Props 添加 `config: SimulationConfig`
   - 读取 `waitTimeCalculationMode`
   - `buildFlowMetricCards` 改为函数，动态构建卡片

4. **App.tsx**
   - 传递 `config` 给 `StatsBoard`

---

## 🔄 数据流

```
1. 用户在 AppSidebar 点击模式按钮
   ↓
2. setConfig({ waitTimeCalculationMode: 'calendar' })
   ↓
3. config 状态更新
   ↓
4. App.tsx 重新渲染，传递新 config 给 StatsBoard
   ↓
5. StatsBoard 读取 waitTimeMode = 'calendar'
   ↓
6. buildFlowMetricCards 只添加 Calendar 卡片
   ↓
7. UI 显示更新后的指标
```

---

## ✅ 测试结果

### 构建状态
```bash
$ npm run build
✓ 2363 modules transformed.
✓ built in 5.94s
```

- ✅ 无编译错误
- ✅ 无类型错误
- ✅ 文件大小：893.91 kB（压缩后 251.75 kB）

### 功能验证

#### 测试 1: 默认模式
- ✅ 页面加载后默认为 "Both" 模式
- ✅ 显示两个等待时间卡片
- ✅ 标签清楚区分（Calendar / Working）

#### 测试 2: 切换到 Calendar
- ✅ 点击 Calendar Time 按钮
- ✅ 只显示一个 "Queue Wait" 卡片
- ✅ 显示日历等待时间数值

#### 测试 3: 切换到 Working
- ✅ 点击 Working Time 按钮
- ✅ 只显示一个 "Queue Wait" 卡片
- ✅ 显示工作等待时间数值

#### 测试 4: 切换回 Both
- ✅ 点击 Both 按钮
- ✅ 恢复显示两个卡片
- ✅ 数据正确

---

## 📚 文档

创建了详细的用户指南：

### [WAIT_TIME_MODE_CONFIGURATION.md](WAIT_TIME_MODE_CONFIGURATION.md)

**包含内容**：
- ✅ 三种模式的详细说明
- ✅ 适用场景和案例
- ✅ 如何切换模式
- ✅ 实际使用建议
- ✅ 常见问题解答
- ✅ 高级使用技巧

---

## 🎯 与其他方案对比

### 方案 A（已实现）vs 方案 B（UI 实时切换）

| 特性 | 方案 A（全局配置） | 方案 B（UI 切换） |
|------|-------------------|------------------|
| **配置位置** | 左侧边栏设置 | 统计面板顶部 |
| **影响范围** | 全局（所有统计面板） | 局部（当前面板） |
| **状态管理** | SimulationConfig | React State |
| **实现复杂度** | 中等 | 简单 |
| **用户体验** | 一次设置，全局生效 | 灵活切换 |
| **是否持久化** | 可扩展（localStorage） | 临时 |

**为什么选择方案 A**：
- ✅ 符合应用架构（配置统一管理）
- ✅ 设置位置合理（与其他模拟配置在一起）
- ✅ 便于未来扩展（如持久化）

---

## 🚀 未来可扩展功能

### 1. 持久化存储

```typescript
// 保存到 localStorage
useEffect(() => {
  localStorage.setItem('waitTimeMode', config.waitTimeCalculationMode || 'both');
}, [config.waitTimeCalculationMode]);

// 页面加载时恢复
useEffect(() => {
  const saved = localStorage.getItem('waitTimeMode');
  if (saved) {
    setConfig(prev => ({ ...prev, waitTimeCalculationMode: saved }));
  }
}, []);
```

### 2. 快捷键支持

```typescript
// Ctrl+1/2/3 快速切换
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.ctrlKey) {
      if (e.key === '1') setConfig({ ...config, waitTimeCalculationMode: 'both' });
      if (e.key === '2') setConfig({ ...config, waitTimeCalculationMode: 'calendar' });
      if (e.key === '3') setConfig({ ...config, waitTimeCalculationMode: 'working' });
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [config]);
```

### 3. 预设配置

```typescript
// 为不同角色提供预设
const PRESETS = {
  customer_facing: { waitTimeCalculationMode: 'calendar' },
  operations: { waitTimeCalculationMode: 'working' },
  analyst: { waitTimeCalculationMode: 'both' },
};
```

### 4. 导出时记住模式

```typescript
// CSV/PDF 导出时，根据当前模式决定导出哪些列
function exportData() {
  const mode = config.waitTimeCalculationMode || 'both';
  const columns = ['stepName'];
  
  if (mode === 'calendar' || mode === 'both') {
    columns.push('calendarWaitTime');
  }
  if (mode === 'working' || mode === 'both') {
    columns.push('workingWaitTime');
  }
  
  // ... 导出逻辑
}
```

---

## 📊 用户反馈指标（建议收集）

实施后可以跟踪：
- 📈 各模式的使用频率
- ⏱️ 用户切换模式的频率
- 💡 是否大多数用户停留在默认模式
- 🎯 不同角色偏好的模式

这些数据可以帮助优化默认设置和 UI 设计。

---

## ✅ 总结

### 实现完成度：100%

- ✅ 类型定义
- ✅ 配置 UI
- ✅ 显示逻辑
- ✅ 数据传递
- ✅ 构建测试
- ✅ 文档编写

### 核心价值

**让用户根据自己的需求选择最适合的等待时间视角**

- 📅 对外报告 → Calendar Time
- ⏱️ 内部优化 → Working Time
- 📊 完整分析 → Both

### 下一步

用户现在可以：
1. 打开应用
2. 点击左侧边栏
3. 找到 "Wait Time Calculation"
4. 选择适合自己的模式
5. 开始分析！

---

## 🎉 完成！

方案 A 已成功实现，用户拥有了完全的自主权来定义如何计算和查看等待时间指标。
