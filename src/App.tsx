import { useCallback, useEffect, useState } from 'react'
import FilmList from './components/FilmList'
import FilmForm from './components/FilmForm'
import Session from './components/Session'
import { fetchFilms, fetchSession, forgetPassword, savedPassword } from './api'
import type { SessionInfo } from './api'
import type { Film } from './types'

type Screen =
  | { name: 'films' }
  | { name: 'session'; filmId: string }
  | { name: 'edit'; filmId?: string }

export default function App() {
  const [films, setFilms] = useState<Film[] | null>(null)
  const [session, setSession] = useState<SessionInfo>({ writesEnabled: false, admin: false })
  const [error, setError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'films' })

  const load = useCallback(async () => {
    setError(null)
    try {
      const [info, list] = await Promise.all([fetchSession(), fetchFilms()])
      setSession(info)
      setFilms(list)
      // Пароль мог быть сменён в Railway — тогда сохранённый больше не работает.
      if (!info.admin && savedPassword()) forgetPassword()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить фильмы.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const goToFilms = useCallback(() => {
    setScreen({ name: 'films' })
    void load()
  }, [load])

  if (error) {
    return (
      <Shell>
        <div className="state">
          <p className="state__emoji">🎬</p>
          <h1 className="state__title">Сервер не отвечает</h1>
          <p className="state__text">{error}</p>
          <button className="button button--primary" onClick={() => void load()}>
            Попробовать снова
          </button>
        </div>
      </Shell>
    )
  }

  if (films === null) {
    return (
      <Shell>
        <div className="state">
          <p className="state__emoji state__emoji--pulse">🎬</p>
          <p className="state__text">Загружаем фильмы…</p>
        </div>
      </Shell>
    )
  }

  if (screen.name === 'edit') {
    return (
      <Shell>
        <FilmForm
          film={films.find((f) => f.id === screen.filmId)}
          onDone={goToFilms}
          onCancel={goToFilms}
        />
      </Shell>
    )
  }

  // Фильм мог исчезнуть, пока экран был открыт, — тогда просто показываем список.
  const openFilm = screen.name === 'session' ? films.find((f) => f.id === screen.filmId) : undefined

  if (openFilm) {
    return (
      <Shell wide>
        <Session
          film={openFilm}
          canEdit={session.admin}
          onBack={goToFilms}
          onEdit={() => setScreen({ name: 'edit', filmId: openFilm.id })}
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <FilmList
        films={films}
        session={session}
        onOpen={(id) => setScreen({ name: 'session', filmId: id })}
        onAdd={() => setScreen({ name: 'edit' })}
        onEdit={(id) => setScreen({ name: 'edit', filmId: id })}
        onChanged={load}
        onSignedIn={() => setSession((prev) => ({ ...prev, admin: true }))}
      />
    </Shell>
  )
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <div className="blob blob--one" aria-hidden />
      <div className="blob blob--two" aria-hidden />
      <main className={wide ? 'page page--wide' : 'page'}>{children}</main>
    </>
  )
}
