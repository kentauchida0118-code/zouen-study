import { useStore } from '../store'
import { CATEGORIES } from '../types'
import { categoryStats, pickDaily } from '../lib/select'
import { isMastered } from '../lib/srs'
import { daysBetween, todayStr } from '../lib/date'
import { newSession, pct, useNav } from '../ui'
import { dueCount } from './common'

function Target({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const left = value ? daysBetween(todayStr(), value) : null
  return (
    <div className="target">
      <label>
        <span>{label}の第一次検定 目標日</span>
        <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
      </label>
      <div className="target-left">
        {value == null ? '未設定（公式発表後に入力）' : left! > 0 ? `あと ${left} 日` : left === 0 ? '今日が試験日' : '日付を過ぎています'}
      </div>
    </div>
  )
}

export function Home() {
  const s = useStore()
  const nav = useNav()
  const today = todayStr()
  const days = new Set(s.attempts.map((a) => a.day)).size
  const total = s.attempts.length
  const ok = s.attempts.filter((a) => a.correct).length
  const stats = categoryStats(s.attempts)
  const due = dueCount(s.cards, s.questions, today)
  const daily = pickDaily(s.questions, s.cards, s.attempts, today)
  const mastered = Object.values(s.cards).filter((c) => !c.qid.startsWith('m:') && isMastered(c)).length
  const misc = Object.values(s.cards).filter((c) => !c.qid.startsWith('m:') && c.misconception).length
  const resumable = s.session && s.session.index < s.session.ids.length

  return (
    <div className="screen">
      <h1>造園施工管理 第一次検定</h1>
      <p className="muted">対象は<b>第一次検定</b>（合格で「技士補」）。二級・一級に向けた個人学習用アプリです。</p>

      <button className="btn primary block hero" disabled={daily.length === 0} onClick={() => nav.start(newSession('daily', '今日の10分学習', daily.map((q) => q.id)))}>
        <span className="hero-main">今日の10分学習</span>
        <span className="hero-sub">{daily.length} 問（期限の来た復習 → 苦手分野 → 未学習）</span>
      </button>

      {resumable && s.session && (
        <button className="btn block" onClick={nav.resume}>▶ 続きから再開：{s.session.label}（{s.session.index + 1}/{s.session.ids.length}）</button>
      )}

      <div className="cards2">
        <button className="tile" onClick={() => nav.go('review')}>
          <div className="tile-n">{due.questions}</div><div>今日の復習（問題）</div>
        </button>
        <button className="tile" onClick={() => nav.go('learn', 'memo')}>
          <div className="tile-n">{due.memo}</div><div>暗記カード（要復習）</div>
        </button>
      </div>

      {misc > 0 && <p className="warn-box">⚠ 「自信あり」で間違えた「思い込みミス」が {misc} 問あります。復習タブで優先的に潰しましょう。</p>}

      <section>
        <h2>学習の記録</h2>
        <div className="cards3">
          <div className="stat"><b>{days}</b><span>学習日数</span></div>
          <div className="stat"><b>{total}</b><span>解答数</span></div>
          <div className="stat"><b>{pct(ok, total) ?? '—'}{total ? '%' : ''}</b><span>正答率</span></div>
        </div>
        <p className="muted small">定着（自信あり正解が3回連続）：{mastered} 問</p>
        <ul className="plain">
          {CATEGORIES.map((c) => {
            const st = stats[c.id]
            const r = st ? pct(st.ok, st.n) : null
            return (
              <li key={c.id} className="cat-row">
                <span className="cat-name">{c.name}</span>
                <span className="bar"><span style={{ width: `${r ?? 0}%` }} /></span>
                <span className="cat-pct">{r == null ? '未学習' : `${r}%（${st.ok}/${st.n}）`}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2>目標日</h2>
        <p className="muted small">2027年度の正式な試験日は公式資料で確認できていないため「未設定」です。公表されたら入力してください。</p>
        <Target label="二級" value={s.settings.target2} onChange={(v) => s.updateSettings({ target2: v })} />
        <Target label="一級" value={s.settings.target1} onChange={(v) => s.updateSettings({ target1: v })} />
      </section>
    </div>
  )
}
