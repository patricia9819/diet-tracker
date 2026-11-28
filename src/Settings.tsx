import { useRef, useState } from 'react'
import type { useStore } from './store'
import { ask, toast } from './dialogs'
import { useCap } from './platform'
import { DIETS, type AppData, type DietType, type Profile } from './types'
import { ACTIVITY_LEVELS, sortedWeights, targets, todayISO } from './util'
import { badges } from './habits'

type Store = ReturnType<typeof useStore>

/** 存檔：Claude 頁面用 downloads 功能，其他地方用一般下載 */
async function download(name: string, text: string) {
  const dl = await useCap<{ save: (r: { filename: string; data: string }) => Promise<unknown> }>('downloads')
  if (dl) {
    try { await dl.save({ filename: name, data: text }); toast('已匯出備份') }
    catch (e) { const c = (e as { code?: string }).code; if (c !== 'declined') toast(c === 'host_unavailable' ? '這個 App 無法存檔，請改用瀏覽器打開 claude.ai。' : '匯出失敗，請再試一次。') }
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

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
    weeklyLossKg: p?.weeklyLossKg ?? 0.5,
    diet: (p?.diet ?? 'lacto-ovo') as DietType,
    fiveSpices: p?.fiveSpices ?? false,
    exerciseAddBack: p?.exerciseAddBack ?? 0.5
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const build = (): { profile: Profile; kg: number } | null => {
    const h = parseFloat(f.heightCm), g = parseFloat(f.goalWeight), y = parseInt(f.birthYear), kg = parseFloat(f.currentKg)
    if (!(h > 100 && h < 250)) return null
    if (!(g > 20 && g < 400)) return null
    if (!(y > 1920 && y <= new Date().getFullYear() - 10)) return null
    if (!(kg > 20 && kg < 400)) return null
    return {
      profile: {
        sex: f.sex as Profile['sex'], birthYear: y, heightCm: h, activity: f.activity, goalWeight: g, weeklyLossKg: f.weeklyLossKg,
        diet: f.diet, fiveSpices: f.fiveSpices, exerciseAddBack: f.exerciseAddBack
      },
      kg
    }
  }
  const built = build()
  const preview = built ? targets(built.profile, built.kg) : null

  const save = () => {
    if (!built) return toast('請把身高、體重、目標和出生年填完整')
    update((d) => {
      const latest = sortedWeights(d.weights).pop()
      const weights = latest?.kg === built.kg
        ? d.weights
        : [...d.weights.filter((w) => w.date !== todayISO()), { date: todayISO(), kg: built.kg }]
      return { ...d, profile: built.profile, weights }
    })
    if (!onboarding) toast('已儲存')
  }

  const exportData = () => download(`減重紀錄備份-${todayISO()}.json`, JSON.stringify(data, null, 2))

  const importData = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as AppData
      if (d.version !== 1 || !Array.isArray(d.logs) || !Array.isArray(d.weights)) throw new Error()
      if (await ask('匯入會用備份檔取代目前所有的紀錄，確定嗎？', '匯入')) { replace(d); toast('已匯入備份') }
    } catch {
      toast('檔案格式不正確，請選擇從這個 App 匯出的 .json 備份檔')
    }
  }

  const delCustom = async (id: string, name: string) => {
    if (await ask(`從我的食物刪除「${name}」？`, '刪除')) update((d) => ({ ...d, customFoods: d.customFoods.filter((c) => c.id !== id) }))
  }
  const veg = f.diet !== 'omnivore'

  return (
    <>
      {!onboarding && <header className="top"><h1>我的</h1></header>}

      {!onboarding && data.profile && <Badges data={data} />}

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
        <label className="field">飲食習慣
          <select value={f.diet} onChange={(e) => setF({ ...f, diet: e.target.value as DietType })}>
            {DIETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <small>{DIETS.find((d) => d.key === f.diet)?.desc}</small>
        </label>
        {veg && (
          <label className="field">五辛（蔥、蒜、韭、薤、興渠）
            <div className="row">
              <button className={f.fiveSpices ? 'chip on' : 'chip'} onClick={() => setF({ ...f, fiveSpices: true })}>可以吃</button>
              <button className={!f.fiveSpices ? 'chip on' : 'chip'} onClick={() => setF({ ...f, fiveSpices: false })}>不吃五辛</button>
            </div>
          </label>
        )}
        {!onboarding && (
          <label className="field">運動消耗加回飲食額度
            <div className="row">
              {[0, 0.5, 1].map((v) => (
                <button key={v} className={f.exerciseAddBack === v ? 'chip on' : 'chip'} onClick={() => setF({ ...f, exerciseAddBack: v })}>{v === 0 ? '不加回' : `${v * 100}%`}</button>
              ))}
            </div>
          </label>
        )}
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
            {data.customFoods.length === 0 && <p className="muted">新增餐點時可以建立自訂食物，掃描過的條碼也會存在這裡</p>}
            {data.customFoods.map((c) => (
              <div className="log" key={c.id}>
                <div><div>{c.name}</div><small className="muted">{c.unit}・{c.kcal} 大卡{c.barcode ? '・🔍 條碼' : ''}</small></div>
                <button className="del" onClick={() => delCustom(c.id, c.name)} aria-label="刪除">✕</button>
              </div>
            ))}
          </section>

          <section className="card">
            <b>備份</b>
            <p className="muted">
              {store.status === 'cloud'
                ? '紀錄存在你 Claude 帳號的私人空間，只有你看得到，換手機登入同一個帳號也會在。也可以匯出一份備份檔自己保存。'
                : '紀錄只存在這個瀏覽器裡，建議定期匯出備份。'}
              舊版 App 匯出的備份檔也可以在這裡匯入。
            </p>
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

function Badges({ data }: { data: AppData }) {
  const list = badges(data)
  const got = list.filter((b) => b.got).length
  const [open, setOpen] = useState(false)
  const shown = open ? list : [...list.filter((b) => b.got), ...list.filter((b) => !b.got)].slice(0, 8)
  return (
    <section className="card">
      <div className="row between"><b>🏆 成就徽章</b><span className="muted">{got} / {list.length}</span></div>
      <div className="badges">
        {shown.map((b) => (
          <div key={b.name} className={b.got ? 'badge got' : 'badge'} title={b.desc}>
            <span className="badge-icon">{b.icon}</span>
            <span className="badge-name">{b.name}</span>
            <small>{b.got ? b.desc : b.progress ?? b.desc}</small>
          </div>
        ))}
      </div>
      <button className="add" onClick={() => setOpen(!open)}>{open ? '收起' : '看全部徽章'}</button>
    </section>
  )
}
