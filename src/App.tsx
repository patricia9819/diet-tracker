import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import Today from './Today'
import WeightView from './WeightView'
import Activity from './Activity'
import Advice from './Advice'
import Garden from './Garden'
import { dayTasks } from './garden'
import ProfilePage, { ProfileForm } from './Settings'
import { sortedWeights } from './util'
import { celebrate, Dialogs } from './dialogs'
import { Icon } from './icons'
import { PageHead } from './ui'

type Tab = 'food' | 'body' | 'move' | 'garden' | 'insight' | 'me'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'food', icon: 'food', label: '飲食' },
  { key: 'body', icon: 'body', label: '體態' },
  { key: 'move', icon: 'walk', label: '活動' },
  { key: 'garden', icon: 'flower', label: '花園' },
  { key: 'insight', icon: 'sparkle', label: '建議' },
  { key: 'me', icon: 'user', label: '我的' }
]

export default function App() {
  const store = useStore()
  const { data } = store
  const [tab, setTab] = useState<Tab>('food')

  // 今日任務剛好全部完成時，蓋下「今日完成」印章
  const ready = store.status === 'cloud' || store.status === 'local'
  const allDone = ready && !!data.profile && dayTasks(data).done
  const prevDone = useRef<boolean | null>(null)
  useEffect(() => {
    if (!ready) return
    if (prevDone.current === false && allDone) celebrate('stamp')
    prevDone.current = allDone
  }, [allDone, ready])

  if (store.status === 'loading' || store.status === 'error') {
    return (
      <div className="app">
        <main className="splash">
          <Icon name="leaf" size={40} className="accent" />
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
          <PageHead title="歡迎" en="Welcome" />
          <p className="lead">先建立你的資料。紀錄會存在你 Claude 帳號的私人空間，只有你看得到。之前的 App 有資料的話，完成後到「我的 → 資料與隱私」匯入備份。</p>
          <ProfileForm store={store} onboarding />
        </main>
        <Dialogs />
      </div>
    )
  }

  const currentKg = sortedWeights(data.weights).pop()?.kg ?? data.profile.goalWeight
  const go = (t: Tab) => { setTab(t); window.scrollTo(0, 0) }

  return (
    <div className={tab === 'garden' ? 'app garden-app' : 'app'}>
      <main>
        {store.saveError && <div className="alert">{store.saveError}</div>}
        {tab === 'food' && (
          <>
            {!data.profile.diet && (
              <div className="alert">
                請到「我的 → 個人資料與目標」設定飲食習慣（例如奶蛋素），食物清單和 Claude 的建議都會依此調整。
              </div>
            )}
            <Today store={store} currentKg={currentKg} goBody={() => go('body')} goGarden={() => go('garden')} />
          </>
        )}
        {tab === 'body' && <WeightView store={store} />}
        {tab === 'move' && <Activity store={store} />}
        {tab === 'garden' && <Garden store={store} />}
        {tab === 'insight' && <Advice store={store} />}
        {tab === 'me' && <ProfilePage store={store} />}
      </main>
      <nav className="tabs" aria-label="主要功能">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => go(t.key)} aria-current={tab === t.key ? 'page' : undefined}>
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <Dialogs />
    </div>
  )
}
