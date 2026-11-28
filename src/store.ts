import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from './types'
import { useCap } from './platform'

/*
 * 儲存位置：
 * - 在 Claude 頁面裡：存在你 Claude 帳號的私人空間（data/users/<你的 id>/），只有你看得到，換手機也在。
 *   拆成「main」（個人資料、自訂食物、建議）和每月一份（m-2026-11：飲食、體重、喝水、運動）。
 * - 其他地方（例如 GitHub Pages）：存在這支手機的瀏覽器。
 */
const LOCAL_KEY = 'diet-tracker-v1'

export const empty = (): AppData => ({ version: 1, profile: null, weights: [], logs: [], customFoods: [], water: {}, exercises: [], advice: [] })

type Docs = Record<string, Record<string, unknown>>

function split(d: AppData): Docs {
  const docs: Docs = { main: { profile: d.profile, customFoods: d.customFoods, advice: d.advice } }
  const m = (date: string) => {
    const k = 'm-' + date.slice(0, 7)
    return (docs[k] ??= { logs: [], weights: [], water: {}, exercises: [] }) as { logs: unknown[]; weights: unknown[]; water: Record<string, number>; exercises: unknown[] }
  }
  for (const l of d.logs) m(l.date).logs.push(l)
  for (const w of d.weights) m(w.date).weights.push(w)
  for (const e of d.exercises) m(e.date).exercises.push(e)
  for (const [date, ml] of Object.entries(d.water)) m(date).water[date] = ml
  return docs
}

function join(docs: Docs): AppData {
  const d = empty()
  const main = docs.main as Partial<AppData> | undefined
  if (main) {
    d.profile = main.profile ?? null
    d.customFoods = main.customFoods ?? []
    d.advice = main.advice ?? []
  }
  for (const [k, v] of Object.entries(docs)) {
    if (!k.startsWith('m-')) continue
    const m = v as Partial<AppData>
    d.logs.push(...(m.logs ?? []))
    d.weights.push(...(m.weights ?? []))
    d.exercises.push(...(m.exercises ?? []))
    Object.assign(d.water, m.water ?? {})
  }
  return d
}

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty()
  } catch {
    return empty()
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Status = 'loading' | 'cloud' | 'local' | 'error'

export function useStore() {
  const [data, setData] = useState<AppData>(empty)
  const [status, setStatus] = useState<Status>('loading')
  const [saveError, setSaveError] = useState('')
  const col = useRef<any>(null) // 雲端的私人 collection
  const saved = useRef<Record<string, string>>({}) // 每份文件上次存的內容
  const queue = useRef<Record<string, Record<string, unknown> | null>>({})
  const busy = useRef<Record<string, boolean>>({})
  const ready = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [db, user] = await Promise.all([useCap('db'), useCap('user')])
      const id = user ? await user.id().catch(() => null) : null
      if (cancelled) return
      if (!db || !id) {
        setData(loadLocal()); setStatus('local'); ready.current = true
        return
      }
      const c = db.collection('data/users/' + id)
      const timer = setTimeout(() => !cancelled && setStatus((s) => (s === 'loading' ? 'error' : s)), 12000)
      try {
        const snap = await c.get()
        clearTimeout(timer)
        if (cancelled) return
        const docs: Docs = {}
        for (const s of snap.docs) if (s.exists) docs[s.id] = s.data()
        for (const [k, v] of Object.entries(docs)) saved.current[k] = JSON.stringify(v)
        col.current = c
        setData(join(docs))
        setStatus('cloud')
        ready.current = true
      } catch {
        clearTimeout(timer)
        if (!cancelled) setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 一份文件一次只寫一筆，寫完再寫最新的內容
  const flush = useCallback(async (key: string) => {
    if (busy.current[key]) return
    busy.current[key] = true
    while (key in queue.current) {
      const body = queue.current[key]
      delete queue.current[key]
      try {
        if (body) await col.current.doc(key).set(body)
        else await col.current.doc(key).delete()
        setSaveError('')
      } catch (e: any) {
        setSaveError(e?.code === 'quota_exceeded' ? '雲端空間已滿，請先匯出備份並刪除舊資料。' : '儲存失敗，請檢查網路，下次修改時會再試一次。')
        delete saved.current[key]
      }
    }
    busy.current[key] = false
  }, [])

  useEffect(() => {
    if (!ready.current) return
    if (status === 'local') {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)) } catch { setSaveError('無法儲存到這支手機，請匯出備份。') }
      return
    }
    if (status !== 'cloud' || !col.current) return
    const docs = split(data)
    const keys = new Set([...Object.keys(docs), ...Object.keys(saved.current)])
    for (const k of keys) {
      const body = docs[k]
      const json = body ? JSON.stringify(body) : ''
      if ((saved.current[k] ?? '') === json) continue
      if (body) saved.current[k] = json
      else delete saved.current[k]
      queue.current[k] = body ?? null
      flush(k)
    }
  }, [data, status, flush])

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [])
  const replace = useCallback((d: AppData) => setData({ ...empty(), ...d }), [])
  return { data, update, replace, status, saveError }
}
