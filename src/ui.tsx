import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'
import { parseISO, todayISO } from './util'

export function PageHead({ title, en, right }: { title: string; en: string; right?: ReactNode }) {
  return (
    <header className="ph">
      <div>
        <h1>{title}</h1>
        <div className="en">{en}</div>
      </div>
      {right && <div className="ph-right">{right}</div>}
    </header>
  )
}

export function dateLabel(s: string) {
  const d = parseISO(s)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日（${'日一二三四五六'[d.getDay()]}）`
}

/** 看起來像標籤的日期選擇器 */
export function DateButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="datebtn">
      <span>{value === todayISO() ? '今天' : dateLabel(value)}</span>
      <Icon name="chevronDown" size={16} />
      <input type="date" value={value} max={todayISO()} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="選擇日期" />
    </label>
  )
}

export function Sheet({ title, onClose, children, full }: { title: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  // 用 portal 放到最上層，避免被頁面的圖層或底部功能列蓋住
  return createPortal(
    <div className="sheet-bg" onClick={onClose}>
      <div className={full ? 'sheet full' : 'sheet'} ref={ref} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <b>{title}</b>
          <button className="icon-btn" onClick={onClose} aria-label="關閉"><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Bar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'blue' | 'bad' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return <div className="bar-track"><div className={'bar-fill ' + tone} style={{ width: `${pct}%` }} /></div>
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
