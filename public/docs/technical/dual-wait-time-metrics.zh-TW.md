# 雙等待時間指標技術說明

語言：繁體中文  
更新：2026-06-07

## 1. 設計目的

FlowSim 同時保留 Calendar Wait 與 Working Wait，是為了避免把兩種問題混在一起：

- 客戶視角：從提交到被處理前，真實過了多久？
- 營運視角：在公司開門、可以工作的時間裡，佇列真正積壓了多久？

只看 Calendar Wait 可能誤判為資源不足；只看 Working Wait 又可能低估客戶體驗問題。因此系統提供雙指標，並額外提供 Diagnostic Working Wait 做步驟級瓶頸診斷。

---

## 2. 指標定義

| 指標 | 口徑 | 聚合方式 | 主要用途 |
| --- | --- | --- | --- |
| Queue Wait (Calendar) | item 從入隊到開始處理的完整日曆時間 | item-weighted | SLA、客戶體驗、對外報告 |
| Queue Wait (Working) | item 在工作時間內實際等待處理的時間 | item-weighted | 內部效率、排班、容量規劃 |
| Diagnostic Working Wait | 各 Process 步驟 Working Wait 的步驟級平均 | step average | 找瓶頸、定位異常步驟 |
| Non-working Delay | `Calendar Cycle - Global Working Cycle`，基於全域 Business Calendar 的非工作時間差 | item/flow 統計 | 評估營業時間策略 |

### Calendar Wait

包含夜晚、週末、午休、假日與任何非工作時間。

```text
週五 17:00 入隊 → 週一 09:00 開始處理
Calendar Wait ≈ 64 小時
```

### Working Wait

只統計 Business Hours 開啟時 item 在佇列中等待的時間。

```text
週五 16:50 入隊 → 17:00 下班 → 週一 09:00 處理
Working Wait ≈ 10 分鐘
```

### Diagnostic Working Wait

Diagnostic Working Wait 是步驟診斷指標，不是客戶平均體驗。它把每個步驟的工作時間等待平均，用來突出小步驟異常。

```text
步驟 A：100 個 item，平均 Working Wait = 1 分鐘
步驟 B：1 個 item，平均 Working Wait = 100 分鐘

Queue Wait (Working) ≈ 1.98 分鐘
Diagnostic Working Wait = 50.5 分鐘
```

這表示 B 步驟值得排查，但不代表平均每個 item 等了 50.5 分鐘。

---

## 3. 與模擬邏輯的關係

| 模組 | 對等待指標的影響 |
| --- | --- |
| Start | 決定 item 何時進入系統，受 Arrival Model、Batch、Item Mix、Demand Peaks 影響 |
| Process Resource Mode | 資源不足會形成 queue，等待指標主要在這裡產生 |
| Process Time Delay | 不使用資源，通常不產生資源佇列等待，但會增加週期時間 |
| Business Hours | 決定 Working Wait 的計時窗口 |
| Calendar Override | 讓單個 Start 或 Process 使用與全域不同的工作日曆 |
| Non-working arrivals | 決定非工作時間 arrival 是 queue、delay 或 reject |
| Connections | 返工路徑會增加多次排隊和週期時間 |
| Exceptions | 失敗和取消會影響完成 item 的統計樣本 |

---

## 4. 典型讀數

| Calendar Wait | Working Wait | 可能含義 |
| --- | --- | --- |
| 高 | 低 | 非工作時間占比高，客戶等很久但開門時不一定堵 |
| 高 | 高 | 開門時也排隊，資源或處理時長可能不足 |
| 低 | 高 | 短時間高峰內排隊明顯，但總日曆跨度不長 |
| 低 | 低 | 等待壓力較小 |

搭配判斷：

- Resource Util. 高 + Working Wait 高：資源不足或處理時間過長。
- P90 高 + Avg 正常：尾端體驗差，檢查複雜 item、高峰、返工。
- Non-working Delay 高：營業時間、午休、週末影響明顯。

---

## 5. 多步驟與返工

item 可能經過多個 Process，每次進入資源佇列都會產生一次等待。Flow-level 指標會彙總 item 的真實經歷；Step-level 指標顯示每個步驟自己的佇列情況。

返工示例：

```text
Preparation → Quality Check → 10% 回 Preparation → Quality Check → Packaging
```

返工會增加總週期時間、排隊次數、資源負載、P90 和尾端風險。

---

## 6. 報告建議

| 報告對象 | 推薦指標 | 說明 |
| --- | --- | --- |
| 客戶 / 外部 SLA | Calendar Wait、Avg Calendar、P90 | 與真實體驗一致 |
| 營運 / 排班 | Working Wait、Resource Util.、Throughput | 判斷工作時間內是否處理不過來 |
| 流程改善小組 | Both + Diagnostic | 同時看體驗、效率和瓶頸 |
| 技術調試 | Step metrics + queue snapshots | 定位連線、日曆、容量問題 |

---

## 7. 常見誤區

- Calendar Wait 高不是 bug，也不一定是資源不足。
- Working Wait 低不代表客戶滿意；客戶可能仍等過夜或週末。
- Diagnostic Working Wait 不是 item 平均體驗。
- 切換 Wait Time Calculation 不會改變模擬結果，只改變顯示。
- 比較方案時應保持相同的到達邏輯和時間邊界。