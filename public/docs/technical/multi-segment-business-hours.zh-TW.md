# 多段工作時間指南

語言：繁體中文  
更新：2026-06-07

## 1. 目的

Business Hours 用來描述系統什麼時候可以處理 item。多段工作時間允許一天內設定多個開放時段，例如 `09:00-12:00` 和 `13:00-18:00`，適合午休、分班、門店營業、客服輪班和跨部門日曆。

---

## 2. 核心設定

| 設定 | 含義 | 例子 |
| --- | --- | --- |
| Enabled | 是否啟用工作日曆 | 開啟後非工作時間會影響處理 |
| Calendar start | 模擬第 0 毫秒對應的日期時間 | 2026-01-05 09:00 |
| Working days | 哪些星期工作 | 週一到週五 |
| Working hours | 每天一個或多個時段 | 9-12、13-18 |
| Non-working arrivals | 非工作時間到達策略 | queue、delay、reject |
| Calendar Override | 單個 Start 或 Process 的自訂日曆 | 線上訂單 24/7，財務工作日 9-17 |

`workingDay` 時間單位固定為 8 小時，不會自動等於你設定的每日工作小時數。

---

## 3. 非工作時間到達策略

| 策略 | 行為 | 適合 |
| --- | --- | --- |
| queue | item 可進入佇列，但等開門後處理 | 客戶可隨時提交訂單或工單 |
| delay | 到達本身推遲到下個工作時段 | 只在開門時接收現場客戶 |
| reject | 非工作時間到達不建立 item，並增加 Cancelled 計數 | 嚴格營業窗口 |

指標影響：queue 會讓 Calendar Wait 增加，但 Working Wait 只在工作時段累計；delay 會改變實際進入系統時間；reject 不建立非工作時間 item，並增加 Cancelled 計數。

---

## 4. 常見配置

### 辦公室

- Working days：Mon-Fri。
- Working hours：09:00-12:00、13:00-18:00。
- Non-working arrivals：queue 或 delay。

### 餐廳

- Working days：All days。
- Working hours：11:00-14:00、17:00-22:00。
- Demand Peaks：午餐和晚餐 x2。

### 24/7 支援

- Working days：All days。
- Working hours：00:00-24:00。
- Non-working arrivals 通常無影響。

---

## 5. 與等待時間指標的關係

| 現象 | 解讀 |
| --- | --- |
| Calendar Wait 高、Working Wait 低 | 多半是關門時間造成客戶等待 |
| Non-working Delay 高 | 營業時間策略對週期影響大 |
| Oldest Queue 在開門前很高 | queue 策略讓 off-hours item 先排隊 |
| Working Wait 高 | 開門期間資源仍處理不過來 |

建議使用 Both 模式評估營業時間方案。

---

## 6. Start / Process Calendar Override

某些步驟可能不應繼承全域日曆。

例：Start 接收線上訂單 24/7；倉庫揀貨週一到週六 8-20；財務審核只在週一到週五 9-17。此時可為對應 Start 或 Process 設定 Calendar Override。

---

## 7. 排查清單

| 問題 | 檢查 |
| --- | --- |
| item 不處理 | Business Time 是否 Closed；Process 是否有 Calendar Override |
| 非工作時間仍有 item 進入佇列 | Non-working arrivals 是否為 queue |
| 週末資料異常 | Working days 是否包含週末 |
| 午休仍在處理 | Working hours 是否正確拆成兩段 |
| workingDay 與預期不符 | workingDay 固定 8 小時，是單位換算，不是日曆長度 |