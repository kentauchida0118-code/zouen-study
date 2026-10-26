import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Attempt, CardState, Confidence, Lesson, Question, Session, Settings } from './types'
import { LESSONS } from './data/lessons'
import { QUESTIONS } from './data/questions'
import * as db from './lib/db'
import { nextCard } from './lib/srs'
import { todayStr } from './lib/date'

export interface Report { qid: string; text: string; at: number }

interface Ctx {
  ready: boolean
  error: string | null
  lessons: Lesson[]
  questions: Question[]
  custom: db.Custom
  cards: Record<string, CardState>
  attempts: Attempt[]
  settings: Settings
  bookmarks: Set<string>
  reports: Report[]
  session: Session | null
  record: (q: Question, correct: boolean, conf: Confidence, mode: string) => Promise<void>
  recordRaw: (qid: string, category: string, correct: boolean, conf: Confidence, mode: string) => Promise<void>
  recordMemo: (memoId: string, remembered: boolean) => Promise<void>
  toggleBookmark: (qid: string) => Promise<void>
  addReport: (qid: string, text: string) => Promise<void>
  updateSettings: (s: Partial<Settings>) => Promise<void>
  saveSession: (s: Session | null) => Promise<void>
  reload: () => Promise<void>
  saveCustom: (c: db.Custom) => Promise<void>
}

const StoreCtx = createContext<Ctx | null>(null)
export const useStore = () => {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('StoreProvider が必要です')
  return c
}

const DEFAULT_SETTINGS: Settings = { target2: null, target1: null }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [custom, setCustom] = useState<db.Custom>({ lessons: [], questions: [] })
  const [cards, setCards] = useState<Record<string, CardState>>({})
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [reports, setReports] = useState<Report[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const cardsRef = useRef<Record<string, CardState>>({})

  const reload = useCallback(async () => {
    try {
      const [c, cs, at, st, bm, rp, se] = await Promise.all([
        db.loadCustom(), db.allCards(), db.allAttempts(),
        db.kvGet<Settings>('settings'), db.kvGet<string[]>('bookmarks'), db.kvGet<Report[]>('reports'), db.kvGet<Session>('session'),
      ])
      setCustom(c)
      cardsRef.current = Object.fromEntries(cs.map((x) => [x.qid, x]))
      setCards(cardsRef.current)
      setAttempts(at)
      setSettings({ ...DEFAULT_SETTINGS, ...(st ?? {}) })
      setBookmarks(new Set(bm ?? []))
      setReports(rp ?? [])
      setSession(se ?? null)
      setError(null)
    } catch (e) {
      setError('ブラウザ内の保存領域（IndexedDB）を開けませんでした。プライベートモードでは動作しない場合があります。' + String(e))
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const lessons = useMemo(() => [...LESSONS, ...custom.lessons], [custom])
  const questions = useMemo(() => [...QUESTIONS, ...custom.questions], [custom])

  const recordRaw = useCallback(async (qid: string, category: string, correct: boolean, conf: Confidence, mode: string) => {
    const today = todayStr()
    const a: Attempt = { qid, category, correct, conf, at: Date.now(), day: today, mode }
    const card = nextCard(cardsRef.current[qid], qid, correct, conf, today)
    cardsRef.current = { ...cardsRef.current, [qid]: card }
    await db.addAttempt(a)
    await db.putCard(card)
    setAttempts((p) => [...p, a])
    setCards((p) => ({ ...p, [qid]: card }))
  }, [])

  const record = useCallback((q: Question, correct: boolean, conf: Confidence, mode: string) => recordRaw(q.id, q.category, correct, conf, mode), [recordRaw])

  const recordMemo = useCallback(async (memoId: string, remembered: boolean) => {
    const key = 'm:' + memoId
    const card = nextCard(cardsRef.current[key], key, remembered, remembered ? 'sure' : 'unknown', todayStr())
    cardsRef.current = { ...cardsRef.current, [key]: card }
    await db.putCard(card)
    setCards((p) => ({ ...p, [key]: card }))
  }, [])

  const toggleBookmark = useCallback(async (qid: string) => {
    const n = new Set(bookmarks)
    if (n.has(qid)) n.delete(qid); else n.add(qid)
    setBookmarks(n)
    await db.kvSet('bookmarks', [...n])
  }, [bookmarks])

  const addReport = useCallback(async (qid: string, text: string) => {
    const n = [...reports, { qid, text, at: Date.now() }]
    setReports(n)
    await db.kvSet('reports', n)
  }, [reports])

  const updateSettings = useCallback(async (s: Partial<Settings>) => {
    const n = { ...settings, ...s }
    setSettings(n)
    await db.kvSet('settings', n)
  }, [settings])

  const saveSession = useCallback(async (s: Session | null) => {
    setSession(s)
    if (s) await db.kvSet('session', s); else await db.kvDel('session')
  }, [])

  const saveCustom = useCallback(async (c: db.Custom) => {
    await db.saveCustom(c)
    setCustom(c)
  }, [])

  const value: Ctx = { ready, error, lessons, questions, custom, cards, attempts, settings, bookmarks, reports, session, record, recordRaw, recordMemo, toggleBookmark, addReport, updateSettings, saveSession, reload, saveCustom }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
