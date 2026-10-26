import { useState } from 'react'
import { useStore } from '../store'
import { CATEGORIES, catName } from '../types'
import type { MemoCard } from '../types'
import { filterQuestions } from '../lib/select'
import { todayStr } from '../lib/date'
import { newSession, shuffleIds, useNav } from '../ui'

const LEVEL_NOTE = '「共通基礎／一級で追加」の区分は、このアプリの編集上の目安です（公式の出題区分ではありません）。'

export function Learn() {
  const { lessons } = useStore()
  const nav = useNav()
  if (nav.detail === 'memo' || nav.detail?.startsWith('memo:')) return <MemoDrill />
  const lesson = lessons.find((l) => l.id === nav.detail)
  if (lesson) return <LessonView id={lesson.id} />
  return (
    <div className="screen">
      <h1>学ぶ</h1>
      <p className="muted small">{LEVEL_NOTE}一級の出題範囲を軸に、基礎から。1本3〜5分。</p>
      <button className="btn primary block" onClick={() => nav.go('learn', 'memo')}>🧠 暗記カードで覚える</button>
      {CATEGORIES.map((c) => (
        <section key={c.id}>
          <h2>{c.name}</h2>
          {lessons.filter((l) => l.category === c.id).map((l) => (
            <button key={l.id} className="list-item" onClick={() => nav.go('learn', l.id)}>
              <span className="grow">{l.title}</span>
              <span className={'badge ' + (l.level === 'common' ? '' : 'ok')}>{l.level === 'common' ? '共通基礎' : '一級で追加'}</span>
              <span className="muted small">約{l.minutes}分</span>
            </button>
          ))}
          {lessons.filter((l) => l.category === c.id).length === 0 && <p className="muted small">レッスンはまだありません。</p>}
        </section>
      ))}
    </div>
  )
}

function LessonView({ id }: { id: string }) {
  const { lessons, questions, cards, attempts, bookmarks } = useStore()
  const nav = useNav()
  const l = lessons.find((x) => x.id === id)!
  const related = questions.filter((q) => q.lessonIds.includes(l.id))
  const answered = new Set(attempts.map((a) => a.qid))
  const drill = filterQuestions(related, {}, cards, answered, bookmarks)
  return (
    <div className="screen lesson">
      <button className="btn small ghost" onClick={() => nav.go('learn', null)}>← レッスン一覧</button>
      <div className="badges">
        <span className="badge">{catName(l.category)}</span>
        <span className={'badge ' + (l.level === 'common' ? '' : 'ok')}>{l.level === 'common' ? '共通基礎' : '一級で追加'}</span>
        <span className="badge ghost">約{l.minutes}分</span>
      </div>
      <h1>{l.title}</h1>
      <p className="muted small">{LEVEL_NOTE}</p>

      <h2>① 何のための知識か</h2>
      <p>{l.purpose}</p>

      <h2>② 用語の意味</h2>
      <dl className="terms">
        {l.terms.map((t) => (
          <div key={t.term}><dt>{t.term}<span className="reading">（{t.reading}）</span></dt><dd>{t.meaning}</dd></div>
        ))}
      </dl>

      <h2>③ 具体例</h2>
      <ul>{l.examples.map((e, i) => <li key={i}>{e}</li>)}</ul>

      <h2>④ 試験で間違えやすい点</h2>
      <ul className="pitfalls">{l.pitfalls.map((e, i) => <li key={i}>⚠ {e}</li>)}</ul>

      <h2>⑤ 暗記ポイント（ゴロ付き）</h2>
      <ul className="plain">{l.memo.map((m) => (
        <li key={m.id} className="memo-line"><b>{m.front}</b><br />{m.back}{m.goro && <div className="goro-inline">🧠 {m.goro}</div>}</li>
      ))}</ul>

      <p className="muted small">根拠：{l.sources.map((s) => s.url ? s.title : s.title).join(' / ')}</p>

      <div className="stack">
        <button className="btn primary block" onClick={() => nav.go('learn', 'memo:' + l.id)}>🧠 このレッスンの暗記カード（{l.memo.length}枚）</button>
        <button className="btn block" disabled={drill.length === 0} onClick={() => nav.start(newSession('practice', l.title + ' の問題', shuffleIds(drill.map((q) => q.id))))}>
          ✎ 関連問題を解く（{drill.length}問）
        </button>
      </div>
    </div>
  )
}

function MemoDrill() {
  const { lessons, cards, recordMemo } = useStore()
  const nav = useNav()
  const only = nav.detail?.startsWith('memo:') ? nav.detail.slice(5) : null
  const today = todayStr()
  const [mode, setMode] = useState<'due' | 'all'>(only ? 'all' : 'due')
  const [queue, setQueue] = useState<{ card: MemoCard; lesson: string }[] | null>(null)
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)

  const all = lessons.filter((l) => !only || l.id === only).flatMap((l) => l.memo.map((m) => ({ card: m, lesson: l.title })))
  const dueList = all.filter((x) => { const c = cards['m:' + x.card.id]; return !c || c.due <= today })

  if (!queue) {
    return (
      <div className="screen">
        <button className="btn small ghost" onClick={() => nav.go('learn', only)}>← 戻る</button>
        <h1>暗記カード</h1>
        <p className="muted">答えを見る前に、必ず頭の中（または声）で答えてから「答えを見る」を押してください。「まだ」はその日のうちにまた出ます。</p>
        <div className="row">
          <button className={'btn small ' + (mode === 'due' ? 'primary' : 'ghost')} onClick={() => setMode('due')}>要復習・未学習（{dueList.length}）</button>
          <button className={'btn small ' + (mode === 'all' ? 'primary' : 'ghost')} onClick={() => setMode('all')}>すべて（{all.length}）</button>
        </div>
        <button className="btn primary block big-btn" disabled={(mode === 'due' ? dueList : all).length === 0} onClick={() => { setQueue(shuffleIds(mode === 'due' ? dueList : all)); setI(0); setFlip(false) }}>
          開始
        </button>
        {dueList.length === 0 && <p className="muted">今日の暗記カードはすべて完了です。</p>}
      </div>
    )
  }

  if (i >= queue.length) {
    return (
      <div className="screen">
        <h1>暗記カード 完了</h1>
        <p>{queue.length} 枚を確認しました。「まだ」と答えたカードは今日もう一度出ます。</p>
        <button className="btn primary block" onClick={() => { setQueue(null) }}>戻る</button>
      </div>
    )
  }
  const cur = queue[i]
  const rate = async (ok: boolean) => { await recordMemo(cur.card.id, ok); setFlip(false); setI(i + 1) }
  return (
    <div className="screen">
      <div className="muted small">{cur.lesson}　{i + 1} / {queue.length}</div>
      <div className="bar"><span style={{ width: `${(i / queue.length) * 100}%` }} /></div>
      <div className="flash">
        <div className="flash-q">{cur.card.front}</div>
        {flip ? (
          <>
            <div className="flash-a">{cur.card.back}</div>
            {cur.card.goro && <div className="goro"><div className="goro-title">🧠 ゴロ</div><div className="goro-body">{cur.card.goro}</div></div>}
          </>
        ) : <div className="muted">まず自分で答えてから…</div>}
      </div>
      {!flip
        ? <button className="btn primary block big-btn" onClick={() => setFlip(true)}>答えを見る</button>
        : <div className="conf">
            <button className="btn primary" onClick={() => rate(true)}>○ 覚えた</button>
            <button className="btn danger" onClick={() => rate(false)}>× まだ</button>
          </div>}
    </div>
  )
}
