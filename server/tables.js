import { deleteTableState, getFilm, loadTableState, saveTableState } from './db.js'

/**
 * Общий стол и рассылка изменений.
 *
 * Каждый, кто открыл фильм, держит с сервером открытое HTTP-соединение (SSE).
 * Мы складываем эти соединения в Set и при любом изменении пишем в каждое
 * целиком новое состояние стола. Целиком, а не по кусочкам: состояние размером
 * с твит, зато любой пропустивший событие сам себя вылечит.
 */

/** filmId → Set<res>. Живёт только в памяти: соединения переживать нечему. */
const subscribers = new Map()

/** Прокси и мобильные сети рвут молчащие соединения — напоминаем о себе. */
const HEARTBEAT_MS = 25_000

/** Карточки в том порядке, в котором ведущий ввёл вопросы. */
function inputOrder(length) {
  return Array.from({ length }, (_, i) => i)
}

/** Фишер — Йетс: тасуем только по кнопке, сами по себе карточки не перемешиваются. */
function shuffle(length) {
  const order = inputOrder(length)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * Стол фильма: из базы, если он там есть и всё ещё сходится с вопросами.
 * Фильм могли отредактировать между встречами — тогда раскладываем заново,
 * в порядке ввода: ведущий часто продумывает последовательность вопросов.
 */
function ensureTable(film) {
  const stored = loadTableState(film.id)
  if (stored && stored.order.length === film.questions.length) return stored

  const fresh = { order: inputOrder(film.questions.length), flipped: [] }
  saveTableState(film.id, fresh)
  return fresh
}

export function getTable(filmId) {
  const film = getFilm(filmId)
  if (!film) return null
  return { ...ensureTable(film), viewers: viewerCount(filmId) }
}

function viewerCount(filmId) {
  return subscribers.get(filmId)?.size ?? 0
}

function broadcast(filmId) {
  const listeners = subscribers.get(filmId)
  if (!listeners?.size) return

  const table = getTable(filmId)
  if (!table) return

  const message = `data: ${JSON.stringify(table)}\n\n`
  for (const res of listeners) res.write(message)
}

/**
 * Переворот идемпотентен: если карточка уже открыта, второе нажатие ничего не
 * меняет. Поэтому два человека, ткнувшие одну карточку одновременно, не мешают
 * друг другу — блокировки не нужны, Node всё равно однопоточный.
 */
export function flipCard(filmId, index) {
  const film = getFilm(filmId)
  if (!film) return null

  const table = ensureTable(film)
  if (!Number.isInteger(index) || index < 0 || index >= film.questions.length) return null
  if (table.flipped.includes(index)) return getTable(filmId)

  saveTableState(filmId, { order: table.order, flipped: [...table.flipped, index] })
  broadcast(filmId)
  return getTable(filmId)
}

/**
 * Закрыть карточку обратно — на случай, когда ткнули мимо. Тоже идемпотентно:
 * закрывать уже закрытую нечего. Пароль не нужен по той же причине, по которой
 * не нужен на переворот: кто открыл случайно, тот и закрывает.
 */
export function unflipCard(filmId, index) {
  const film = getFilm(filmId)
  if (!film) return null

  const table = ensureTable(film)
  if (!Number.isInteger(index) || index < 0 || index >= film.questions.length) return null
  if (!table.flipped.includes(index)) return getTable(filmId)

  saveTableState(filmId, {
    order: table.order,
    flipped: table.flipped.filter((flippedIndex) => flippedIndex !== index),
  })
  broadcast(filmId)
  return getTable(filmId)
}

export function reshuffleTable(filmId) {
  const film = getFilm(filmId)
  if (!film) return null

  saveTableState(filmId, { order: shuffle(film.questions.length), flipped: [] })
  broadcast(filmId)
  return getTable(filmId)
}

/**
 * Вернуть карточки в порядок ввода. Открытые не закрываем: `flipped` хранит
 * индексы вопросов, а не места на столе, так что они просто переедут вместе
 * с карточками.
 */
export function unshuffleTable(filmId) {
  const film = getFilm(filmId)
  if (!film) return null

  const table = ensureTable(film)
  saveTableState(filmId, { order: inputOrder(film.questions.length), flipped: table.flipped })
  broadcast(filmId)
  return getTable(filmId)
}

/** Фильм отредактировали — вопросы могли поменяться, пересобираем стол. */
export function resetTable(filmId) {
  deleteTableState(filmId)
  broadcast(filmId)
}

/** Подписка на поток. Ответ намеренно не закрываем — в этом весь смысл. */
export function subscribe(req, res, filmId) {
  if (!getFilm(filmId)) return false

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Просит обратные прокси не копить наш поток в буфере, а отдавать сразу.
    'X-Accel-Buffering': 'no',
  })

  if (!subscribers.has(filmId)) subscribers.set(filmId, new Set())
  subscribers.get(filmId).add(res)

  // Новичку сразу отдаём текущий стол, остальным — обновлённый счётчик людей.
  res.write(`data: ${JSON.stringify(getTable(filmId))}\n\n`)
  broadcast(filmId)

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)

  req.on('close', () => {
    clearInterval(heartbeat)
    const listeners = subscribers.get(filmId)
    listeners?.delete(res)
    if (listeners && listeners.size === 0) subscribers.delete(filmId)
    broadcast(filmId)
  })

  return true
}
