# 配置、匯入匯出與資料模型參考

語言：繁體中文  
更新：2026-06-07

## 1. 配置結構

FlowSim 的主配置型別是 `SimulationConfig`，由全域設定和步驟陣列組成。

| 欄位 | 含義 |
| --- | --- |
| `steps` | 所有 Start、Process、End 節點 |
| `isRunning` | 是否正在運行；匯入時會重設為 false |
| `speedMultiplier` | Speed 倍率 |
| `timeCompression` | Sim Clock，每真實 ms 推進多少模擬 ms |
| `simulationMode` | `realistic` 或 `worst-case` |
| `calendarStartIso` | 模擬 0 點對應的日曆時間 |
| `businessCalendar` | 全域工作日曆 |
| `demandModifiers` | 全域需求高峰 |
| `autoPause` | 自動暫停條件 |
| `waitTimeCalculationMode` | `both`、`calendar`、`working` |

---

## 2. 節點資料模型

所有節點都是 `ProcessStep`，透過 `type` 區分。

| type | 核心欄位 | 用途 |
| --- | --- | --- |
| `start` | arrivalModel、arrivalRate、arrivalSchedule、arrivalEvents、itemProfiles | 建立 item |
| `process` | capacity、simulationMode、resourceExecutionMode、processingTime、failureProbability | 排隊、處理、失敗、取消 |
| `end` | endTimeUnit | 流程終點和顯示單位 |

所有非 End 節點都可有 `connections`。所有節點都有 `id`、`name`、`color`、`x`、`y`。

---

## 3. 預設示例流程

預設配置是線上訂單流程：

```text
Online Orders → Order Taking → Preparation → Quality Check → Packaging → Shipment
                         ↑                 |
                         └──── 10% rework ─┘
```

關鍵預設值：Start 為 12 items / hour；Order Taking Capacity 2，Processing 2 秒，Queue Cancellation 5% / sec；Preparation Capacity 3，Processing 4 秒，10% failure；Quality Check Capacity 1，Processing 1.5 秒，5% failure，90% 去 Packaging，10% 回 Preparation；Packaging Capacity 2，Processing 1 秒。

---

## 4. 匯入清理規則

匯入入口是 `parseImportedConfig`，可接受直接 `SimulationConfig` 或 `{ config: ... }` 包裝格式。

| 項目 | 規則 |
| --- | --- |
| 節點類型 | 只接受 start/process/end |
| 機率 | 限制到 0-1 |
| Connections | 移除不存在目標和自連線，再歸一化機率 |
| Capacity | 至少 1，僅 Process 使用 |
| Batch size | 1 到 1000 |
| Scheduled quantity | 最大 50000 |
| Teams | resources 限制為正整數 |
| Explicit teams | 保存前要求總資源數等於 Capacity |
| Working hours | 無效時段會被忽略，預設 9-17 |
| Demand multiplier | 最小 0.01 |
| Auto Pause target | 必須為正數 |

---

## 5. 多語文檔入口配置

應用內 Docs 選單由 `constants/documents.ts` 管理。

| 欄位 | 含義 |
| --- | --- |
| `id` | 文檔唯一標識 |
| `title` | 選單顯示標題 |
| `shortTitle` | 簡短標題 |
| `description` | 選單描述 |
| `category` | guide 或 technical |
| `defaultPath` | 預設打開路徑 |
| `alternates` | zh-TW、zh-CN、en 三語路徑 |

新增主文檔時，應同步添加三語文件、更新 `MARKDOWN_DOCS`、更新文檔索引和 README。

---

## 6. 本地草稿和備份

FlowSim 會用瀏覽器 localStorage 保存草稿。草稿適合短期恢復，不適合作為長期備份。重要實驗、分享模型或匯入別人 JSON 前，建議先 Export。

---

## 7. 維護建議

| 任務 | 建議 |
| --- | --- |
| 新增欄位 | 同步更新 `types.ts`、sanitize、預設值、文檔 |
| 新增節點模式 | 同步 Step Editor、模擬核心、StatsBoard、匯入清理 |
| 新增文檔 | 三語補齊並更新 `constants/documents.ts` |
| 修改演算法口徑 | 更新演算法文檔、等待時間文檔和排障指南 |
| 修改指標 | 更新 StatsBoard 說明和技術指標文檔 |