import { useStore } from '../store'
import { catName } from '../types'
import { isDrillable } from '../lib/select'
import { addDays, todayStr } from '../lib/date'
import { newSession, shuffleIds, useNav } from '../ui'
import { dueCount } from './common'
import { OfficialReviewList } from './Official'

export function Review() {
  const { questions, cards } = useStore()
  const nav = useNav()
  const today = todayStr()
  const qs = questions.filter(isDrillable)
  const withCard = qs.filter((q) => cards[q.id])
  const due = withCard.filter((q) => cards[q.id].due <= today)
  const misc = withCard.filter((q) => cards[q.id].misconception)
  const wrongNow = withCard.filter((q) => cards[q.id].lastResult === 'wrong')
  const unsure = withCard.filter((q) => cards[q.id].lastResult === 'correct' && cards[q.id].lastConf !== 'sure')
  const cnt = dueCount(cards, questions, today)
  const upcoming = [1, 2, 3, 7].map((d) => ({ d, n: withCard.filter((q) => cards[q.id].due === addDays(today, d)).length }))

  const start = (label: string, list: typeof qs) => nav.start(newSession('practice', label, shuffleIds(list.map((q) => q.id))))

  return (
    <div className="screen">
      <h1>復習</h1>
      <p className="muted small">間隔の目安：翌日 → 3日 → 7日 → 14日 → 30日。間違えると今日中にもう一度、最初の間隔に戻ります。「自信あり」で間違えた問題は最優先です。</p>

      <button className="btn primary block hero" disabled={due.length === 0} onClick={() => start('今日の復習', due)}>
        <span className="hero-main">今日の復習 {due.length} 問</span>
        <span className="hero-sub">{due.length === 0 ? '期限の来た復習はありません' : '期限が来たものから順に'}</span>
      </button>
      <button className="btn block" onClick={() => nav.go('learn', 'memo')}>🧠 暗記カードの復習（要復習 {cnt.memo} 枚）</button>

      <section>
        <h2>優先して潰す</h2>
        <button className="list-item" disabled={misc.length === 0} onClick={() => start('思い込みミス', misc)}>
          <span className="grow">⚠ 自信ありで間違えた（思い込みミス）</span><b>{misc.length}</b>
        </button>
        <button className="list-item" disabled={wrongNow.length === 0} onClick={() => start('直近で間違えた問題', wrongNow)}>
          <span className="grow">✗ 直近で間違えた</span><b>{wrongNow.length}</b>
        </button>
        <button className="list-item" disabled={unsure.length === 0} onClick={() => start('自信がなかった問題', unsure)}>
          <span className="grow">？ 正解したが自信がなかった</span><b>{unsure.length}</b>
        </button>
      </section>

      <OfficialReviewList />

      <section>
        <h2>今後の予定</h2>
        <ul className="plain">{upcoming.map(({ d, n }) => <li key={d} className="stat-row"><span>{d === 1 ? '明日' : `${d}日後`}</span><span>{n} 問</span></li>)}</ul>
      </section>

      {due.length > 0 && (
        <section>
          <h2>今日の復習の内訳</h2>
          <ul className="plain">{due.map((q) => (
            <li key={q.id} className="stat-row"><span>{catName(q.category)}</span><span className="muted small">{cards[q.id].misconception ? '⚠ 思い込み' : cards[q.id].lastResult === 'wrong' ? '✗ 誤答' : '？ 要確認'}</span></li>
          ))}</ul>
        </section>
      )}
    </div>
  )
}
