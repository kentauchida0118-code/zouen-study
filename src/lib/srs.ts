import type { CardState, Confidence } from '../types'
import { addDays } from './date'

/** 翌日・3日後・7日後・14日後・30日後（目安） */
export const INTERVALS = [1, 3, 7, 14, 30]
/** 自信あり正解がこの回数続いたら「定着」とみなす（厳しめの基準） */
export const MASTERED_STREAK = 3

export function gradeAnswer(answer: string[], picked: string[]): boolean {
  if (picked.length !== answer.length) return false
  const a = new Set(answer)
  return new Set(picked).size === picked.length && picked.every((p) => a.has(p))
}

/**
 * 厳しめの復習ルール:
 * - 誤答: 当日中にもう一度（due=今日）、間隔は最初に戻す。「自信あり」での誤答は思い込みミスとして記録。
 * - 正解＋自信あり: 次の間隔へ進む
 * - 正解＋迷った／分からない: 間隔は進めず、翌日にもう一度
 */
export function nextCard(prev: CardState | undefined, qid: string, correct: boolean, conf: Confidence, today: string, now = Date.now()): CardState {
  const p: CardState = prev ?? { qid, step: -1, due: today, lapses: 0, streak: 0, lastResult: 'correct', lastConf: 'sure', misconception: false, updatedAt: now }
  if (!correct) {
    return { ...p, step: -1, due: today, lapses: p.lapses + 1, streak: 0, lastResult: 'wrong', lastConf: conf, misconception: p.misconception || conf === 'sure', updatedAt: now }
  }
  if (conf === 'sure') {
    const step = Math.min(p.step + 1, INTERVALS.length - 1)
    const streak = p.streak + 1
    return { ...p, step, due: addDays(today, INTERVALS[step]), streak, lastResult: 'correct', lastConf: conf, misconception: streak >= MASTERED_STREAK ? false : p.misconception, updatedAt: now }
  }
  return { ...p, due: addDays(today, 1), streak: 0, lastResult: 'correct', lastConf: conf, updatedAt: now }
}

export const isDue = (c: CardState, today: string) => c.due <= today
export const isMastered = (c: CardState) => c.streak >= MASTERED_STREAK
