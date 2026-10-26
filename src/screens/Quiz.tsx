import { useState } from 'react'
import { useStore } from '../store'
import { CATEGORIES } from '../types'
import type { Grade } from '../types'
import { filterQuestions, isDrillable, pickCheck } from '../lib/select'
import type { Filter } from '../lib/select'
import { EXAM_RULES } from '../lib/exams'
import { OFFICIAL_INDEX } from '../data/sources'
import { OfficialList, OfficialPaperView } from './Official'
import { newSession, shuffleIds, useNav } from '../ui'

export function Quiz() {
  const { questions, cards, attempts, bookmarks } = useStore()
  const nav = useNav()
  const [grade, setGrade] = useState<Grade | 'all'>('all')
  const [category, setCategory] = useState('all')
  const [mode, setMode] = useState<NonNullable<Filter['mode']>>('all')
  const [size, setSize] = useState(10)
  const [checkN, setCheckN] = useState(10)
  const [timed, setTimed] = useState(false)

  const answered = new Set(attempts.map((a) => a.qid))
  const list = filterQuestions(questions, { grade, category, mode }, cards, answered, bookmarks)
  const pool = questions.filter(isDrillable)
  const excluded = questions.length - pool.length

  const startPractice = () => {
    const ids = shuffleIds(list.map((q) => q.id)).slice(0, size === 0 ? undefined : size)
    nav.start(newSession('practice', '問題演習', ids))
  }
  const startCheck = () => {
    const picked = pickCheck(questions, checkN)
    nav.start(newSession('check', `理解度チェック（${picked.length}問）`, picked.map((q) => q.id), timed ? picked.length * 60 : null))
  }

  if (nav.detail?.startsWith('off:')) {
    const [, id, mode] = nav.detail.split(':')
    return <OfficialPaperView key={nav.detail} paperId={id} onlyDue={mode === 'due'} />
  }

  return (
    <div className="screen">
      <h1>問題</h1>

      <section>
        <h2>問題演習</h2>
        <div className="filters">
          <label>対象<select value={grade} onChange={(e) => setGrade(e.target.value as Grade | 'all')}>
            <option value="all">すべて</option><option value="2">二級</option><option value="1">一級</option><option value="common">共通基礎</option>
          </select></label>
          <label>分野<select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">すべて</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>絞り込み<select value={mode} onChange={(e) => setMode(e.target.value as NonNullable<Filter['mode']>)}>
            <option value="all">すべて</option><option value="unanswered">未回答</option><option value="weak">苦手（誤答・自信なし）</option>
            <option value="misconception">思い込みミス</option><option value="bookmark">ブックマーク</option>
          </select></label>
          <label>出題数<select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={5}>5問</option><option value={10}>10問</option><option value={20}>20問</option><option value={0}>全部</option>
          </select></label>
        </div>
        <p className="muted" aria-live="polite">条件に合う問題：{list.length} 問{list.length === 0 && '（条件を変えてください）'}</p>
        <button className="btn primary block big-btn" disabled={list.length === 0} onClick={startPractice}>
          {Math.min(list.length, size === 0 ? list.length : size)} 問で開始
        </button>
        <p className="muted small">解答後、間違えた問題は正解を選び直すまで次へ進めません。{excluded > 0 && `要確認・図が必要な ${excluded} 問は出題から除外しています。`}</p>
      </section>

      <section>
        <h2>理解度チェック</h2>
        <p className="muted small">全分野から無作為に出題します。<b>公式試験と同じ条件の模擬試験ではありません。</b>結果は最後にまとめて表示します。</p>
        <div className="row">
          <button className={'btn small ' + (checkN === 10 ? 'primary' : 'ghost')} onClick={() => setCheckN(10)}>10問</button>
          <button className={'btn small ' + (checkN === 20 ? 'primary' : 'ghost')} onClick={() => setCheckN(20)}>20問</button>
          <label className="check"><input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> 時間制限（1問1分）</label>
        </div>
        {pool.length < checkN && <p className="muted small">登録問題が {pool.length} 問のため、{pool.length} 問で実施します。</p>}
        <button className="btn block" disabled={pool.length === 0} onClick={startCheck}>理解度チェックを始める</button>
      </section>

      <section>
        <h2>正式な模擬試験</h2>
        {EXAM_RULES.length === 0 ? (
          <p className="muted">年度ごとの出題数・時間・合格基準を公式資料で確認できていないため、正式な模擬試験は提供していません（<code>src/lib/exams.ts</code> に確認済みの条件を追加すると表示されます）。上の「理解度チェック」を使ってください。</p>
        ) : EXAM_RULES.map((r) => {
          const n = Math.min(r.questions, pool.length)
          const full = pool.length >= r.questions
          return (
            <div key={r.year + r.grade} className="list-item col">
              <b>{r.year} {r.grade === '1' ? '一級' : '二級'}　{r.questions}問・{r.minutes}分</b>
              <span className="muted small">合格基準：{r.passRule}（出典 {r.sourceUrl}、確認日 {r.checkedOn}）</span>
              <button className="btn small" onClick={() => {
                const picked = pickCheck(questions, n)
                nav.start(newSession('check', full ? `模擬試験 ${r.year}` : `理解度チェック（${picked.length}問・問題数不足）`, picked.map((q) => q.id), full ? r.minutes * 60 : null))
              }}>{full ? '開始' : `問題数不足のため理解度チェックとして開始（${n}問）`}</button>
            </div>
          )
        })}
      </section>

      <section>
        <h2>公式過去問の答え合わせ</h2>
        <OfficialList />
        <p className="small"><a href={OFFICIAL_INDEX} target="_blank" rel="noreferrer">全国建設研修センター「試験問題／正答肢」一覧（公式）</a></p>
        <p className="muted small">公式サイトで第一次検定として確認できたのは令和7・8年度のみで、過去10年分は入手できませんでした。</p>
      </section>
    </div>
  )
}
