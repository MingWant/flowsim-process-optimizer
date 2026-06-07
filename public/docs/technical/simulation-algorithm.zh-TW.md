# FlowSim 模擬演算法詳解

語言：繁體中文  
更新：2026-06-07

## 1. 總體執行模型

FlowSim 的核心在 `hooks/useProcessSimulation.ts`。它以瀏覽器動畫幀驅動，每個 tick 推進模擬時間、產生到達、分配資源、推進處理、結算完成並刷新統計。

每個 tick 大致順序：計算時間差 → 生成 Start 到達 → 統計資源占用 → 啟動可處理的 queued item → 推進 transmitting/processing → 處理已到期事件 → 檢查取消和完成 → 刷新 UI。

---

## 2. 時間推進

單幀真實時間會被限制在 100 ms 以避免卡頓後一次跳太遠。

$$
\Delta t_{sim}=\min(\Delta t_{real},100ms)\times speedMultiplier\times timeCompression
$$

`speedMultiplier` 來自 Speed；`timeCompression` 來自 Sim Clock。UI 約每 33 ms 更新一次，模擬邏輯可在更新間持續推進。

---

## 3. WorkItem 狀態機

| 狀態 | 含義 |
| --- | --- |
| `transmitting` | item 正在視覺移動到下一節點；業務傳輸時間為 0 |
| `queued` | 等待 Process 資源或工作時間 |
| `processing` | 正在處理或延遲 |
| `finished` | 正常完成 |
| `cancelled` | 排隊取消；非工作時間 reject 只增加 Cancelled 計數，不建立 WorkItem |
| `error` | 處理完成時失敗 |

傳輸動畫約 900 ms，只影響畫面，不增加業務週期時間。

---

## 4. Start 到達演算法

### Simple

Rate 模式：

$$
nextDelay=\frac{unitMs\times batchSize}{arrivalRate\times demandMultiplier}
$$

Interval 模式：

$$
nextDelay=\frac{arrivalInterval\times unitMs}{demandMultiplier}
$$

Range 模式會在最小值和最大值間取隨機值。需求倍率越高，到達越頻繁。

### Schedule

`burst` 在窗口開始時投放 `quantity × demandMultiplier`；`spread` 把調整後數量均勻分布到窗口內。可用 weekdays、months、startDate、endDate 過濾。

### Events

事件可用 `dayOffset + hour` 或 `startDate + hour` 定位。Repeat 支援 Once、Daily、Working days、Weekly、Monthly、Yearly。`sequence` 會按 item interval 逐個投放，`burst` 一次投放。

---

## 5. 非工作時間到達

Start 到達會檢查有效日曆：

| 策略 | 行為 |
| --- | --- |
| `queue` | 仍建立 item，進入後續流程 |
| `delay` | 將 arrival slot 推遲到下一段工作時間 |
| `reject` | 不建立 item，增加 cancelled 計數 |

---

## 6. 路由與資源分配

Connections 會按總概率歸一化後抽樣。如果沒有出口，item 會流向 finished。

Resource Mode 的隊列排序：priority 高者優先；priority 相同時，較早入隊者優先。

| Execution Mode | 演算法 |
| --- | --- |
| Single | 一個 item 占用一個資源 |
| Collaborative | item 占用多個資源；Auto team 用空閒資源，Explicit team 每隊同時處理一件 |
| Multitask | 容量上限為 `capacity × maxConcurrentItemsPerResource` |

Collaborative 預設速度約為 `1 + (resources - 1) × 0.65`。Multitask 預設並發越高，單件速度越低，最低約 0.25。

---

## 7. 處理時長

時長來源優先級：Source Rule → Range → Fixed。

| 模式 | Fixed + Variance |
| --- | --- |
| Realistic | 正態隨機，限制在 base × 0.2 到 base × 3 |
| Worst-Case | 均勻隨機 `base × (1 ± variance)` |

實際時長：

$$
actualDuration=\frac{baseDuration\times profileTimeFactor}{executionSpeedMultiplier}
$$

---

## 8. 工作日曆

核心函數在 `services/simulationCalendar.ts`：`isWorkingTime` 判斷是否開門，`getNextWorkingSimulationTime` 找下一段工作時間，`addWorkingDuration` 在工作時間內累加處理時長，`getWorkingDurationBetween` 計算兩點間的工作時間重疊。

處理開始會被推到下一段工作時間；處理結束使用 `addWorkingDuration`，所以任務會跨過夜晚、週末或午休。

---

## 9. 失敗、取消和統計

失敗概率：

$$
failChance=clamp(step.failureProbability\times item.failureMultiplier,0,1)
$$

排隊取消：Realistic 使用 `1 - exp(-p × seconds)`；Worst-Case 使用 `min(1, p × seconds)`。

完成 item 才進入週期樣本。Calendar Cycle 是建立到完成的日曆時間；Global Working Cycle 用全域日曆計算工作時間；Operational Working Cycle 是 `totalWorkingWaitTime + totalProcessingTime`；Off-hours Delay 是 Calendar Cycle 與 Global Working Cycle 的差值。

---

## 10. 保護限制

| 限制 | 值 |
| --- | --- |
| 單 tick 單 Start 最大生成 | 1000 |
| 單 tick 業務事件最大處理 | 5000 |
| UI item 最大渲染 | 900 |
| transmitting / processing / queued 渲染上限 | 420 / 320 / 120 |

這些是瀏覽器即時模擬的安全邊界，不是業務模型的理論上限。