# 等待時間計算模式配置指南

語言：繁體中文  
更新：2026-06-07

## 1. 概述

Wait Time Calculation 控制 StatsBoard 如何呈現等待時間。它**不改變模擬行為、不清空統計、不重新建立 item**，只改變等待時間的顯示口徑。同一組模擬結果可以分別用於客戶 SLA、內部效率與瓶頸診斷。

| 模式 | 顯示重點 | 適合對象 |
| --- | --- | --- |
| Both | Calendar Wait、Working Wait、Diagnostic Working Wait | 初次分析、營運復盤、方案比較 |
| Calendar Time | 客戶實際感受到的完整等待 | 客戶、業務主管、SLA 報告 |
| Working Time | 工作時間內真實排隊等待 | 營運、排班、容量規劃 |

設定位置：Sidebar → Simulation Settings → **Wait Time Calculation**。

---

## 2. 三種模式詳解

### 2.1 Both（建議預設）

Both 會同時顯示兩種 item 視角等待時間，並保留步驟診斷指標。

| 指標 | 含義 | 用途 |
| --- | --- | --- |
| Queue Wait (Calendar) | 從進入佇列到開始處理的完整日曆等待 | 客戶視角 |
| Queue Wait (Working) | 完成 item 在工作時間內經歷的排隊等待 | 營運視角 |
| Diagnostic Working Wait | 各步驟工作時間等待的步驟級平均 | 找瓶頸 |

適合：第一次建模、找原因、比較配置、向團隊解釋為什麼客戶等待很長但內部排隊未必嚴重。

### 2.2 Calendar Time

Calendar Time 強調客戶感受到的等待。夜晚、週末、假日、午休等非工作時間都會被計入。

例：週五 17:00 入隊，週一 09:00 開始處理。

- Calendar Wait 約 64 小時。
- 適合 SLA、回應時長承諾、客戶體驗報告。

不要把 Calendar Wait 高直接理解成資源不足。它可能只是營業時間策略造成的自然等待。

### 2.3 Working Time

Working Time 只計算工作時間內的排隊等待，更適合內部效率分析。

同樣例子：週五 17:00 入隊，週一 09:00 開始處理。

- 如果 17:00 正好下班，Working Wait 可能是 0。
- 如果 16:50 入隊、17:00 下班、週一 09:00 處理，Working Wait 約 10 分鐘。

適合：是否加人、加機器、調整 Capacity、比較不同營業時間配置。

---

## 3. 與 Business Hours 的關係

| 配置 | 對指標的影響 |
| --- | --- |
| Calendar start | 決定模擬第 0 毫秒對應的真實日曆時間 |
| Working days | 決定哪些日期計入工作時間 |
| Working hours | 決定一天內哪些時段計入工作時間 |
| Non-working arrivals = queue | 非工作時間到達可進入佇列；Calendar Wait 累計，Working Wait 只在開門後累計 |
| Non-working arrivals = delay | 到達被推遲到下一段工作時間 |
| Non-working arrivals = reject | 非工作時間到達不建立 item，並增加 Cancelled 計數 |
| Calendar Override | 某個 Start 或 Process 可使用自己的工作日曆 |

若 Calendar Wait 很高但 Working Wait 很低，請優先檢查 Business Hours 和 Non-working arrivals，而不是立刻增加 Capacity。

---

## 4. 決策流程

1. 先用 **Both** 跑基準。
2. 比較 Calendar Wait 與 Working Wait 的差距。
3. Calendar 高、Working 低：多半是營業時間、到達策略或 SLA 口徑問題。
4. Calendar 高、Working 也高：多半是資源、處理時間、返工路由或需求高峰問題。
5. 查看 Diagnostic Working Wait，定位可能的瓶頸 Process。
6. 對外報告用 Calendar，內部優化用 Working。

---

## 5. 場景示例

### 客服 SLA 報告

目標：回答「客戶提交工單後，到被處理前等了多久」。  
建議：Calendar Time。客戶不會把夜晚和週末從等待體驗中扣除。

### 內部排班會議

目標：判斷是否要增加客服或調整班次。  
建議：Working Time，並觀察 Resource Util.、Oldest Queue、Throughput。

### 營業時間策略評估

目標：比較 9-17、9-20、週末開門三種方案。  
建議：Both。Calendar Wait 顯示客戶體驗改善；Working Wait 顯示內部佇列壓力。

### 瓶頸定位

目標：找出哪個步驟拖慢流程。  
建議：Both + Diagnostic Working Wait + Step Resource Util.。

---

## 6. 讀數檢查清單

| 現象 | 可能原因 | 下一步 |
| --- | --- | --- |
| Calendar 高、Working 低 | 非工作時間影響大 | 延長工作時間、調整到達策略、解釋 SLA 口徑 |
| Calendar 高、Working 高 | 工作時間內也排隊 | 檢查 Capacity、處理時間、返工、需求高峰 |
| Diagnostic 高但 Working 不高 | 少數步驟異常、步驟平均放大 | 看單步驟佇列和利用率 |
| P90 遠高於 Avg | 尾端體驗差 | 檢查複雜 item、返工、波動和高峰 |
| Resource Util. 低但佇列長 | 可能關門、連線錯誤或 Calendar Override | 檢查 Business Hours、Process 日曆和連線 |

---

## 7. FAQ

**切換模式會影響模擬結果嗎？**  
不會，只改變 StatsBoard 顯示。

**哪個模式最準？**  
三個都準，只是回答不同問題。Calendar 看客戶等多久；Working 看工作時間內堵多久；Diagnostic 用於找步驟瓶頸。

**為什麼 Diagnostic Working Wait 和 Queue Wait (Working) 不一樣？**  
Queue Wait (Working) 是按完成 item 的真實經歷聚合；Diagnostic 是步驟級平均，不是 item-weighted。

**報告用哪個？**  
對外預設 Calendar Time；內部改善預設 Working Time；不確定用 Both。