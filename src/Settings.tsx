import { useRef, useState } from 'react'
import type { useStore } from './store'
import { ask, toast } from './dialogs'
import { useCap } from './platform'
import { DIETS, type AppData, type DietType, type Profile } from './types'
import { ACTIVITY_LEVELS, sortedWeights, targets, todayISO } from './util'
import { badges, headline } from './habits'
import { Hex, Icon } from './icons'
import { PageHead, Sheet } from './ui'

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

type Page = 'profile' | 'reminders' | 'foods' | 'data' | 'help' | 'badges' | null

export default function ProfilePage({ store }: { store: Store }) {
  const { data, update } = store
  const p = data.profile!
  const [page, setPage] = useState<Page>(null)
  const [editName, setEditName] = useState(false)
  const [name, setName] = useState(p.nickname ?? '')
  const heads = headline(data)

  const saveName = () => {
    update((d) => ({ ...d, profile: { ...d.profile!, nickname: name.trim() } }))
    setEditName(false)
  }

  const menu: { key: Page; icon: string; label: string }[] = [
    { key: 'profile', icon: 'user', label: '個人資料與目標' },
    { key: 'reminders', icon: 'bell', label: '提醒設定' },
    { key: 'foods', icon: 'bowl', label: '我的食物' },
    { key: 'data', icon: 'shield', label: '資料與隱私' },
    { key: 'help', icon: 'book', label: '使用說明' }
  ]

  return (
    <>
      <PageHead title="個人生活誌" en="My Profile" right={<button className="icon-btn" onClick={() => setPage('profile')} aria-label="設定"><Icon name="settings" size={24} /></button>} />

      <section className="me">
        <Avatar />
        <div className="grow">
          {editName ? (
            <div className="row">
              <input className="inline name-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的暱稱" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveName()} />
              <button className="btn-line sm" onClick={saveName}>完成</button>
            </div>
          ) : (
            <button className="me-name" onClick={() => setEditName(true)}>{p.nickname || '設定暱稱'}<Icon name="pencil" size={15} /></button>
          )}
          <div className="me-tag">一起養成更健康的生活習慣！</div>
          <div className="me-diet">{DIETS.find((d) => d.key === (p.diet ?? 'omnivore'))?.label}{p.diet && p.diet !== 'omnivore' && p.fiveSpices === false ? '・不吃五辛' : ''}</div>
        </div>
      </section>

      <section className="block">
        <div className="sec-row">
          <h2 className="sec">成就徽章</h2>
          <button className="link-add" onClick={() => setPage('badges')}>查看全部<Icon name="chevron" size={16} /></button>
        </div>
        <div className="hex-row">
          {heads.map((h) => (
            <div className="hex-cell" key={h.name}>
              <Hex icon={h.icon} got size={60} />
              <b>{h.name}</b>
              <small>{h.value}</small>
            </div>
          ))}
        </div>
      </section>

      <nav className="menu" aria-label="設定">
        {menu.map((m) => (
          <button key={m.label} className="menu-row" onClick={() => setPage(m.key)}>
            <Icon name={m.icon} size={22} />
            <span className="grow">{m.label}</span>
            <Icon name="chevron" size={18} className="chev" />
          </button>
        ))}
      </nav>

      {page === 'profile' && <Sheet title="個人資料與目標" onClose={() => setPage(null)} full><ProfileForm store={store} onDone={() => setPage(null)} /></Sheet>}
      {page === 'reminders' && <Sheet title="提醒設定" onClose={() => setPage(null)}><Reminders store={store} /></Sheet>}
      {page === 'foods' && <Sheet title="我的食物" onClose={() => setPage(null)} full><MyFoods store={store} /></Sheet>}
      {page === 'data' && <Sheet title="資料與隱私" onClose={() => setPage(null)}><DataPrivacy store={store} /></Sheet>}
      {page === 'help' && <Sheet title="使用說明" onClose={() => setPage(null)} full><Help /></Sheet>}
      {page === 'badges' && <Sheet title="成就徽章" onClose={() => setPage(null)} full><AllBadges data={data} /></Sheet>}
    </>
  )
}

