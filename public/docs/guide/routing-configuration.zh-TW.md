# Routing 配置與診斷指南

語言：繁體中文  
更新：2026-06-07

## 1. 這個功能解決什麼問題？

早期 FlowSim 的 `connections` 只用固定機率分流，例如 50% 去 A、50% 去 B。現實流程通常不是這樣：

- 會避開已經塞住的處理站。
- VIP、急件或高優先級案件會走不同通道。
- 沒有完全符合規則時，系統仍需要安全 fallback，避免 item 卡住。

新的 Routing 功能保留原本機率模型，同時加入 **Load-aware**、**Time-aware / ETA**、**Item Profile filter**、**Priority filter** 和 **Routing Diagnostics**。

---

## 2. Routing Strategy

在節點的 **Connections / Routing** 區塊，可以選擇 routing strategy。

| Strategy | 行為 | 適合場景 |
| --- | --- | --- |
| `Probability` | 只依照每條 route 的 base weight 抽選 | 穩定比例分流、規則簡單的流程 |
| `Load-aware` | 先保留 base weight，再根據目標節點壅塞度動態降低有效權重 | 多個服務台、共享資源池、希望自動避開塞車節點 |
| `Time-aware / ETA` | 先保留 base weight，再偏向預估完成時間較短的 route | queue、capacity、processing time、calendar 都會影響決策的真實流程 |

### Probability

假設某節點有兩條 route：

| Route | Probability |
| --- | --- |
| Team A | 0.5 |
| Team B | 0.5 |

長期來看，item 約一半去 A、一半去 B。即使 A 已經排隊，仍然可能繼續分到 A。

### Load-aware

Load-aware 會把每條 route 的 `probability` 視為 **base weight**，再根據目標節點的負載計算 effective weight。

概念公式：

```text
effective weight = base weight / (1 + load sensitivity × congestion)
```

`congestion` 會考慮：

- 目標節點 queue 中的 item 數量
- 目標節點正在 processing 的 item 數量
- 正在傳輸到該節點的 inbound item
- 目標節點 capacity

`Load sensitivity` 越高，越強烈避開壅塞目標；設為 0 時接近純 base weight。

### Time-aware / ETA

Time-aware 會把每條 route 的 `probability` 視為 **base weight**，再估算目標 route 的完成時間。

估算會包含：

- 目標節點已排隊的工作量
- 目標節點正在處理的剩餘工作量
- 正在傳輸到該目標的 inbound item
- 目標節點 capacity 與 resource mode
- 預期 processing time，包含 item profile processing multiplier
- 可選的目標 business hours calendar delay

概念公式：

```text
effective weight = base weight / (1 + ETA sensitivity × relative delay)
```

`ETA sensitivity` 越高，越偏向預估最快完成的 route；設為 0 時接近 base weight。啟用 **Calendar-aware ETA** 時，如果目標節點目前非工作時間，或工作時段較短，該 route 會變得較不吸引。

---

## 3. Route Filters

每條 connection 都可以額外限制哪些 item 可以走該 route。

| Filter | 說明 | 例子 |
| --- | --- | --- |
| Item Profiles | 只允許特定 Start node profile | VIP 走 Fast Lane，Standard 走一般隊列 |
| Min Priority | 只允許 priority 大於等於指定值 | priority >= 5 才能走緊急通道 |
| Max Priority | 只允許 priority 小於等於指定值 | priority <= 3 走標準處理 |

Filter 可以一起使用。若同一條 route 設了 profile 和 priority，item 需要同時符合兩者。

---

## 4. Fallback 邏輯

FlowSim 會避免因規則太嚴而讓 item 沒路可走。每次 routing 時會依序嘗試：

1. **符合 filter 的 route**
2. **沒有任何 filter 的 route**
3. **所有有效 route**
4. 若仍無有效 route，item 結束於 `finished`

因此建議：

- 對特殊 route 加 filter，例如 VIP Fast Lane。
- 保留至少一條無 filter 的 route 作為一般 fallback。
- 用 Routing Diagnostics 觀察 fallback 是否過多。

---

## 5. Routing Demo Walkthrough

工具列的 **Routing Demo** 會載入一個示例：

