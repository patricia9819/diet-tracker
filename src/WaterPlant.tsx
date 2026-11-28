import { useEffect, useRef, useState } from 'react'
import type { useStore } from './store'
import { Icon } from './icons'
import { fmt, Sheet } from './ui'
import { todayISO } from './util'
import { toast } from './dialogs'
import { collection, dayFlower, flowerOf, flowerSrc, pickFlower, STAGES, stageOf, type Flower } from './garden'

type Store = ReturnType<typeof useStore>

export const DEFAULT_CUPS = [800, 1100]
const SLOTS = [9, 11, 13, 15, 17, 19, 21] // 每格代表從這個整點起的兩小時

/** 此刻「應該」喝到多少（9 點到 21 點平均分配） */
const shouldBy = (goal: number, d = new Date()) => {
  const h = d.getHours() + d.getMinutes() / 60
  return Math.max(0, Math.min(1, (h - 9) / 12)) * goal
}

function message(water: number, goal: number, isToday: boolean, name?: string) {
  if (!isToday) return water >= goal ? `這天的${name ?? '花'}開了。` : water > 0 ? `這天喝了 ${fmt(water)} ml。` : '這天沒有喝水紀錄。'
  const h = new Date().getHours()
  const left = goal - water
  if (water >= goal) return '今天的花開了，明天見！'
  if (water === 0) return h < 11 ? '早安，喝第一杯水就會種下今天的花。' : '今天還沒澆水喔，喝一杯就種下今天的花。'
  if (left <= 300) return `再 ${fmt(left)} ml 就開花了！`
  if (water < shouldBy(goal) - 300) return h >= 14 && h < 18 ? '下午容易忘記，現在喝一杯剛好。' : `${name ?? '花'}有點渴了…喝口水吧。`
  if (h >= 20) return `睡前別喝太多，還差 ${fmt(left)} ml。`
  return '進度很穩，繼續保持。'
}

/** 一株紙雕花：依原圖比例縮放，種子稍微放大方便看見 */
export function FlowerSprite({ f, stage, scale = 1, className = '' }: { f: Flower; stage: number; scale?: number; className?: string }) {
  const [w, h] = f.sizes[stage]
  const k = scale * (stage === 0 ? 1.4 : 1)
  return <img className={'sprite ' + className} src={flowerSrc(f.id, stage)} width={Math.round(w * k)} height={Math.round(h * k)} alt={`${f.name}・${STAGES[stage]}`} draggable={false} />
}

