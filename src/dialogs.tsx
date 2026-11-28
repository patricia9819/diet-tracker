import { useEffect, useState } from 'react'

// Claude 頁面不顯示 alert / confirm，所以用頁面內的提示與確認視窗。
type Ask = { msg: string; ok: string; resolve: (v: boolean) => void }
let toastFn: (m: string) => void = () => {}
let celebrateFn: (k: 'leaves' | 'stamp') => void = () => {}
/** 小慶祝動畫：記錄餐點的紙雕葉子、完成今日任務的印章 */
export const celebrate = (k: 'leaves' | 'stamp') => celebrateFn(k)
let askFn: (a: Ask) => void = () => {}

export const toast = (m: string) => toastFn(m)
export const ask = (msg: string, ok = '確定') => new Promise<boolean>((resolve) => askFn({ msg, ok, resolve }))

export function Dialogs() {
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState<Ask | null>(null)
  const [fx, setFx] = useState<{ id: number; k: 'leaves' | 'stamp' }[]>([])
  useEffect(() => {
    let n = 0
    celebrateFn = (k) => {
      const id = ++n
      setFx((x) => [...x, { id, k }])
      setTimeout(() => setFx((x) => x.filter((y) => y.id !== id)), k === 'stamp' ? 2400 : 1800)
    }
    let t: ReturnType<typeof setTimeout>
    toastFn = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(''), 2600) }
    askFn = setQ
  }, [])
  const done = (v: boolean) => { q?.resolve(v); setQ(null) }
  return (
    <>
      {msg && <div className="toast" role="status">{msg}</div>}
      {fx.map((f) => f.k === 'leaves' ? (
        <div className="fx-leaves" key={f.id} aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ ['--x' as string]: `${8 + i * 10.5}%`, ['--d' as string]: `${(i % 4) * 0.08}s`, ['--r' as string]: `${(i % 2 ? 1 : -1) * (40 + i * 13)}deg` }} />)}
        </div>
      ) : (
        <div className="fx-stamp" key={f.id} role="status"><div className="stamp big">今日<br />完成<small>{new Date().getMonth() + 1}.{new Date().getDate()}</small></div></div>
      ))}
      {q && (
        <div className="sheet-bg center-bg" onClick={() => done(false)}>
          <div className="dialog" role="dialog" onClick={(e) => e.stopPropagation()}>
            <p>{q.msg}</p>
            <div className="row end">
              <button className="ghost" onClick={() => done(false)}>取消</button>
              <button className="primary danger" onClick={() => done(true)}>{q.ok}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
