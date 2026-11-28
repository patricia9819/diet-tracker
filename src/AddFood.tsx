import { useEffect, useMemo, useRef, useState } from 'react'
import type { useStore } from './store'
import { MEALS, type FoodItem, type Meal } from './types'
import { BUILTIN_FOODS } from './foods'
import { uid } from './util'
import { allowedFood, avoidsFive, dietPrompt } from './diet'
import { friendlyError, readNutritionLabel, recognizeMeal, type MealResult } from './ai'
import { decodeBarcode } from './barcode'
import { toast } from './dialogs'

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

export default function AddFood({ store, date, meal, onClose }: { store: Store; date: string; meal: Meal; onClose: () => void }) {
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

  const addMany = (items: { f: FoodItem; s: number }[]) => {
    update((d) => ({
      ...d,
      logs: [...d.logs, ...items.filter((x) => x.s > 0).map(({ f, s }) => ({ id: uid(), date, meal, foodId: f.id, name: f.name, unit: f.unit, servings: s, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }))]
    }))
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
          <button className="icon" onClick={onClose} aria-label="關閉">✕</button>
        </div>

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
              <button onClick={() => setMode('photo')}><span>📷</span>拍照辨識</button>
              <button onClick={() => setMode('scan')}><span>🔍</span>拍條碼</button>
              <button onClick={() => openCustom(emptyForm(q))}><span>✏️</span>自己輸入</button>
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

function PhotoMeal({ dietInfo, onBack, onAdd }: { dietInfo: string; onBack: () => void; onAdd: (x: { f: FoodItem; s: number }[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<MealResult | null>(null)
  const [sel, setSel] = useState<boolean[]>([])
  const [items, setItems] = useState<MealResult['items']>([])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const choose = (file: File) => {
    setErr(''); setRes(null)
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  const run = async () => {
    setBusy(true); setErr('')
    try {
      const r = await recognizeMeal(photo!, dietInfo, hint)
      setRes(r); setItems(r.items); setSel(r.items.map(() => true))
    } catch (e) { setErr(friendlyError(e)) }
    setBusy(false)
  }

  const setItem = (i: number, k: 'kcal' | 'name', v: string) =>
    setItems(items.map((it, j) => (j === i ? { ...it, [k]: k === 'kcal' ? num(v) : v } : it)))

  const confirm = () => onAdd(items.flatMap((it, i) => sel[i] ? [{
    f: { id: 'ai' + uid(), name: it.name, unit: it.portion, kcal: Math.round(it.kcal), protein: it.protein, carbs: it.carbs, fat: it.fat },
    s: 1
  }] : []))

  return (
    <div className="pick scroll">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && choose(e.target.files[0])} />
      {!preview ? (
        <div className="center" style={{ padding: '24px 0' }}>
          <p className="muted">拍下整份餐點，Claude 會辨識內容並估算熱量。<br />第一次使用時，請在跳出的視窗允許這個頁面使用 Claude。</p>
          <button className="primary" onClick={() => fileRef.current?.click()}>📷 拍照或選照片</button>
        </div>
      ) : (
        <>
          <img src={preview} className="photo" alt="餐點照片" />
          {!res && (
            <>
              <label className="field">補充說明（選填）<input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="例如：飯只吃一半、素食自助餐" /></label>
              <div className="row end">
                <button className="ghost" onClick={() => fileRef.current?.click()}>換一張</button>
                <button className="primary" onClick={run} disabled={busy}>{busy ? 'Claude 辨識中，約 10–40 秒…' : '開始辨識'}</button>
              </div>
            </>
          )}
        </>
      )}
      {err && <div className="alert">{err}</div>}
      {res && (
        <>
          {items.length === 0 && <p className="muted">{res.comment || '沒有辨識到食物'}</p>}
          {items.map((it, i) => (
            <div className="ai-item" key={i}>
              <input type="checkbox" checked={sel[i]} onChange={(e) => setSel(sel.map((v, j) => (j === i ? e.target.checked : v)))} />
              <div className="grow">
                <input className="inline" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
                <small className="muted">{it.portion}・蛋白 {Math.round(it.protein)}g・碳水 {Math.round(it.carbs)}g・脂肪 {Math.round(it.fat)}g</small>
                {it.concern && <div className="warn small">⚠️ {it.concern}</div>}
              </div>
              <input className="inline kcal" inputMode="decimal" value={Math.round(it.kcal)} onChange={(e) => setItem(i, 'kcal', e.target.value)} />
            </div>
          ))}
          {res.comment && items.length > 0 && <p className="note">{res.comment}</p>}
          <p className="note">AI 估算可能有誤差，可以先修改名稱和熱量再加入。</p>
          <div className="row end">
            <button className="ghost" onClick={onBack}>取消</button>
            <button className="primary" onClick={confirm} disabled={!sel.some(Boolean)}>
              加入 {Math.round(items.reduce((a, it, i) => a + (sel[i] ? it.kcal : 0), 0))} 大卡
            </button>
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
        r.concern && `⚠️ ${r.concern}`,
        r.servingsPerPackage > 1 && `本包裝共 ${r.servingsPerPackage} 份，加入後可在份數調整。`
      ].filter(Boolean).join('\n')
      onForm({ ...toForm({ ...r, custom: true }), barcode: code || r.barcode || undefined, note: notes || '請對照包裝確認 Claude 讀出的數值。' })
    } catch (e) { setErr(friendlyError(e)); setStatus(code ? 'notfound' : 'idle') }
  }

  return (
    <div className="pick scroll">
      <input ref={codeRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fromPhoto(f) }} />
      <input ref={labelRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readLabel(f) }} />
      {(status === 'idle' || status === 'decoding') && (
        <>
          <div className="center" style={{ padding: '16px 0 8px' }}>
            <p className="muted">拍下包裝上的條碼。掃過並存起來的食物，下次拍條碼就會直接找到。</p>
            <button className="primary" onClick={() => codeRef.current?.click()} disabled={status === 'decoding'}>{status === 'decoding' ? '讀取條碼中…' : '📷 拍條碼'}</button>
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
          <button className="primary" onClick={() => labelRef.current?.click()}>📷 拍營養標示</button>
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
