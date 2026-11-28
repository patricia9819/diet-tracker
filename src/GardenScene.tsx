import { useEffect, useMemo, useRef, useState } from 'react'
import type { useStore } from './store'
import { dayFlower, flowerOf, flowerSrc, STAGES, stageOf } from './garden'
import { fmtDate, todayISO } from './util'

type Store = ReturnType<typeof useStore>

// 場景座標：寬 1160、高 1250（上方 0–500 是插畫背景，下方是紙雕花圃）
const W = 1160, H = 1250
const px = (x: number) => `${(x / W) * 100}%`
const py = (y: number) => `${(y / H) * 100}%`

/** S 形步道：中心線與半寬（從溫室門口往前延伸） */
const pathX = (y: number) => 700 - (y - 470) * 0.16 + Math.sin(((y - 470) / 780) * Math.PI) * 70
const pathHalf = (y: number) => 42 + ((y - 470) / 780) * 92

/** 兩塊橢圓形花圃 */
const BEDS = [
  { cx: 290, cy: 885, rx: 245, ry: 300 },
  { cx: 935, cy: 905, rx: 200, ry: 290 }
]
const inBed = (x: number, y: number, pad: number) =>
  BEDS.some((b) => ((x - b.cx) / (b.rx - pad)) ** 2 + ((y - b.cy) / (b.ry - pad * 0.6)) ** 2 <= 1)

/** 花圃裡可以種花的位置：由後往前分排；用固定亂數排出種花順序 */
function makeSlots() {
  const slots: { x: number; y: number; s: number }[] = []
  let seed = 11
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (let y = 640; y <= 1160; y += 78) {
    const s = 0.95 + ((y - 640) / 520) * 0.6
    const step = 112 * s
    for (let x = 50 + rnd() * 50; x < 1130; x += step) {
      const jx = x + (rnd() - 0.5) * 26 * s, jy = y + (rnd() - 0.5) * 20
      if (!inBed(jx, jy - 20, 34 * s)) continue
      slots.push({ x: jx, y: jy, s })
    }
  }
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
  // 花圃種滿後，沿著後排樹籬和前方草地繼續種
  const lawn: { x: number; y: number; s: number }[] = []
  for (const [y, s] of [[560, 0.72], [600, 0.8], [1190, 1.35]] as const) {
    for (let x = 60 + rnd() * 40; x < 1120; x += 105 * s) {
      const jx = x + (rnd() - 0.5) * 24
      if (Math.abs(jx - pathX(y)) < pathHalf(y) + 50 * s || inBed(jx, y, -30)) continue
      if (y > 1100 && Math.abs(jx - TODAY_X) < 110) continue
      lawn.push({ x: jx, y: y + (rnd() - 0.5) * 16, s })
    }
  }
  return [...shuffle(slots), ...shuffle(lawn)]
}
const TODAY_X = pathX(1150) - pathHalf(1150) - 85
const TODAY_SPOT = { x: TODAY_X, y: 1165, s: 1.45 }
const SLOTS = makeSlots()

/** 紙雕灌木：幾個圓疊在一起 */
function Bush({ x, y, r, tone }: { x: number; y: number; r: number; tone: 1 | 2 }) {
  return (
    <g filter="url(#gs-shadow)" fill={tone === 1 ? 'var(--gs-bush-1)' : 'var(--gs-bush-2)'}>
      <circle cx={x - r * 0.7} cy={y} r={r * 0.75} /><circle cx={x + r * 0.7} cy={y + r * 0.05} r={r * 0.7} /><circle cx={x} cy={y - r * 0.35} r={r} />
    </g>
  )
}

// 一天中的光線：[分鐘, 色調 r, g, b, 濃度, 路燈亮度, 星星]
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
function phaseName(m: number) {
  return m < 300 ? '深夜' : m < 420 ? '清晨' : m < 660 ? '早上' : m < 810 ? '中午' : m < 1020 ? '午後' : m < 1110 ? '黃昏' : m < 1260 ? '晚上' : '深夜'
}

