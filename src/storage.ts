import type { Backup, Film } from './types'

const KEY = 'movie-club.films.v1'

/**
 * Весь доступ к хранилищу живёт здесь. Если однажды понадобится общая база на
 * несколько устройств, меняется только этот файл — остальному приложению
 * достаточно того же набора функций.
 */

function read(): Film[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isFilm) : []
  } catch {
    return []
  }
}

function write(films: Film[]): void {
  localStorage.setItem(KEY, JSON.stringify(films))
}

function isFilm(value: unknown): value is Film {
  if (typeof value !== 'object' || value === null) return false
  const film = value as Partial<Film>
  return (
    typeof film.id === 'string' &&
    typeof film.title === 'string' &&
    Array.isArray(film.questions) &&
    film.questions.every((q) => typeof q === 'string')
  )
}

function newId(): string {
  return crypto.randomUUID()
}

export function loadFilms(): Film[] {
  // Свежие сверху: последний добавленный фильм — тот, который сегодня смотрим.
  return read().sort((a, b) => b.createdAt - a.createdAt)
}

export function saveFilm(draft: Omit<Film, 'id' | 'createdAt'> & { id?: string }): Film {
  const films = read()
  const existing = draft.id ? films.find((f) => f.id === draft.id) : undefined

  const film: Film = {
    id: existing?.id ?? newId(),
    createdAt: existing?.createdAt ?? Date.now(),
    title: draft.title,
    note: draft.note,
    questions: draft.questions,
  }

  write(existing ? films.map((f) => (f.id === film.id ? film : f)) : [...films, film])
  return film
}

export function deleteFilm(id: string): void {
  write(read().filter((f) => f.id !== id))
  clearTable(id)
}

export function exportBackup(): Backup {
  return { version: 1, exportedAt: new Date().toISOString(), films: loadFilms() }
}

/**
 * Импорт объединяет, а не затирает: фильм с уже известным id обновляется,
 * незнакомый добавляется. Так безопасно слить два устройства.
 */
export function importBackup(json: string): { added: number; updated: number } {
  const parsed: unknown = JSON.parse(json)
  const incoming = extractFilms(parsed)
  if (!incoming) throw new Error('Не похоже на файл с фильмами киноклуба.')

  const films = read()
  const byId = new Map(films.map((f) => [f.id, f]))
  let added = 0
  let updated = 0

  for (const film of incoming) {
    if (byId.has(film.id)) updated++
    else added++
    byId.set(film.id, { ...film, createdAt: film.createdAt ?? Date.now() })
  }

  write([...byId.values()])
  return { added, updated }
}

function extractFilms(parsed: unknown): Film[] | null {
  // Принимаем и полноценный бэкап, и просто голый массив фильмов.
  const candidate = Array.isArray(parsed) ? parsed : (parsed as Partial<Backup>)?.films
  if (!Array.isArray(candidate)) return null
  const films = candidate.filter(isFilm)
  return films.length ? films : null
}

/* --- Состояние стола ---------------------------------------------------- */

/**
 * Разложенные карточки: `order` — как перетасовалась колода, `flipped` — что уже
 * открыли. Живёт в sessionStorage: переживает случайный F5 посреди встречи, но
 * исчезает вместе с вкладкой — ровно то, что нужно для одноразовой сессии.
 */
export interface Table {
  /** Индексы вопросов фильма в том порядке, в котором лежат карточки. */
  order: number[]
  flipped: number[]
}

const tableKey = (filmId: string) => `movie-club.table.${filmId}`

export function loadTable(filmId: string, questionCount: number): Table | null {
  try {
    const raw = sessionStorage.getItem(tableKey(filmId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Table>
    if (!Array.isArray(parsed.order) || !Array.isArray(parsed.flipped)) return null
    // Фильм могли отредактировать между встречами — тогда стол пересобираем.
    if (parsed.order.length !== questionCount) return null
    return { order: parsed.order, flipped: parsed.flipped }
  } catch {
    return null
  }
}

export function saveTable(filmId: string, table: Table): void {
  sessionStorage.setItem(tableKey(filmId), JSON.stringify(table))
}

export function clearTable(filmId: string): void {
  sessionStorage.removeItem(tableKey(filmId))
}
