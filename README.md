# 減重飲食紀錄

個人用的體重與飲食追蹤 App（PWA）。資料只存在手機瀏覽器裡，不會上傳。

## 功能
- 依身高、體重、年齡、活動量計算基礎代謝、每日消耗與建議熱量（有安全下限）
- 早／午／晚餐／點心飲食紀錄，內建常見台灣食物，可自訂食物、顯示最近吃過
- 熱量環形圖、蛋白質／碳水／脂肪進度、喝水紀錄
- 體重與體脂紀錄、7 日平均趨勢圖、BMI、減重速度
- JSON 匯出／匯入備份

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
