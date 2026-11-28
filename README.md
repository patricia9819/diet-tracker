# 減重飲食紀錄

個人用的體重與飲食追蹤 App（PWA）。個人用的體重與飲食追蹤 App。

## 功能
- 依身高、體重、年齡、活動量計算基礎代謝、每日消耗與建議熱量（有安全下限）
- 飲食習慣設定（奶蛋素、奶素、蛋素、全素、葷食；可設定是否吃五辛），食物清單會隱藏葷食品項
- 早／午／晚餐／點心飲食紀錄，內建常見台灣食物與素食品項，可自訂食物、顯示最近吃過
- 📷 拍照辨識餐點（Claude AI），會提醒可能含葷或五辛的食物
- 🔍 拍條碼：存過的食物直接找到；新的產品拍營養標示由 AI 讀取
- 🏃 運動紀錄（MET 估算或手動輸入），可設定加回飲食額度的比例
- 🤖 AI 飲食建議：依最近 7 天紀錄與飲食習慣產生
- 🔔 今日提醒：還沒量體重、還沒記的餐點、喝水進度
- 🏆 連續記錄天數與成就徽章
- 熱量環形圖、蛋白質／碳水／脂肪進度、喝水紀錄
- 體重與體脂紀錄、7 日平均趨勢圖、BMI、減重速度
- JSON 匯出／匯入備份

## 主要版本：Claude 頁面
App 發布為 claude.ai 上的 Claude 頁面（Artifact），在 Claude App 或 claude.ai 打開：
- 拍照辨識、讀營養標示、AI 建議使用你自己的 Claude 帳號，不需要 API 金鑰
- 紀錄存在你 Claude 帳號的私人空間（`data/users/<你的 id>/`），只有你看得到
- 打包：`npm run build:artifact` 產生 `dist-artifact/diet-tracker.html`

GitHub Pages 上的版本仍可使用（資料存在瀏覽器），但沒有 AI 功能。

## 安裝到手機
1. 用手機打開部署好的網址
2. iPhone：Safari → 分享 → 加入主畫面；Android：Chrome → 選單 → 安裝應用程式
3. 之後從主畫面圖示開啟，像一般 App 一樣使用，也能離線使用

## 開發
```
npm install
npm run dev     # 開發伺服器
npm run build   # 產出 dist/
```
推送到 `main` 會由 GitHub Actions 自動部署到 GitHub Pages（需在 repo 設定 → Pages → Source 選 GitHub Actions）。
