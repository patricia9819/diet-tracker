import { useEffect, useMemo, useRef, useState } from 'react'
import type { useStore } from './store'
import { MEALS, mealPhotos, type FoodItem, type Meal } from './types'
import { BUILTIN_FOODS } from './foods'
import { uid } from './util'
import { allowedFood, avoidsFive, dietPrompt } from './diet'
import { friendlyError, maxImages, readNutritionLabel, recognizeMeal, type MealResult } from './ai'
import { decodeBarcode } from './barcode'
import { celebrate, toast } from './dialogs'
import { Icon } from './icons'

type Store = ReturnType<typeof useStore>
type Mode = 'list' | 'pick' | 'custom' | 'photo' | 'scan'

const num = (s: string) => {
  const n = parseFloat(s)
  return isFinite(n) && n >= 0 ? n : 0
}

interface Form { name: string; unit: string; kcal: string; protein: string; carbs: string; fat: string; save: boolean; barcode?: string; note?: string }
const emptyForm = (name = ''): Form => ({ name, unit: '1 份', kcal: '', protein: '', carbs: '', fat: '', save: true })
const toForm = (f: Omit<FoodItem, 'id'>, note = ''): Form => ({
  name: f.name, unit: f.unit, kcal: String(f.kcal), protein: String(f.protein), carbs: String(f.carbs), fat: String(f.fat), save: true, barcode: f.barcode, note
})

/** 把照片縮成小縮圖（存在紀錄裡顯示用） */
export async function makeThumb(photo: Blob): Promise<string> {
  try {
    const bmp = await createImageBitmap(photo)
    const side = 220
    const c = document.createElement('canvas')
    c.width = c.height = side
    const sc = side / Math.min(bmp.width, bmp.height)
    const w = bmp.width * sc, h = bmp.height * sc
    c.getContext('2d')!.drawImage(bmp, (side - w) / 2, (side - h) / 2, w, h)
    return c.toDataURL('image/jpeg', 0.72)
  } catch {
    return ''
  }
}

