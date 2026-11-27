import { useRef, useState } from 'react'
import type { useStore } from './store'
import type { AppData, Profile } from './types'
import { ACTIVITY_LEVELS, sortedWeights, targets, todayISO } from './util'

type Store = ReturnType<typeof useStore>

export default function Settings({ store, onboarding }: { store: Store; onboarding?: boolean }) {
  const { data, update, replace } = store
  const p = data.profile
  const ws = sortedWeights(data.weights)
  const [f, setF] = useState({
    sex: p?.sex ?? 'female',
    birthYear: String(p?.birthYear ?? 1990),
    heightCm: String(p?.heightCm ?? ''),
    currentKg: ws.length ? String(ws[ws.length - 1].kg) : '',
    activity: p?.activity ?? 1.375,
    goalWeight: String(p?.goalWeight ?? ''),
    weeklyLossKg: p?.weeklyLossKg ?? 0.5
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const build = (): { profile: Profile; kg: number } | null => {
    const h = parseFloat(f.heightCm), g = parseFloat(f.goalWeight), y = parseInt(f.birthYear), kg = parseFloat(f.currentKg)
    if (!(h > 100 && h < 250)) return null
    if (!(g > 20 && g < 400)) return null
    if (!(y > 1920 && y <= new Date().getFullYear() - 10)) return null
    if (!(kg > 20 && kg < 400)) return null
    return { profile: { sex: f.sex as Profile['sex'], birthYear: y, heightCm: h, activity: f.activity, goalWeight: g, weeklyLossKg: f.weeklyLossKg }, kg }
  }
  const built = build()
  const preview = built ? targets(built.profile, built.kg) : null

  const save = () => {
    if (!built) return alert('請把資料填完整')
    update((d) => {
      const latest = sortedWeights(d.weights).pop()
      const weights = latest?.kg === built.kg
        ? d.weights
        : [...d.weights.filter((w) => w.date !== todayISO()), { date: todayISO(), kg: built.kg }]
      return { ...d, profile: built.profile, weights }
    })
    if (!onboarding) alert('已儲存')
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `減重紀錄備份-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as AppData
      if (d.version !== 1 || !Array.isArray(d.logs) || !Array.isArray(d.weights)) throw new Error()
      if (confirm('匯入會覆蓋目前手機裡的所有資料，確定嗎？')) replace(d)
    } catch {
      alert('檔案格式不正確')
    }
  }

  const delCustom = (id: string) => update((d) => ({ ...d, customFoods: d.customFoods.filter((c) => c.id !== id) }))

  return (
    <>
      {!onboarding && <header className="top"><h1>我的</h1></header>}
      <section className="card">
        <b>個人資料</b>
        <div className="row" style={{ margin: '8px 0' }}>
          <button className={f.sex === 'female' ? 'chip on' : 'chip'} onClick={() => setF({ ...f, sex: 'female' })}>女</button>
          <button className={f.sex === 'male' ? 'chip on' : 'chip'} onClick={() => setF({ ...f, sex: 'male' })}>男</button>
        </div>
        <div className="grid2">
          <label className="field">出生年 (西元)<input inputMode="numeric" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value })} /></label>
          <label className="field">身高 (cm)<input inputMode="decimal" value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} /></label>
          <label className="field">目前體重 (kg)<input inputMode="decimal" value={f.currentKg} onChange={(e) => setF({ ...f, currentKg: e.target.value })} /></label>
          <label className="field">目標體重 (kg)<input inputMode="decimal" value={f.goalWeight} onChange={(e) => setF({ ...f, goalWeight: e.target.value })} /></label>
        </div>
        <label className="field">活動量
          <select value={f.activity} onChange={(e) => setF({ ...f, activity: parseFloat(e.target.value) })}>
            {ACTIVITY_LEVELS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
          </select>
        </label>
        <label className="field">每週減重速度
          <div className="row">
            {[0.25, 0.5, 0.75].map((v) => (
              <button key={v} className={f.weeklyLossKg === v ? 'chip on' : 'chip'} onClick={() => setF({ ...f, weeklyLossKg: v })}>{v} kg</button>
            ))}
          </div>
        </label>
        {preview && (
          <div className="preview">
            <div>基礎代謝 <b>{preview.bmr}</b>・每日消耗 <b>{preview.tdee}</b> 大卡</div>
            <div>建議每日攝取 <b className="accent">{preview.kcal}</b> 大卡</div>
            <div className="muted">蛋白質 {preview.protein}g・碳水 {preview.carbs}g・脂肪 {preview.fat}g</div>
            {preview.floored && <div className="warn">已套用安全下限，避免熱量吃太少。</div>}
          </div>
        )}
        <button className="primary block" onClick={save}>{onboarding ? '開始使用' : '儲存'}</button>
      </section>

      {!onboarding && (
        <>
          <section className="card">
            <b>我的食物</b>
            {data.customFoods.length === 0 && <p className="muted">新增餐點時可以建立自訂食物</p>}
            {data.customFoods.map((c) => (
              <div className="log" key={c.id}>
                <div><div>{c.name}</div><small className="muted">{c.unit}・{c.kcal} 大卡</small></div>
                <button className="del" onClick={() => delCustom(c.id)} aria-label="刪除">✕</button>
              </div>
            ))}
          </section>

          <section className="card">
            <b>備份</b>
            <p className="muted">資料只存在這支手機裡。建議每隔一段時間匯出備份，換手機時再匯入。</p>
            <div className="row">
              <button className="ghost" onClick={exportData}>匯出備份</button>
              <button className="ghost" onClick={() => fileRef.current?.click()}>匯入備份</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            </div>
          </section>
          <p className="note">熱量建議依 Mifflin-St Jeor 公式估算，僅供參考，不能取代醫療建議。</p>
        </>
      )}
    </>
  )
}
