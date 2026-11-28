import { useState } from 'react'
import { useStore } from './store'
import Today from './Today'
import WeightView from './WeightView'
import Exercise from './Exercise'
import Advice from './Advice'
import Settings from './Settings'
import { sortedWeights } from './util'
import { Dialogs } from './dialogs'

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

  if (store.status === 'loading' || store.status === 'error') {
    return (
      <div className="app">
        <main className="splash">
          <div className="logo" aria-hidden="true">⚖️</div>
          {store.status === 'loading'
            ? <p className="muted">讀取你的紀錄…</p>
            : <p>暫時連不上你的資料。請確認網路連線，稍後再重新打開這個頁面。</p>}
        </main>
      </div>
    )
  }

  if (!data.profile) {
    return (
      <div className="app">
        <main>
          <header className="top"><h1>歡迎！先建立你的資料</h1></header>
          <p className="muted small">紀錄會存在你 Claude 帳號的私人空間，只有你看得到。之前的 App 有資料的話，填完後可以到「我的 → 備份」匯入。</p>
          <Settings store={store} onboarding />
        </main>
        <Dialogs />
      </div>
    )
  }

  const ws = sortedWeights(data.weights)
  const currentKg = ws.length ? ws[ws.length - 1].kg : data.profile.goalWeight
  const go = (t: Tab) => { setTab(t); window.scrollTo(0, 0) }

  return (
    <div className="app">
      <main>
        {store.saveError && <div className="alert">{store.saveError}</div>}
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
      <Dialogs />
    </div>
  )
}
