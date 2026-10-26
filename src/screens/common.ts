import type { CardState, Question } from '../types'
import { isDrillable } from '../lib/select'

export function dueCount(cards: Record<string, CardState>, questions: Question[], today: string) {
  const ids = new Set(questions.filter(isDrillable).map((q) => q.id))
  let q = 0
  let memo = 0
  for (const c of Object.values(cards)) {
    if (c.due > today) continue
    if (c.qid.startsWith('m:')) memo++
    else if (ids.has(c.qid)) q++
  }
  return { questions: q, memo }
}
