import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { gradeAnswer, nextCard, INTERVALS } from './srs'
import { isDrillable, pickCheck, pickDaily } from './select'
import { validateImport } from './validate'
import * as db from './db'
import { QUESTIONS } from '../data/questions'
import { LESSONS } from '../data/lessons'
import { SAMPLE_IMPORT } from '../data/sample'
import { addDays } from './date'
import { OFFICIAL_PAPERS } from '../data/official'
import { gradeOfficial, offQid, parseOffQid } from './official'
import type { Attempt, CardState } from '../types'

const T = '2026-10-22'

describe('採点', () => {
  it('単一選択', () => {
    expect(gradeAnswer(['b'], ['b'])).toBe(true)
    expect(gradeAnswer(['b'], ['a'])).toBe(false)
    expect(gradeAnswer(['b'], [])).toBe(false)
  })
  it('複数選択は過不足なく一致したときのみ正解', () => {
    expect(gradeAnswer(['a', 'c'], ['c', 'a'])).toBe(true)
    expect(gradeAnswer(['a', 'c'], ['a'])).toBe(false)
    expect(gradeAnswer(['a', 'c'], ['a', 'c', 'd'])).toBe(false)
    expect(gradeAnswer(['a', 'c'], ['a', 'b'])).toBe(false)
    expect(gradeAnswer(['a', 'c'], ['a', 'a'])).toBe(false)
  })
})

describe('復習間隔', () => {
  it('自信あり正解で 1→3→7→14→30 日と進む', () => {
    let c: CardState | undefined
    const gaps: number[] = []
    for (let i = 0; i < 6; i++) {
      c = nextCard(c, 'q', true, 'sure', T)
      gaps.push(Math.round((new Date(c.due).getTime() - new Date(T).getTime()) / 86400000))
    }
    expect(gaps).toEqual([...INTERVALS, 30])
  })
  it('誤答は当日中に再出題、間隔は最初に戻り、自信ありの誤答は思い込みミス', () => {
    let c = nextCard(undefined, 'q', true, 'sure', T)
    c = nextCard(c, 'q', true, 'sure', T)
    c = nextCard(c, 'q', false, 'sure', T)
    expect(c.due).toBe(T)
    expect(c.step).toBe(-1)
    expect(c.misconception).toBe(true)
    expect(c.lapses).toBe(1)
    c = nextCard(c, 'q', true, 'sure', T)
    expect(c.due).toBe(addDays(T, 1))
  })
  it('迷った正解は間隔を進めず翌日', () => {
    const a = nextCard(undefined, 'q', true, 'sure', T)
    const b = nextCard(a, 'q', true, 'unsure', T)
    expect(b.step).toBe(a.step)
    expect(b.due).toBe(addDays(T, 1))
    expect(b.streak).toBe(0)
  })
})

describe('今日の10分学習', () => {
  const att = (qid: string, category: string, correct: boolean): Attempt => ({ qid, category, correct, conf: 'sure', at: 0, day: T, mode: 'x' })
  it('期限の来た復習 → 苦手分野 → 未学習 の順', () => {
    const qs = QUESTIONS.filter(isDrillable)
    const due = qs[0]
    const cards: Record<string, CardState> = { [due.id]: nextCard(undefined, due.id, false, 'sure', T) }
    const weakCat = qs[10].category
    const attempts = [att(due.id, due.category, false), att('x1', weakCat, false), att('x2', weakCat, false)]
    const picked = pickDaily(qs, cards, attempts, T)
    expect(picked[0].id).toBe(due.id)
    expect(picked.length).toBe(10)
    expect(new Set(picked.map((q) => q.id)).size).toBe(10)
  })
  it('問題数が少なくても重複・クラッシュなく動く', () => {
    expect(pickDaily([], {}, [], T)).toEqual([])
    const two = QUESTIONS.filter(isDrillable).slice(0, 2)
    const p = pickDaily(two, {}, [], T)
    expect(p.length).toBe(2)
    expect(pickCheck(two, 20).length).toBe(2)
  })
  it('要確認・図が必要な問題は出題されない', () => {
    const all = pickDaily(QUESTIONS, {}, [], T, 100)
    expect(all.some((q) => q.verification === 'needs-review')).toBe(false)
    expect(QUESTIONS.some((q) => q.verification === 'needs-review')).toBe(true)
  })
})

