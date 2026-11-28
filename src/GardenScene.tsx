import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { useStore } from './store'
import { collection, dayFlower, flowerOf, flowerSrc, STAGES, stageOf, type Flower } from './garden'
import { fmtDate, todayISO } from './util'
import layout from '../public/garden/spots.json'
import cloudData from '../public/garden/clouds.json'

type Store = ReturnType<typeof useStore>

// 場景座標＝插畫像素（1536 × 1024）
const W = layout.w, H = layout.h
const SPOTS = layout.spots as { x: number; y: number; s: number }[]
const px = (x: number) => `${(x / W) * 100}%`
const py = (y: number) => `${(y / H) * 100}%`

/** 一小叢：同一種花種 3 株，前後錯開 */
/** 依日期產生固定的亂數，每次打開花園，同一天的花叢長得都一樣 */
function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296
}
/** 一叢花：後排 2 株花苞、前面 4–5 株盛開，大小、角度、方向都不同，前後交錯 */
function clump(date: string) {
  const r = rng(date)
  const stems: { dx: number; dy: number; k: number; rot: number; flip: boolean; st: 2 | 3 | 4 }[] = []
  const put = (st: 2 | 3 | 4, ring: number, dyBase: number, size: number, ang: number) => {
    const rad = ring * (0.75 + r() * 0.35)
    stems.push({ dx: Math.cos(ang) * 64 * rad, dy: dyBase + Math.sin(ang) * 18 * rad, k: size * (0.85 + r() * 0.28), rot: (r() - 0.5) * 12, flip: r() < 0.5, st })
  }
  // 外圍一圈綠葉打底、後排花苞，再把 5–6 朵盛開的花放在中間偏前
  for (let i = 0; i < 4; i++) put(2, 1, 2, 0.6, (i / 4) * Math.PI * 2 + r())
  for (let i = 0; i < 2; i++) put(3, 0.6, -14, 0.6, Math.PI + (i - 0.5) * 1.4 + r() * 0.4)
  const n = 5 + Math.floor(r() * 2)
  for (let i = 0; i < n; i++) put(4, i === 0 ? 0 : 0.62, 0, 0.66, (i / n) * Math.PI * 2 + r() * 0.8)
  return stems
}