export default function GardenScene({ store }: { store: Store }) {
  const { data } = store
  const goal = data.profile!.waterGoal ?? 2000
  const today = todayISO()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])
  const m = now.getHours() * 60 + now.getMinutes()
  const light = lightAt(m)

  // 開過花的日子依序種進花圃（最多種滿所有位置，之後顯示最近的）
  const planted = useMemo(() => {
    const days = Object.keys(data.water).filter((d) => d < today && stageOf(data.water[d], goal) === 4).sort()
    const shown = days.slice(-SLOTS.length)
    return shown.map((d, i) => ({ date: d, f: flowerOf(dayFlower(data, d))!, slot: SLOTS[i] })).filter((p) => p.f)
  }, [data, goal, today])
  const todayStage = stageOf(data.water[today] ?? 0, goal)
  const todayFlower = flowerOf(dayFlower(data, today))

  const [poke, setPoke] = useState<{ key: string; n: number } | null>(null)
  const n = useRef(0)
  const tap = (key: string) => setPoke({ key, n: ++n.current })

  // 太陽 06:00–18:30，月亮 18:00–06:00
  const sunP = (m - 360) / 750
  const moonP = ((m - 1080 + 1440) % 1440) / 720
  const sun = sunP >= 0 && sunP <= 1 ? { x: 640 + 460 * sunP, y: 200 - Math.sin(Math.PI * sunP) * 170 } : null
  const moon = moonP >= 0 && moonP <= 1 ? { x: 680 + 420 * moonP, y: 190 - Math.sin(Math.PI * moonP) * 150 } : null
  const night = light.stars > 0.3

  const items = [
    ...planted.map((p) => ({ key: p.date, f: p.f, stage: 4, ...p.slot, label: `${p.f.name}・${fmtDate(p.date).replace(/（.）/, '')} 開花` })),
    ...(todayFlower && todayStage >= 0 ? [{ key: 'today', f: todayFlower, stage: todayStage, ...TODAY_SPOT, label: `今天的${todayFlower.name}・${STAGES[todayStage]}` }] : [])
  ].sort((a, b) => a.y - b.y)

  return (
    <div className={'scene' + (night ? ' night' : '')} style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={`我的花園，${phaseName(m)}，種了 ${planted.length} 朵花`}>
      <img className="scene-bg" src="garden/backdrop.webp" alt="" draggable={false} style={{ width: '100%', height: py(500) }} />
      <img className="scene-tree" src="garden/tree.webp" alt="" draggable={false} style={{ left: 0, top: 0, width: px(560), height: py(330) }} />
      <img className="scene-wisteria" src="garden/wisteria.webp" alt="" draggable={false} style={{ left: px(215), top: py(250), width: px(220), height: py(220) }} />
      {sun && <span className="sun" style={{ left: px(sun.x), top: py(sun.y), opacity: 1 - light.stars }} />}
      {moon && night && <span className="moon" style={{ left: px(moon.x), top: py(moon.y), opacity: light.stars }} />}

      <svg className="ground" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="gs-lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--gs-lawn-1)" /><stop offset="1" stopColor="var(--gs-lawn-2)" /></linearGradient>
          <radialGradient id="gs-soil" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="var(--gs-soil-1)" /><stop offset="1" stopColor="var(--gs-soil-2)" /></radialGradient>
          <filter id="gs-shadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#5d4528" floodOpacity=".24" /></filter>
        </defs>
        {/* 後排的紙雕樹籬，把溫室前原本的花遮住 */}
        <path d="M0 455 C 90 420 160 448 250 430 S 420 418 520 436 S 700 420 820 438 S 1010 418 1160 440 L1160 1250 L0 1250 Z" fill="var(--gs-hedge)" filter="url(#gs-shadow)" />
        <path d="M0 498 C 160 474 380 492 580 482 S 940 470 1160 486 L1160 1250 L0 1250 Z" fill="url(#gs-lawn)" filter="url(#gs-shadow)" />
        {/* 草地上淡淡的紙紋條 */}
        {[560, 700, 860, 1020, 1170].map((y, i) => <path key={y} d={`M0 ${y} C 300 ${y - 18} 760 ${y + 14} 1160 ${y - 6}`} stroke="var(--gs-lawn-line)" strokeWidth="10" fill="none" opacity={0.35 - i * 0.03} />)}
        {/* 花圃：土壤＋一圈小石頭 */}
        {BEDS.map((b, i) => (
          <g key={i}>
            <ellipse cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill="url(#gs-soil)" filter="url(#gs-shadow)" />
            <ellipse cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill="none" stroke="var(--gs-stone)" strokeWidth="16" strokeDasharray="0.1 30" strokeLinecap="round" filter="url(#gs-shadow)" />
          </g>
        ))}
        {/* S 形踏石步道 */}
        <path d={`M${pathX(470) - pathHalf(470)} 470 ${Array.from({ length: 14 }, (_, i) => { const y = 470 + (i + 1) * 60; return `L${pathX(y) - pathHalf(y)} ${y}` }).join(' ')} L${pathX(1260) + pathHalf(1260)} 1260 ${Array.from({ length: 14 }, (_, i) => { const y = 1260 - (i + 1) * 60; return `L${pathX(y) + pathHalf(y)} ${y}` }).join(' ')} Z`} fill="var(--gs-path)" filter="url(#gs-shadow)" />
        {Array.from({ length: 12 }, (_, i) => {
          const y = 505 + i * 63, w = pathHalf(y)
          return <ellipse key={i} cx={pathX(y) + (i % 2 ? 0.28 : -0.28) * w} cy={y} rx={w * 0.52} ry={9 + i * 1.7} fill="var(--gs-stone)" filter="url(#gs-shadow)" />
        })}
        {/* 灌木 */}
        <Bush x={70} y={560} r={52} tone={1} /><Bush x={560} y={548} r={40} tone={2} /><Bush x={1100} y={575} r={56} tone={2} />
        <Bush x={40} y={1215} r={70} tone={2} /><Bush x={1135} y={1225} r={64} tone={1} />
        {/* 前景的草葉 */}
        <path d={`M0 1250 ${Array.from({ length: 30 }, (_, i) => `L${i * 40 + 20} ${1222 - (i % 3) * 12} L${i * 40 + 40} 1250`).join(' ')} Z`} fill="var(--gs-bush-1)" opacity=".9" />
      </svg>

      {items.map((it) => {
        const [w, h] = it.f.sizes[it.stage]
        const k = it.s * (it.stage === 0 ? 1.8 : 1.15)
        const active = poke?.key === it.key
        return (
          <button key={it.key} className={'plant' + (active ? ' poked' : '') + (it.key === 'today' ? ' is-today' : '')}
            style={{ left: px(it.x), top: py(it.y), width: px(w * k), height: py(h * k), animationDelay: `${(it.x * 7 + it.y) % 3000}ms`, zIndex: Math.round(it.y) }}
            onClick={() => tap(it.key)} aria-label={it.label}>
            <img key={active ? poke!.n : 0} src={flowerSrc(it.f.id, it.stage)} alt="" draggable={false} />
            <span className="hit" aria-hidden="true" />
            {active && <span className="bubble" key={'b' + poke!.n}>{it.label}</span>}
            {it.key === 'today' && <span className="today-tag">今天</span>}
          </button>
        )
      })}

      <span className="tint" style={{ background: light.tint, opacity: light.alpha }} />
      <span className="lamps" style={{ opacity: light.lamps }}>
        <i style={{ left: px(22), top: py(270) }} /><i style={{ left: px(645), top: py(320) }} /><i style={{ left: px(1128), top: py(375) }} />
        <i className="low" style={{ left: px(300), top: py(900) }} /><i className="low" style={{ left: px(930), top: py(920) }} />
        <b style={{ left: px(270), top: py(170), width: px(760), height: py(300) }} />
      </span>
      {light.stars > 0 && (
        <span className="stars" style={{ opacity: light.stars }}>
          {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: px(620 + ((i * 197) % 520)), top: py(20 + ((i * 73) % 190)), animationDelay: `${i * 0.37}s` }} />)}
          {Array.from({ length: 9 }, (_, i) => <em key={i} style={{ left: px(80 + ((i * 263) % 1000)), top: py(620 + ((i * 151) % 520)), animationDelay: `${i * 0.6}s` }} />)}
        </span>
      )}
      {!night && (
        <span className="breeze" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => <i key={i} style={{ top: py(540 + i * 140), animationDelay: `${i * 2.3}s` }} />)}
        </span>
      )}
      <span className="scene-time">{phaseName(m)} {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}</span>
      {planted.length === 0 && <span className="scene-empty">花圃還是空的。<br />喝水達標開出的花，會一朵朵種進來。</span>}
    </div>
  )
}
