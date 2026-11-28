import { useState, type ReactNode } from 'react'
import type { useStore } from './store'
import { friendlyError, getAdvice } from './ai'
import { Icon } from './icons'
import { PageHead } from './ui'
import { dayActivity } from './activity'
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
    `每日目標：${t.kcal} 大卡，蛋白質 ${t.protein}g、碳水 ${t.carbs}g、脂肪 ${t.fat}g；喝水目標 ${p.waterGoal ?? 2000} ml；步數目標 ${p.stepGoal ?? 8000} 步。`,
    '',
    '# 體重（最近 21 天）',
    ws.filter((w) => w.date >= addDays(todayISO(), -21)).map((w) => `${w.date}: ${w.kg} kg`).join('\n') || '沒有紀錄',
    '',
    '# 最近 7 天飲食與活動'
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
    const st = d.steps?.[day]?.steps
    if (st) lines.push(`走路 ${st} 步（約 ${dayActivity(d, day, kg).walk} 大卡）`)
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
  const [more, setMore] = useState(false)
  const list = [...data.advice].reverse()
  const loggedDays = new Set(data.logs.filter((l) => l.date > addDays(todayISO(), -7)).map((l) => l.date)).size

  const run = async () => {
    setBusy(true); setErr('')
    try {
      const r = await getAdvice(dietPrompt(data.profile!), buildReport(data))
      update((d) => ({ ...d, advice: [...d.advice, { date: todayISO(), text: r.detail, title: r.title, summary: r.summary, tips: r.tips }].slice(-20) }))
      setIdx(0); setMore(false)
    } catch (e) { setErr(friendlyError(e)) }
    setBusy(false)
  }

  const cur = list[idx]
  return (
    <>
      <PageHead title="AI 飲食建議" en="Insights" />
      <div className="insight-hero"><BowlArt /></div>

      {cur ? (
        <section className="insight">
          <span className="tag-pill">{cur.date === todayISO() ? '今日建議' : `${fmtDate(cur.date)} 的建議`}</span>
          <h2 className="insight-title">{(cur.title ?? '飲食建議').split(/[，,]/).map((x, i, a) => <span key={i}>{x}{i < a.length - 1 ? '，' : ''}</span>)}</h2>
          {cur.summary && <p className="insight-sum">{cur.summary}</p>}
          {cur.tips?.length ? (
            <>
              <h3 className="sec">具體建議</h3>
              {cur.tips.map((t) => (
                <div className="tip" key={t.text}><Icon name={t.icon} size={22} /><span>{t.text}</span></div>
              ))}
            </>
          ) : null}
          {cur.text && (
            <>
              <button className="link-add" onClick={() => setMore(!more)} aria-expanded={more}>{more ? '收起完整建議' : '看完整建議'}<Icon name={more ? 'chevronDown' : 'chevron'} size={16} /></button>
              {more && <Md text={cur.text} />}
            </>
          )}
          {list.length > 1 && (
            <div className="hist">
              <button className="btn-line" disabled={idx >= list.length - 1} onClick={() => { setIdx(idx + 1); setMore(false) }}><Icon name="chevronLeft" size={16} />較舊</button>
              <span className="muted small">{idx + 1} / {list.length}</span>
              <button className="btn-line" disabled={idx === 0} onClick={() => { setIdx(idx - 1); setMore(false) }}>較新<Icon name="chevron" size={16} /></button>
            </div>
          )}
        </section>
      ) : (
        <section className="insight">
          <span className="tag-pill">開始使用</span>
          <h2 className="insight-title"><span>讓 Claude 看看，</span><span>你最近吃得如何</span></h2>
          <p className="insight-sum">Claude 會參考你最近 7 天的飲食、喝水、步數和體重，依「奶蛋素、不吃五辛」等飲食習慣，給你具體可行的調整建議。</p>
        </section>
      )}

      <section className="block">
        {loggedDays < 3 && <p className="note">目前紀錄還不多，建議記錄滿 3 天再產生，會比較準。</p>}
        <button className="btn-dark" onClick={run} disabled={busy}>
          <Icon name="sparkle" size={18} />{busy ? 'Claude 分析中，約 20–60 秒…' : cur ? '重新產生建議' : '產生建議'}
        </button>
        {err && <div className="alert">{err}</div>}
      </section>
      <p className="note">建議由 Claude 產生，會用到你 Claude 方案的使用額度。內容僅供參考，不能取代醫師或營養師的專業建議。</p>
    </>
  )
}

/** 首圖：一碗優格與穀物（向量插畫） */
function BowlArt() {
  return (
    <svg viewBox="0 0 360 200" className="bowl-art" role="img" aria-label="一碗優格搭配藍莓與穀物">
      <defs>
        <radialGradient id="ba-light" cx="70%" cy="20%" r="80%"><stop offset="0" stopColor="var(--art-light)" /><stop offset="1" stopColor="var(--art-bg)" /></radialGradient>
        <linearGradient id="ba-bowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--art-bowl)" /><stop offset="1" stopColor="var(--art-bowl-2)" /></linearGradient>
      </defs>
      <rect width="360" height="200" fill="url(#ba-light)" />
      <g fill="var(--art-leaf)" opacity=".5">
        <path d="M300 -10c30 10 46 34 44 64-28-8-44-32-44-64z" />
        <path d="M262 8c22 14 28 34 20 56-20-14-28-34-20-56z" opacity=".7" />
        <path d="M330 60c22 14 28 34 20 56-20-14-28-34-20-56z" opacity=".6" />
      </g>
      <path d="M0 150 C80 135 200 135 360 160 L360 200 L0 200z" fill="var(--art-cloth)" />
      <ellipse cx="170" cy="168" rx="104" ry="14" fill="var(--art-shadow)" />
      <path d="M62 100h216c0 48-48 72-108 72S62 148 62 100z" fill="url(#ba-bowl)" />
      <ellipse cx="170" cy="100" rx="108" ry="26" fill="var(--art-rim)" />
      <ellipse cx="170" cy="102" rx="98" ry="21" fill="var(--art-yogurt)" />
      <g fill="var(--art-granola)">
        <circle cx="150" cy="95" r="5" /><circle cx="162" cy="100" r="4" /><circle cx="140" cy="102" r="4.5" /><circle cx="175" cy="94" r="4" />
        <circle cx="132" cy="96" r="3.5" /><circle cx="155" cy="106" r="3.5" /><circle cx="168" cy="108" r="3" /><circle cx="186" cy="101" r="3.5" />
      </g>
      <g fill="var(--art-berry)">
        <circle cx="198" cy="96" r="7" /><circle cx="212" cy="103" r="6.5" /><circle cx="206" cy="91" r="6" /><circle cx="222" cy="95" r="5.5" />
        <circle cx="120" cy="104" r="5" />
      </g>
      <g fill="var(--art-berry-hi)"><circle cx="196" cy="94" r="1.6" /><circle cx="210" cy="101" r="1.5" /><circle cx="204" cy="89" r="1.4" /></g>
    </svg>
  )
}
