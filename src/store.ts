import { useCallback, useEffect, useState } from 'react'
import type { AppData } from './types'

const KEY = 'diet-tracker-v1'

const empty = (): AppData => ({ version: 1, profile: null, weights: [], logs: [], customFoods: [], water: {} })

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    return { ...empty(), ...JSON.parse(raw) }
  } catch {
    return empty()
  }
}

export function useStore() {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      alert('儲存失敗，請先匯出備份。')
    }
  }, [data])

  // 要求瀏覽器把資料標為「持久保存」，降低被系統清除的機會
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [])
  const replace = useCallback((d: AppData) => setData({ ...empty(), ...d }), [])
  return { data, update, replace }
}
