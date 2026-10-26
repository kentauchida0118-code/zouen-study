import type { Attempt, CardState, Lesson, Question } from '../types'

const DB_NAME = 'zouen-study'
const DB_VERSION = 1
export const BACKUP_APP = 'zouen-study'
export const BACKUP_VERSION = 1

let dbp: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      if (!db.objectStoreNames.contains('attempts')) db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true })
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'qid' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { dbp = null; reject(req.error) }
  })
  return dbp
}

/** テスト用: 接続キャッシュを破棄する */
export function resetDbCache() { dbp = null }

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
}
async function store(name: string, mode: IDBTransactionMode) {
  const db = await openDb()
  return db.transaction(name, mode).objectStore(name)
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })
}

export async function kvGet<T>(key: string): Promise<T | undefined> { return wrap((await store('kv', 'readonly')).get(key)) as Promise<T | undefined> }
export async function kvSet(key: string, value: unknown): Promise<void> { await wrap((await store('kv', 'readwrite')).put(value, key)) }
export async function kvDel(key: string): Promise<void> { await wrap((await store('kv', 'readwrite')).delete(key)) }

export async function addAttempt(a: Attempt): Promise<void> { await wrap((await store('attempts', 'readwrite')).add(a)) }
export async function allAttempts(): Promise<Attempt[]> { return wrap((await store('attempts', 'readonly')).getAll()) }
export async function putCard(c: CardState): Promise<void> { await wrap((await store('cards', 'readwrite')).put(c)) }
export async function allCards(): Promise<CardState[]> { return wrap((await store('cards', 'readonly')).getAll()) }

const KV_KEYS = ['settings', 'bookmarks', 'reports', 'session', 'lastRoute', 'customContent'] as const

export interface Backup {
  app: string
  version: number
  exportedAt: string
  kv: Record<string, unknown>
  attempts: Attempt[]
  cards: CardState[]
}

export async function exportAll(): Promise<Backup> {
  const kv: Record<string, unknown> = {}
  for (const k of KV_KEYS) { const v = await kvGet(k); if (v !== undefined) kv[k] = v }
  const attempts = (await allAttempts()).map(({ id: _id, ...rest }) => rest as Attempt)
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), kv, attempts, cards: await allCards() }
}

export function validateBackup(raw: unknown): string[] {
  const errs: string[] = []
  if (!raw || typeof raw !== 'object') return ['JSONオブジェクトではありません']
  const b = raw as Record<string, unknown>
  if (b.app !== BACKUP_APP) errs.push('このアプリのバックアップではありません (app が一致しません)')
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) errs.push('未対応のバージョンです')
  if (!b.kv || typeof b.kv !== 'object') errs.push('kv がありません')
  if (!Array.isArray(b.attempts)) errs.push('attempts が配列ではありません')
  else if ((b.attempts as Attempt[]).some((a) => !a || typeof a.qid !== 'string' || typeof a.correct !== 'boolean' || typeof a.at !== 'number')) errs.push('attempts に不正な要素があります')
  if (!Array.isArray(b.cards)) errs.push('cards が配列ではありません')
  else if ((b.cards as CardState[]).some((c) => !c || typeof c.qid !== 'string' || typeof c.due !== 'string' || typeof c.step !== 'number')) errs.push('cards に不正な要素があります')
  return errs
}

/** 現在の学習記録を全て置き換えて復元する（呼び出し側で validateBackup 済みであること） */
export async function restoreAll(b: Backup): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['kv', 'attempts', 'cards'], 'readwrite')
  tx.objectStore('kv').clear(); tx.objectStore('attempts').clear(); tx.objectStore('cards').clear()
  for (const [k, v] of Object.entries(b.kv)) if ((KV_KEYS as readonly string[]).includes(k)) tx.objectStore('kv').put(v, k)
  for (const a of b.attempts) tx.objectStore('attempts').add(a)
  for (const c of b.cards) tx.objectStore('cards').put(c)
  await done(tx)
}

export async function clearProgress(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['kv', 'attempts', 'cards'], 'readwrite')
  tx.objectStore('attempts').clear(); tx.objectStore('cards').clear()
  for (const k of ['bookmarks', 'reports', 'session', 'lastRoute']) tx.objectStore('kv').delete(k)
  await done(tx)
}

export interface Custom { lessons: Lesson[]; questions: Question[] }
export async function loadCustom(): Promise<Custom> {
  return (await kvGet<Custom>('customContent')) ?? { lessons: [], questions: [] }
}
export async function saveCustom(c: Custom) { await kvSet('customContent', c) }
