import { useEffect, useState } from 'react'

// Claude 頁面不顯示 alert / confirm，所以用頁面內的提示與確認視窗。
type Ask = { msg: string; ok: string; resolve: (v: boolean) => void }
let toastFn: (m: string) => void = () => {}
let askFn: (a: Ask) => void = () => {}

export const toast = (m: string) => toastFn(m)
export const ask = (msg: string, ok = '確定') => new Promise<boolean>((resolve) => askFn({ msg, ok, resolve }))

export function Dialogs() {
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState<Ask | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    toastFn = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(''), 2600) }
    askFn = setQ
  }, [])
  const done = (v: boolean) => { q?.resolve(v); setQ(null) }
  return (
    <>
      {msg && <div className="toast" role="status">{msg}</div>}
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
