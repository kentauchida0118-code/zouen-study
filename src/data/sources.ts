import type { Source } from '../types'

const D = '2026-10-22'

/** e-Gov法令検索APIで条文本文を取得して確認した一次資料 */
export const SRC = {
  anzenKisoku: { title: '労働安全衛生規則（昭和47年労働省令第32号）第518条・第563条／e-Gov法令検索（施行日 2026-10-01 時点の現行条文）', url: 'https://laws.e-gov.go.jp/law/347M50002000032', checkedOn: D },
  anzenHou: { title: '労働安全衛生法（昭和47年法律第57号）第59条／e-Gov法令検索（施行日 2026-10-01 時点の現行条文）', url: 'https://laws.e-gov.go.jp/law/347AC0000000057', checkedOn: D },
  roukihou: { title: '労働基準法（昭和22年法律第49号）第34条／e-Gov法令検索（施行日 2026-07-17 時点の現行条文）', url: 'https://laws.e-gov.go.jp/law/322AC0000000049', checkedOn: D },
  kensetsu: { title: '建設業法（昭和24年法律第100号）第26条／e-Gov法令検索（施行日 2025-12-12 時点の現行条文）', url: 'https://laws.e-gov.go.jp/law/324AC0000000100', checkedOn: D },
  haiki: { title: '廃棄物の処理及び清掃に関する法律 第12条の3／e-Gov法令検索（施行日 2026-09-16 時点の現行条文）', url: 'https://laws.e-gov.go.jp/law/345AC0000000137', checkedOn: D },
  jctc1: { title: '一般財団法人全国建設研修センター 一級造園施工管理技術検定 試験案内', url: 'https://www.jctc.jp/exam/zouen-1/', checkedOn: D },
  jctc2: { title: '一般財団法人全国建設研修センター 二級造園施工管理技術検定 試験案内', url: 'https://www.jctc.jp/exam/zouen-2/', checkedOn: D },
} satisfies Record<string, Source>

/** 一次資料と個別照合していない、標準的な教科書的知識に基づく出題の出典表記（URLなし） */
export const TEXTBOOK: Source = {
  title: '標準的な造園施工管理の教科書・実務で広く確立している知識（個別の一次資料との照合は未実施。公式の解説ではありません）',
  url: '',
  checkedOn: D,
}

export interface PastPaperLink { label: string; url: string; status: string }
/** 取得可否(HTTP 200・application/pdf)を確認した公式PDF。本文は転載せずリンクのみ。 */
export const OFFICIAL_LINKS: PastPaperLink[] = [
  { label: '2026年度（令和8年度）一級 第一次検定 問題A', url: 'https://www.jctc.jp/wjctcp/wp-content/uploads/2026/09/20260907z_mondaia.pdf', status: 'PDF取得可（2026-10-22確認）' },
  { label: '2026年度（令和8年度）一級 第一次検定 問題B', url: 'https://www.jctc.jp/wjctcp/wp-content/uploads/2026/09/20260907z_mondaib.pdf', status: 'PDF取得可（2026-10-22確認）' },
  { label: '2026年度（令和8年度）一級 第一次検定 正答肢', url: 'https://www.jctc.jp/wjctcp/wp-content/uploads/2026/09/20260907z_seitou.pdf', status: 'PDF取得可（2026-10-22確認）' },
]
export const OFFICIAL_INDEX = 'https://www.jctc.jp/mondai/'