// 一天中的光線：[分鐘, 色調 r, g, b, 濃度, 燈光, 星星]
const KEYS: [number, number, number, number, number, number, number][] = [
  // 夜晚只把天空換成夜空，地面只稍微變暗、偏紫，保持溫暖明亮
  [0, 168, 156, 206, 0.24, 1, 1],
  [300, 168, 156, 206, 0.24, 1, 1],
  [360, 236, 186, 200, 0.22, 0.5, 0.35],
  [450, 255, 226, 196, 0.1, 0, 0],
  [720, 255, 255, 255, 0, 0, 0],
  [960, 255, 218, 170, 0.1, 0, 0],
  [1050, 248, 178, 128, 0.24, 0.25, 0.1],
  [1110, 196, 160, 196, 0.26, 0.85, 0.6],
  [1200, 168, 156, 206, 0.24, 1, 1],
  [1440, 168, 156, 206, 0.24, 1, 1]
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
  // 溫室兩側的藤蔓：種過紫藤花就長出紫藤，種過玫瑰／白玫瑰就爬滿玫瑰
  const got = useMemo(() => collection(data), [data])
  const hasWisteria = got.has('f05')
  const hasRose = got.has('f04') || got.has('f21')
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
  const moon = moonP >= 0 && moonP <= 1 ? { x: 1250 + 190 * moonP, y: 150 - Math.sin(Math.PI * moonP) * 62 } : null   // 留在右上方的夜空，不壓到溫室屋頂

  type Item = { key: string; group: string; src: string; w: number; h: number; x: number; y: number; rot: number; flip: boolean; label: string; delay: number; back?: boolean; lead?: boolean; today?: boolean }
  const items: Item[] = []
  const shadows: { key: string; x: number; y: number; s: number }[] = []
  planted.forEach((p, i) => {
    const label = `${p.f.name}・${fmtDate(p.date).replace(/（.）/, '')} 開花`
    const g = p.f.gsizes
    shadows.push({ key: p.date, x: p.spot.x, y: p.spot.y + 4, s: p.spot.s * 1.25 })
    clump(p.date).forEach((c, j) => {
      const st = c.st
      const [w, h] = g ? g[st - 2] : p.f.sizes[st]
      const depth = 1 + c.dy / 160
      const k = p.spot.s * c.k * depth
      items.push({
        key: `${p.date}-${j}`, group: p.date, src: g ? flowerSrc(p.f.id, `g${st}` as 'g2' | 'g3' | 'g4') : flowerSrc(p.f.id, st),
        w: w * k, h: h * k, x: p.spot.x + c.dx * p.spot.s, y: p.spot.y + c.dy * p.spot.s + 6, rot: c.rot, flip: c.flip,
        label, delay: (i * 530 + j * 370) % 4200, back: st < 4, lead: j === 6
      })
    })
  })
  if (todayFlower && todayStage >= 0) {
    const useG = todayStage >= 3 && todayFlower.gsizes
    const [w, h] = useG ? todayFlower.gsizes![todayStage - 2] : todayFlower.sizes[todayStage]
    const k = todaySpot.s * (todayStage === 0 ? 1.4 : useG ? 0.62 : 0.85)
    if (todayStage >= 1) shadows.push({ key: 'today', x: todaySpot.x, y: todaySpot.y + 8, s: todaySpot.s * 0.6 })
    items.push({ key: 'today', group: 'today', src: useG ? flowerSrc(todayFlower.id, `g${todayStage}` as 'g3' | 'g4') : flowerSrc(todayFlower.id, todayStage), w: w * k, h: h * k, x: todaySpot.x, y: todaySpot.y + 10, rot: 0, flip: false, label: `今天的${todayFlower.name}・${STAGES[todayStage]}`, delay: 0, lead: true, today: true })
  }
  items.sort((a, b) => a.y - b.y)

  return (
    <div className="scene-wrap">
      <div className="scene-scroll" ref={scroller} onScroll={() => { if (ready.current && hint) setHint(false) }}>
        <div className={'scene' + (night ? ' night' : '')} role="img" aria-label={`我的花園，${phaseName(m)}，種了 ${planted.length} 叢花`}>
          <img className="scene-bg" src="garden/backdrop.webp" alt="" draggable={false} />
          {/* 白天的雲 */}
          {cloudData.day.map((c, i) => (
            <img key={c.src} className="cloud" src={`garden/${c.src}`} alt="" draggable={false}
              style={{ left: px(c.x), top: py(c.y), width: px(c.w), height: py(c.h), opacity: 1 - light.stars, animationDuration: `${46 + i * 9}s`, animationDelay: `${-i * 13}s` }} />
          ))}
          {light.stars > 0 && <img className="scene-bg night-sky" src="garden/night-sky.webp" alt="" draggable={false} style={{ opacity: light.stars }} />}
          {/* 夜晚的雲 */}
          {light.stars > 0 && cloudData.night.map((c, i) => (
            <img key={c.src} className="cloud night" src={`garden/${c.src}`} alt="" draggable={false}
              style={{ left: px(c.x), top: py(c.y), width: px(c.w), height: py(c.h), opacity: light.stars, animationDuration: `${38 + (i % 3) * 11}s`, animationDelay: `${-i * 7}s` }} />
          ))}
          {/* 大樹的樹冠分成 4 叢，各自隨風擺動 */}
          {[0, 1, 2, 3].map((k) => (
            <img key={k} className={`scene-tree t${k}`} src={`garden/tree-${k}.webp`} alt="" draggable={false} style={{ left: 0, top: 0, width: px(860), height: py(360) }} />
          ))}
          <img key={hasWisteria ? 'w1' : 'w0'} className={'scene-vines' + (hasWisteria ? ' bloomed' : '')} src={hasWisteria ? 'garden/vines-wisteria.webp' : 'garden/vines.webp'} alt="" draggable={false} style={{ left: px(480), top: py(170), width: px(280), height: py(310) }} />
          <img key={hasRose ? 'r1' : 'r0'} className={'scene-vines right' + (hasRose ? ' bloomed' : '')} src={hasRose ? 'garden/vines-rose.webp' : 'garden/vines-right.webp'} alt="" draggable={false} style={{ left: px(1020), top: py(150), width: px(280), height: py(370) }} />
          {sun && <img className="sun-img" src="garden/sun.webp" alt="" draggable={false} style={{ left: px(sun.x), top: py(sun.y), opacity: 1 - light.stars }} />}
          {moon && light.stars > 0.2 && <img className="moon-img" src="garden/moon.webp" alt="" draggable={false} style={{ left: px(moon.x), top: py(moon.y), opacity: Math.min(1, light.stars * 1.3) }} />}
          <span className="fountain" style={{ left: px(1250), top: py(700) }} aria-hidden="true"><i /><i /><i /></span>
          {/* 噴水池往下流的水：上層碗邊→下層碗、下層碗邊→水池 */}
          {[[1200, 548, 42], [1222, 552, 38], [1278, 552, 38], [1300, 548, 42], [1156, 598, 92], [1180, 604, 86], [1322, 604, 86], [1346, 598, 92]].map(([x, y, h], i) => (
            <span key={i} className="water-fall" style={{ left: px(x), top: py(y), height: py(h), animationDelay: `${-i * 0.23}s` }} aria-hidden="true" />
          ))}

          {shadows.map((sh) => (
            <span key={'sh' + sh.key} className="clump-shadow" style={{ left: px(sh.x), top: py(sh.y), width: px(130 * sh.s), height: py(34 * sh.s), zIndex: Math.round(sh.y) - 40 }} aria-hidden="true" />
          ))}
          {items.map((it) => {
            const active = poke?.key === it.group
            return (
              <button key={it.key} className={'plant' + (active ? ' poked' : '') + (it.today ? ' is-today' : '') + (it.back ? ' back' : '')}
                style={{ left: px(it.x), top: py(it.y), width: px(it.w), height: py(it.h), animationDelay: `${it.delay}ms`, zIndex: Math.round(it.y) }}
                onClick={() => tap(it.group)} aria-label={it.label}>
                <img key={active ? poke!.n : 0} src={it.src} alt="" draggable={false} style={{ ['--r' as string]: `${it.rot}deg`, ...(it.flip ? { scale: '-1 1' } : {}) }} />
                <span className="hit" aria-hidden="true" />
                {active && it.lead && <span className="bubble" key={'b' + poke!.n}>{it.label}</span>}
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
    </div>
  )
}