function Avatar() {
  return (
    <svg className="avatar" viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <linearGradient id="av-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sky-1)" /><stop offset="1" stopColor="var(--sky-2)" /></linearGradient>
        <clipPath id="av-c"><circle cx="40" cy="40" r="40" /></clipPath>
      </defs>
      <g clipPath="url(#av-c)">
        <rect width="80" height="80" fill="url(#av-sky)" />
        <g fill="var(--cloud)">
          <circle cx="26" cy="56" r="12" /><circle cx="40" cy="50" r="15" /><circle cx="56" cy="57" r="11" /><rect x="14" y="56" width="54" height="30" />
          <circle cx="58" cy="26" r="6" opacity=".7" /><circle cx="66" cy="28" r="5" opacity=".7" />
        </g>
      </g>
    </svg>
  )
}

function AllBadges({ data }: { data: AppData }) {
  const list = badges(data)
  return (
    <>
      <p className="muted small">已獲得 {list.filter((b) => b.got).length} / {list.length} 個</p>
      <div className="badge-grid">
        {list.map((b) => (
          <div key={b.name} className={b.got ? 'badge got' : 'badge'}>
            <Hex icon={b.icon} got={b.got} size={58} />
            <b>{b.name}</b>
            <small>{b.got ? b.desc : b.progress ?? b.desc}</small>
          </div>
        ))}
      </div>
    </>
  )
}

export function ProfileForm({ store, onboarding, onDone }: { store: Store; onboarding?: boolean; onDone?: () => void }) {
  const { data, update } = store
  const p = data.profile
  const ws = sortedWeights(data.weights)
  const [f, setF] = useState({
    sex: p?.sex ?? 'female',
    birthYear: String(p?.birthYear ?? 1990),
    heightCm: String(p?.heightCm ?? ''),
    currentKg: ws.length ? String(ws[ws.length - 1].kg) : '',
    activity: p?.activity ?? 1.2,
    goalWeight: String(p?.goalWeight ?? ''),
    weeklyLossKg: p?.weeklyLossKg ?? 0.5,
    diet: (p?.diet ?? 'lacto-ovo') as DietType,
    fiveSpices: p?.fiveSpices ?? false,
    exerciseAddBack: p?.exerciseAddBack ?? 0.5,
    stepGoal: String(p?.stepGoal ?? 8000),
    waterGoal: String(p?.waterGoal ?? 2000)
  })

  const build = (): { profile: Profile; kg: number } | null => {
    const h = parseFloat(f.heightCm), g = parseFloat(f.goalWeight), y = parseInt(f.birthYear), kg = parseFloat(f.currentKg)
    if (!(h > 100 && h < 250) || !(g > 20 && g < 400) || !(y > 1920 && y <= new Date().getFullYear() - 10) || !(kg > 20 && kg < 400)) return null
    const sg = parseInt(f.stepGoal), wg = parseInt(f.waterGoal)
    return {
      profile: {
        ...(p ?? {}),
        sex: f.sex as Profile['sex'], birthYear: y, heightCm: h, activity: f.activity, goalWeight: g, weeklyLossKg: f.weeklyLossKg,
        diet: f.diet, fiveSpices: f.fiveSpices, exerciseAddBack: f.exerciseAddBack,
        stepGoal: sg >= 1000 && sg <= 50000 ? sg : 8000, waterGoal: wg >= 500 && wg <= 5000 ? wg : 2000
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
      const weights = latest?.kg === built.kg ? d.weights : [...d.weights.filter((w) => w.date !== todayISO()), { date: todayISO(), kg: built.kg }]
      return { ...d, profile: built.profile, weights }
    })
    if (!onboarding) toast('已儲存')
    onDone?.()
  }
  const veg = f.diet !== 'omnivore'
  const chip = (on: boolean) => (on ? 'chip on' : 'chip')

  return (
    <div className="form">
      <h3 className="sec">基本資料</h3>
      <div className="row">
        <button className={chip(f.sex === 'female')} onClick={() => setF({ ...f, sex: 'female' })}>女</button>
        <button className={chip(f.sex === 'male')} onClick={() => setF({ ...f, sex: 'male' })}>男</button>
      </div>
      <div className="grid2">
        <label className="field">出生年（西元）<input inputMode="numeric" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value })} /></label>
        <label className="field">身高（cm）<input inputMode="decimal" value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} /></label>
        <label className="field">目前體重（kg）<input inputMode="decimal" value={f.currentKg} onChange={(e) => setF({ ...f, currentKg: e.target.value })} /></label>
        <label className="field">目標體重（kg）<input inputMode="decimal" value={f.goalWeight} onChange={(e) => setF({ ...f, goalWeight: e.target.value })} /></label>
      </div>

      <h3 className="sec">飲食習慣</h3>
      <label className="field">類型
        <select value={f.diet} onChange={(e) => setF({ ...f, diet: e.target.value as DietType })}>
          {DIETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <small>{DIETS.find((d) => d.key === f.diet)?.desc}</small>
      </label>
      {veg && (
        <label className="field">五辛（蔥、蒜、韭、薤、興渠）
          <div className="row">
            <button className={chip(!f.fiveSpices)} onClick={() => setF({ ...f, fiveSpices: false })}>不吃五辛</button>
            <button className={chip(f.fiveSpices)} onClick={() => setF({ ...f, fiveSpices: true })}>可以吃</button>
          </div>
        </label>
      )}

      <h3 className="sec">目標</h3>
      <label className="field">每週減重速度
        <div className="row">
          {[0.25, 0.5, 0.75].map((v) => <button key={v} className={chip(f.weeklyLossKg === v)} onClick={() => setF({ ...f, weeklyLossKg: v })}>{v} kg</button>)}
        </div>
      </label>
      <div className="grid2">
        <label className="field">每日步數目標<input inputMode="numeric" value={f.stepGoal} onChange={(e) => setF({ ...f, stepGoal: e.target.value.replace(/\D/g, '') })} /></label>
        <label className="field">每日喝水（ml）<input inputMode="numeric" value={f.waterGoal} onChange={(e) => setF({ ...f, waterGoal: e.target.value.replace(/\D/g, '') })} /></label>
      </div>
      <label className="field">平常的活動量（不含另外記錄的步數與運動）
        <select value={f.activity} onChange={(e) => setF({ ...f, activity: parseFloat(e.target.value) })}>
          {ACTIVITY_LEVELS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
        </select>
        <small>有記錄步數的話，選「久坐」最準，走路會另外加回。</small>
      </label>
      {!onboarding && (
        <label className="field">活動消耗加回飲食額度
          <div className="row">
            {[0, 0.5, 1].map((v) => <button key={v} className={chip(f.exerciseAddBack === v)} onClick={() => setF({ ...f, exerciseAddBack: v })}>{v === 0 ? '不加回' : `${v * 100}%`}</button>)}
          </div>
        </label>
      )}

      {preview && (
        <div className="preview">
          <div className="muted small">基礎代謝 {preview.bmr}・每日消耗 {preview.tdee} kcal</div>
          <div>建議每日攝取 <b className="accent-num">{preview.kcal}</b> kcal</div>
          <div className="muted small">蛋白質 {preview.protein} g・碳水 {preview.carbs} g・脂肪 {preview.fat} g</div>
          {preview.floored && <div className="warn small">已套用安全下限，避免熱量吃太少。</div>}
        </div>
      )}
      <button className="btn-dark" onClick={save}>{onboarding ? '開始使用' : '儲存'}</button>
      <p className="note">熱量建議依 Mifflin-St Jeor 公式估算，僅供參考，不能取代醫療建議。</p>
    </div>
  )
}

