/**
 * 正式な模擬試験の設定データ。年度ごとの出題数・時間・合格基準を公式資料で確認できた場合だけここに追加する。
 * 2026-10-22時点: JCTC 一級/二級の試験案内ページに2027年度の日程は無く、問題数・時間・合格基準の記載も
 * 確認できなかったため空。空の間は「理解度チェック」としてのみ提供する（公式と同条件とは表示しない）。
 */
export interface ExamRule {
  year: string
  grade: '1' | '2'
  questions: number
  minutes: number
  passRule: string
  sourceUrl: string
  checkedOn: string
}
export const EXAM_RULES: ExamRule[] = []