export default function AddFood({ store, date, meal: initialMeal, onClose }: { store: Store; date: string; meal: Meal; onClose: () => void }) {
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const { data, update } = store
  const p = data.profile!
  const [mode, setMode] = useState<Mode>('list')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<FoodItem | null>(null)
  const [servings, setServings] = useState('1')
  const [form, setForm] = useState<Form>(emptyForm())
  const noFive = avoidsFive(p)

  const all = useMemo(() => [...data.customFoods, ...BUILTIN_FOODS.filter((f) => allowedFood(p, f))], [data.customFoods, p])

  const recents = useMemo(() => {
    const seen = new Set<string>()
    const out: FoodItem[] = []
    for (const l of [...data.logs].reverse()) {
      if (seen.has(l.name)) continue
      seen.add(l.name)
      out.push({ id: l.foodId ?? l.id, name: l.name, unit: l.unit, kcal: l.kcal, protein: l.protein, carbs: l.carbs, fat: l.fat })
      if (out.length >= 8) break
    }
    return out
  }, [data.logs])

  const results = q.trim() ? all.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())) : null

  const addMany = (items: { f: FoodItem; s: number }[], thumbs: string[] = []) => {
    update((d) => ({
      ...d,
      photos: thumbs.length ? { ...d.photos, [date]: { ...(d.photos?.[date] ?? {}), [meal]: [...mealPhotos(d, date, meal), ...thumbs].slice(-8) } } : d.photos,
      logs: [...d.logs, ...items.filter((x) => x.s > 0).map(({ f, s }) => ({ id: uid(), date, meal, foodId: f.id, name: f.name, unit: f.unit, servings: s, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }))]
    }))
    celebrate('leaves')
    onClose()
  }
  const add = (f: FoodItem, s: number) => addMany([{ f, s }])

  const addCustom = () => {
    if (!form.name.trim()) return toast('請輸入名稱')
    const f: FoodItem = {
      id: 'c' + uid(), name: form.name.trim(), unit: form.unit.trim() || '1 份',
      kcal: num(form.kcal), protein: num(form.protein), carbs: num(form.carbs), fat: num(form.fat), custom: true,
      ...(form.barcode ? { barcode: form.barcode } : {})
    }
    if (form.save) update((d) => ({ ...d, customFoods: [f, ...d.customFoods.filter((c) => !(f.barcode && c.barcode === f.barcode))] }))
    add(f, 1)
  }

  const openCustom = (f: Form) => { setForm(f); setMode('custom') }
  const label = MEALS.find((m) => m.key === meal)!.label
  const FoodRow = ({ f }: { f: FoodItem }) => (
    <button className="food" onClick={() => { setPicked(f); setServings('1'); setMode('pick') }}>
      <span>{f.name}{f.custom && <em> 自訂</em>}{noFive && f.five && <em className="warn"> 常含五辛</em>}<small className="muted"> {f.unit}</small></span>
      <span className="muted">{f.kcal}</span>
    </button>
  )

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b>新增{label}</b>
          <button className="icon-btn" onClick={onClose} aria-label="關閉"><Icon name="close" /></button>
        </div>
        {(mode === 'list' || mode === 'photo') && (
          <div className="meal-pick" role="group" aria-label="哪一餐">
            {MEALS.map((m) => <button key={m.key} className={m.key === meal ? 'on' : ''} onClick={() => setMeal(m.key)}>{m.label}</button>)}
          </div>
        )}

        {mode === 'pick' && picked && (
          <div className="pick">
            <h2>{picked.name}</h2>
            <div className="muted">每份：{picked.unit}・{picked.kcal} 大卡</div>
            <label className="field">
              份數
              <div className="row">
                {[0.5, 1, 1.5, 2].map((v) => (
                  <button key={v} className={num(servings) === v ? 'chip on' : 'chip'} onClick={() => setServings(String(v))}>{v}</button>
                ))}
                <input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
              </div>
            </label>
            <div className="macros">
              <span>🔥 {Math.round(picked.kcal * num(servings))} 大卡</span>
              <span>蛋白 {Math.round(picked.protein * num(servings))}g</span>
              <span>碳水 {Math.round(picked.carbs * num(servings))}g</span>
              <span>脂肪 {Math.round(picked.fat * num(servings))}g</span>
            </div>
            <div className="row end">
              <button className="ghost" onClick={() => setMode('list')}>返回</button>
              <button className="primary" onClick={() => add(picked, num(servings))}>加入</button>
            </div>
          </div>
        )}

        {mode === 'custom' && (
          <CustomForm form={form} setForm={setForm} onBack={() => setMode('list')} onAdd={addCustom} />
        )}

        {mode === 'photo' && (
          <PhotoMeal dietInfo={dietPrompt(p)} onBack={() => setMode('list')} onAdd={addMany} />
        )}

        {mode === 'scan' && (
          <Scanner
            customFoods={data.customFoods}
            dietInfo={dietPrompt(p)}
            onBack={() => setMode('list')}
            onFound={(f) => { setPicked(f); setServings('1'); setMode('pick') }}
            onForm={openCustom}
          />
        )}

        {mode === 'list' && (
          <>
            <div className="quick">
              <button onClick={() => setMode('photo')}><Icon name="camera" size={24} />拍照／聚餐</button>
              <button onClick={() => setMode('scan')}><Icon name="barcode" size={24} />拍條碼</button>
              <button onClick={() => openCustom(emptyForm(q))}><Icon name="pencil" size={24} />自己輸入</button>
            </div>
            <input className="search" placeholder="搜尋食物，例如：豆干、豆漿" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="list">
              {!results && recents.length > 0 && <div className="list-title">最近吃過</div>}
              {(results ?? recents).map((f) => <FoodRow key={f.id + f.name} f={f} />)}
              {!results && <div className="list-title">全部食物</div>}
              {!results && all.map((f) => <FoodRow key={f.id} f={f} />)}
              {results && results.length === 0 && <p className="muted center">找不到，可以用上方「拍照辨識」或「自己輸入」</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CustomForm({ form, setForm, onBack, onAdd }: { form: Form; setForm: (f: Form) => void; onBack: () => void; onAdd: () => void }) {
  const field = (k: 'kcal' | 'protein' | 'carbs' | 'fat', label: string) => (
    <label className="field">{label}<input inputMode="decimal" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
  )
  return (
    <div className="pick scroll">
      {form.note && <div className="alert">{form.note}</div>}
      {form.barcode && <div className="muted small">條碼：{form.barcode}（存起來後，下次掃描會直接找到）</div>}
      <label className="field">名稱<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="field">份量描述<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
      <div className="grid2">
        {field('kcal', '熱量 (大卡)')}
        {field('protein', '蛋白質 (g)')}
        {field('carbs', '碳水 (g)')}
        {field('fat', '脂肪 (g)')}
      </div>
      <label className="check"><input type="checkbox" checked={form.save} onChange={(e) => setForm({ ...form, save: e.target.checked })} /> 存到我的食物，下次可直接選</label>
      <div className="row end">
        <button className="ghost" onClick={onBack}>返回</button>
        <button className="primary" onClick={onAdd}>加入</button>
      </div>
    </div>
  )
}

// 聚餐時每道合菜可以選吃了多少（以「平均一人份」為基準）
const SHARE_LEVELS = [
  { label: '沒吃', k: 0 },
  { label: '一點', k: 0.5 },
  { label: '平均', k: 1 },
  { label: '比較多', k: 1.5 }
]
const SOLO_LEVELS = [
  { label: '沒吃', k: 0 },
  { label: '半份', k: 0.5 },
  { label: '一份', k: 1 }
]

function PhotoMeal({ dietInfo, onBack, onAdd }: { dietInfo: string; onBack: () => void; onAdd: (x: { f: FoodItem; s: number }[], thumbs?: string[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [shots, setShots] = useState<{ file: File; url: string }[]>([])
  const [hint, setHint] = useState('')
  const [group, setGroup] = useState(false)
  const [people, setPeople] = useState(4)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<MealResult | null>(null)
  const [items, setItems] = useState<MealResult['items']>([])
  const [share, setShare] = useState<number[]>([]) // 每道菜吃的比例（相對於平均一人份或一份）
  const n = group ? people : 1

  const shotsRef = useRef(shots)
  shotsRef.current = shots
  useEffect(() => () => shotsRef.current.forEach((x) => URL.revokeObjectURL(x.url)), [])
  const choose = async (files: File[]) => {
    setErr(''); setRes(null)
    const max = await maxImages()
    const all = [...shots, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]
    if (all.length > max) { all.slice(max).forEach((x) => URL.revokeObjectURL(x.url)); setErr(`一次最多 ${max} 張，已保留前 ${max} 張。`) }
    setShots(all.slice(0, max))
  }
  const removeShot = (i: number) => { URL.revokeObjectURL(shots[i].url); setShots(shots.filter((_, j) => j !== i)) }

  const run = async () => {
    setBusy(true); setErr('')
    try {
      const r = await recognizeMeal(shots.map((x) => x.file), dietInfo, hint, n)
      setRes(r); setItems(r.items); setShare(r.items.map(() => 1))
    } catch (e) { setErr(friendlyError(e)) }
    setBusy(false)
  }

  // 實際吃下的份數（相對於這道菜的數值）
  const servingsOf = (i: number) => (items[i].shared ? share[i] / n : share[i])
  const mine = (i: number, k: 'kcal' | 'protein' | 'carbs' | 'fat') => items[i][k] * servingsOf(i)
  const total = items.reduce((a, _, i) => a + mine(i, 'kcal'), 0)

  const setItem = (i: number, k: 'kcal' | 'name', v: string) =>
    setItems(items.map((it, j) => (j === i ? { ...it, [k]: k === 'kcal' ? num(v) : v } : it)))

  const confirm = async () => onAdd(items.flatMap((it, i) => share[i] > 0 ? [{
    f: {
      id: 'ai' + uid(),
      name: it.shared ? `${it.name}（聚餐 ${n} 人）` : it.name,
      unit: it.shared ? `整道 ${it.portion}` : it.portion,
      kcal: Math.round(it.kcal), protein: it.protein, carbs: it.carbs, fat: it.fat
    },
    s: Math.round(servingsOf(i) * 1000) / 1000
  }] : []), (await Promise.all(shots.map((x) => makeThumb(x.file)))).filter(Boolean))

  return (
    <div className="pick scroll">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) choose(fs) }} />
      {!res && (
        <div className="seg" role="group" aria-label="用餐方式">
          <button className={!group ? 'on' : ''} onClick={() => setGroup(false)}><Icon name="user" size={18} />自己吃</button>
          <button className={group ? 'on' : ''} onClick={() => setGroup(true)}><Icon name="users" size={18} />聚餐分食</button>
        </div>
      )}
      {!res && group && (
        <div className="people">
          <span>幾個人一起吃</span>
          <div className="row">
            <button className="ghost stepper" onClick={() => setPeople(Math.max(2, people - 1))} aria-label="減少人數"><Icon name="minus" size={18} /></button>
            <b>{people} 人</b>
            <button className="ghost stepper" onClick={() => setPeople(Math.min(30, people + 1))} aria-label="增加人數"><Icon name="plus" size={18} /></button>
          </div>
        </div>
      )}
      {!shots.length ? (
        <div className="center" style={{ padding: '20px 0' }}>
          <p className="muted">
            {group
              ? '開動前把整桌菜拍下來。Claude 會估算每道菜，再由你選每道吃了多少。'
              : '拍下或從相簿選餐點照片，可以一次選好幾張。Claude 會辨識內容並估算熱量。'}
            <br />第一次使用時，請在跳出的視窗允許這個頁面使用 Claude。
          </p>
          <button className="primary" onClick={() => fileRef.current?.click()}><Icon name="camera" size={18} />拍照或選照片</button>
        </div>
      ) : (
        <>
          <div className="shots">
            {shots.map((x, i) => (
              <div className="shot" key={x.url}>
                <img src={x.url} alt={`餐點照片 ${i + 1}`} />
                {!res && <button className="shot-x" onClick={() => removeShot(i)} aria-label={`移除第 ${i + 1} 張`}><Icon name="close" size={14} /></button>}
              </div>
            ))}
            {!res && <button className="shot add-shot" onClick={() => fileRef.current?.click()} aria-label="再加照片"><Icon name="plus" size={22} /></button>}
          </div>
          {!res && (
            <>
              <label className="field">補充說明（選填）
                <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder={group ? '例如：素食餐廳、那鍋湯是昆布湯底' : '例如：飯只吃一半、素食自助餐'} />
              </label>
              <div className="row end">
                <button className="primary" onClick={run} disabled={busy}>{busy ? 'Claude 辨識中，約 10–60 秒…' : `辨識 ${shots.length} 張照片`}</button>
              </div>
            </>
          )}
        </>
      )}
      {err && <div className="alert">{err}</div>}
      {res && (
        <>
          {items.length > 0 && <h3 className="confirm-title">請確認辨識結果<small>可以修改名稱、熱量，沒吃的選「沒吃」</small></h3>}
          {group && items.length > 0 && <p className="note" style={{ marginTop: 4 }}>{n} 人分食。「平均」是整道菜的 1/{n}；個人份的菜（例如自己那碗飯）用「一份」計算。</p>}
          {items.length === 0 && <p className="muted">{res.comment || '沒有辨識到食物'}</p>}
          {items.map((it, i) => (
            <div className={share[i] > 0 ? 'ai-item' : 'ai-item off'} key={i}>
              <div className="grow">
                <div className="row between nowrap">
                  <input className="inline grow" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} aria-label="菜名" />
                  <span className="mine">{Math.round(mine(i, 'kcal'))}<small> 大卡</small></span>
                </div>
                <small className="muted">
                  {it.shared ? '整道' : ''}{it.portion}・
                  <label className="inline-kcal">
                    <input className="inline kcal" inputMode="decimal" value={Math.round(it.kcal)} onChange={(e) => setItem(i, 'kcal', e.target.value)} aria-label={it.shared ? '整道熱量' : '熱量'} /> 大卡
                  </label>
                  {it.shared && <em className="tag">合菜</em>}
                </small>
                <div className="levels">
                  {(it.shared ? SHARE_LEVELS : SOLO_LEVELS).map((l) => (
                    <button key={l.label} className={share[i] === l.k ? 'chip on' : 'chip'} onClick={() => setShare(share.map((v, j) => (j === i ? l.k : v)))}>{l.label}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {res.comment && items.length > 0 && <p className="note">{res.comment}</p>}
          <p className="note">Claude 估算的是大約數值，熱量可以直接修改。</p>
          <div className="row end">
            <button className="ghost" onClick={onBack}>取消</button>
            <button className="ghost" onClick={() => { setRes(null); setItems([]) }}>重新辨識</button>
            <button className="primary" onClick={confirm} disabled={!share.some((v) => v > 0)}>確認加入 {share.filter((v) => v > 0).length} 項・{Math.round(total)} 大卡</button>
          </div>
        </>
      )}
      {!res && <div className="row end"><button className="ghost" onClick={onBack}>返回</button></div>}
    </div>
  )
}

function Scanner({ customFoods, dietInfo, onBack, onFound, onForm }: {
  customFoods: FoodItem[]; dietInfo: string; onBack: () => void; onFound: (f: FoodItem) => void; onForm: (f: Form) => void
}) {
  const codeRef = useRef<HTMLInputElement>(null)
  const labelRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [manual, setManual] = useState('')
  const [status, setStatus] = useState<'idle' | 'decoding' | 'notfound' | 'reading'>('idle')
  const [err, setErr] = useState('')

  const check = (c: string) => {
    setCode(c)
    const mine = customFoods.find((f) => f.barcode === c)
    if (mine) onFound(mine)
    else setStatus('notfound')
  }

  const fromPhoto = async (file: File) => {
    setErr(''); setStatus('decoding')
    const c = await decodeBarcode(file)
    if (c) check(c)
    else { setStatus('idle'); setErr('讀不到條碼。請靠近一點、讓條碼清楚對焦再拍一次，或直接輸入條碼下方的數字。') }
  }

  const readLabel = async (file: File) => {
    setStatus('reading'); setErr('')
    try {
      const r = await readNutritionLabel(file, dietInfo)
      const notes = [
        r.vegLabel && `包裝標示：${r.vegLabel}`,
        r.servingsPerPackage > 1 && `本包裝共 ${r.servingsPerPackage} 份，加入後可在份數調整。`
      ].filter(Boolean).join('\n')
      onForm({ ...toForm({ ...r, custom: true }), barcode: code || r.barcode || undefined, note: notes || '請對照包裝確認 Claude 讀出的數值。' })
    } catch (e) { setErr(friendlyError(e)); setStatus(code ? 'notfound' : 'idle') }
  }

  return (
    <div className="pick scroll">
      <input ref={codeRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fromPhoto(f) }} />
      <input ref={labelRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readLabel(f) }} />
      {(status === 'idle' || status === 'decoding') && (
        <>
          <div className="center" style={{ padding: '16px 0 8px' }}>
            <p className="muted">拍下或從相簿選一張包裝上的條碼照片。掃過並存起來的食物，下次拍條碼就會直接找到。</p>
            <button className="primary" onClick={() => codeRef.current?.click()} disabled={status === 'decoding'}>{status === 'decoding' ? '讀取條碼中…' : <><Icon name="barcode" size={18} />拍照或選條碼照片</>}</button>
          </div>
          <div className="row">
            <input className="search grow" inputMode="numeric" placeholder="或輸入條碼數字" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} />
            <button className="primary" onClick={() => manual && check(manual)}>查詢</button>
          </div>
        </>
      )}
      {status === 'reading' && <p className="center">Claude 讀取營養標示中，約 10–40 秒…</p>}
      {status === 'notfound' && (
        <div className="center" style={{ padding: '12px 0' }}>
          <p>條碼 {code} 還沒有存過。</p>
          <p className="muted">拍下包裝背面的「營養標示」，Claude 會幫你讀出數值。存起來後，下次拍這個條碼就會直接找到。</p>
          <button className="primary" onClick={() => labelRef.current?.click()}><Icon name="camera" size={18} />拍照或選營養標示照片</button>
        </div>
      )}
      {err && <div className="alert">{err}</div>}
      <div className="row end">
        {status === 'idle' && <button className="ghost" onClick={() => labelRef.current?.click()}>沒有條碼，直接拍營養標示</button>}
        <button className="ghost" onClick={onBack}>返回</button>
      </div>
    </div>
  )
}
