import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { GRADE_LABEL, VERIFY_LABEL, catName } from './types'
import type { Question, Session } from './types'

export type Tab = 'home' | 'learn' | 'quiz' | 'review' | 'log'
export interface Nav {
  tab: Tab
  /** タブ内の詳細ビュー（レッスンID など） */
  detail: string | null
  go: (tab: Tab, detail?: string | null) => void
  start: (s: Session) => void
  resume: () => void
}
export const NavCtx = createContext<Nav | null>(null)
export const useNav = () => {
  const n = useContext(NavCtx)
  if (!n) throw new Error('NavCtx')
  return n
}

export function newSession(kind: Session['kind'], label: string, ids: string[], timeLimitSec: number | null = null): Session {
  return { id: kind + '-' + Date.now(), kind, label, ids, index: 0, timeLimitSec, startedAt: Date.now(), results: {} }
}

export function shuffleIds<T>(a: T[]): T[] {
  const r = a.slice()
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

const NEG_RE = /(適切でない|適当でない|不適当|不適切|誤っている|誤り|正しくない|含まれない|ないもの)/g

export function StemText({ q }: { q: Question }) {
  const parts = q.stem.split(NEG_RE)
  return (
    <p className="stem">
      {q.negative && <span className="neg-badge">⚠ 否定問題：「正しくないもの」を選ぶ</span>}
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="neg">{p}</mark> : <span key={i}>{p}</span>))}
      {q.multi && <span className="multi-note"> （{q.answer.length}つ選ぶ）</span>}
    </p>
  )
}

export function QuestionBadges({ q }: { q: Question }) {
  return (
    <div className="badges">
      <span className="badge">{GRADE_LABEL[q.grade]}</span>
      <span className="badge">{catName(q.category)}</span>
      <span className="badge">難易度{'★'.repeat(q.difficulty)}</span>
      <span className="badge ghost">{q.origin === 'official' ? '公式過去問' : '独自問題'}</span>
      <span className={'badge ' + (q.verification === 'primary-verified' ? 'ok' : q.verification === 'needs-review' ? 'warn' : 'ghost')}>{q.verification === 'primary-verified' ? '一次資料確認済' : q.verification === 'needs-review' ? '要確認' : '教科書知識'}</span>
    </div>
  )
}

export function SourceInfo({ q }: { q: Question }) {
  return (
    <details className="src">
      <summary>根拠・検証状況</summary>
      <p><b>検証状態：</b>{VERIFY_LABEL[q.verification]}</p>
      {q.lawBasisDate && <p><b>法令の基準日：</b>{q.lawBasisDate}（現行条文を確認した時点。改正に注意）</p>}
      <p><b>区分：</b>{q.origin === 'official' ? '公式過去問' : 'アプリ独自の練習問題（公式の問題・公式解答ではありません）'}</p>
      {q.origin === 'official' && q.official && (
        <p>{q.official.year} {q.official.booklet} 問{q.official.number}／{q.official.answerPublished ? '公式正答あり' : '公式正答は未公開（独自の解答は公式解答ではありません）'}</p>
      )}
      <ul>{q.sources.map((s, i) => (
        <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}（確認日 {s.checkedOn}）</li>
      ))}</ul>
      {q.note && <p><b>メモ：</b>{q.note}</p>}
    </details>
  )
}

interface ConfirmReq { title: string; body: string; ok: string; danger?: boolean; run: () => void | Promise<void> }
const ConfirmCtx = createContext<(r: ConfirmReq) => void>(() => {})
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmReq | null>(null)
  return (
    <ConfirmCtx.Provider value={setReq}>
      {children}
      {req && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-label={req.title}>
          <div className="modal">
            <h3>{req.title}</h3>
            <p>{req.body}</p>
            <div className="row">
              <button className="btn ghost" onClick={() => setReq(null)}>キャンセル</button>
              <button className={'btn ' + (req.danger ? 'danger' : 'primary')} onClick={async () => { const r = req; setReq(null); await r.run() }}>{req.ok}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

export function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const pct = (ok: number, n: number) => (n ? Math.round((ok / n) * 100) : null)
