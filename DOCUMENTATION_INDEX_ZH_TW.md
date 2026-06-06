# 雙等待時間指標 - 文檔索引（繁體中文）

## 📚 完整文檔列表

### 🚀 快速開始（推薦從這裡開始）

#### [等待時間模式 - 快速參考](WAIT_TIME_QUICK_REFERENCE_ZH_TW.md) ⭐ 最快上手
**5 分鐘速覽**
- 三種模式的簡單說明
- 快速決策表
- 常見使用技巧

#### [等待時間計算模式配置 - 使用者指南](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md) ⭐ 完整指南
**完整學習**
- 三種模式的詳細說明
- 實際使用案例
- 常見問題解答
- 進階使用技巧

---

### 📖 深入理解（英文/簡體）

#### [雙等待時間指標實作](DUAL_WAIT_TIME_METRICS.md)
**技術詳解**（英文+簡體）
- 兩種等待時間的定義
- 計算邏輯說明
- 使用場景詳解
- 實際案例分析

#### [等待時間分析](WAIT_TIME_ANALYSIS.md)
**概念深度解析**（英文+簡體）
- 兩種定義的優劣分析
- 混合方案的設計思路
- 決策考量因素

---

### 🛠️ 技術實作（開發者）

#### [配置模式實作總結](CONFIG_MODE_IMPLEMENTATION.md)
**方案 A 實作細節**（英文+簡體）
- 程式碼變更
- 資料流程
- 測試結果
- 未來擴展建議

#### [UI 更新總結](UI_UPDATES_SUMMARY.md)
**介面變更**（英文+簡體）
- StatsBoard 更新
- 顯示效果
- 顏色編碼

#### [工作時間邏輯修復](WORKING_HOURS_FIXES.md)
**底層修復**（英文+簡體）
- 邊界定義統一
- 邊緣情況處理
- 函數修正

---

## 🎯 按使用角色選擇文檔

### 👤 一般使用者
1. 先看：[快速參考](WAIT_TIME_QUICK_REFERENCE_ZH_TW.md) 
2. 再看：[使用者指南](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md)
3. 需要時：[雙指標詳解](DUAL_WAIT_TIME_METRICS.md)

### 📊 資料分析師
1. [使用者指南](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md) - 了解三種模式
2. [雙指標詳解](DUAL_WAIT_TIME_METRICS.md) - 深入理解計算
3. [等待時間分析](WAIT_TIME_ANALYSIS.md) - 掌握分析方法

### 💻 開發者
1. [配置模式實作](CONFIG_MODE_IMPLEMENTATION.md) - 技術實作
2. [UI 更新總結](UI_UPDATES_SUMMARY.md) - 介面變更
3. [工作時間修復](WORKING_HOURS_FIXES.md) - 底層邏輯

### 🎓 系統管理員
1. [使用者指南](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md) - 功能說明
2. [快速參考](WAIT_TIME_QUICK_REFERENCE_ZH_TW.md) - 培訓材料
3. [配置模式實作](CONFIG_MODE_IMPLEMENTATION.md) - 系統設定

---

## 📋 按使用場景選擇文檔

### 場景 1：剛開始使用
**步驟**：
1. 讀 [快速參考](WAIT_TIME_QUICK_REFERENCE_ZH_TW.md)（5 分鐘）
2. 開啟系統，找到左側邊欄的「Wait Time Calculation」
3. 選擇 📊 **Both** 模式
4. 觀察統計面板的兩個等待時間指標

