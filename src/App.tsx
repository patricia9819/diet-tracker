import { useState } from 'react'
import { useStore } from './store'
import Today from './Today'
import WeightView from './WeightView'
import Exercise from './Exercise'
import Advice from './Advice'
import Settings from './Settings'
import { sortedWeights } from './util'

type Tab = 'today' | 'weight' | 'exercise' | 'advice' | 'me'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'today', icon: '🍱', label: '飲食' },
  { key: 'weight', icon: '⚖️', label: '體重' },
  { key: 'exercise', icon: '🏃', label: '運動' },
  { key: 'advice', icon: '🤖', label: '建議' },
  { key: 'me', icon: '👤', label: '我的' }
]

export default function App() {
  const store = useStore()
  const { data } = store
  const [tab, setTab] = useState<Tab>('today')

  if (!data.profile) {
    return (
      <div className="app">
        <header className="top"><h1>歡迎！先建立你的資料</h1></header>
        <main><Settings store={store} onboarding /></main>
      </div>
    )
  }

  const ws = sortedWeights(data.weights)
  const currentKg = ws.length ? ws[ws.length - 1].kg : data.profile.goalWeight
  const go = (t: Tab) => { setTab(t); window.scrollTo(0, 0) }

  return (
    <div className="app">
      <main>
        {tab === 'today' && (
          <>
            {!data.profile.diet && (
              <div className="card alert-card">
                <b>✨ 新功能</b>
                <p className="small">現在可以設定飲食習慣（例如奶蛋素），食物清單、拍照辨識和 AI 建議都會依此調整。</p>
                <button className="primary" onClick={() => go('me')}>前往設定</button>
              </div>
            )}
            <Today store={store} currentKg={currentKg} />
          </>
        )}
        {tab === 'weight' && <WeightView store={store} />}
        {tab === 'exercise' && <Exercise store={store} />}
        {tab === 'advice' && <Advice store={store} />}
        {tab === 'me' && <Settings store={store} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => go(t.key)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