describe('内蔵コンテンツの整合性', () => {
  it('全問が検証を通る（ID重複・不正な正答なし）', () => {
    const r = validateImport({ lessons: LESSONS, questions: QUESTIONS }, new Set(), new Set())
    expect(r.errors).toEqual([])
    expect(r.questions.length).toBe(QUESTIONS.length)
  })
  it('分野を網羅し、40問程度・レッスン8本', () => {
    const ok = QUESTIONS.filter(isDrillable)
    expect(ok.length).toBeGreaterThanOrEqual(40)
    expect(LESSONS.length).toBe(8)
    expect(new Set(ok.map((q) => q.category)).size).toBe(8)
    expect(ok.some((q) => q.multi)).toBe(true)
    expect(ok.some((q) => !q.multi)).toBe(true)
  })
  it('関連レッスンIDが実在し、独自問題に公式区分がない', () => {
    const ids = new Set(LESSONS.map((l) => l.id))
    for (const q of QUESTIONS) {
      expect(q.lessonIds.every((l) => ids.has(l))).toBe(true)
      expect(q.origin).toBe('original')
    }
  })
  it('一次資料確認済みの問題はURLと法令基準日を持つ', () => {
    for (const q of QUESTIONS.filter((x) => x.verification === 'primary-verified')) {
      expect(q.sources.every((s) => s.url.startsWith('https://'))).toBe(true)
      expect(q.lawBasisDate).toBeTruthy()
    }
  })
  it('サンプルJSONは検証を通る', () => {
    const r = validateImport(SAMPLE_IMPORT, new Set(), new Set())
    expect(r.errors).toEqual([])
  })
})

describe('インポート検証', () => {
  const base = () => JSON.parse(JSON.stringify(SAMPLE_IMPORT))
  it('不正なトップレベルを拒否', () => {
    for (const bad of [null, 5, 'x', [], {}, { questions: 'a' }]) expect(validateImport(bad, new Set(), new Set()).errors.length).toBeGreaterThan(0)
  })
  it('重複IDを検出（ファイル内・既存）', () => {
    const d = base()
    d.questions.push(JSON.parse(JSON.stringify(d.questions[0])))
    expect(validateImport(d, new Set(), new Set()).errors.some((e) => e.includes('重複'))).toBe(true)
    expect(validateImport(base(), new Set(['Q-sample-001']), new Set()).errors.some((e) => e.includes('既存'))).toBe(true)
  })
  it('不正な正答設定を検出', () => {
    const a = base(); a.questions[0].answer = ['z']
    expect(validateImport(a, new Set(), new Set()).errors.some((e) => e.includes('選択肢にありません'))).toBe(true)
    const b = base(); b.questions[0].answer = ['a', 'b']
    expect(validateImport(b, new Set(), new Set()).errors.length).toBeGreaterThan(0)
    const c = base(); c.questions[1].answer = ['a']
    expect(validateImport(c, new Set(), new Set()).errors.some((e) => e.includes('複数選択'))).toBe(true)
    const d = base(); d.questions[0].answer = []
    expect(validateImport(d, new Set(), new Set()).errors.length).toBeGreaterThan(0)
  })
  it('公式過去問は出題年度・冊子・問題番号が必須', () => {
    const d = base(); delete d.questions[1].official
    expect(validateImport(d, new Set(), new Set()).errors.some((e) => e.includes('official'))).toBe(true)
  })
  it('エラーがあれば1件も取り込まない', () => {
    const d = base(); d.questions[0].answer = ['z']
    const r = validateImport(d, new Set(), new Set())
    expect(r.questions.length + r.lessons.length).toBe(0)
  })
})

