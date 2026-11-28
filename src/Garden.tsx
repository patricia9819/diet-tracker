import { useMemo, useState } from 'react'
import type { useStore } from './store'
import { addDays, fmtDate, parseISO, toISO, todayISO } from './util'
import { collection, dayFlower, dayTasks, FLOWERS, flowerOf, flowerSrc, GROUPS, STAGES, stageOf, type Flower } from './garden'
import WaterPlant, { FlowerSprite } from './WaterPlant'
import { streak } from './habits'
import { getSample } from './ai'
import { Icon } from './icons'
import { Sheet, fmt } from './ui'

type Store = ReturnType<typeof useStore>

export default function Garden({ store }: { store: Store }) {
  const { data } = store
  const goal = data.profile!.waterGoal ?? 2000
  const today = todayISO()
  const got = useMemo(() => collection(data), [data])
  const [month, setMonth] = useState(today.slice(0, 7))
  const [day, setDay] = useState<string | null>(null)
  const [group, setGroup] = useState(0)
  const [dex, setDex] = useState<Flower | null>(null)
  const { tasks, done } = dayTasks(data)
  const bloomsThisMonth = Object.keys(data.water).filter((d) => d.startsWith(today.slice(0, 7)) && stageOf(data.water[d], goal) === 4).length

  return (
    <div className="garden">
      <header className="plaque">
        <span className="plaque-leaf l" aria-hidden="true" /><span className="plaque-leaf r" aria-hidden="true" />
        <h1>我的花園</h1>
        <small>My Garden</small>
      </header>

      <div className="g-hero">
        <img src="garden/hero.webp" alt="紙雕風格的花園與溫室" />
        <span className="g-chip">{+today.slice(5, 7)} 月已開 {bloomsThisMonth} 朵花・圖鑑 {got.size}/{FLOWERS.length}</span>
      </div>

      <section className="g-card layered">
        <h2 className="g-sec">今日花朵<em>每天第一次澆水時抽一種花</em></h2>
        <WaterPlant store={store} date={today} variant="garden" />
      </section>

      <section className="g-card">
        <h2 className="g-sec">今日任務</h2>
        {done && <div className="stamp" aria-label="今日完成">今日<br />完成<small>{+today.slice(5, 7)}.{+today.slice(8)}</small></div>}
        <div className="checks">
          {tasks.map((t) => (
            <div key={t.key} className={t.done ? 'ok' : ''}>
              <i>{t.done ? <Icon name="check" size={18} /> : null}</i>{t.label}
            </div>
          ))}
        </div>
        <p className="g-hint">{done ? '今天五項都完成了，月曆上也蓋了一個小印記。' : '三餐、體重、喝水都完成時，會蓋下「今日完成」印章。'}</p>
      </section>

      <Calendar store={store} month={month} setMonth={setMonth} onPick={setDay} />

      <WeekReview store={store} />

      <section className="g-card">
        <h2 className="g-sec">花卉圖鑑<em>已收集 {got.size} / {FLOWERS.length}</em></h2>
        <div className="g-tabs" role="tablist">
          {GROUPS.map((g, i) => (
            <button key={g} role="tab" aria-selected={group === i} className={group === i ? 'on' : ''} onClick={() => setGroup(i)}>
              {g}<small>{FLOWERS.filter((f) => f.group === i && got.has(f.id)).length}/10</small>
            </button>
          ))}
        </div>
        <div className="dex">
          {FLOWERS.filter((f) => f.group === group).map((f) => (
            <button key={f.id} className={got.has(f.id) ? '' : 'lock'} onClick={() => setDex(f)}>
              <img src={flowerSrc(f.id, 'p')} alt="" loading="lazy" />
              <span>{got.has(f.id) ? f.name : '？？？'}</span>
            </button>
          ))}
        </div>
        <p className="g-hint">還沒收集的花是灰色剪影。每天第一次澆水時，會優先抽還沒收集過的花。</p>
      </section>

      {day && <DaySheet store={store} date={day} onClose={() => setDay(null)} />}
      {dex && <DexSheet f={dex} info={got.get(dex.id)} onClose={() => setDex(null)} />}
    </div>
  )
}