```text
Customer Demand Mix
├─ Standard → Standard Intake Router → General Team A / General Team B → Quality Check → End
└─ VIP      → VIP Intake Gate         → VIP Fast Lane                 → Quality Check → End
```

示例重點：

| 設計 | 觀察方式 |
| --- | --- |
| Start node 產生 Standard 與 VIP item profiles | 在 Start node 的 profile 設定中查看比例與 priority |
| VIP route 使用 profile / priority filter | VIP item 會走 VIP Intake Gate 和 VIP Fast Lane |
| Standard Intake Router 使用 Time-aware / ETA | Team A 下午才開工，因此 calendar-aware ETA 可能在早上偏向 Team B |
| VIP Intake Gate 使用 Load-aware | VIP 優先走 VIP Fast Lane，但必要時可使用 overflow route |
| Routing Diagnostics 顯示實際分流 | 觀察 Actual Share、Effective、Congestion、Fallback |

建議操作：

1. 點擊 **Routing Demo**。
2. 點擊 **Start**。
3. 等待數十秒模擬時間。
4. 觀察 map connection badge。
5. 查看下方 **Routing Diagnostics** 表格。
6. 修改 General Team A capacity、processing time 或 business hours，再比較 route share 與 ETA。

---

## 6. 如何解讀 Routing Diagnostics

| 欄位 | 含義 |
| --- | --- |
| Selected | 該 route 實際被選中的次數 |
| Actual Share | 同一來源節點中，此 route 實際佔比 |
| Base | 使用者設定的 base probability / weight |
| Effective | 動態調整後的即時有效佔比 |
| ETA | Time-aware route 最近估算的 queue + processing + calendar time |
| Congestion | 目標節點目前的壅塞程度估計 |
| Fallback | 有多少次是因 filter fallback 被選中 |
| Profile Hits | 選中時符合 profile filter 的次數 |
| Priority Hits | 選中時符合 priority filter 的次數 |
| Mode | 該 route 最近一次決策使用 Probability、Load-aware 或 Time-aware |

判讀口訣：

- **Base ≠ Actual Share**：正常，因為隨機波動、filter 或 load-aware 會影響結果。
- **Effective 低於 Base**：代表目標可能比較塞。
- **ETA calendar delay 很高**：目標 calendar 可能關閉或工作時段有限。
- **Fallback 很高**：代表 filter 可能太嚴或缺少一般 fallback route。
- **Congestion 長期偏高**：代表目標節點 capacity 不足或 processing time 太長。

---

## 7. 建模建議

| 目的 | 建議配置 |
| --- | --- |
| 固定比例分配 | 使用 `Probability`，確保總 weight 接近 100% |
| 平衡多個服務台 | 使用 `Load-aware`， sensitivity 從 1-4 開始 |
| 選擇真實最快通道 | 使用 `Time-aware / ETA`，sensitivity 從 2-5 開始，並啟用 Calendar-aware ETA |
| VIP / 急件優先 | 用 item profile 或 min priority 建立專用 route |
| 避免 item 卡住 | 保留至少一條無 filter route |
| 找 routing 規則問題 | 跑模擬後查看 Routing Diagnostics 的 Fallback 和 Actual Share |

---

## 8. 常見問題

### Q: Load-aware 會完全選最短隊列嗎？

不會。FlowSim 仍採用 weighted random，只是降低壅塞目標的權重。這比永遠選最短隊列更穩定，可避免所有 item 同時湧向同一個剛變空的節點。

### Q: Probability 加起來一定要等於 1 嗎？

建議接近 1，但不強制。模擬時會將有效候選 route 正規化。

### Q: 為什麼 VIP 沒走 VIP lane？

請檢查：

1. Start node 是否真的產生 VIP profile。
2. VIP route 的 `itemProfileIds` 是否包含正確 profile id。
3. priority filter 是否過高。
4. 是否因 route target 被刪除或未連線。

### Q: Fallback 為什麼出現？

代表第一次找不到符合 filter 的 route。這不一定是錯誤；可能是系統使用一般 route 作為安全出口。但如果 fallback 很高，建議檢查 filter 規則。