export default function WaterPlant({ store, date, variant = 'food', onOpen }: { store: Store; date: string; variant?: 'food' | 'garden'; onOpen?: () => void }) {
  const { data, update } = store
  const p = data.profile!
  const goal = p.waterGoal ?? 2000
  const cups = (p.cups?.length ? p.cups : DEFAULT_CUPS).filter((c) => c > 0)
  const water = data.water[date] ?? 0
  const log = data.waterLog?.[date] ?? []
  const isToday = date === todayISO()
  const pct = goal ? water / goal : 0
  const stage = stageOf(water, goal)
  const f = flowerOf(dayFlower(data, date))
  const thirsty = (p.reminders?.water ?? true) && isToday && stage >= 0 && stage < 4 && water < shouldBy(goal) - 300 && new Date().getHours() >= 11
  const big = variant === 'garden'

  // 動畫狀態
  const [drops, setDrops] = useState<{ id: number; ml: number }[]>([])
  const [bounce, setBounce] = useState(0)
  const [grow, setGrow] = useState<{ from: number; key: number } | null>(null)
  const [bloom, setBloom] = useState(0)
  const [card, setCard] = useState<{ f: Flower; isNew: boolean } | null>(null)
  const [typing, setTyping] = useState(false)
  const [ml, setMl] = useState('')
  const nid = useRef(0)
  const prev = useRef({ stage, fid: f?.id })
  const wasCollected = useRef(f ? collection(data).has(f.id) : false)

  useEffect(() => {
    const before = prev.current
    prev.current = { stage, fid: f?.id }
    if (!isToday || !f || before.fid !== f.id && before.stage >= 0) return
    if (stage > before.stage) {
      setGrow({ from: before.stage, key: Date.now() })
      if (stage === 4) {
        setBloom((b) => b + 1)
        const isNew = !wasCollected.current
        setTimeout(() => setCard({ f, isNew }), 900)
      } else if (stage === 0) toast(`種下了今天的花：${f.name}`)
      else toast(`${f.name}長到「${STAGES[stage]}」了`)
    }
  }, [stage, f, isToday])

  const add = (ml: number) => {
    const now = new Date()
    const minute = now.getHours() * 60 + now.getMinutes()
    update((d) => {
      const planted = d.garden?.[date]
      if (!planted) wasCollected.current = false
      const fid = planted ?? pickFlower(d, date)
      if (!planted) wasCollected.current = collection(d).has(fid)
      return {
        ...d,
        water: { ...d.water, [date]: (d.water[date] ?? 0) + ml },
        waterLog: isToday ? { ...d.waterLog, [date]: [...(d.waterLog?.[date] ?? []), [minute, ml]] } : d.waterLog,
        garden: { ...d.garden, [date]: fid }
      }
    })
    const id = ++nid.current
    setDrops((x) => [...x, { id, ml }])
    setBounce((b) => b + 1)
  }

  const undo = () => {
    const last = log[log.length - 1]
    const ml = last ? last[1] : Math.min(100, water)
    if (!ml) return
    update((d) => ({
      ...d,
      water: { ...d.water, [date]: Math.max(0, (d.water[date] ?? 0) - ml) },
      waterLog: last ? { ...d.waterLog, [date]: (d.waterLog?.[date] ?? []).slice(0, -1) } : d.waterLog
    }))
    toast(`已復原 −${fmt(ml)} ml`)
  }

  const nowH = new Date().getHours()
  const slots = SLOTS.map((h) => {
    const ml = log.filter(([m]) => m >= (h === 9 ? 0 : h * 60) && m < (h === 21 ? 24 * 60 : (h + 2) * 60)).reduce((a, [, v]) => a + v, 0)
    return { h, ml, now: isToday && nowH >= h && nowH < h + 2, past: !isToday || nowH >= h + 2 }
  })
  const scale = big ? 1.15 : 0.82

  return (
    <section
      className={`plant-card v-${variant}` + (thirsty ? ' thirsty' : '') + (stage === 4 ? ' bloomed' : '') + (onOpen ? ' linkish' : '')}
      onClick={onOpen ? (e) => { if (!(e.target as HTMLElement).closest('button, input, .sheet-bg')) onOpen() } : undefined}
      onKeyDown={onOpen ? (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpen() } } : undefined}
      role={onOpen ? 'link' : undefined} tabIndex={onOpen ? 0 : undefined} aria-label={onOpen ? '今日花朵，點一下前往花園' : undefined}>
      <div className="plant-top">
        <div className="plant-stage" aria-hidden="true">
          <span className="mound" />
          <div key={bounce} className={'pot-flower' + (bounce ? ' bounce' : '') + (thirsty ? ' droop' : '')}>
            {f && stage >= 0 ? (
              <>
                {grow && grow.from >= 0 && <FlowerSprite key={'o' + grow.key} f={f} stage={grow.from} scale={scale} className="leaving" />}
                <FlowerSprite key={'n' + (grow?.key ?? 0) + stage} f={f} stage={stage} scale={scale} className={grow ? 'entering' : ''} />
              </>
            ) : <span className="empty-soil">還沒種下</span>}
          </div>
          {grow && <span className="sparkles" key={'s' + grow.key}>{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 60 + 20}deg` }} />)}</span>}
          {drops.map((d) => (
            <span key={d.id} className="drop-wrap" onAnimationEnd={(e) => e.target === e.currentTarget && setDrops((x) => x.filter((y) => y.id !== d.id))}>
              <span className="drop" />
              <span className="ripple" />
              <span className="float-ml">+{fmt(d.ml)}</span>
            </span>
          ))}
          {bloom > 0 && (
            <span className="petals" key={bloom}>
              {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 36}deg` }} />)}
            </span>
          )}
        </div>
        <div className="plant-info">
          <div className="plant-title">
            {f && stage >= 0 ? <>{big ? '' : (isToday ? '今日花朵・' : '當天的花・')}<b>{f.name}</b></> : <><Icon name="sprout" size={18} />{isToday ? '今日花朵' : '當天的花'}</>}
            {onOpen && <span className="go-garden">花園<Icon name="chevron" size={14} /></span>}
          </div>
          {big && f && stage >= 0 && <div className="plant-words">{f.words}</div>}
          <div className="plant-ml"><b>{fmt(water)}</b><span> / {fmt(goal)} ml</span></div>
          {!big && <div className="plant-bar"><span style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>}
          <p className="plant-msg" aria-live="polite">{message(water, goal, isToday, f?.name)}</p>
        </div>
      </div>

      {big && (
        <div className="stage-track" aria-label={`生長階段：${stage >= 0 ? STAGES[stage] : '還沒種下'}`}>
          {STAGES.map((s, i) => <span key={s} className={i < stage ? 'done' : i === stage ? 'cur' : ''}>{s.replace(' ', '')}</span>)}
        </div>
      )}

      {isToday && !big && (
        <div className="timeline" role="img" aria-label={`喝水時間軸：${slots.filter((s) => s.ml).map((s) => `${s.h} 點 ${s.ml} ml`).join('、') || '還沒喝'}`}>
          {slots.map((s) => (
            <div key={s.h} className={'slot' + (s.ml ? ' on' : '') + (s.now ? ' now' : '') + (!s.ml && s.past ? ' miss' : '')}>
              <span className="dot"><Icon name="drop" size={14} /></span>
              <small>{s.h}</small>
            </div>
          ))}
        </div>
      )}

      <div className="water-btns">
        <button className="wb undo" onClick={undo} disabled={water <= 0} aria-label="復原上一次喝水"><Icon name="undo" size={18} /></button>
        <button className="wb" onClick={() => add(100)}><Icon name="drop" size={16} />+100</button>
        {cups.slice(0, 2).map((c, i) => (
          <button className="wb cup" key={i} onClick={() => add(c)}><Icon name={i === 0 ? 'cup' : 'bottle'} size={17} />{fmt(c)}</button>
        ))}
        <button className="wb undo" onClick={() => { setMl(''); setTyping(true) }} aria-label="手動輸入喝水量"><Icon name="pencil" size={17} /></button>
      </div>

      {typing && (
        <Sheet title="輸入喝水量" onClose={() => setTyping(false)}>
          <form className="water-form" onSubmit={(e) => {
            e.preventDefault()
            const v = Math.round(Number(ml))
            if (!(v > 0 && v <= 5000)) return toast('請輸入 1–5000 ml')
            add(v); setTyping(false)
          }}>
            <label className="field">這次喝了多少（ml）
              <input id="water-ml" inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ''))} placeholder="例如 350" autoFocus />
            </label>
            <div className="row" style={{ marginTop: 10 }}>
              {[150, 250, 350, 500, 600].map((v) => <button type="button" key={v} className={Number(ml) === v ? 'chip on' : 'chip'} onClick={() => setMl(String(v))}>{v}</button>)}
            </div>
            <p className="note">喝了半杯、喝別的杯子，或補記之前忘了記的量，都可以在這裡輸入。今天目前 {fmt(water)} / {fmt(goal)} ml。</p>
            <button className="btn-dark" type="submit">加入{ml ? ` ${fmt(Number(ml))} ml` : ''}</button>
          </form>
        </Sheet>
      )}

      {card && (
        <Sheet title={card.isNew ? '新的花收進圖鑑了！' : '今天的花開了！'} onClose={() => setCard(null)}>
          <div className="bloom-card">
            {card.isNew && <span className="new-tag">NEW</span>}
            <img className="bloom-portrait" src={flowerSrc(card.f.id, 'p')} alt={card.f.name} />
            <h3>{card.f.name}</h3>
            <p>{card.f.words}</p>
            <p className="muted small">{card.isNew ? '第一次種出這種花，已收進「花園 → 花卉圖鑑」。' : '這種花之前就收集過了，花園裡又多了一朵。'}</p>
            <button className="btn-dark" onClick={() => setCard(null)}>好</button>
          </div>
        </Sheet>
      )}
    </section>
  )
}
