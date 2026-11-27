import { useState } from 'react'
import { useStore } from './store'
import Today from './Today'
import WeightView from './WeightView'
import Settings from './Settings'
import { sortedWeights } from './util'

type Tab = 'today' | 'weight' | 'me'

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

  return (
    <div className="app">
      <main>
        {tab === 'today' && <Today store={store} currentKg={currentKg} />}
        {tab === 'weight' && <WeightView store={store} />}
        {tab === 'me' && <Settings store={store} />}
      </main>
      <nav className="tabs">
        <button className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>
          <span>🍱</span>飲食
        </button>
        <button className={tab === 'weight' ? 'on' : ''} onClick={() => setTab('weight')}>
          <span>⚖️</span>體重
        </button>
        <button className={tab === 'me' ? 'on' : ''} onClick={() => setTab('me')}>
          <span>👤</span>我的
        </button>
      </nav>
    </div>
  )
}
