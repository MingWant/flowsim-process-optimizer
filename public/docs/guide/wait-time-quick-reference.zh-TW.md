# 等待時間模式快速參考

語言：繁體中文  
更新：2026-06-07

## 1. 五分鐘決策表

| 你要回答的問題 | 選擇模式 | 重點看 |
| --- | --- | --- |
| 客戶到底等了多久？ | Calendar Time | Queue Wait、Avg Calendar、P90 |
| 工作時間內是否真的堵？ | Working Time | Queue Wait、Resource Util.、Throughput |
| 第一次分析，不確定原因 | Both | Calendar vs Working 差距、Diagnostic Working Wait |
| 是否需要加人或加機器？ | Working Time | Working Wait、Capacity、Oldest Queue |
| 營業時間是否太短？ | Both | Calendar Wait - Working Wait、Non-working Delay |
| 哪個步驟是瓶頸？ | Both | Diagnostic Working Wait、Step Utilization |

---

## 2. 三個模式一句話

- **Both**：最完整，適合診斷和解釋差異。
- **Calendar Time**：客戶視角，包含夜晚和週末。
- **Working Time**：營運視角，只看工作時間內排隊。

設定位置：Sidebar → Simulation Settings → **Wait Time Calculation**。

---

## 3. 快速例子

週五 17:00 入隊，週一 09:00 開始處理：

| 指標 | 結果 | 解讀 |
| --- | --- | --- |
| Calendar Wait | 約 64 小時 | 客戶實際等待了整個週末 |
| Working Wait | 可能 0 小時 | 工作時間內沒有真正排隊 |
| Diagnostic Working Wait | 看步驟平均 | 用於找哪個 Process 可能堵 |

結論：如果只有 Calendar 高，不一定要加人；可能需要調整營業時間、SLA 說明或非工作時間到達策略。

---

## 4. 讀數口訣

| 現象 | 口訣 | 行動 |
| --- | --- | --- |
| Calendar 高、Working 低 | 關門造成等待 | 看 Business Hours |
| Calendar 高、Working 高 | 開門也堵 | 看 Capacity 和處理時間 |
| P90 遠高於 Avg | 尾部有問題 | 看複雜 item、高峰、返工 |
| Util. 高、Queue 長 | 資源忙不過來 | 加資源或縮短處理時間 |
| Util. 低、Queue 長 | 可能沒開門或連線錯 | 看日曆、連線、Override |

---

## 5. 最小操作流程

1. 先選擇 **Both**。
2. 跑到有足夠 Finished item。
3. 觀察 Calendar Wait 與 Working Wait。
4. 看 P90 是否明顯高於 Avg。
5. 看哪個 Process 的 Diagnostic Working Wait 和 Resource Util. 高。
6. 根據用途切換模式輸出報告。

---

## 6. 常見選擇

- 客戶報告：Calendar Time。
- 內部排班：Working Time。
- 管理層復盤：Both。
- 配置比較：Both 或 Working Time。
- 快速排障：Both。