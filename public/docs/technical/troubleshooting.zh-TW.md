# FlowSim 排障指南

語言：繁體中文  
更新：2026-06-07

## 1. 文檔打不開或語言不對

| 現象 | 檢查 | 修復 |
| --- | --- | --- |
| Docs 首頁打不開 | 路徑是否為 `/docs/index.html` | 文檔應放在 `public/docs/` 下 |
| Markdown 打不開 | 文件是否在 `guide/` 或 `technical/` | 檢查 `constants/documents.ts` 的路徑 |
| 語言切換無效 | 是否配置 alternates | 為 zh-TW、zh-CN、en 都添加文件 |
| 相對連結跳錯 | 連結是否相對目前 Markdown | 使用 `../technical/file.md` 或同目錄文件名 |

---

## 2. 模擬不產生 item

| 可能原因 | 檢查點 | 修復 |
| --- | --- | --- |
| Start 未配置 | Arrival Model、Rate / Interval、Batch size | 設定正數到達率或間隔 |
| 非工作時間被拒絕 | Business Hours + Non-working arrivals | 改為 queue / delay 或調整工作時間 |
| Schedule / Events 不在目前日期 | Calendar start、Weekdays、Months、date range | 調整日期過濾或 Stop Date |
| Demand Peaks 誤設為 0 | 全域或 Start 內部倍率 | 改為大於 0 的 multiplier |
| 沒有連到 Process | Connections | 設定下游和 Probability |

---

## 3. item 排隊但不處理

| 可能原因 | 檢查點 | 修復 |
| --- | --- | --- |
| 目前關門 | Business Time Open / Closed | 調整 Working days / hours |
| Process 自訂日曆關閉 | Calendar Override | 改為 Inherit 或修正自訂時段 |
| Capacity 為 0 或太低 | Process Basic | 設定合理 Capacity |
| Team 配置不合法 | Explicit teams 總人數 | 總人數必須等於 Capacity |
| Execution Mode 限制並發 | Team size、Max concurrent | 增加並發或減少團隊人數 |

---

## 4. 佇列越來越長

| 現象 | 可能原因 | 行動 |
| --- | --- | --- |
| Queue 長且 Util. 高 | 資源忙不過來 | 增加 Capacity、縮短處理時間、減少返工 |
| Queue 長但 Util. 低 | 關閉、連線或日曆問題 | 檢查 Business Hours、Calendar Override、Connections |
| P90 上升很快 | 高峰或複雜 item | 檢查 Demand Peaks、Item Mix、Range |
| 返工後堵塞 | 回路機率過高 | 檢查 Connections 機率和 Failure |

---

## 5. Connections 警告或流程斷開

| 問題 | 修復 |
| --- | --- |
| 出口機率合計不是 1.0 | 調整每條 Probability，常規流程合計 1.0 |
| End 沒有上游 | 從最後一個 Process 連到 End |
| Process 沒有出口 | 添加下游 Process 或 End |
| 返工機率太高 | 降低返工機率或增加返工步驟 Capacity |
| 貼上後連線不對 | 檢查複製範圍；系統只會重建內部連線和有效目標 |

---

## 6. 指標看起來異常

| 現象 | 解讀 | 下一步 |
| --- | --- | --- |
| Calendar Wait 特別高 | 可能包含夜晚、週末、午休 | 切到 Both，對比 Working Wait |
| Working Wait 高 | 工作時間內真的排隊 | 查 Capacity、處理時間、返工、高峰 |
| Diagnostic Working Wait 高 | 某個步驟可能堵 | 看 Step queue 和 Util. |
| Avg 低但 P90 高 | 少數 item 等很久 | 查複雜 item、返工、波動 |
| Finished 太少 | 樣本不足 | 延長 Auto Pause 或加快時間壓縮 |

---

## 7. Import / Export / Draft

| 現象 | 修復 |
| --- | --- |
| 匯入後目前流程被覆蓋 | 這是預期行為；匯入前先 Export 備份 |
| 匯入失敗 | 確認 JSON 來自 FlowSim，格式未被手動破壞 |
| 草稿不是最新 | 瀏覽器 localStorage 可能被清理；使用 Export 做長期備份 |
| 複製貼上後 ID 變化 | 預期行為，系統會重建 ID 避免衝突 |

---

## 8. AI 功能

| 問題 | 檢查 |
| --- | --- |
| Generate Scenario 不可用 | 是否選擇 API Key |
| 生成流程不符合業務 | AI 是草稿，需要人工檢查 Capacity、Connections、時間 |
| Analyze Bottlenecks 結果空泛 | 模擬樣本不足，先跑到有足夠 Finished item |
| 建議與指標不一致 | 以 StatsBoard 和業務知識為準，AI 只做輔助解釋 |

---

## 9. 快速定位流程

1. 沒有 item：先查 Start。
2. 有 item 不動：查 Business Hours 和 Process Capacity。
3. 有佇列：查 Resource Util.。
4. Util. 高：資源或處理時間問題。
5. Util. 低：日曆、連線或模式問題。
6. 指標高：切 Both，區分 Calendar 與 Working。
7. 報告前：確認 Auto Pause 邊界和樣本量。