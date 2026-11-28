import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { useStore } from './store'
import { dayFlower, flowerOf, flowerSrc, STAGES, stageOf, type Flower } from './garden'
import { fmtDate, todayISO } from './util'
import layout from '../public/garden/spots.json'

type Store = ReturnType<typeof useStore>

// 場景座標＝插畫像素（1536 × 1024）
const W = layout.w, H = layout.h
const SPOTS = layout.spots as { x: number; y: number; s: number }[]
const px = (x: number) => `${(x / W) * 100}%`
const py = (y: number) => `${(y / H) * 100}%`

/** 一小叢：同一種花種 3 株，前後錯開 */
const CLUMP = [
  { dx: -36, dy: -9, k: 0.82, flip: false },
  { dx: 34, dy: -5, k: 0.88, flip: true },
  { dx: -2, dy: 10, k: 1, flip: false }
]

// 一天中的光線：[分鐘, 色調 r, g, b, 濃度, 燈光, 星星]
const KEYS: [number, number, number, number, number, number, number][] = [
  [0, 38, 50, 96, 0.64, 1, 1],
  [300, 38, 50, 96, 0.64, 1, 1],
  [360, 232, 168, 190, 0.3, 0.45, 0.2],
  [450, 255, 222, 186, 0.12, 0, 0],
  [720, 255, 255, 255, 0, 0, 0],
  [960, 255, 214, 160, 0.12, 0, 0],
  [1050, 246, 166, 106, 0.3, 0.2, 0],
  [1110, 118, 92, 150, 0.46, 0.85, 0.45],
  [1200, 38, 50, 96, 0.64, 1, 1],
  [1440, 38, 50, 96, 0.64, 1, 1]
]
function lightAt(m: number) {
  const i = KEYS.findIndex((k) => k[0] > m)
  const a = KEYS[i - 1], b = KEYS[i]
  const t = (m - a[0]) / (b[0] - a[0])
  const mix = (k: number) => a[k] + (b[k] - a[k]) * t
  return { tint: `rgb(${mix(1) | 0} ${mix(2) | 0} ${mix(3) | 0})`, alpha: mix(4), lamps: mix(5), stars: mix(6) }
}
const phaseName = (m: number) => (m < 300 ? '深夜' : m < 420 ? '清晨' : m < 660 ? '早上' : m < 810 ? '中午' : m < 1020 ? '午後' : m < 1110 ? '黃昏' : m < 1260 ? '晚上' : '深夜')

