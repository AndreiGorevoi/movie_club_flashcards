/**
 * Состояние стола — единственное, что остаётся жить в браузере. Сами фильмы и
 * вопросы хранятся на сервере (см. api.ts).
 *
 * Разложенные карточки: `order` — как перетасовалась колода, `flipped` — что уже
 * открыли. sessionStorage переживает случайный F5 посреди встречи, но исчезает
 * вместе с вкладкой: следующая встреча начинается с чистого стола.
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
