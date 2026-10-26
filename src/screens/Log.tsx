import { useState } from 'react'
import { useStore } from '../store'
import { CATEGORIES } from '../types'
import { categoryStats } from '../lib/select'
import { validateImport } from '../lib/validate'
import type { ValidationResult } from '../lib/validate'
import { clearProgress, exportAll, restoreAll, validateBackup } from '../lib/db'
import type { Backup } from '../lib/db'
import { SAMPLE_IMPORT } from '../data/sample'
import { OFFICIAL_PAPERS } from '../data/official'
import { download, newSession, pct, useConfirm, useNav } from '../ui'
import { todayStr } from '../lib/date'

async function readFile(f: File): Promise<string> { return f.text() }

export function Log() {
  const s = useStore()
  const nav = useNav()
  const confirm = useConfirm()
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState<ValidationResult | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'ng'; text: string } | null>(null)
  const [restoreText, setRestoreText] = useState('')
  const [restoreErrs, setRestoreErrs] = useState<string[]>([])
  const [restoreOk, setRestoreOk] = useState<Backup | null>(null)

  const stats = categoryStats(s.attempts)
  const total = s.attempts.length
  const ok = s.attempts.filter((a) => a.correct).length
  const bm = s.questions.filter((q) => s.bookmarks.has(q.id))

  const checkImport = (text: string) => {
    setMsg(null)
    try {
      const raw = JSON.parse(text)
      setPreview(validateImport(raw, new Set(s.questions.map((q) => q.id)), new Set(s.lessons.map((l) => l.id))))
    } catch (e) {
      setPreview({ errors: ['JSONとして読み込めません：' + (e as Error).message], warnings: [], lessons: [], questions: [] })
    }
  }
  const doImport = async () => {
    if (!preview || preview.errors.length) return
    await s.saveCustom({ lessons: [...s.custom.lessons, ...preview.lessons], questions: [...s.custom.questions, ...preview.questions] })
    setMsg({ kind: 'ok', text: `✓ レッスン${preview.lessons.length}件・問題${preview.questions.length}問を追加しました。` })
    setPreview(null); setImportText('')
  }

  const checkRestore = (text: string) => {
    setMsg(null); setRestoreOk(null)
    try {
      const raw = JSON.parse(text)
      const errs = validateBackup(raw)
      setRestoreErrs(errs)
      if (errs.length === 0) setRestoreOk(raw as Backup)
    } catch (e) {
      setRestoreErrs(['JSONとして読み込めません：' + (e as Error).message])
    }
  }

  return (
    <div className="screen">
      <h1>記録</h1>

      <section>
        <h2>成績</h2>
        <p>解答 {total} 回／正答率 {pct(ok, total) ?? '—'}{total ? '%' : ''}</p>
        <ul className="plain">{CATEGORIES.map((c) => {
          const st = stats[c.id]
          return <li key={c.id} className="stat-row"><span>{c.name}</span><span>{st ? `${st.ok}/${st.n}（${pct(st.ok, st.n)}%）` : '未学習'}</span></li>
        })}</ul>
      </section>

      <section>
        <h2>ブックマーク（{bm.length}）</h2>
        {bm.length === 0 ? <p className="muted small">解答後の画面で ☆ を押すと追加されます。</p>
          : <button className="btn block" onClick={() => nav.start(newSession('practice', 'ブックマーク', bm.map((q) => q.id)))}>ブックマークを解く</button>}
      </section>

      <section>
        <h2>誤り報告（{s.reports.length}）</h2>
        {s.reports.length === 0 ? <p className="muted small">問題の誤りを見つけたら、解答後の「この問題の誤りを報告」から保存できます。</p> : (
          <>
            <ul className="plain">{s.reports.map((r, i) => <li key={i} className="report-row"><b>{r.qid}</b>：{r.text}</li>)}</ul>
            <button className="btn block" onClick={() => download(`zouen-reports-${todayStr()}.json`, s.reports)}>報告をJSONで書き出す</button>
          </>
        )}
      </section>

      <section>
        <h2>データ管理</h2>
        {msg && <p className={msg.kind === 'ok' ? 'ok-text' : 'miss'} role="status">{msg.text}</p>}

        <h3>学習記録のバックアップ・復元</h3>
        <button className="btn block" onClick={async () => { download(`zouen-backup-${todayStr()}.json`, await exportAll()); setMsg({ kind: 'ok', text: '✓ バックアップを書き出しました。' }) }}>学習記録をエクスポート（JSON）</button>
        <input type="file" accept="application/json,.json" aria-label="バックアップファイルを選択" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await readFile(f); setRestoreText(t); checkRestore(t) } }} />
        <textarea rows={3} placeholder="またはバックアップJSONをここに貼り付け" value={restoreText} onChange={(e) => { setRestoreText(e.target.value); if (e.target.value.trim()) checkRestore(e.target.value); else { setRestoreErrs([]); setRestoreOk(null) } }} />
        {restoreErrs.length > 0 && <ul className="errs" role="alert">{restoreErrs.map((x, i) => <li key={i}>✗ {x}</li>)}</ul>}
        {restoreOk && (
          <>
            <p className="ok-text">✓ 形式OK：解答{restoreOk.attempts.length}件・カード{restoreOk.cards.length}件（{restoreOk.exportedAt}）</p>
            <button className="btn danger block" onClick={() => confirm({
              title: '学習記録を復元しますか？', body: '現在の学習記録（解答履歴・復習予定・設定・ブックマーク）はバックアップの内容で置き換えられます。', ok: '復元する', danger: true,
              run: async () => { await restoreAll(restoreOk); await s.reload(); setRestoreText(''); setRestoreOk(null); setMsg({ kind: 'ok', text: '✓ 学習記録を復元しました。' }) },
            })}>この内容で復元する</button>
          </>
        )}

        <h3>問題・レッスンの追加（JSON）</h3>
        <p className="muted small">追加前に形式を検証し、プレビューを表示します。ID重複・不正な正答設定は拒否されます。</p>
        <div className="row wrap">
          <button className="btn small ghost" onClick={() => download('sample-import.json', SAMPLE_IMPORT)}>サンプルJSONをダウンロード</button>
          <button className="btn small ghost" onClick={() => { const t = JSON.stringify(SAMPLE_IMPORT, null, 2); setImportText(t); checkImport(t) }}>サンプルを読み込んで検証</button>
        </div>
        <input type="file" accept="application/json,.json" aria-label="追加するJSONファイルを選択" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await readFile(f); setImportText(t); checkImport(t) } }} />
        <textarea rows={5} placeholder="または問題JSONをここに貼り付け" value={importText} onChange={(e) => setImportText(e.target.value)} />
        <button className="btn block" disabled={!importText.trim()} onClick={() => checkImport(importText)}>形式を検証してプレビュー</button>
        {preview && (
          <div className="preview">
            {preview.errors.length > 0 ? (
              <>
                <p className="miss" role="alert">✗ 追加できません（{preview.errors.length}件のエラー）。何も変更していません。</p>
                <ul className="errs">{preview.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </>
            ) : (
              <>
                <p className="ok-text">✓ 検証OK：レッスン{preview.lessons.length}件／問題{preview.questions.length}問</p>
                <ul className="plain">{preview.questions.map((q) => <li key={q.id}><b>{q.id}</b>（{q.multi ? '複数' : '単一'}選択・{q.origin === 'official' ? '公式過去問' : '独自'}・{q.verification === 'needs-review' ? '要確認' : '出題対象'}）{q.stem.slice(0, 40)}</li>)}
                  {preview.lessons.map((l) => <li key={l.id}><b>{l.id}</b>（レッスン）{l.title}</li>)}</ul>
              </>
            )}
            {preview.warnings.length > 0 && <ul className="warns">{preview.warnings.map((x, i) => <li key={i}>⚠ {x}</li>)}</ul>}
            {preview.errors.length === 0 && <button className="btn primary block" onClick={doImport}>この内容を追加する</button>}
          </div>
        )}

        {(s.custom.lessons.length > 0 || s.custom.questions.length > 0) && (
          <>
            <h3>追加済みの内容</h3>
            <p className="small">レッスン{s.custom.lessons.length}件／問題{s.custom.questions.length}問</p>
            <button className="btn danger block" onClick={() => confirm({
              title: '追加した問題・レッスンを削除しますか？', body: '内蔵コンテンツは消えません。追加分のみ削除されます（学習記録は残ります）。', ok: '削除する', danger: true,
              run: async () => { await s.saveCustom({ lessons: [], questions: [] }); setMsg({ kind: 'ok', text: '✓ 追加した内容を削除しました。' }) },
            })}>追加した内容を削除</button>
          </>
        )}

        <h3>学習記録の削除</h3>
        <button className="btn danger block" onClick={() => confirm({
          title: '学習記録をすべて削除しますか？', body: '解答履歴・復習予定・暗記カードの進捗・ブックマーク・誤り報告・目標日の記録は元に戻せません。先にエクスポートしておくと安全です。', ok: 'すべて削除する', danger: true,
          run: async () => { await clearProgress(); await s.reload(); setMsg({ kind: 'ok', text: '✓ 学習記録を削除しました。' }) },
        })}>学習記録をすべて削除</button>
      </section>

      <section>
        <h2>資料の検証状況</h2>
        <ul className="small">
          <li>一次資料（e-Gov現行条文）と照合済み：労働安全衛生規則・労働安全衛生法・労働基準法・建設業法・廃棄物処理法の該当条文（法令基準日は各問題の「根拠・検証状況」に表示）。</li>
          <li>教科書的知識：植物・土壌・施工・工程管理などの問題は、個別の一次資料との照合は未実施で、各問題に明記しています。</li>
          <li>公式過去問：問題文は収録していません（転載条件が確認できないため）。公式PDFへのリンクと、公式の正答番号（正答肢PDFを画像で読み取って転記、確認日 2026-10-22）で答え合わせができます。合格基準点は公式資料で確認できていません。</li>
        </ul>
        <ul className="plain">{OFFICIAL_PAPERS.map((p) => <li key={p.id} className="link-row"><span>{p.year} {p.title}</span><span><a href={p.questionUrl} target="_blank" rel="noreferrer">問題</a>・<a href={p.answerUrl} target="_blank" rel="noreferrer">正答</a></span></li>)}</ul>
      </section>
    </div>
  )
}
