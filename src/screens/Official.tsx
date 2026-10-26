import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { catName } from '../types'
import type { Confidence } from '../types'
import { OFFICIAL_PAPERS } from '../data/official'
import type { OfficialPaper } from '../data/official'
import { findItem, gradeOfficial, offQid } from '../lib/official'
import { kvGet, kvSet } from '../lib/db'
import { todayStr } from '../lib/date'
import { pct, useNav } from '../ui'

export function OfficialList() {
  const { attempts, cards } = useStore()
  const nav = useNav()
  const today = todayStr()
  const dueByPaper = (id: string) => Object.values(cards).filter((c) => c.qid.startsWith(`OFF:${id}:`) && c.due <= today).length
  return (
    <div>
      <p className="muted small">問題文は転載せず、公式PDFを開いて解き、<b>番号だけをここに入力</b>して公式の正答で採点します（問題文・選択肢の転載可否を確認できないため）。正答番号は公式の「正答肢」を転記したものです。</p>
      {OFFICIAL_PAPERS.map((p) => {
        const done = attempts.filter((a) => a.qid.startsWith(`OFF:${p.id}:`))
        const ok = done.filter((a) => a.correct).length
        const due = dueByPaper(p.id)
        return (
          <button key={p.id} className="list-item col" onClick={() => nav.go('quiz', 'off:' + p.id)}>
            <b>{p.year}　{p.title}</b>
            <span className="muted small">{p.items.length}問　{done.length ? `記録 ${ok}/${done.length}（${pct(ok, done.length)}%）` : '未挑戦'}{due > 0 ? `　見直し ${due}問` : ''}</span>
          </button>
        )
      })}
      <p className="muted small">第一次検定として確認できた公式資料は上の4冊のみです（令和7年度の一級は第一次検定の資料が掲載されていません）。</p>
    </div>
  )
}

type Answers = Record<number, number[]>
type Confs = Record<number, boolean>

