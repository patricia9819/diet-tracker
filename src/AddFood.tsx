import { useMemo, useState } from 'react'
import type { useStore } from './store'
import { MEALS, type FoodItem, type Meal } from './types'
import { BUILTIN_FOODS } from './foods'
import { uid } from './util'

type Store = ReturnType<typeof useStore>

const num = (s: string) => {
  const n = parseFloat(s)
  return isFinite(n) && n >= 0 ? n : 0
}

export default function AddFood({ store, date, meal, onClose }: { store: Store; date: string; meal: Meal; onClose: () => void }) {
  const { data, update } = store
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<FoodItem | null>(null)
  const [servings, setServings] = useState('1')
  const [custom, setCustom] = useState(false)
  const [form, setForm] = useState({ name: '', unit: '1 份', kcal: '', protein: '', carbs: '', fat: '', save: true })

  const all = useMemo(() => [...data.customFoods, ...BUILTIN_FOODS], [data.customFoods])

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

  const add = (f: FoodItem, s: number) => {
    if (s <= 0) return
    update((d) => ({
      ...d,
      logs: [...d.logs, { id: uid(), date, meal, foodId: f.id, name: f.name, unit: f.unit, servings: s, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }]
    }))
    onClose()
  }

  const addCustom = () => {
    if (!form.name.trim()) return alert('請輸入名稱')
    const f: FoodItem = {
      id: 'c' + uid(),
      name: form.name.trim(),
      unit: form.unit.trim() || '1 份',
      kcal: num(form.kcal),
      protein: num(form.protein),
      carbs: num(form.carbs),
      fat: num(form.fat),
      custom: true
    }
    if (form.save) update((d) => ({ ...d, customFoods: [f, ...d.customFoods] }))
    add(f, 1)
  }

  const label = MEALS.find((m) => m.key === meal)!.label

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b>新增{label}</b>
          <button className="icon" onClick={onClose} aria-label="關閉">✕</button>
        </div>

        {picked ? (
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
              <button className="ghost" onClick={() => setPicked(null)}>返回</button>
              <button className="primary" onClick={() => add(picked, num(servings))}>加入</button>
            </div>
          </div>
        ) : custom ? (
          <div className="pick">
            <label className="field">名稱<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
            <label className="field">份量描述<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
            <div className="grid2">
              <label className="field">熱量 (大卡)<input inputMode="decimal" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} /></label>
              <label className="field">蛋白質 (g)<input inputMode="decimal" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} /></label>
              <label className="field">碳水 (g)<input inputMode="decimal" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} /></label>
              <label className="field">脂肪 (g)<input inputMode="decimal" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} /></label>
            </div>
            <label className="check"><input type="checkbox" checked={form.save} onChange={(e) => setForm({ ...form, save: e.target.checked })} /> 存到我的食物，下次可直接選</label>
            <div className="row end">
              <button className="ghost" onClick={() => setCustom(false)}>返回</button>
              <button className="primary" onClick={addCustom}>加入</button>
            </div>
          </div>
        ) : (
          <>
            <input className="search" placeholder="搜尋食物，例如：便當、豆漿" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="add" onClick={() => { setForm({ ...form, name: q }); setCustom(true) }}>＋ 自訂食物／手動輸入熱量</button>
            <div className="list">
              {!results && recents.length > 0 && <div className="list-title">最近吃過</div>}
              {(results ?? recents).map((f) => (
                <button key={f.id + f.name} className="food" onClick={() => { setPicked(f); setServings('1') }}>
                  <span>{f.name}{f.custom && <em> 自訂</em>}<small className="muted"> {f.unit}</small></span>
                  <span className="muted">{f.kcal}</span>
                </button>
              ))}
              {!results && <div className="list-title">全部食物</div>}
              {!results && all.map((f) => (
                <button key={f.id} className="food" onClick={() => { setPicked(f); setServings('1') }}>
                  <span>{f.name}{f.custom && <em> 自訂</em>}<small className="muted"> {f.unit}</small></span>
                  <span className="muted">{f.kcal}</span>
                </button>
              ))}
              {results && results.length === 0 && <p className="muted center">找不到，請用上方「自訂食物」新增</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
