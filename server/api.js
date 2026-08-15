import { createHash, timingSafeEqual } from 'node:crypto'
import { countFilms, deleteFilm, importFilms, listFilms, saveFilm } from './db.js'
import { flipCard, getTable, reshuffleTable, resetTable, subscribe } from './tables.js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''
const MAX_BODY = 1_000_000 // ~1 МБ: вопросов столько не бывает
const WRONG_PASSWORD_DELAY = 400 // мс, чтобы перебор был скучным занятием

export const writesEnabled = ADMIN_PASSWORD.length > 0

/**
 * Сравнение постоянного времени. Хэшируем, чтобы уравнять длину — иначе
 * timingSafeEqual просто бросит исключение на строках разного размера.
 */
function matchesPassword(candidate) {
  const digest = (value) => createHash('sha256').update(String(value)).digest()
  return timingSafeEqual(digest(candidate), digest(ADMIN_PASSWORD))
}

function isAuthorized(req) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return writesEnabled && token.length > 0 && matchesPassword(token)
}

async function readBody(req) {
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, 'Слишком большой запрос.')
    chunks.push(chunk)
  }

  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Тело запроса — не JSON.')
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** Приводим что угодно из сети к фильму, которому можно доверять. */
function validateFilm(input) {
  if (typeof input !== 'object' || input === null) throw new HttpError(400, 'Ожидался фильм.')

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) throw new HttpError(400, 'У фильма должно быть название.')
  if (title.length > 200) throw new HttpError(400, 'Слишком длинное название.')

  if (!Array.isArray(input.questions)) throw new HttpError(400, 'Вопросы должны быть списком.')
  const questions = input.questions
    .filter((q) => typeof q === 'string')
    .map((q) => q.trim())
    .filter(Boolean)
  if (questions.length === 0) throw new HttpError(400, 'Нужен хотя бы один вопрос.')
  if (questions.length > 200) throw new HttpError(400, 'Слишком много вопросов.')
  if (questions.some((q) => q.length > 500)) throw new HttpError(400, 'Слишком длинный вопрос.')

  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 200) : ''
  const id = typeof input.id === 'string' && input.id ? input.id.slice(0, 64) : undefined
  const createdAt = Number.isFinite(input.createdAt) ? input.createdAt : undefined

  return { id, title, note, questions, createdAt }
}

/**
 * Возвращает true, если запрос был к API и уже обработан. Всё остальное
 * достаётся раздаче статики.
 */
export async function handleApi(req, res, pathname) {
  if (!pathname.startsWith('/api/')) return false

  try {
    await route(req, res, pathname)
  } catch (error) {
    if (error instanceof HttpError) send(res, error.status, { error: error.message })
    else {
      console.error(error)
      send(res, 500, { error: 'Внутренняя ошибка сервера.' })
    }
  }

  return true
}

async function route(req, res, pathname) {
  const { method } = req

  if (pathname === '/api/health') {
    return send(res, 200, { ok: true, films: countFilms(), writesEnabled })
  }

  // Клиент спрашивает при загрузке: показывать ли кнопки правки вообще.
  if (pathname === '/api/session' && method === 'GET') {
    return send(res, 200, { writesEnabled, admin: isAuthorized(req) })
  }

  // Проверка пароля перед тем, как запомнить его в браузере.
  if (pathname === '/api/session' && method === 'POST') {
    requireWritesEnabled()
    const { password } = await readBody(req)
    if (typeof password !== 'string' || !matchesPassword(password)) {
      await sleep(WRONG_PASSWORD_DELAY)
      throw new HttpError(401, 'Неверный пароль.')
    }
    return send(res, 200, { admin: true })
  }

  if (pathname === '/api/films' && method === 'GET') {
    return send(res, 200, { films: listFilms() })
  }

  if (pathname === '/api/films' && method === 'POST') {
    requireAdmin(req)
    const film = saveFilm(validateFilm(await readBody(req)))
    // Вопросы могли измениться — стол пересоберётся под новый набор.
    resetTable(film.id)
    return send(res, 200, { film })
  }

  if (pathname === '/api/films/import' && method === 'POST') {
    requireAdmin(req)
    const body = await readBody(req)
    const incoming = Array.isArray(body) ? body : body?.films
    if (!Array.isArray(incoming)) throw new HttpError(400, 'Не похоже на файл с фильмами.')

    const result = importFilms(incoming.map(validateFilm))
    return send(res, 200, { ...result, films: listFilms() })
  }

  const match = pathname.match(/^\/api\/films\/([^/]+)$/)
  if (match && method === 'DELETE') {
    requireAdmin(req)
    if (!deleteFilm(decodeURIComponent(match[1]))) throw new HttpError(404, 'Фильм не найден.')
    return send(res, 200, { ok: true })
  }

  /* --- Общий стол ---------------------------------------------------------- */

  const table = pathname.match(/^\/api\/films\/([^/]+)\/(stream|table|flip|reshuffle)$/)
  if (table) {
    const filmId = decodeURIComponent(table[1])
    const action = table[2]

    // Поток: соединение остаётся открытым, ответ намеренно не завершаем.
    if (action === 'stream' && method === 'GET') {
      if (!subscribe(req, res, filmId)) throw new HttpError(404, 'Фильм не найден.')
      return undefined
    }

    if (action === 'table' && method === 'GET') {
      return send(res, 200, requireTable(getTable(filmId)))
    }

    if (action === 'flip' && method === 'POST') {
      const { index } = await readBody(req)
      const updated = flipCard(filmId, index)
      if (!updated) throw new HttpError(400, 'Нет такой карточки.')
      return send(res, 200, updated)
    }

    // Перетасовку отдаём только ведущему: иначе любой гость обнулит стол
    // посреди встречи.
    if (action === 'reshuffle' && method === 'POST') {
      requireAdmin(req)
      return send(res, 200, requireTable(reshuffleTable(filmId)))
    }
  }

  throw new HttpError(404, 'Нет такого метода.')
}

function requireTable(table) {
  if (!table) throw new HttpError(404, 'Фильм не найден.')
  return table
}

function requireWritesEnabled() {
  if (!writesEnabled) {
    throw new HttpError(503, 'Сервер запущен без ADMIN_PASSWORD — редактирование выключено.')
  }
}

function requireAdmin(req) {
  requireWritesEnabled()
  if (!isAuthorized(req)) throw new HttpError(401, 'Нужен пароль.')
}

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
