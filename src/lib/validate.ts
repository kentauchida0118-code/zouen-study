import { CATEGORIES } from '../types'
import type { Lesson, Question } from '../types'

export interface ValidationResult { errors: string[]; warnings: string[]; lessons: Lesson[]; questions: Question[] }

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const catIds = new Set<string>(CATEGORIES.map((c) => c.id))
const GRADES = new Set(['1', '2', 'common'])
const VERIFS = new Set(['primary-verified', 'textbook', 'needs-review'])

export function validateImport(raw: unknown, existingQ: Set<string>, existingL: Set<string>): ValidationResult {
  const res: ValidationResult = { errors: [], warnings: [], lessons: [], questions: [] }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    res.errors.push('JSONのトップは {"lessons":[...], "questions":[...]} の形式にしてください')
    return res
  }
  const o = raw as Record<string, unknown>
  if (o.questions !== undefined && !Array.isArray(o.questions)) res.errors.push('questions は配列にしてください')
  if (o.lessons !== undefined && !Array.isArray(o.lessons)) res.errors.push('lessons は配列にしてください')
  if (res.errors.length) return res
  if (!o.questions && !o.lessons) { res.errors.push('lessons か questions のどちらかが必要です'); return res }

  const seenL = new Set<string>()
  const seenQ = new Set<string>()
  const goodL: Lesson[] = []
  const goodQ: Question[] = []

  ;((o.lessons ?? []) as unknown[]).forEach((l, i) => {
    const p = `lessons[${i}]`
    if (!l || typeof l !== 'object') { res.errors.push(`${p}: オブジェクトではありません`); return }
    const x = l as Record<string, unknown>
    const before = res.errors.length
    if (!isStr(x.id)) res.errors.push(`${p}: id がありません`)
    else if (seenL.has(x.id)) res.errors.push(`${p}: ファイル内でIDが重複しています (${x.id})`)
    else if (existingL.has(x.id)) res.errors.push(`${p}: 既存レッスンとIDが重複しています (${x.id})`)
    else seenL.add(x.id)
    if (!isStr(x.title)) res.errors.push(`${p}: title がありません`)
    if (!isStr(x.category) || !catIds.has(x.category)) res.errors.push(`${p}: category が不正です`)
    if (x.level !== 'common' && x.level !== 'first-extra') res.errors.push(`${p}: level は common か first-extra`)
    if (!isStr(x.purpose)) res.errors.push(`${p}: purpose（何のための知識か）がありません`)
    for (const k of ['terms', 'examples', 'pitfalls', 'memo', 'sources']) if (!Array.isArray(x[k])) res.errors.push(`${p}: ${k} は配列にしてください`)
    if (res.errors.length === before) goodL.push({ minutes: 4, ...(x as object) } as Lesson)
  })

  ;((o.questions ?? []) as unknown[]).forEach((q, i) => {
    const p = `questions[${i}]`
    if (!q || typeof q !== 'object') { res.errors.push(`${p}: オブジェクトではありません`); return }
    const x = q as Record<string, unknown>
    const before = res.errors.length
    const id = isStr(x.id) ? x.id : null
    const tag = id ? `${p}(${id})` : p
    if (!id) res.errors.push(`${p}: id がありません`)
    else if (seenQ.has(id)) res.errors.push(`${tag}: ファイル内でIDが重複しています`)
    else if (existingQ.has(id)) res.errors.push(`${tag}: 既存の問題とIDが重複しています`)
    else seenQ.add(id)
    if (!isStr(x.stem)) res.errors.push(`${tag}: 問題文 stem がありません`)
    if (!isStr(x.grade) || !GRADES.has(x.grade)) res.errors.push(`${tag}: grade は 1 / 2 / common`)
    if (!isStr(x.category) || !catIds.has(x.category)) res.errors.push(`${tag}: category が不正です`)
    if (![1, 2, 3].includes(x.difficulty as number)) res.errors.push(`${tag}: difficulty は 1〜3`)
    if (typeof x.multi !== 'boolean') res.errors.push(`${tag}: multi は true/false`)
    if (!isStr(x.explanation)) res.errors.push(`${tag}: explanation がありません`)
    if (x.origin !== 'official' && x.origin !== 'original') res.errors.push(`${tag}: origin は official か original`)
    if (!isStr(x.verification) || !VERIFS.has(x.verification)) res.errors.push(`${tag}: verification が不正です`)
    if (!Array.isArray(x.lessonIds)) res.errors.push(`${tag}: lessonIds は配列にしてください`)
    if (!Array.isArray(x.sources) || x.sources.length === 0) res.errors.push(`${tag}: sources（出典の正式名称・URL・確認日）が必要です`)
    else (x.sources as Record<string, unknown>[]).forEach((s, j) => {
      const urlOk = isStr(s?.url) || (x.verification !== 'primary-verified' && typeof s?.url === 'string')
      if (!s || !isStr(s.title) || !urlOk || !isStr(s.checkedOn)) res.errors.push(`${tag}: sources[${j}] は title / url / checkedOn が必要です（一次資料確認済みはURL必須）`)
    })
    const choices = x.choices
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6) res.errors.push(`${tag}: choices は2〜6個の配列にしてください`)
    else {
      const ids = new Set<string>()
      ;(choices as Record<string, unknown>[]).forEach((c, j) => {
        if (!c || !isStr(c.id) || !isStr(c.text)) { res.errors.push(`${tag}: choices[${j}] は id と text が必要です`); return }
        if (ids.has(c.id)) res.errors.push(`${tag}: 選択肢IDが重複しています (${c.id})`)
        ids.add(c.id)
        if (!isStr(c.explanation)) res.errors.push(`${tag}: choices[${j}] の explanation（その選択肢が正しい/誤りの理由）がありません`)
      })
      const ans = x.answer
      if (!Array.isArray(ans) || ans.length === 0) res.errors.push(`${tag}: answer は選択肢IDの配列にしてください`)
      else {
        if (new Set(ans).size !== ans.length) res.errors.push(`${tag}: answer に重複があります`)
        for (const a of ans) if (!ids.has(a as string)) res.errors.push(`${tag}: 正答 ${String(a)} が選択肢にありません`)
        if (x.multi === false && ans.length !== 1) res.errors.push(`${tag}: 単一選択なのに正答が${ans.length}個です`)
        if (x.multi === true && ans.length < 2) res.errors.push(`${tag}: 複数選択なのに正答が${ans.length}個です`)
        if (ans.length >= (choices as unknown[]).length) res.errors.push(`${tag}: 全選択肢が正答になっています`)
      }
    }
    if (x.origin === 'official') {
      const off = x.official as Record<string, unknown> | undefined
      if (!off || !isStr(off.year) || !isStr(off.booklet) || typeof off.number !== 'number') res.errors.push(`${tag}: 公式過去問は official.year / booklet / number が必要です`)
      else if (typeof off.answerPublished !== 'boolean') res.errors.push(`${tag}: official.answerPublished（公式正答が公開されているか）が必要です`)
    }
    if (x.needsFigure === true) res.warnings.push(`${tag}: 図が必要な問題のため通常出題から除外されます`)
    if (x.verification === 'needs-review') res.warnings.push(`${tag}: 要確認のため通常出題から除外されます`)
    if (x.category === 'law' && !x.lawBasisDate) res.warnings.push(`${tag}: 法規の問題には lawBasisDate（基準日）を付けてください`)
    if (res.errors.length === before) goodQ.push(x as unknown as Question)
  })

  if (res.errors.length === 0) { res.lessons = goodL; res.questions = goodQ }
  return res
}