function Reminders({ store }: { store: Store }) {
  const p = store.data.profile!
  const r = p.reminders ?? { weight: true, meals: true, water: true }
  const set = (k: keyof typeof r, v: boolean) => store.update((d) => ({ ...d, profile: { ...d.profile!, reminders: { ...r, [k]: v } } }))
  const rows: { k: keyof typeof r; icon: string; label: string; desc: string }[] = [
    { k: 'weight', icon: 'scale', label: '量體重', desc: '當天還沒記錄體重時提醒' },
    { k: 'meals', icon: 'bowl', label: '記錄三餐', desc: '10 點、14 點、20 點後還沒記錄時提醒' },
    { k: 'water', icon: 'drop', label: '喝水', desc: '依時間比較喝水進度，落後時提醒' }
  ]
  return (
    <>
      <p className="muted small">提醒會在打開 App 時，顯示在「飲食日誌」上方。Claude 頁面無法在背景發通知；需要手機通知的話，可以請 Claude 幫你在 Google 日曆建立每日提醒。</p>
      {rows.map((x) => (
        <label className="menu-row toggle" key={x.k}>
          <Icon name={x.icon} size={22} />
          <span className="grow"><span>{x.label}</span><small>{x.desc}</small></span>
          <input type="checkbox" role="switch" checked={r[x.k]} onChange={(e) => set(x.k, e.target.checked)} />
        </label>
      ))}
    </>
  )
}

