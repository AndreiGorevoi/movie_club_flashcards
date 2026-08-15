import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

// Раздача собранной статики. Без зависимостей — Railway ставит только react
// и vite, а в рантайме нужен один этот файл.

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
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

async function resolve(urlPath) {
  // normalize схлопывает `..`, а ведущий слэш не даёт выйти за пределы dist.
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(ROOT, safe)
  if (!candidate.startsWith(ROOT)) return null

  try {
    const info = await stat(candidate)
    if (info.isFile()) return candidate
  } catch {
    /* ниже отдадим index.html */
  }
  return null
}

createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname
    // Всё, что не найдено, — это клиентский маршрут: отдаём index.html.
    const file = (await resolve(path)) ?? join(ROOT, 'index.html')
    const ext = extname(file)

    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      // Файлы сборки содержат хэш в имени, index.html — нет.
      'Cache-Control': file.includes('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    })
    res.end(await readFile(file))
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Внутренняя ошибка')
  }
}).listen(PORT, () => console.log(`Киноклуб слушает порт ${PORT}`))
