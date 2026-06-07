# 模擬模式與 Process 執行模式指南

語言：繁體中文  
更新：2026-06-07

## 1. 三類相關模式

FlowSim 有三類常被混淆的模式：

| 層級 | 設定 | 影響 |
| --- | --- | --- |
| 全域 Simulation Mode | Realistic / Worst-Case | 控制隨機取值與壓力測試口徑 |
| Process Simulation Type | Resource Mode / Time Delay | 控制單一步驟是否使用資源與佇列 |
| Process Execution Mode | 1 resource / item、Team per item、1 resource / many items | 控制 Capacity 如何被 item 占用 |

建議先用 Realistic 建立基準，再用 Worst-Case 做保守容量評估。

---

## 2. Realistic 與 Worst-Case

| 模式 | 含義 | 使用場景 |
| --- | --- | --- |
| Realistic | 按配置中的隨機分布、機率和波動正常運行 | 日常預測、平均表現、方案比較 |
| Worst-Case | 偏向壓力測試和保守評估 | 高峰驗證、SLA 安全邊際、容量下限 |

使用流程：

1. 在 Realistic 下調到符合歷史資料的基準。
2. 記錄 Avg、P90、Queue、Util.、Throughput。
3. 切到 Worst-Case，觀察高峰下佇列是否失控。
4. 若 Worst-Case 下 P90 或 Queue 過高，增加 Capacity、縮短處理時間或調整到達策略。

---

## 3. Process Simulation Type

### Resource Mode

Resource Mode 表示該步驟需要有限資源。若資源被占滿，新 item 會進入佇列。

適合客服處理、人工審核、櫃台服務、機器加工、醫護接診。重點指標是 Queue、Oldest Queue、Queue Wait、Resource Util.。

### Time Delay

Time Delay 不占用 Capacity，也不因資源不足排隊。item 到達後會進入處理計時；如果該步驟日曆目前關閉，開始時間會被推到下一段工作時間。

適合運輸等待、冷卻、沉澱、風乾、系統批處理延遲、外部依賴等待。它會增加 Cycle Time，但通常不是資源瓶頸。

---

## 4. Execution Mode

### 1 resource / item

最常見模式，一個 item 占用一個資源。Capacity = 3 表示最多同時處理 3 個客戶。

### Team per item

一個 item 需要多個資源共同處理。

| 子模式 | 說明 |
| --- | --- |
| Auto teams | 系統按 Capacity 和預設團隊大小自動分組 |
| Explicit teams | 手動定義團隊名稱和人數，總人數必須等於 Capacity |

例：Capacity = 6，Team size = 2，最多 3 個 item 同時處理。團隊越大可設定更高速度倍率，但會降低並發數。

### 1 resource / many items

一個資源可以同時處理多個 item。

| 參數 | 含義 |
| --- | --- |
| Max concurrent items / resource | 每個資源最多並發處理 item 數 |
| Speed multiplier by concurrent load | 並發負載下的速度倍率 |

適合 AI 助手、批處理系統、自動化工具、一人監控多個任務。

---

## 5. 處理時間設定

| 模式 | 參數 | 說明 |
| --- | --- | --- |
| Fixed | Base Time + Variance | 圍繞基礎時間波動 |
| Range | Min / Max Duration | 在範圍內取值 |

若 P90 遠高於 Avg，請檢查處理時間波動、複雜 item 的 Time Factor、返工連線和需求高峰。

---

## 6. 選擇指南

| 業務情況 | 建議設定 |
| --- | --- |
| 一人處理一單 | Resource Mode + 1 resource / item |
| 兩人一起處理一件事 | Resource Mode + Team per item |
| 一個系統並發處理多單 | Resource Mode + 1 resource / many items |
| 不占人也不占機器，只是等待 | Time Delay |
| 平時預測 | Realistic |
| 保守壓力測試 | Worst-Case |

---

## 7. 排查建議

| 現象 | 檢查 |
| --- | --- |
| Queue 很長、Util. 很高 | Capacity 太低、處理時間太長、返工太多 |
| Queue 很長、Util. 很低 | Business Hours 關閉、Calendar Override、連線錯誤 |
| Team 模式保存失敗 | Explicit teams 總人數是否等於 Capacity |
| Multitask 效果不明顯 | Max concurrent、速度倍率、到達量是否足夠 |
| Worst-Case 結果過差 | 檢查是否過度保守，再看安全邊際是否可接受 |