### 場景 2：準備客戶報告
**步驟**：
1. 讀 [使用者指南 - 場景 2](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md#場景-2準備客戶報告)
2. 切換到 📅 **Calendar Time** 模式
3. 匯出或截圖資料
4. 用於客戶報告

### 場景 3：容量規劃決策
**步驟**：
1. 讀 [使用者指南 - 場景 4](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md#場景-4容量規劃)
2. 先看 📊 **Both** 模式，了解全局
3. 切換到 ⏱️ **Working Time**，聚焦佇列效率
4. 根據 Working Time 決定是否增加資源

### 場景 4：對比不同配置
**步驟**：
1. 讀 [使用者指南 - 場景 5](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md#場景-5對比不同配置)
2. 切換到 ⏱️ **Working Time** 模式
3. 測試配置 A，記錄數值
4. 測試配置 B，記錄數值
5. 對比 Working Time（公平比較）

### 場景 5：理解概念差異
**步驟**：
1. 讀 [雙指標詳解 - 案例分析](DUAL_WAIT_TIME_METRICS.md#實際案例分析)
2. 讀 [等待時間分析 - 深度對比](WAIT_TIME_ANALYSIS.md)
3. 實際操作：設定一個週五晚上入隊的場景
4. 觀察兩個指標的差異

---

## 💡 核心概念速記

### 兩種等待時間的本質差異

```
Calendar Time（日曆時間）
= 從入隊到處理的【完整日曆時間】
= 客戶視角：「我等了多久？」
= 包含週末、夜間等非工作時間

Working Time（工作時間）
= 按完成 item 真實經歷聚合的【工作時間內等待】
= 營運視角：「佇列積壓多久？」
= 排除週末、夜間等非工作時間

Diagnostic Working Wait（診斷工作等待）
= 步驟級平均
= 用來找瓶頸，不代表每個 item 的真實平均等待

差值 = 非工作時間的影響
```

### 三種模式的選擇邏輯

```
📊 Both
何時用：完整分析、學習階段、不確定時
優點：資訊最全面
缺點：卡片較多

📅 Calendar Time
何時用：客戶報告、SLA 檢查
優點：客戶視角、對外溝通
缺點：包含非工作時間，可能誤導內部決策

⏱️ Working Time
何時用：資源規劃、內部優化
優點：完成 item 的真實工作時間佇列經歷、公平對比配置
缺點：不反映客戶實際體驗
```

---

## 🎓 學習路徑建議

### 初級使用者（5-15 分鐘）
```
步驟 1：快速參考（5 分鐘）
       ↓
步驟 2：開啟系統試用（5 分鐘）
       ↓
步驟 3：切換三種模式，觀察變化（5 分鐘）
```

### 中級使用者（30-60 分鐘）
```
步驟 1：完整使用者指南（20 分鐘）
       ↓
步驟 2：實際場景練習（20 分鐘）
       - 準備一份客戶報告
       - 做一次容量規劃決策
       ↓
步驟 3：雙指標詳解（20 分鐘）
```

### 高級使用者（2-3 小時）
```
步驟 1：完整使用者指南（20 分鐘）
       ↓
步驟 2：雙指標詳解（30 分鐘）
       ↓
步驟 3：等待時間分析（30 分鐘）
       ↓
步驟 4：配置模式實作（30 分鐘）
       ↓
步驟 5：進階場景練習（30 分鐘）
```

---

## 📞 需要協助？

### 快速問題
查看 [快速參考](WAIT_TIME_QUICK_REFERENCE_ZH_TW.md) 或 [使用者指南 - 常見問題](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md#常見問題)

### 使用問題
查看 [使用者指南](WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md)

### 概念理解
查看 [雙指標詳解](DUAL_WAIT_TIME_METRICS.md) 或 [等待時間分析](WAIT_TIME_ANALYSIS.md)

### 技術實作
查看 [配置模式實作](CONFIG_MODE_IMPLEMENTATION.md)

---

## ✅ 檢查清單

### 使用前
- [ ] 已閱讀快速參考
- [ ] 了解三種模式的差異
- [ ] 知道如何在設定中切換模式

### 第一次使用
- [ ] 找到左側邊欄的「Wait Time Calculation」
- [ ] 成功切換三種模式
- [ ] 觀察到統計面板的變化

### 實際應用
- [ ] 為客戶報告選擇正確模式
- [ ] 為內部優化選擇正確模式
- [ ] 理解兩種等待時間的差異含義

---

## 🎉 開始使用

**推薦起點**：
1. 花 5 分鐘讀 → [快速參考](WAIT_TIME_QUICK_REFERENCE_ZH_TW.md)
2. 開啟系統 → 左側邊欄 → Wait Time Calculation
3. 選擇 📊 **Both** → 開始探索！

**記住**：沒有「最好」的模式，只有「最適合」的模式。根據你的任務選擇，隨時切換！
