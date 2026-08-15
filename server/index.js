import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi, writesEnabled } from './api.js'
import { DATA_DIR, countFilms, saveFilm } from './db.js'

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'dist')
const PORT = Number(process.env.PORT) || 3000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

async function resolveFile(urlPath) {
  // normalize схлопывает `..`, а проверка префикса не даёт выйти за пределы dist.
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(ROOT, safe)
  if (!candidate.startsWith(ROOT)) return null

  try {
    if ((await stat(candidate)).isFile()) return candidate
  } catch {
    /* ниже отдадим index.html */
  }
  return null
}

async function serveStatic(res, pathname) {
  // Всё, что не найдено, — клиентский маршрут: отдаём index.html.
  const file = (await resolveFile(pathname)) ?? join(ROOT, 'index.html')

  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    // Имена файлов сборки содержат хэш, index.html — нет.
    'Cache-Control': file.includes('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  })
  res.end(await readFile(file))
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost')
    if (await handleApi(req, res, pathname)) return
    await serveStatic(res, pathname)
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Внутренняя ошибка')
  }
}).listen(PORT, () => {
  seedIfEmpty()
  console.log(`Киноклуб слушает порт ${PORT}`)
  console.log(`База: ${DATA_DIR}/movie-club.db (фильмов: ${countFilms()})`)

  if (!writesEnabled) {
    console.warn('⚠️  ADMIN_PASSWORD не задан — добавление и правка фильмов выключены.')
  }
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.warn(
      '⚠️  К сервису не подключён Volume: база лежит внутри контейнера и будет ' +
        'стёрта следующим редеплоем. Railway → Settings → Volumes.',
    )
  }
})

/** Один фильм-пример на совсем пустой базе, чтобы не встречать пустым экраном. */
function seedIfEmpty() {
  if (countFilms() > 0) return

  saveFilm({
    title: 'Пример: как это работает',
    note: 'Можно спокойно удалить — это просто демонстрация',
    questions: [
      'Какая сцена осталась с вами дольше всего после титров?',
      'Кому из героев вы сочувствовали, хотя не должны были?',
      'Что фильм показал, но так и не объяснил?',
      'Какой момент вы бы вырезали, будь вы монтажёром?',
      'Если бы фильм заканчивался на десять минут раньше — стало бы лучше?',
      'О чём этот фильм на самом деле, если убрать сюжет?',
      'Кому из друзей вы бы его посоветовали и почему именно ему?',
      'Что вы почувствовали в первую минуту после финального кадра?',
    ],
  })
}
