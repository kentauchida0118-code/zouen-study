import { useCallback, useEffect, useMemo, useState } from 'react'
import { StoreProvider, useStore } from './store'
import { ConfirmProvider, NavCtx } from './ui'
import type { Nav, Tab } from './ui'
import type { Session } from './types'
import { Home } from './screens/Home'
import { Learn } from './screens/Learn'
import { Quiz } from './screens/Quiz'
import { Review } from './screens/Review'
import { Log } from './screens/Log'
import { Runner } from './Runner'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ホーム', icon: '⌂' },
  { id: 'learn', label: '学ぶ', icon: '📖' },
  { id: 'quiz', label: '問題', icon: '✎' },
  { id: 'review', label: '復習', icon: '↻' },
  { id: 'log', label: '記録', icon: '▤' },
]

function Shell() {
  const { ready, error, saveSession, session } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [detail, setDetail] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const go = useCallback((t: Tab, d: string | null = null) => { setTab(t); setDetail(d); setRunning(false); window.scrollTo(0, 0) }, [])
  const start = useCallback((s: Session) => { void saveSession(s); setRunning(true); window.scrollTo(0, 0) }, [saveSession])
  const resume = useCallback(() => setRunning(true), [])
  const nav: Nav = useMemo(() => ({ tab, detail, go, start, resume }), [tab, detail, go, start, resume])

  useEffect(() => { window.scrollTo(0, 0) }, [session?.index])

  if (!ready) return <div className="screen"><p>読み込み中…</p></div>
  return (
    <NavCtx.Provider value={nav}>
      <ConfirmProvider>
        {error && <div className="warn-box" role="alert">{error}</div>}
        {running && session ? <Runner onExit={() => setRunning(false)} /> : (
          <>
            {tab === 'home' && <Home />}
            {tab === 'learn' && <Learn />}
            {tab === 'quiz' && <Quiz />}
            {tab === 'review' && <Review />}
            {tab === 'log' && <Log />}
            <nav className="bottom-nav" aria-label="メインメニュー">
              {TABS.map((t) => (
                <button key={t.id} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
                  <span className="ic" aria-hidden="true">{t.icon}</span><span>{t.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}
      </ConfirmProvider>
    </NavCtx.Provider>
  )
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>
}