export default function GardenScene({ store }: { store: Store }) {
  const { data } = store
  const goal = data.profile!.waterGoal ?? 2000
  const today = todayISO()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])
  const m = now.getHours() * 60 + now.getMinutes()
  const light = lightAt(m)
  const night = light.stars > 0.3

  // 開過花的日子依序種成一小叢；種滿之後顯示最近的
  const blooms = useMemo(() => Object.keys(data.water).filter((d) => d < today && stageOf(data.water[d], goal) === 4).sort(), [data.water, goal, today])
  const shown = blooms.slice(-SPOTS.length)
  const planted = shown.map((d, i) => ({ date: d, f: flowerOf(dayFlower(data, d)), spot: SPOTS[i] })).filter((p): p is { date: string; f: Flower; spot: typeof SPOTS[number] } => !!p.f)
  const todayStage = stageOf(data.water[today] ?? 0, goal)
  const todayFlower = flowerOf(dayFlower(data, today))
  const todaySpot = SPOTS[Math.min(shown.length, SPOTS.length - 1)]

  const [poke, setPoke] = useState<{ key: string; n: number } | null>(null)
  const n = useRef(0)
  const tap = (key: string) => setPoke({ key, n: ++n.current })

  // 手機上場景比螢幕寬：一開始捲到中間（溫室和步道），可以左右滑動看整座花園
  const scroller = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState(true)
  const ready = useRef(false)
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) * 0.55
    const t = setTimeout(() => { ready.current = true }, 400)   // 忽略一開始自動捲到中間的那一次
    return () => clearTimeout(t)
  }, [])

  // 太陽 06:00–18:30，月亮 18:00–06:00（在右上方的天空）
  const sunP = (m - 360) / 750
  const moonP = ((m - 1080 + 1440) % 1440) / 720
  const sun = sunP >= 0 && sunP <= 1 ? { x: 980 + 520 * sunP, y: 230 - Math.sin(Math.PI * sunP) * 190 } : null
  const moon = moonP >= 0 && moonP <= 1 ? { x: 1010 + 470 * moonP, y: 210 - Math.sin(Math.PI * moonP) * 160 } : null

  type Item = { key: string; f: Flower; stage: number; x: number; y: number; k: number; flip: boolean; label: string; delay: number; today?: boolean }
  const items: Item[] = []
  planted.forEach((p, i) => {
    const label = `${p.f.name}・${fmtDate(p.date).replace(/（.）/, '')} 開花`
    CLUMP.forEach((c, j) => items.push({ key: `${p.date}-${j}`, f: p.f, stage: 4, x: p.spot.x + c.dx * p.spot.s, y: p.spot.y + c.dy * p.spot.s, k: p.spot.s * c.k * 0.78, flip: c.flip, label, delay: (i * 530 + j * 270) % 4000 }))
  })
  if (todayFlower && todayStage >= 0) {
    items.push({ key: 'today', f: todayFlower, stage: todayStage, x: todaySpot.x, y: todaySpot.y + 8, k: todaySpot.s * (todayStage === 0 ? 1.4 : 0.9), flip: false, label: `今天的${todayFlower.name}・${STAGES[todayStage]}`, delay: 0, today: true })
  }
  items.sort((a, b) => a.y - b.y)

  return (
    <div className="scene-wrap">
      <div className="scene-scroll" ref={scroller} onScroll={() => { if (ready.current && hint) setHint(false) }}>
        <div className={'scene' + (night ? ' night' : '')} role="img" aria-label={`我的花園，${phaseName(m)}，種了 ${planted.length} 叢花`}>
          <img className="scene-bg" src="garden/backdrop.webp" alt="" draggable={false} />
          <img className="scene-tree" src="garden/tree.webp" alt="" draggable={false} style={{ left: 0, top: 0, width: px(860), height: py(360) }} />
          <img className="scene-vines" src="garden/vines.webp" alt="" draggable={false} style={{ left: px(495), top: py(190), width: px(240), height: py(280) }} />
          {sun && <span className="sun" style={{ left: px(sun.x), top: py(sun.y), opacity: 1 - light.stars }} />}
          {moon && night && <span className="moon" style={{ left: px(moon.x), top: py(moon.y), opacity: light.stars }} />}
          <span className="fountain" style={{ left: px(1250), top: py(700) }} aria-hidden="true"><i /><i /><i /></span>

          {items.map((it) => {
            const [w, h] = it.f.sizes[it.stage]
            const group = it.today ? 'today' : it.key.slice(0, 10)   // 同一天的 3 株一起晃
            const active = poke?.key === group
            return (
              <button key={it.key} className={'plant' + (active ? ' poked' : '') + (it.today ? ' is-today' : '')}
                style={{ left: px(it.x), top: py(it.y), width: px(w * it.k), height: py(h * it.k), animationDelay: `${it.delay}ms`, zIndex: Math.round(it.y) }}
                onClick={() => tap(group)} aria-label={it.label}>
                <img key={active ? poke!.n : 0} src={flowerSrc(it.f.id, it.stage)} alt="" draggable={false} style={it.flip ? { scale: '-1 1' } : undefined} />
                <span className="hit" aria-hidden="true" />
                {active && (it.today || it.key.endsWith('-2')) && <span className="bubble" key={'b' + poke!.n}>{it.label}</span>}
                {it.today && <span className="today-tag">今天</span>}
              </button>
            )
          })}

          <span className="tint" style={{ background: light.tint, opacity: light.alpha }} />
          <span className="lamps" style={{ opacity: light.lamps }}>
            <i style={{ left: px(320), top: py(268) }} /><i style={{ left: px(942), top: py(318) }} /><i style={{ left: px(1428), top: py(372) }} />
            <b style={{ left: px(590), top: py(190), width: px(760), height: py(380) }} />
            <i className="low" style={{ left: px(370), top: py(900) }} /><i className="low" style={{ left: px(1300), top: py(900) }} />
          </span>
          {light.stars > 0 && (
            <span className="stars" style={{ opacity: light.stars }}>
              {Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: px(880 + ((i * 197) % 640)), top: py(15 + ((i * 73) % 210)), animationDelay: `${i * 0.37}s` }} />)}
              {Array.from({ length: 10 }, (_, i) => <em key={i} style={{ left: px(100 + ((i * 263) % 1340)), top: py(620 + ((i * 151) % 360)), animationDelay: `${i * 0.6}s` }} />)}
            </span>
          )}
          {!night && (
            <span className="breeze" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => <i key={i} style={{ top: py(560 + i * 90), animationDelay: `${i * 2.3}s` }} />)}
            </span>
          )}
        </div>
      </div>
      <span className="scene-time">{phaseName(m)} {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}</span>
      {hint && <span className="scene-hint" aria-hidden="true">‹ 左右滑動看整座花園 ›</span>}
      {planted.length === 0 && <span className="scene-empty">花圃還是空的。<br />喝水達標的那天，會在花圃種下一小叢花。</span>}
    </div>
  )
}
