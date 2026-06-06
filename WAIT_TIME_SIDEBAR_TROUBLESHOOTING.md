# Wait Time Calculation 显示问题排查

## 问题
用户报告在左侧栏的 Simulation Mode 下方看不到 Wait Time Calculation。

## 代码验证

### ✅ 代码已正确添加
```tsx
// 位置：components/AppSidebar.tsx, 行 691-739

<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wait Time Calculation</h3>
  <div className="space-y-2">
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-[10px] text-slate-400">
      Choose how queue wait time is calculated and displayed in metrics.
    </div>
    <div className="space-y-1.5">
      <!-- 三个按钮：Both, Calendar Time, Working Time -->
    </div>
  </div>
</div>
```

### ✅ 位置正确
```
行 664: Simulation Mode
行 692: Wait Time Calculation ← 就在 Simulation Mode 之后
```

---

## 可能的原因

### 1. 需要向下滚动 ⭐ 最可能
左侧栏是可滚动的区域：
```tsx
<div className="custom-scrollbar h-full overflow-y-auto p-4 space-y-4">
```

**解决方法**：
- 在左侧栏中向下滚动
- Wait Time Calculation 部分在 Simulation Mode 下方

---

### 2. 浏览器缓存
页面可能加载了旧版本。

**解决方法**：
1. 硬刷新页面：`Ctrl + Shift + R`（Windows）或 `Cmd + Shift + R`（Mac）
2. 或清除浏览器缓存后刷新

---

### 3. 开发服务器未重启
如果应用正在运行，可能需要重启。

**解决方法**：
```bash
# 停止现有服务器（Ctrl + C）
# 重新启动
npm run dev
```

---

### 4. 构建问题
开发构建可能有问题。

**解决方法**：
```bash
# 清理并重新构建
rm -rf node_modules/.vite
npm run dev
```

---

## 验证步骤

### 1. 检查代码
```bash
grep -n "Wait Time Calculation" components/AppSidebar.tsx
```
**预期结果**: 应该显示 `692:` 行

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 打开应用
```
http://localhost:3000
```

### 4. 打开左侧栏
- 点击左上角的汉堡菜单（移动端）
- 或者在桌面端，左侧栏应该默认打开

### 5. 向下滚动
- 在左侧栏中向下滚动
- 应该看到：
  ```
  ┌─────────────────────────────┐
  │ Simulation Mode             │
  │ [Realistic] [Worst-Case]    │
  ├─────────────────────────────┤
  │ Wait Time Calculation       │ ← 这里！
  │ Choose how queue wait...    │
  │ [📊 Both (Recommended)]     │
  │ [📅 Calendar Time]          │
  │ [⏱️ Working Time]           │
  └─────────────────────────────┘
  ```

---

## 视觉参考

### 完整的左侧栏结构（从上到下）
```
┌────────────────────────────────┐
│ Quick Controls                 │
│ ├─ Theme (移动端)              │
│ ├─ Speed                       │
│ ├─ Rate                        │
│ └─ Play/Pause/Reset            │
├────────────────────────────────┤
│ AI Insights                    │
│ ├─ Generate Scenario           │
│ └─ Analyze Bottlenecks         │
├────────────────────────────────┤
│ Simulation Mode                │
│ ├─ Realistic                   │
│ └─ Worst-Case                  │
├────────────────────────────────┤
│ Wait Time Calculation          │ ← 在这里
│ ├─ 📊 Both (Recommended)       │
│ ├─ 📅 Calendar Time            │
│ └─ ⏱️ Working Time             │
├────────────────────────────────┤
│ Steps                          │
│ └─ (所有步骤列表)              │
└────────────────────────────────┘
```

---

## 调试工具

### 使用浏览器开发者工具
1. 按 `F12` 打开开发者工具
2. 选择 Elements 标签
3. 搜索 "Wait Time Calculation"
4. 检查元素是否存在
5. 查看 CSS 样式，确认没有 `display: none` 或 `visibility: hidden`

### 检查元素是否被隐藏
```css
/* 应该没有这些样式 */
display: none;
visibility: hidden;
height: 0;
opacity: 0;
```

---

## 如果仍然看不到

### 临时调试方案
在 `AppSidebar.tsx` 的 Wait Time Calculation 标题中添加醒目标记：

```tsx
<h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">
  ⚠️ Wait Time Calculation ⚠️
</h3>
```

这样会用红色显示，更容易找到。

---

## 确认清单

- [ ] 代码已添加（行 691-739）
- [ ] 位置正确（Simulation Mode 下方）
- [ ] 浏览器已硬刷新
- [ ] 开发服务器已重启
- [ ] 左侧栏已打开
- [ ] 已向下滚动查看

---

## 最终确认

如果以上都做了还是看不到，请：

1. 截图左侧栏的完整内容
2. 检查浏览器控制台是否有错误
3. 分享 `npm run dev` 的输出

代码本身是正确的，问题很可能只是需要滚动或刷新缓存。
