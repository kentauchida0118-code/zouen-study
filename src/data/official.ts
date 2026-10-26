import type { CategoryId } from '../types'

/**
 * 公式過去問の「答え合わせ」用データ。
 * 問題文・選択肢は転載しない（JCTCのサイトに利用条件の記載がなく、転載可否を確認できないため）。
 * 収録しているのは、公式PDFへのリンク、問題番号、公式の正答番号（一般財団法人全国建設研修センター公表の「正答肢」を
 * 2026-10-22に画像で読み取って転記）、このアプリ独自の分野分類、図表の有無の目印のみ。
 */
export interface OfficialItem { no: number; category: CategoryId; answer: number[]; figure: boolean }
export interface OfficialPaper {
  id: string
  year: string
  grade: '1' | '2'
  title: string
  questionUrl: string
  answerUrl: string
  checkedOn: string
  items: OfficialItem[]
  note: string
}

const CAT: Record<string, CategoryId> = { p: 'plant', s: 'soil', g: 'planting', f: 'facility', c: 'civil', r: 'process', y: 'safety', l: 'law' }

function build(cats: string, answers: (number | number[])[], figures: number[]): OfficialItem[] {
  if (cats.length !== answers.length) throw new Error(`official data length mismatch: ${cats.length} vs ${answers.length}`)
  return answers.map((a, i) => ({ no: i + 1, category: CAT[cats[i]], answer: Array.isArray(a) ? a : [a], figure: figures.includes(i + 1) }))
}

const D = '2026-10-22'
const BASE = 'https://www.jctc.jp/wjctcp/wp-content/uploads/'

export const OFFICIAL_PAPERS: OfficialPaper[] = [
  {
    id: 'R8-1A', year: '令和8年度（2026年度）', grade: '1', title: '一級 第一次検定 問題A',
    questionUrl: BASE + '2026/09/20260907z_mondaia.pdf', answerUrl: BASE + '2026/09/20260907z_seitou.pdf', checkedOn: D,
    note: '問題A・36問。正答表は問題A/Bの別表。',
    items: build('ffsspppg' + 'fffgppff' + 'ffffcccc' + 'fccclrrr' + 'crlr',
      [4, 2, 2, 2, 1, 3, 2, 4, 1, 2, 3, 4, 2, 4, 4, 3, 3, 1, 1, 2, 2, 3, 2, 2, 4, 2, 2, 1, 1, 3, 1, 3, 4, 3, 3, 2], [26, 31, 36]),
  },
  {
    id: 'R8-1B', year: '令和8年度（2026年度）', grade: '1', title: '一級 第一次検定 問題B',
    questionUrl: BASE + '2026/09/20260907z_mondaib.pdf', answerUrl: BASE + '2026/09/20260907z_seitou.pdf', checkedOn: D,
    note: '問題B・29問。問題24〜29は施工管理法（応用能力）で、正解の数字をすべて選ばないと得点になりません。',
    items: build('rrrrggsr' + 'fcrryyyy' + 'lllllllp' + 'gglgy',
      [1, 4, 1, 3, 3, 1, 4, 1, 1, 2, 3, 2, 3, 4, 3, 3, 3, 3, 2, 2, 4, 2, 1, [1, 3], [1, 2, 4], [1, 3, 4], [2], [1, 2, 4], [1, 4]], [1, 4, 10]),
  },
  {
    id: 'R8-2', year: '令和8年度（2026年度）前期', grade: '2', title: '二級 第一次検定（前期）',
    questionUrl: BASE + '2026/06/20260608z_mondaia.pdf', answerUrl: BASE + '2026/06/20260608z_seitou.pdf', checkedOn: D,
    note: '40問すべて必須。問題37〜40は正解の数字をすべて選ばないと得点になりません。',
    items: build('fsssppp' + 'gfgspgcf' + 'fcccccc' + 'lrrrrgr' + 'yyyllll' + 'gglg',
      [1, 4, 1, 1, 3, 3, 2, 3, 2, 1, 3, 3, 2, 4, 4, 2, 4, 4, 4, 1, 1, 3, 1, 2, 2, 1, 2, 3, 1, 3, 3, 2, 4, 2, 4, 3, [1, 2, 3], [3, 4], [1, 3, 4], [2, 4]], [13, 19, 20, 21, 27]),
  },
  {
    id: 'R7-2', year: '令和7年度（2025年度）', grade: '2', title: '二級 第一次検定',
    questionUrl: BASE + '2025/11/20251117z_mondaia.pdf', answerUrl: BASE + '2025/11/20251117z_seitou.pdf', checkedOn: D,
    note: '問題1〜40。問題37〜40は施工管理法（基礎的能力）で、正解の数字をすべて選ぶ必要があります。',
    items: build('fssspppp' + 'fggppcff' + 'cccccc' + 'lrlrrrr' + 'yyyllll' + 'gfrg',
      [3, 2, 3, 4, 1, 1, 1, 3, 3, 1, 1, 1, 4, 3, 2, 1, 4, 3, 1, 3, 1, 4, 4, 1, 4, 4, 3, 4, 1, 2, 4, 3, 1, 2, 1, 2, [1, 2, 4], [2, 3], [1, 3], [1, 4]], [9, 16, 17, 20, 22, 24, 27, 28]),
  },
]
