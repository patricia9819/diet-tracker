import { useState, type ReactNode } from 'react'
import type { useStore } from './store'
import { AI_MODEL, friendlyError, getAdvice } from './ai'
import { dietPrompt } from './diet'
import { MEALS, type AppData } from './types'
import { addDays, fmtDate, r1, sortedWeights, sumLogs, targets, todayISO } from './util'

type Store = ReturnType<typeof useStore>

/** 整理最近 7 天的紀錄給 AI */
export function buildReport(d: AppData) {
  const p = d.profile!
  const ws = sortedWeights(d.weights)
  const kg = ws.length ? ws[ws.length - 1].kg : p.goalWeight
  const t = targets(p, kg)
  const age = new Date().getFullYear() - p.birthYear
  const lines = [
    `# 基本資料`,
    `${p.sex === 'female' ? '女' : '男'}，${age} 歲，身高 ${p.heightCm} cm，目前 ${kg} kg，目標 ${p.goalWeight} kg，希望每週減 ${p.weeklyLossKg} kg。`,
    `每日目標：${t.kcal} 大卡，蛋白質 ${t.protein}g、碳水 ${t.carbs}g、脂肪 ${t.fat}g；喝水目標 2000 ml。`,
    '',
    '# 體重（最近 21 天）',
    ws.filter((w) => w.date >= addDays(todayISO(), -21)).map((w) => `${w.date}: ${w.kg} kg`).join('\n') || '沒有紀錄',
    '',
    '# 最近 7 天飲食與運動'
  ]
  for (let i = 6; i >= 0; i--) {
    const day = addDays(todayISO(), -i)
    const logs = d.logs.filter((l) => l.date === day)
    const ex = d.exercises.filter((e) => e.date === day)
    const tot = sumLogs(logs)
    lines.push(`## ${day}${i === 0 ? '（今天，可能還沒記完）' : ''}`)
    if (!logs.length) lines.push('沒有記錄飲食')
    else {
      lines.push(`總計 ${Math.round(tot.kcal)} 大卡，蛋白質 ${Math.round(tot.protein)}g、碳水 ${Math.round(tot.carbs)}g、脂肪 ${Math.round(tot.fat)}g`)
      for (const m of MEALS) {
        const items = logs.filter((l) => l.meal === m.key)
        if (items.length) lines.push(`${m.label}：${items.map((l) => `${l.name}${l.servings !== 1 ? `×${r1(l.servings)}` : ''}(${Math.round(l.kcal * l.servings)})`).join('、')}`)
      }
    }
    lines.push(`喝水 ${d.water[day] ?? 0} ml`)
    if (ex.length) lines.push(`運動：${ex.map((e) => `${e.name} ${e.minutes} 分鐘 ${e.kcal} 大卡`).join('、')}`)
  }
  lines.push('', '請根據以上紀錄給我飲食建議。')
  return lines.join('\n')
}

/** 簡單的 Markdown 顯示（只處理小標題、條列、粗體） */
function Md({ text }: { text: string }) {
  const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? <b key={i}>{x}</b> : x))
  const out: ReactNode[] = []
  let list: ReactNode[] = []
  const flush = () => { if (list.length) { out.push(<ul key={out.length}>{list}</ul>); list = [] } }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (/^[-*•]\s+/.test(line)) { list.push(<li key={list.length}>{bold(line.replace(/^[-*•]\s+/, ''))}</li>); continue }
    flush()
    if (!line) continue
    if (/^#{1,4}\s/.test(line)) out.push(<h3 key={out.length}>{bold(line.replace(/^#+\s*/, ''))}</h3>)
    else out.push(<p key={out.length}>{bold(line)}</p>)
  }
  flush()
  return <div className="md">{out}</div>
}

export default function Advice({ store }: { store: Store }) {
  const { data, update } = store
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [idx, setIdx] = useState(0)
  const list = [...data.advice].reverse()
  const loggedDays = new Set(data.logs.filter((l) => l.date > addDays(todayISO(), -7)).map((l) => l.date)).size

  const run = async () => {
    setBusy(true); setErr('')
    try {
      const text = await getAdvice(dietPrompt(data.profile!), buildReport(data))
      update((d) => ({ ...d, advice: [...d.advice, { date: todayISO(), text }].slice(-20) }))
      setIdx(0)
    } catch (e) { setErr(friendlyError(e)) }
    setBusy(false)
  }

  const cur = list[idx]
  return (
    <>
      <header className="top"><h1>AI 飲食建議</h1></header>
      <section className="card">
        <p className="muted small" style={{ marginTop: 0 }}>
          AI 會參考你最近 7 天的飲食、喝水、運動和體重，並依你的飲食習慣（{data.profile?.diet === 'omnivore' || !data.profile?.diet ? '葷食' : '素食'}）給建議。
          {loggedDays < 3 && ' 目前紀錄還不多，建議記錄滿 3 天以上再產生，會比較準。'}
        </p>
        <button className="primary block" onClick={run} disabled={busy}>{busy ? 'AI 分析中，約需 20–60 秒…' : '🤖 產生建議'}</button>
        {err && <div className="alert">{err}</div>}
      </section>
      {cur && (
        <section className="card">
          <div className="row between">
            <b>{fmtDate(cur.date)} 的建議</b>
            {list.length > 1 && (
              <div className="row">
                <button className="chip" disabled={idx >= list.length - 1} onClick={() => setIdx(idx + 1)}>較舊</button>
                <button className="chip" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>較新</button>
              </div>
            )}
          </div>
          <Md text={cur.text} />
        </section>
      )}
      <p className="note">建議由 AI（{AI_MODEL}）產生，僅供參考，不能取代醫師或營養師的專業建議。</p>
    </>
  )
}
