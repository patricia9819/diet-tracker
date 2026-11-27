// 運動強度 MET 值（參考 Compendium of Physical Activities），消耗 ≈ MET × 體重(kg) × 小時
export const ACTIVITIES: { name: string; met: number }[] = [
  { name: '散步', met: 3.0 },
  { name: '快走', met: 4.3 },
  { name: '慢跑', met: 7.0 },
  { name: '跑步（時速 10 公里）', met: 9.8 },
  { name: '騎腳踏車（休閒）', met: 4.0 },
  { name: '飛輪', met: 8.5 },
  { name: '游泳', met: 6.0 },
  { name: '瑜伽', met: 2.5 },
  { name: '皮拉提斯', met: 3.0 },
  { name: '重量訓練', met: 5.0 },
  { name: '有氧舞蹈', met: 6.5 },
  { name: '爬樓梯', met: 8.0 },
  { name: '跳繩', met: 11.0 },
  { name: '登山健行', met: 6.0 },
  { name: '羽球', met: 5.5 },
  { name: '籃球', met: 6.5 },
  { name: '做家事', met: 3.0 }
]