describe('保存とバックアップ', () => {
  beforeEach(async () => { await db.clearProgress(); await db.kvDel('customContent') })
  it('記録を保存→エクスポート→削除→復元で元に戻る', async () => {
    const card = nextCard(undefined, 'Q-plant-001', false, 'sure', T)
    await db.addAttempt({ qid: 'Q-plant-001', category: 'plant', correct: false, conf: 'sure', at: 1, day: T, mode: 'daily' })
    await db.putCard(card)
    await db.kvSet('settings', { target2: '2027-06-06', target1: null })
    await db.kvSet('bookmarks', ['Q-plant-001'])
    const backup = JSON.parse(JSON.stringify(await db.exportAll()))
    expect(db.validateBackup(backup)).toEqual([])
    await db.clearProgress()
    expect((await db.allAttempts()).length).toBe(0)
    await db.restoreAll(backup)
    expect((await db.allAttempts()).length).toBe(1)
    expect((await db.allCards())[0]).toEqual(card)
    expect(await db.kvGet('bookmarks')).toEqual(['Q-plant-001'])
    expect(await db.kvGet<{ target2: string }>('settings')).toEqual({ target2: '2027-06-06', target1: null })
  })
  it('不正なバックアップを拒否', () => {
    expect(db.validateBackup(null).length).toBeGreaterThan(0)
    expect(db.validateBackup({ app: 'other' }).length).toBeGreaterThan(0)
    expect(db.validateBackup({ app: 'zouen-study', version: 1, kv: {}, attempts: [{ qid: 1 }], cards: [] }).length).toBeGreaterThan(0)
    expect(db.validateBackup({ app: 'zouen-study', version: 99, kv: {}, attempts: [], cards: [] }).length).toBeGreaterThan(0)
  })
})

describe('公式過去問の答え合わせ', () => {
  it('問題数・複数選択の位置が公式の正答表どおり', () => {
    const n = Object.fromEntries(OFFICIAL_PAPERS.map((p) => [p.id, p.items.length]))
    expect(n).toEqual({ 'R8-1A': 36, 'R8-1B': 29, 'R8-2': 40, 'R7-2': 40 })
    const multiNos = (id: string) => OFFICIAL_PAPERS.find((p) => p.id === id)!.items.filter((i) => i.answer.length > 1).map((i) => i.no)
    expect(multiNos('R8-2')).toEqual([37, 38, 39, 40])
    expect(multiNos('R7-2')).toEqual([37, 38, 39, 40])
    expect(multiNos('R8-1B')).toEqual([24, 25, 26, 28, 29])
    expect(multiNos('R8-1A')).toEqual([])
  })
  it('正答番号は1〜4で重複なし', () => {
    for (const p of OFFICIAL_PAPERS) for (const i of p.items) {
      expect(i.answer.every((a) => a >= 1 && a <= 4)).toBe(true)
      expect(new Set(i.answer).size).toBe(i.answer.length)
    }
  })
  it('採点は過不足なく一致したときのみ正解', () => {
    const it = OFFICIAL_PAPERS.find((p) => p.id === 'R8-2')!.items[36]
    expect(it.answer).toEqual([1, 2, 3])
    expect(gradeOfficial(it, [3, 1, 2])).toBe(true)
    expect(gradeOfficial(it, [1, 2])).toBe(false)
    expect(gradeOfficial(it, [1, 2, 3, 4])).toBe(false)
    expect(gradeOfficial(OFFICIAL_PAPERS[0].items[0], [4])).toBe(true)
    expect(gradeOfficial(OFFICIAL_PAPERS[0].items[0], [])).toBe(false)
  })
  it('IDの組み立てと解析', () => {
    expect(parseOffQid(offQid('R8-1A', 12))).toEqual({ paperId: 'R8-1A', no: 12 })
    expect(parseOffQid('Q-plant-001')).toBeNull()
  })
})
