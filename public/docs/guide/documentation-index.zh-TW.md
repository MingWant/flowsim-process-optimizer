# FlowSim 文檔索引

語言：繁體中文  
更新：2026-06-07

## 1. 文檔入口

| 文檔 | 說明 | 繁體中文 | 简体中文 | English |
| --- | --- | --- | --- | --- |
| 完整使用手冊 | 全系統操作、節點配置、指標、模板 | [開啟](user-guide.md) | [打开](user-guide.md) | [Open](user-guide.md) |
| Routing 配置與診斷 | Load-aware、profile/priority 分流、fallback 與診斷表 | [開啟](routing-configuration.zh-TW.md) | [打开](routing-configuration.zh-CN.md) | [Open](routing-configuration.en.md) |
| 等待時間快速參考 | 5 分鐘決策表和讀數口訣 | [開啟](wait-time-quick-reference.zh-TW.md) | [打开](wait-time-quick-reference.zh-CN.md) | [Open](wait-time-quick-reference.en.md) |
| 等待時間模式配置 | 三種模式、場景、FAQ | [開啟](wait-time-mode-configuration.zh-TW.md) | [打开](wait-time-mode-configuration.zh-CN.md) | [Open](wait-time-mode-configuration.en.md) |
| 雙等待時間指標 | 指標口徑、聚合方式、技術解讀 | [開啟](../technical/dual-wait-time-metrics.zh-TW.md) | [打开](../technical/dual-wait-time-metrics.zh-CN.md) | [Open](../technical/dual-wait-time-metrics.en.md) |
| 模擬演算法詳解 | Tick、到達、資源、日曆與統計演算法 | [開啟](../technical/simulation-algorithm.zh-TW.md) | [打开](../technical/simulation-algorithm.zh-CN.md) | [Open](../technical/simulation-algorithm.en.md) |
| 模擬模式指南 | Realistic、Worst-Case、資源執行模式 | [開啟](../technical/simulation-mode-guide.zh-TW.md) | [打开](../technical/simulation-mode-guide.zh-CN.md) | [Open](../technical/simulation-mode-guide.en.md) |
| 多段工作時間 | Business Hours、queue/delay/reject、Override | [開啟](../technical/multi-segment-business-hours.zh-TW.md) | [打开](../technical/multi-segment-business-hours.zh-CN.md) | [Open](../technical/multi-segment-business-hours.en.md) |
| 排障指南 | 症狀 → 檢查 → 修復 | [開啟](../technical/troubleshooting.zh-TW.md) | [打开](../technical/troubleshooting.zh-CN.md) | [Open](../technical/troubleshooting.en.md) |
| 配置與資料模型 | 配置結構、匯入清理、文檔入口維護 | [開啟](../technical/configuration-reference.zh-TW.md) | [打开](../technical/configuration-reference.zh-CN.md) | [Open](../technical/configuration-reference.en.md) |

---

## 2. 推薦閱讀路徑

| 場景 | 閱讀順序 |
| --- | --- |
| 第一次使用 | 完整使用手冊 → 等待時間快速參考 → 排障指南 |
| 做 SLA 報告 | 等待時間模式配置 → 雙等待時間指標 → 快速參考 |
| 做容量規劃 | 完整使用手冊 → 模擬模式指南 → 雙等待時間指標 |
| 設定動態分流 | Routing 配置與診斷 → Routing Demo → 排障指南 |
| 理解演算法口徑 | 模擬演算法詳解 → 雙等待時間指標 → 配置與資料模型 |
| 調整營業時間 | 多段工作時間 → 等待時間模式配置 → 雙等待時間指標 |
| 找瓶頸 | 快速參考 → 雙等待時間指標 → 排障指南 |
| 維護文檔系統 | 本索引 → `public/docs/README.md` → `constants/documents.ts` |

---

## 3. 文檔目錄規範

| 目錄 | 用途 |
| --- | --- |
| `public/docs/guide/` | 面向使用者的操作指南和快速參考 |
| `public/docs/technical/` | 指標口徑、模式說明、排障和實作相關概念 |
| `public/docs/archive/` | 歷史修復記錄和舊版資料，只作追溯，不作主入口 |

新增主文檔後必須同步：

1. 添加三語文件。
2. 更新 `constants/documents.ts`。
3. 更新本文檔索引。
4. 檢查應用內 Docs 選單和 Markdown 語言切換。