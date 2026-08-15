import type { Backup, Film } from './types'

/**
 * Единственное место, которое знает про сервер. Фильмы живут в SQLite на
 * Railway — они переживают закрытый браузер, чистку кэша и смену устройства.
 */

const PASSWORD_KEY = 'movie-club.password'

/** Пароль лежит в браузере, чтобы не вводить его каждую встречу. */
export function savedPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) ?? ''
}

export function rememberPassword(password: string): void {
  localStorage.setItem(PASSWORD_KEY, password)
}

export function forgetPassword(): void {
  localStorage.removeItem(PASSWORD_KEY)
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(savedPassword() ? { Authorization: `Bearer ${savedPassword()}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0)
  }

  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T
  if (!response.ok) {
    throw new ApiError(payload.error ?? 'Что-то пошло не так.', response.status)
  }
  return payload
}

export interface SessionInfo {
  /** false, если сервер поднят без ADMIN_PASSWORD — правки выключены совсем. */
  writesEnabled: boolean
  admin: boolean
}

export function fetchSession(): Promise<SessionInfo> {
  return request<SessionInfo>('/api/session')
}

/** Проверяет пароль на сервере и запоминает его только если он подошёл. */
export async function signIn(password: string): Promise<void> {
  await request('/api/session', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  rememberPassword(password)
}

export async function fetchFilms(): Promise<Film[]> {
  const { films } = await request<{ films: Film[] }>('/api/films')
  return films
}

export async function saveFilm(
  draft: Pick<Film, 'title' | 'note' | 'questions'> & { id?: string },
): Promise<Film> {
  const { film } = await request<{ film: Film }>('/api/films', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
  return film
}

export async function deleteFilm(id: string): Promise<void> {
  await request(`/api/films/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function importFilms(json: string): Promise<{ added: number; updated: number }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new ApiError('Файл не читается как JSON.', 400)
  }

  return request<{ added: number; updated: number }>('/api/films/import', {
    method: 'POST',
    body: JSON.stringify(parsed),
  })
}

export function buildBackup(films: Film[]): Backup {
  return { version: 1, exportedAt: new Date().toISOString(), films }
}
