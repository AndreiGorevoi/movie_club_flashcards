import { useCallback, useEffect, useState } from 'react'
import { savedPassword } from './api'
import type { Film } from './types'

export interface Table {
  /** Индексы вопросов фильма в том порядке, в котором лежат карточки. */
  order: number[]
  flipped: number[]
  /** Сколько человек сейчас смотрят на этот стол. */
  viewers: number
}

/**
 * Общий стол на всех участников встречи.
 *
 * Браузер открывает одно соединение к `/stream` и держит его. Сервер пишет в
 * него новое состояние каждый раз, когда кто-нибудь переворачивает карточку —
 * и React перерисовывает сетку. Своё собственное нажатие мы узнаём оттуда же,
 * откуда все остальные: так у всех гарантированно одна и та же картинка.
 */
export function useTable(film: Film) {
  const [table, setTable] = useState<Table | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTable(null)
    setError(null)

    const source = new EventSource(`/api/films/${encodeURIComponent(film.id)}/stream`)

    source.onmessage = (event) => {
      setConnected(true)
      setTable(JSON.parse(event.data) as Table)
    }

    // EventSource переподключается сам, так что это не «всё пропало», а
    // «связь моргнула» — показываем это, но ничего не предпринимаем.
    source.onerror = () => setConnected(false)

    return () => source.close()
  }, [film.id])

  const post = useCallback(
    async (action: 'flip' | 'reshuffle', body?: unknown) => {
      setError(null)
      try {
        const response = await fetch(`/api/films/${encodeURIComponent(film.id)}/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(savedPassword() ? { Authorization: `Bearer ${savedPassword()}` } : {}),
          },
          body: JSON.stringify(body ?? {}),
        })
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          setError(payload.error ?? 'Не получилось.')
        }
        // Обновление придёт потоком — здесь ответ намеренно не используем.
      } catch {
        setError('Нет связи с сервером.')
      }
    },
    [film.id],
  )

  return {
    table,
    connected,
    error,
    flip: useCallback((index: number) => post('flip', { index }), [post]),
    reshuffle: useCallback(() => post('reshuffle'), [post]),
  }
}
