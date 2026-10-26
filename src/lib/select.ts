import type { Attempt, CardState, Grade, Question } from '../types'

export const isDrillable = (q: Question) => q.verification !== 'needs-review' && !q.needsFigure

export interface Filter {
  grade?: Grade | 'all'
  category?: string
  mode?: 'all' | 'unanswered' | 'weak' | 'bookmark' | 'misconception'
}

export function weakQids(cards: Record<string, CardState>): Set<string> {
  return new Set(Object.values(cards).filter((c) => c.lastResult === 'wrong' || c.lastConf !== 'sure' || c.misconception).map((c) => c.qid))
}

export function filterQuestions(qs: Question[], f: Filter, cards: Record<string, CardState>, answered: Set<string>, bookmarks: Set<string>): Question[] {
  const weak = weakQids(cards)
  return qs.filter(isDrillable).filter((q) => {
    if (f.grade && f.grade !== 'all' && q.grade !== f.grade) return false
    if (f.category && f.category !== 'all' && q.category !== f.category) return false
    switch (f.mode) {
      case 'unanswered': return !answered.has(q.id)
      case 'weak': return weak.has(q.id)
      case 'bookmark': return bookmarks.has(q.id)
      case 'misconception': return !!cards[q.id]?.misconception
      default: return true
    }
  })
}

export function categoryStats(attempts: Attempt[]) {
  const m: Record<string, { n: number; ok: number }> = {}
  for (const a of attempts) {
    const s = (m[a.category] ??= { n: 0, ok: 0 })
    s.n++
    if (a.correct) s.ok++
  }
  return m
}

/** 今日の10分学習: 期限が来た復習 → 苦手分野 → 未学習 → (足りなければ)その他。重複なし、問題数が少なくても動く。 */
export function pickDaily(qs: Question[], cards: Record<string, CardState>, attempts: Attempt[], today: string, size = 10): Question[] {
  const pool = qs.filter(isDrillable)
  const out: Question[] = []
  const used = new Set<string>()
  const add = (list: Question[]) => {
    for (const q of list) {
      if (out.length >= size) return
      if (!used.has(q.id)) { used.add(q.id); out.push(q) }
    }
  }

  add(pool.filter((q) => cards[q.id] && cards[q.id].due <= today).sort((a, b) => Number(cards[b.id].misconception) - Number(cards[a.id].misconception) || cards[a.id].due.localeCompare(cards[b.id].due)))

  const stats = categoryStats(attempts)
  const rate = (c: string) => (stats[c] && stats[c].n ? stats[c].ok / stats[c].n : 1)
  const answered = new Set(attempts.map((a) => a.qid))
  const weak = weakQids(cards)
  const weakCats = Object.keys(stats).filter((c) => stats[c].n >= 2 && rate(c) < 0.8).sort((a, b) => rate(a) - rate(b))
  for (const c of weakCats) add(pool.filter((q) => q.category === c && (weak.has(q.id) || !answered.has(q.id))))

  add(pool.filter((q) => !answered.has(q.id)))
  add(pool.filter((q) => cards[q.id]).sort((a, b) => cards[a.id].due.localeCompare(cards[b.id].due)))
  return out
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickCheck(qs: Question[], n: number, rnd: () => number = Math.random): Question[] {
  return shuffle(qs.filter(isDrillable), rnd).slice(0, n)
}
