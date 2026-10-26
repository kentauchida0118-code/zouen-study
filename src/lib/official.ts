import type { OfficialItem, OfficialPaper } from '../data/official'

/** 公式の配点と同じく1問1点。正解の数字をすべて選び、余計な数字を選ばなかった場合のみ正解（複数選択の問題も同じ） */
export function gradeOfficial(item: OfficialItem, picked: number[]): boolean {
  if (picked.length !== item.answer.length) return false
  const a = new Set(item.answer)
  return new Set(picked).size === picked.length && picked.every((p) => a.has(p))
}

export const offQid = (paperId: string, no: number) => `OFF:${paperId}:${no}`

export function parseOffQid(qid: string): { paperId: string; no: number } | null {
  const m = /^OFF:([^:]+):(\d+)$/.exec(qid)
  return m ? { paperId: m[1], no: Number(m[2]) } : null
}

export function findItem(papers: OfficialPaper[], qid: string) {
  const p = parseOffQid(qid)
  if (!p) return null
  const paper = papers.find((x) => x.id === p.paperId)
  const item = paper?.items.find((x) => x.no === p.no)
  return paper && item ? { paper, item } : null
}

/** 複数選択の問題か（正答が2つ以上）。未回答の入力欄を複数選択にするかの判断にも使う */
export const isMultiItem = (item: OfficialItem) => item.answer.length > 1