function MyFoods({ store }: { store: Store }) {
  const { data, update } = store
  const del = async (id: string, name: string) => {
    if (await ask(`從我的食物刪除「${name}」？`, '刪除')) update((d) => ({ ...d, customFoods: d.customFoods.filter((c) => c.id !== id) }))
  }
  return (
    <>
      {data.customFoods.length === 0 && <p className="empty">新增餐點時可以建立自訂食物；拍過條碼並存起來的產品也會出現在這裡。</p>}
      {data.customFoods.map((c) => (
        <div className="item" key={c.id}>
          <div className="grow"><div>{c.name}</div><small className="muted">{c.unit}・{c.kcal} kcal{c.barcode ? `・條碼 ${c.barcode}` : ''}</small></div>
          <button className="icon-btn sm" onClick={() => del(c.id, c.name)} aria-label={`刪除 ${c.name}`}><Icon name="trash" size={18} /></button>
        </div>
      ))}
    </>
  )
}

function DataPrivacy({ store }: { store: Store }) {
  const { data, replace, status } = store
  const fileRef = useRef<HTMLInputElement>(null)
  const importData = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as AppData
      if (d.version !== 1 || !Array.isArray(d.logs) || !Array.isArray(d.weights)) throw new Error()
      if (await ask('匯入會用備份檔取代目前所有的紀錄，確定嗎？', '匯入')) { replace(d); toast('已匯入備份') }
    } catch {
      toast('檔案格式不正確，請選擇從這個 App 匯出的 .json 備份檔')
    }
  }
  return (
    <>
      <div className="privacy">
        <Icon name="shield" size={26} />
        <p>
          {status === 'cloud'
            ? '紀錄存在你 Claude 帳號的私人空間，只有你看得到，換手機登入同一個帳號也還在。'
            : '紀錄只存在這個瀏覽器裡，清除瀏覽器資料就會消失，建議定期匯出備份。'}
          使用拍照辨識、讀截圖和 AI 建議時，照片與紀錄摘要會傳給 Claude 分析。
        </p>
      </div>
      <button className="menu-row" onClick={() => download(`減重紀錄備份-${todayISO()}.json`, JSON.stringify(data, null, 2))}>
        <Icon name="download" size={22} /><span className="grow">匯出備份檔</span><Icon name="chevron" size={18} className="chev" />
      </button>
      <button className="menu-row" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" size={22} /><span className="grow">匯入備份檔<small>舊版 App 的備份也可以匯入</small></span><Icon name="chevron" size={18} className="chev" />
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importData(f) }} />
    </>
  )
}

function Help() {
  const items: { icon: string; title: string; text: string }[] = [
    { icon: 'camera', title: '拍照辨識', text: '新增餐點 → 拍照／聚餐。拍下整份餐點，Claude 會列出每樣食物和熱量，可以先修改再加入。第一次使用要在跳出的視窗允許 Claude。' },
    { icon: 'users', title: '聚餐分食', text: '拍照時切到「聚餐分食」，選人數，開動前拍整桌菜。每道合菜選「沒吃／一點／平均／比較多」，自動算出你那一份。' },
    { icon: 'barcode', title: '拍條碼', text: '拍包裝上的條碼。存過的產品會直接找到；新的產品拍營養標示，Claude 會讀出數值並幫你存起來。' },
    { icon: 'footprints', title: '步數', text: '在 iPhone 健康 App 或 Garmin Connect 截一張步數畫面（建議選「週」），到「活動 → 匯入步數截圖」，一次補齊 7 天。' },
    { icon: 'sparkle', title: 'AI 飲食建議', text: '記錄 3 天以上後到「建議」按「產生建議」，Claude 會依你的奶蛋素、不吃五辛習慣給具體建議。' },
    { icon: 'leaf', title: '素食提醒', text: '辨識結果裡標示「注意」的食物，可能含葷料、葷高湯或五辛，點菜或購買前可以再確認。' }
  ]
  return (
    <>
      {items.map((x) => (
        <div className="help" key={x.title}>
          <Icon name={x.icon} size={24} />
          <div><b>{x.title}</b><p>{x.text}</p></div>
        </div>
      ))}
    </>
  )
}
