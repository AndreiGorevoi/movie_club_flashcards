import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Хранилище фильмов. Один файл SQLite — данных здесь килобайты, а `node:sqlite`
 * встроен в Node, так что база не стоит нам ни одной зависимости.
 *
 * Railway сам подставляет RAILWAY_VOLUME_MOUNT_PATH, когда к сервису прикручен
 * Volume. Без него база ляжет в контейнер и умрёт на первом же редеплое —
 * поэтому в проде мы об этом громко предупреждаем (см. server/index.js).
 */
export const DATA_DIR =
  process.env.DATA_DIR ?? process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(process.cwd(), 'data')

mkdirSync(DATA_DIR, { recursive: true })

const db = new DatabaseSync(join(DATA_DIR, 'movie-club.db'))

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS films (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    questions  TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`)

/**
 * Разложенный стол. Раньше он жил в браузере, теперь общий на всех — иначе
 * восемь человек видели бы восемь разных раскладок. Пишем сюда, а не только в
 * память, чтобы редеплой посреди встречи не закрыл всем карточки.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS tables (
    film_id    TEXT PRIMARY KEY REFERENCES films(id) ON DELETE CASCADE,
    card_order TEXT NOT NULL,
    flipped    TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`)

const statements = {
  all: db.prepare('SELECT * FROM films ORDER BY created_at DESC'),
  byId: db.prepare('SELECT * FROM films WHERE id = ?'),
  upsert: db.prepare(`
    INSERT INTO films (id, title, note, questions, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      note = excluded.note,
      questions = excluded.questions
  `),
  remove: db.prepare('DELETE FROM films WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM films'),

  tableById: db.prepare('SELECT * FROM tables WHERE film_id = ?'),
  saveTable: db.prepare(`
    INSERT INTO tables (film_id, card_order, flipped, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(film_id) DO UPDATE SET
      card_order = excluded.card_order,
      flipped = excluded.flipped,
      updated_at = excluded.updated_at
  `),
  removeTable: db.prepare('DELETE FROM tables WHERE film_id = ?'),
}

function toFilm(row) {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    questions: JSON.parse(row.questions),
    createdAt: row.created_at,
  }
}

export function listFilms() {
  return statements.all.all().map(toFilm)
}

export function getFilm(id) {
  const row = statements.byId.get(id)
  return row ? toFilm(row) : null
}

/**
 * Одна операция и на создание, и на правку. `createdAt` у существующего фильма
 * не трогаем: список отсортирован по нему, и правка вопросов не должна
 * перекидывать фильм наверх.
 */
export function saveFilm({ id, title, note = '', questions, createdAt }) {
  const finalId = id ?? crypto.randomUUID()
  const existing = statements.byId.get(finalId)

  statements.upsert.run(
    finalId,
    title,
    note,
    JSON.stringify(questions),
    existing?.created_at ?? createdAt ?? Date.now(),
  )

  return getFilm(finalId)
}

export function deleteFilm(id) {
  statements.removeTable.run(id)
  return statements.remove.run(id).changes > 0
}

/* --- Состояние стола ------------------------------------------------------ */

export function loadTableState(filmId) {
  const row = statements.tableById.get(filmId)
  if (!row) return null

  try {
    return { order: JSON.parse(row.card_order), flipped: JSON.parse(row.flipped) }
  } catch {
    return null
  }
}

export function saveTableState(filmId, { order, flipped }) {
  statements.saveTable.run(filmId, JSON.stringify(order), JSON.stringify(flipped), Date.now())
}

export function deleteTableState(filmId) {
  statements.removeTable.run(filmId)
}

export function countFilms() {
  return statements.count.get().n
}

/** Слияние, а не замена: знакомый id обновляется, незнакомый добавляется. */
export function importFilms(films) {
  let added = 0
  let updated = 0

  // Всё или ничего: наполовину слитый импорт хуже, чем несостоявшийся.
  db.exec('BEGIN')
  try {
    for (const film of films) {
      if (film.id && statements.byId.get(film.id)) updated++
      else added++
      saveFilm(film)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { added, updated }
}
