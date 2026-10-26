import { useEffect, useMemo, useState } from 'react'
import { useStore } from './store'
import { gradeAnswer } from './lib/srs'
import { CATEGORIES } from './types'
import type { Confidence, Question } from './types'
import { QuestionBadges, SourceInfo, StemText, newSession, pct, useNav } from './ui'

const MARK = ['①', '②', '③', '④', '⑤', '⑥']

type Phase = 'answer' | 'feedback' | 'retry' | 'retried'

export function Runner({ onExit }: { onExit: () => void }) {
  const { session, questions, record, saveSession, toggleBookmark, bookmarks, addReport, lessons } = useStore()
  const nav = useNav()
  const [picked, setPicked] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('answer')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [retryMiss, setRetryMiss] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reported, setReported] = useState(false)
  const [now, setNow] = useState(Date.now())

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])
  const s = session
  const finished = !s || s.index >= s.ids.length
  const q: Question | undefined = s && !finished ? byId.get(s.ids[s.index]) : undefined

  const remaining = s?.timeLimitSec ? Math.max(0, s.timeLimitSec - Math.floor((now - s.startedAt) / 1000)) : null
  useEffect(() => {
    if (!s?.timeLimitSec || finished) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [s?.timeLimitSec, s?.id, finished])
  useEffect(() => {
    if (s && remaining === 0 && !finished) void saveSession({ ...s, index: s.ids.length })
  }, [remaining, s, finished, saveSession])

  useEffect(() => { setPicked([]); setPhase('answer'); setRetryMiss(false); setReporting(false); setReported(false); setReportText('') }, [s?.index, s?.id])

  if (!s) return null

  if (finished || !q) return <Result onExit={onExit} />

  const isCheck = s.kind === 'check'
  const toggle = (id: string) => {
    if (phase === 'feedback' || phase === 'retried') return
    setRetryMiss(false)
    setPicked((p) => (q.multi ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]))
  }

  const submit = async (conf: Confidence) => {
    const correct = gradeAnswer(q.answer, picked)
    await record(q, correct, conf, s.kind)
    const next = { ...s, results: { ...s.results, [q.id]: { correct, conf } } }
    if (isCheck) { await saveSession({ ...next, index: s.index + 1 }); return }
    await saveSession(next)
    setLastCorrect(correct)
    setPhase('feedback')
  }

  const retry = () => {
    if (!gradeAnswer(q.answer, picked)) { setRetryMiss(true); return }
    setRetryMiss(false)
    setPhase('retried')
  }

  const next = async () => { await saveSession({ ...s, index: s.index + 1 }) }
  const showFb = phase === 'feedback' || phase === 'retried'
  const mustRetry = phase === 'feedback' && !lastCorrect
  const lesson = lessons.find((l) => l.id === q.lessonIds[0])
  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`

  return (
    <div className="runner">
      <header className="runner-head">
        <button className="btn small ghost" onClick={onExit} aria-label="中断して戻る">← 中断</button>
        <div className="grow">
          <div className="muted small">{s.label}　{s.index + 1} / {s.ids.length}</div>
          <div className="bar"><span style={{ width: `${(s.index / s.ids.length) * 100}%` }} /></div>
        </div>
        {remaining !== null && <div className={'timer' + (remaining < 60 ? ' low' : '')} aria-label="残り時間">⏱ {fmt(remaining)}</div>}
      </header>

      <main className="runner-body">
        <QuestionBadges q={q} />
        <StemText q={q} />

        <ul className="choices">
          {q.choices.map((c, i) => {
            const sel = picked.includes(c.id)
            const isAns = q.answer.includes(c.id)
            const cls = ['choice', sel ? 'sel' : '', showFb && isAns ? 'right' : '', showFb && sel && !isAns ? 'wrong' : ''].join(' ')
            return (
              <li key={c.id}>
                <button className={cls} onClick={() => toggle(c.id)} aria-pressed={sel}>
                  <span className="mark">{MARK[i]}</span>
                  <span className="grow">{c.text}</span>
                  {showFb && isAns && <span className="tag ok">✓ 正しい</span>}
                  {showFb && !isAns && <span className="tag ng">✗ 誤り</span>}
                  {showFb && sel && <span className="tag you">あなたの選択</span>}
                </button>
                {showFb && <p className={'why ' + (isAns ? 'ok' : 'ng')}>{c.explanation}</p>}
              </li>
            )
          })}
        </ul>

        {phase === 'answer' && (
          <div className="answer-bar">
            <p className="muted small">{isCheck ? '選択してから、自信度のボタンで解答します（結果は最後にまとめて表示）。' : '選択してから、自信度のボタンで解答します。正直に答えるほど復習が効きます。'}</p>
            <div className="conf">
              <button className="btn primary" disabled={picked.length === 0} onClick={() => submit('sure')}>自信あり</button>
              <button className="btn" disabled={picked.length === 0} onClick={() => submit('unsure')}>迷った</button>
              <button className="btn ghost" onClick={() => submit('unknown')}>分からない</button>
            </div>
          </div>
        )}

        {phase === 'retry' && (
          <div className="answer-bar">
            <p className="retry-note">✎ やり直し：正解を選んで、もう一度解答してください。</p>
            {retryMiss && <p className="miss" role="alert">✗ まだ違います。解説を読み直して、もう一度。</p>}
            {q.mnemonic && <div className="goro"><div className="goro-title">🧠 ヒント（ゴロ）</div><div className="goro-body">{q.mnemonic}</div></div>}
            <button className="btn primary block" disabled={picked.length === 0} onClick={retry}>この答えで確定</button>
          </div>
        )}

        {showFb && (
          <section className="feedback">
            {phase === 'feedback' && (
              <div className={'result-banner ' + (lastCorrect ? 'ok' : 'ng')} role="status">
                <span className="big">{lastCorrect ? '○ 正解' : '× 不正解'}</span>
                <span>{lastCorrect ? '次の復習日に再確認します。' : '今日中にもう一度出題されます。'}</span>
              </div>
            )}
            {phase === 'retried' && <div className="result-banner ok" role="status"><span className="big">○ 正しく選び直せました</span></div>}
            {q.mnemonic && (
              <div className="goro">
                <div className="goro-title">🧠 覚え方（ゴロ）</div>
                <div className="goro-body">{q.mnemonic}</div>
                <div className="muted small">※アプリ独自の記憶の補助です。公式の解説ではありません。</div>
              </div>
            )}
            <p className="expl"><b>解説：</b>{q.explanation}</p>
            {q.origin === 'original' && <p className="muted small">この問題はアプリ独自の練習問題です。公式の正答・解説ではありません。</p>}
            <SourceInfo q={q} />
            <div className="row wrap">
              {lesson && <button className="btn small ghost" onClick={() => { onExit(); nav.go('learn', lesson.id) }}>📖 関連レッスン：{lesson.title}</button>}
              <button className="btn small ghost" onClick={() => toggleBookmark(q.id)}>{bookmarks.has(q.id) ? '★ ブックマーク済' : '☆ ブックマーク'}</button>
              <button className="btn small ghost" onClick={() => setReporting((v) => !v)}>⚑ この問題の誤りを報告</button>
            </div>
            {reporting && !reported && (
              <div className="report">
                <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="どこが誤り・不明確ですか？" rows={3} />
                <button className="btn small primary" disabled={!reportText.trim()} onClick={async () => { await addReport(q.id, reportText.trim()); setReported(true) }}>報告を保存</button>
                <p className="muted small">報告はこの端末に保存されます（記録タブから書き出せます）。</p>
              </div>
            )}
            {reported && <p className="ok-text">✓ 報告をこの端末に保存しました。</p>}
            {mustRetry
              ? <button className="btn primary block big-btn" onClick={() => { setPicked([]); setPhase('retry') }}>✎ 正解を選び直す（必須）</button>
              : <button className="btn primary block big-btn" onClick={next}>{s.index + 1 >= s.ids.length ? '結果を見る' : '次へ →'}</button>}
          </section>
        )}
      </main>
    </div>
  )
}

function Result({ onExit }: { onExit: () => void }) {
  const { session, saveSession, questions } = useStore()
  const nav = useNav()
  if (!session) return null
  const s = session
  const res = Object.entries(s.results)
  const ok = res.filter(([, r]) => r.correct).length
  const unanswered = s.ids.length - res.length
  const wrongIds = s.ids.filter((id) => s.results[id] && !s.results[id].correct)
  const sure = res.filter(([, r]) => !r.correct && r.conf === 'sure').length
  const byCat = CATEGORIES.map((c) => {
    const ids = s.ids.filter((id) => questions.find((q) => q.id === id)?.category === c.id)
    const done = ids.filter((id) => s.results[id])
    return { c, n: done.length, ok: done.filter((id) => s.results[id].correct).length }
  }).filter((x) => x.n > 0)

  const close = async () => { await saveSession(null); onExit() }
  return (
    <div className="runner">
      <header className="runner-head"><div className="grow"><b>{s.label}　結果</b></div></header>
      <main className="runner-body">
        <div className={'result-banner ' + (ok === s.ids.length ? 'ok' : 'ng')}>
          <span className="big">{ok} / {s.ids.length} 問正解（{pct(ok, s.ids.length) ?? 0}%）</span>
          {unanswered > 0 && <span>未解答 {unanswered} 問（時間切れ）</span>}
        </div>
        {s.kind === 'check' && <p className="muted small">これは「理解度チェック」です。公式試験と同じ条件の模擬試験ではありません。</p>}
        {sure > 0 && <p className="warn-box">⚠ 「自信あり」で間違えた問題が {sure} 問あります。思い込みの可能性が高いので、最優先で復習します。</p>}
        <h3>分野別</h3>
        <ul className="plain">{byCat.map(({ c, n, ok: o }) => (
          <li key={c.id} className="stat-row"><span>{c.name}</span><span>{o}/{n}（{pct(o, n)}%）</span></li>
        ))}</ul>
        <div className="stack">
          {wrongIds.length > 0 && <button className="btn primary block big-btn" onClick={() => nav.start(newSession('practice', '間違いの総ざらい', wrongIds))}>間違えた {wrongIds.length} 問をいますぐやり直す</button>}
          <button className="btn block" onClick={async () => { await close(); nav.go('review') }}>復習タブへ</button>
          <button className="btn ghost block" onClick={close}>ホームに戻る</button>
        </div>
      </main>
    </div>
  )
}