function Calendar({ store, month, setMonth, onPick }: { store: Store; month: string; setMonth: (m: string) => void; onPick: (d: string) => void }) {
  const { data } = store
  const goal = data.profile!.waterGoal ?? 2000
  const today = todayISO()
  const first = parseISO(month + '-01')
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const lead = first.getDay()
  const shift = (n: number) => { const d = new Date(first); d.setMonth(d.getMonth() + n); setMonth(toISO(d).slice(0, 7)) }
  const canNext = month < today.slice(0, 7)
  return (
    <section className="g-card">
      <h2 className="g-sec">花園月曆
        <span className="g-month">
          <button onClick={() => shift(-1)} aria-label="上個月"><Icon name="chevronLeft" size={18} /></button>
          {first.getFullYear()} 年 {first.getMonth() + 1} 月
          <button onClick={() => shift(1)} disabled={!canNext} aria-label="下個月"><Icon name="chevron" size={18} /></button>
        </span>
      </h2>
      <div className="cal">
        {'日一二三四五六'.split('').map((w) => <div className="h" key={w}>{w}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={'b' + i} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`
          const future = date > today
          const st = stageOf(data.water[date] ?? 0, goal)
          const f = flowerOf(dayFlower(data, date))
          const stamped = !future && dayTasks(data, date).done
          return (
            <button key={date} className={'d' + (future ? ' future' : '') + (date === today ? ' today' : '') + (st === 4 ? ' bloom' : '') + (st < 0 && !future ? ' empty' : '')}
              disabled={future} onClick={() => onPick(date)} aria-label={`${fmtDate(date)}${f && st >= 0 ? `，${f.name}・${STAGES[st]}` : '，沒有喝水紀錄'}`}>
              <small>{i + 1}</small>
              {f && st >= 0 && <img src={flowerSrc(f.id, st)} alt="" loading="lazy" className={'s' + st} />}
              {stamped && <span className="mini-stamp" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      <div className="legend"><span><i className="lg bloom" />開花＝喝水達標</span><span><i className="lg grow" />小株＝沒喝夠</span><span><i className="lg lg-stamp" />今日完成</span></div>
    </section>
  )
}

function DaySheet({ store, date, onClose }: { store: Store; date: string; onClose: () => void }) {
  const { data } = store
  const goal = data.profile!.waterGoal ?? 2000
  const water = data.water[date] ?? 0
  const st = stageOf(water, goal)
  const f = flowerOf(dayFlower(data, date))
  const t = dayTasks(data, date)
  return (
    <Sheet title={fmtDate(date)} onClose={onClose}>
      <div className="day-sheet">
        <div className="day-flower">{f && st >= 0 ? <FlowerSprite f={f} stage={st} scale={1.3} /> : <span className="empty-soil">沒有種花</span>}</div>
        {f && st >= 0 && <><h3>{f.name}</h3><p className="muted">{f.words}・{STAGES[st]}</p></>}
        <p>喝水 {fmt(water)} / {fmt(goal)} ml</p>
        <div className="checks small">
          {t.tasks.map((x) => <div key={x.key} className={x.done ? 'ok' : ''}><i>{x.done ? <Icon name="check" size={16} /> : null}</i>{x.label}</div>)}
        </div>
        {date === todayISO() && <p className="note">今天的花會在「今日花朵」繼續長大。</p>}
      </div>
    </Sheet>
  )
}

function DexSheet({ f, info, onClose }: { f: Flower; info?: { first: string; count: number }; onClose: () => void }) {
  return (
    <Sheet title={info ? f.name : '還沒收集的花'} onClose={onClose}>
      <div className="dex-sheet">
        <img className={'bloom-portrait' + (info ? '' : ' lock')} src={flowerSrc(f.id, 'p')} alt={info ? f.name : ''} />
        {info ? (
          <>
            <h3>{f.name}</h3>
            <p>{f.words}</p>
            <p className="muted small">第一次開花：{fmtDate(info.first)}・共開了 {info.count} 次</p>
          </>
        ) : <p className="muted">喝水達標、讓它開花就能收集。每天第一次澆水會優先抽還沒收集的花。</p>}
        <div className="stages">
          {STAGES.map((s, i) => (
            <div key={s} className={info ? '' : 'lock'}>
              <span className="st-img"><FlowerSprite f={f} stage={i} scale={0.55} /></span>
              <small>{s}</small>
            </div>
          ))}
        </div>
        <p className="muted small">{GROUPS[f.group]}</p>
      </div>
    </Sheet>
  )
}

function WeekReview({ store }: { store: Store }) {
  const { data } = store
  const goal = data.profile!.waterGoal ?? 2000
  const today = todayISO()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const blooms = days.filter((d) => stageOf(data.water[d] ?? 0, goal) === 4)
  const waters = days.map((d) => data.water[d] ?? 0).filter((v) => v > 0)
  const avg = waters.length ? waters.reduce((a, b) => a + b, 0) / waters.length : 0
  const best = days.reduce<{ d: string; s: number } | null>((b, d) => { const s = data.steps?.[d]?.steps ?? 0; return s > (b?.s ?? 0) ? { d, s } : b }, null)
  const st = streak(data)
  const [tip, setTip] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const askGoal = async () => {
    setBusy(true); setErr('')
    try {
      const sample = await getSample()
      if (!sample) throw new Error('只能在 Claude App 或 claude.ai 裡使用')
      const prompt = [
        '你是溫和的減重教練。依下面這週的數據，給使用者下週 2 個具體、容易做到的小目標，每個 25 字以內，用「・」開頭，各佔一行，不要其他文字。',
        `使用者吃奶蛋素、不吃五辛。喝水目標每天 ${goal} ml。`,
        `這週：喝水達標 ${blooms.length}/7 天，平均喝水 ${Math.round(avg)} ml；步數最多 ${best ? best.s : 0} 步；連續記錄 ${st} 天。`
      ].join('\n')
      const r = await sample(prompt, { modelTier: 'quick', cache: false })
      setTip(r.text.trim())
    } catch (e) {
      setErr((e as { code?: string }).code === 'not_granted' ? '需要允許這個頁面使用 Claude。' : e instanceof Error ? e.message : '暫時無法取得，請稍後再試。')
    }
    setBusy(false)
  }

  return (
    <section className="g-card layered">
      <h2 className="g-sec">本週回顧<em>{fmtDate(days[0]).replace(/（.）/, '')} – {fmtDate(today).replace(/（.）/, '')}</em></h2>
      <div className="bouquet">
        {blooms.length ? blooms.map((d) => { const f = flowerOf(dayFlower(data, d)); return f ? <FlowerSprite key={d} f={f} stage={4} scale={0.62} /> : null })
          : <p className="g-hint">這週還沒有開花，喝水達標就會開出第一朵。</p>}
      </div>
      <div className="week">
        <div><small>開了幾朵花</small><b>{blooms.length} / 7 朵</b></div>
        <div><small>平均喝水</small><b>{fmt(avg)} ml</b></div>
        <div><small>步數最多</small><b>{best ? `週${'日一二三四五六'[parseISO(best.d).getDay()]} ${fmt(best.s)}` : '—'}</b></div>
        <div><small>連續記錄</small><b>{st} 天</b></div>
      </div>
      {tip ? <div className="week-tip"><Icon name="sparkle" size={18} /><p>{tip}</p></div> : (
        <button className="g-btn" onClick={askGoal} disabled={busy}><Icon name="sparkle" size={16} />{busy ? 'Claude 思考中…' : '請 Claude 給下週小目標'}</button>
      )}
      {err && <p className="g-hint warn">{err}</p>}
    </section>
  )
}
