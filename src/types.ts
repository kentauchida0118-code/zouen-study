export type Grade = '2' | '1' | 'common'
export type CategoryId = 'plant' | 'soil' | 'planting' | 'facility' | 'civil' | 'process' | 'safety' | 'law'
export type Verification = 'primary-verified' | 'textbook' | 'needs-review'

export const CATEGORIES: { id: CategoryId; name: string }[] = [
  { id: 'plant', name: '植物・樹木' },
  { id: 'soil', name: '土壌・肥料' },
  { id: 'planting', name: '植栽・移植・芝生' },
  { id: 'facility', name: '石工事などの造園施設' },
  { id: 'civil', name: '関連する土木・設備工事' },
  { id: 'process', name: '工程管理・品質管理' },
  { id: 'safety', name: '安全管理' },
  { id: 'law', name: '関連法規' },
]
export const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id
export const GRADE_LABEL: Record<Grade, string> = { '2': '二級', '1': '一級', common: '共通基礎' }
export const VERIFY_LABEL: Record<Verification, string> = {
  'primary-verified': '一次資料で確認済み',
  textbook: '標準的な教科書知識（個別の一次資料照合は未実施）',
  'needs-review': '要確認（通常の出題から除外）',
}

export interface Source { title: string; url: string; checkedOn: string }
export interface Choice { id: string; text: string; explanation: string }
export interface Question {
  id: string
  grade: Grade
  category: CategoryId
  difficulty: 1 | 2 | 3
  stem: string
  multi: boolean
  negative?: boolean
  choices: Choice[]
  answer: string[]
  /** 覚え方・語呂合わせ（アプリ独自の記憶補助。公式解説ではない） */
  mnemonic?: string
  explanation: string
  lessonIds: string[]
  origin: 'official' | 'original'
  official?: { year: string; booklet: string; number: number; answerPublished: boolean; officialAnswer?: string[] }
  sources: Source[]
  verification: Verification
  lawBasisDate?: string
  needsFigure?: boolean
  note?: string
}

export interface Term { term: string; reading: string; meaning: string }
export interface MemoCard { id: string; front: string; back: string; goro?: string }
export interface Lesson {
  id: string
  category: CategoryId
  title: string
  /** 'common' = 一級・二級共通の基礎 / 'first-extra' = 一級で追加して学ぶ内容（いずれも編集上の目安） */
  level: 'common' | 'first-extra'
  minutes: number
  purpose: string
  terms: Term[]
  examples: string[]
  pitfalls: string[]
  memo: MemoCard[]
  sources: Source[]
}

export interface CardState { qid: string; step: number; due: string; lapses: number; streak: number; lastResult: 'correct' | 'wrong'; lastConf: Confidence; misconception: boolean; updatedAt: number }
export type Confidence = 'sure' | 'unsure' | 'unknown'
export interface Attempt { id?: number; qid: string; category: string; correct: boolean; conf: Confidence; at: number; day: string; mode: string }
export interface Session { id: string; kind: 'daily' | 'practice' | 'check'; label: string; ids: string[]; index: number; timeLimitSec: number | null; startedAt: number; results: Record<string, { correct: boolean; conf: Confidence }> }
export interface Settings { target2: string | null; target1: string | null }
