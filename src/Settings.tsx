import { useRef, useState } from 'react'
import { getApiKey, setApiKey, type useStore } from './store'
import { DIETS, type AppData, type DietType, type Profile } from './types'
import { ACTIVITY_LEVELS, sortedWeights, targets, todayISO } from './util'
import { badges } from './habits'
import { buildIcs, DEFAULT_REMINDERS } from './reminders'

type Store = ReturnType<typeof useStore>

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
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
    fiveSpices: p?.fiveSpices ?? true,
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

  const exportData = () => download(`減重紀錄備份-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json')

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
          <AiKey />
          <Reminders store={store} />

          <section className="card">
            <b>我的食物</b>
            {data.customFoods.length === 0 && <p className="muted">新增餐點時可以建立自訂食物，掃描過的條碼也會存在這裡</p>}
            {data.customFoods.map((c) => (
              <div className="log" key={c.id}>
                <div><div>{c.name}</div><small className="muted">{c.unit}・{c.kcal} 大卡{c.barcode ? '・🔍 條碼' : ''}</small></div>
                <button className="del" onClick={() => delCustom(c.id)} aria-label="刪除">✕</button>
              </div>
            ))}
          </section>

          <section className="card">
            <b>備份</b>
            <p className="muted">資料只存在這支手機裡。建議每隔一段時間匯出備份，換手機時再匯入。（API 金鑰不會被匯出）</p>
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

function AiKey() {
  const [key, setKey] = useState(getApiKey())
  const [edit, setEdit] = useState(!getApiKey())
  const [show, setShow] = useState(false)
  const saved = getApiKey()
  return (
    <section className="card">
      <b>🤖 AI 設定</b>
      <p className="muted small">
        拍照辨識、讀營養標示和 AI 建議需要 Claude API 金鑰（依用量付費，每次辨識約台幣 1 元左右）。
        金鑰只存在這支手機上，不會被匯出。
        到 <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> 建立金鑰並儲值後貼上即可。
      </p>
      {edit ? (
        <>
          <div className="row">
            <input className="search grow" type={show ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="sk-ant-..." autoComplete="off" />
            <button className="chip" onClick={() => setShow(!show)}>{show ? '隱藏' : '顯示'}</button>
          </div>
          <div className="row end">
            {saved && <button className="ghost" onClick={() => { setKey(saved); setEdit(false) }}>取消</button>}
            <button className="primary" onClick={() => { if (!key.startsWith('sk-ant-')) return alert('金鑰格式應該是 sk-ant- 開頭'); setApiKey(key); setEdit(false) }}>儲存金鑰</button>
          </div>
        </>
      ) : (
        <div className="row between">
          <span>✅ 已設定（…{saved.slice(-4)}）</span>
          <div className="row">
            <button className="ghost" onClick={() => setEdit(true)}>更換</button>
            <button className="ghost" onClick={() => { if (confirm('刪除 API 金鑰？')) { setApiKey(''); setKey(''); setEdit(true) } }}>刪除</button>
          </div>
        </div>
      )}
    </section>
  )
}

function Reminders({ store }: { store: Store }) {
  const { data, update } = store
  const list = data.reminders ?? DEFAULT_REMINDERS
  const set = (id: string, patch: Partial<(typeof list)[number]>) =>
    update((d) => ({ ...d, reminders: (d.reminders ?? DEFAULT_REMINDERS).map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  const appUrl = location.href.split('#')[0].split('?')[0]
  return (
    <section className="card">
      <b>🔔 提醒</b>
      <p className="muted small">
        網頁 App 無法在背景自己跳通知，所以改用手機「行事曆」提醒：選好時間後按下方按鈕，加入行事曆，每天時間到就會通知你。
      </p>
      {list.map((r) => (
        <div className="log" key={r.id}>
          <label className="check" style={{ margin: 0 }}>
            <input type="checkbox" checked={r.on} onChange={(e) => set(r.id, { on: e.target.checked })} /> {r.label}
          </label>
          <input type="time" className="time" value={r.time} onChange={(e) => e.target.value && set(r.id, { time: e.target.value })} />
        </div>
      ))}
      <button className="primary block" onClick={() => download('減重紀錄提醒.ics', buildIcs(list, appUrl), 'text/calendar')}>📅 加入行事曆</button>
      <p className="note">
        iPhone：按下後選「加入全部」。如果從主畫面 App 按了沒反應，請改用 Safari 打開這個網址再按一次。
        想修改時間，先到行事曆刪除舊的「減重紀錄」提醒，再重新加入。
      </p>
    </section>
  )
}