export function OfficialPaperView({ paperId, onlyDue }: { paperId: string; onlyDue: boolean }) {
  const paper = OFFICIAL_PAPERS.find((p) => p.id === paperId)
  const { cards, recordRaw } = useStore()
  const nav = useNav()
  const [answers, setAnswers] = useState<Answers>({})
  const [sure, setSure] = useState<Confs>({})
  const [graded, setGraded] = useState<null | { ok: number; total: number; byCat: Record<string, [number, number]>; wrong: number[] }>(null)
  const [loaded, setLoaded] = useState(false)
  const draftKey = 'off-draft:' + paperId + (onlyDue ? ':due' : '')
  const today = todayStr()

  const items = useMemo(() => {
    if (!paper) return []
    return onlyDue ? paper.items.filter((it) => { const c = cards[offQid(paper.id, it.no)]; return c && c.due <= today }) : paper.items
    // 見直しモードの対象は開いた時点で固定する（採点後に一覧が変わらないようにする）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper?.id, onlyDue])

  useEffect(() => {
    void kvGet<{ a: Answers; s: Confs }>(draftKey).then((d) => { if (d) { setAnswers(d.a); setSure(d.s) } setLoaded(true) })
  }, [draftKey])
  useEffect(() => { if (loaded) void kvSet(draftKey, { a: answers, s: sure }) }, [answers, sure, loaded, draftKey])

  if (!paper) return <div className="screen"><button className="btn small ghost" onClick={() => nav.go('quiz')}>← 戻る</button><p>資料が見つかりません。</p></div>

  const toggle = (no: number, n: number, multi: boolean) => {
    setGraded(null)
    setAnswers((a) => {
      const cur = a[no] ?? []
      const next = multi ? (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort()) : [n]
      return { ...a, [no]: next }
    })
  }

  const grade = async () => {
    let ok = 0
    const byCat: Record<string, [number, number]> = {}
    const wrong: number[] = []
    for (const it of items) {
      const picked = answers[it.no] ?? []
      if (picked.length === 0) continue
      const correct = gradeOfficial(it, picked)
      const conf: Confidence = sure[it.no] ? 'sure' : 'unsure'
      await recordRaw(offQid(paper.id, it.no), it.category, correct, conf, 'official')
      const c = (byCat[it.category] ??= [0, 0])
      c[1]++
      if (correct) { ok++; c[0]++ } else wrong.push(it.no)
    }
    const total = Object.values(byCat).reduce((s, c) => s + c[1], 0)
    setGraded({ ok, total, byCat, wrong })
    window.scrollTo(0, 0)
  }

  const answered = items.filter((it) => (answers[it.no] ?? []).length > 0).length
  const clear = () => { setAnswers({}); setSure({}); setGraded(null) }

  return (
    <div className="screen">
      <button className="btn small ghost" onClick={() => nav.go('quiz')}>← 問題</button>
      <h1>{paper.year}<br />{paper.title}{onlyDue && '（見直し）'}</h1>
      <p className="muted small">{paper.note}</p>
      <div className="row wrap">
        <a className="btn small" href={paper.questionUrl} target="_blank" rel="noreferrer">📄 問題PDFを開く</a>
        <a className="btn small ghost" href={paper.answerUrl} target="_blank" rel="noreferrer">正答肢PDF</a>
      </div>
      <p className="muted small">公式PDFを見ながら解き、選んだ番号を入力してください。「自信」をオンにした正解だけが復習間隔を進めます。出典：一般財団法人全国建設研修センター（正答番号の確認日 {paper.checkedOn}）。</p>

      {graded && (
        <div className={'result-banner ' + (graded.ok === graded.total ? 'ok' : 'ng')} role="status">
          <span className="big">{graded.ok} / {graded.total} 問正解（{pct(graded.ok, graded.total) ?? 0}%）</span>
          <span>{graded.wrong.length ? `間違い：問${graded.wrong.join('、問')}（復習タブに「見直し」として登録しました）` : 'すべて正解です。'}</span>
          <ul className="plain">{Object.entries(graded.byCat).map(([c, [o, n]]) => <li key={c} className="stat-row"><span>{catName(c)}</span><span>{o}/{n}</span></li>)}</ul>
          <p className="small">※合格基準点は公式資料で確認できていないため、合否の判定は表示しません。</p>
        </div>
      )}

      <ul className="plain">
        {items.map((it) => {
          const multi = it.answer.length > 1
          const picked = answers[it.no] ?? []
          const done = graded && picked.length > 0
          const correct = done ? gradeOfficial(it, picked) : null
          return (
            <li key={it.no} className={'off-row' + (done ? (correct ? ' right' : ' wrong') : '')}>
              <div className="off-head">
                <b>問{it.no}</b>
                <span className="badge">{catName(it.category)}</span>
                {it.figure && <span className="badge ghost">図表あり</span>}
                {multi && <span className="badge warn">複数選択（すべて選ぶ）</span>}
              </div>
              <div className="off-btns">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} className={'num' + (picked.includes(n) ? ' sel' : '')} aria-pressed={picked.includes(n)} aria-label={`問${it.no} 選択肢${n}`} onClick={() => toggle(it.no, n, multi)}>{n}</button>
                ))}
                <label className="check sure"><input type="checkbox" checked={!!sure[it.no]} onChange={(e) => setSure((s) => ({ ...s, [it.no]: e.target.checked }))} /> 自信</label>
              </div>
              {done && (
                <p className={'off-res ' + (correct ? 'ok-text' : 'miss')}>
                  {correct ? '○ 正解' : '× 不正解'}　あなた：{picked.join('・')}　公式の正答：{it.answer.join('・')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {items.length === 0 && <p className="muted">見直す問題はありません。</p>}
      <div className="stack">
        <button className="btn primary block big-btn" disabled={answered === 0} onClick={grade}>採点する（入力済み {answered}/{items.length}）</button>
        <button className="btn ghost block" onClick={clear}>入力をクリア</button>
      </div>
    </div>
  )
}

export function OfficialReviewList() {
  const { cards } = useStore()
  const nav = useNav()
  const today = todayStr()
  const due = Object.values(cards).filter((c) => c.qid.startsWith('OFF:') && c.due <= today)
  if (due.length === 0) return null
  const byPaper = new Map<string, number[]>()
  for (const c of due) {
    const f = findItem(OFFICIAL_PAPERS, c.qid)
    if (!f) continue
    byPaper.set(f.paper.id, [...(byPaper.get(f.paper.id) ?? []), f.item.no])
  }
  return (
    <section>
      <h2>公式過去問の見直し</h2>
      {[...byPaper.entries()].map(([id, nos]) => {
        const p: OfficialPaper = OFFICIAL_PAPERS.find((x) => x.id === id)!
        return (
          <button key={id} className="list-item col" onClick={() => nav.go('quiz', `off:${id}:due`)}>
            <b>{p.year}　{p.title}</b>
            <span className="muted small">見直し {nos.length}問：問{nos.sort((a, b) => a - b).join('、問')}</span>
          </button>
        )
      })}
    </section>
  )
}
