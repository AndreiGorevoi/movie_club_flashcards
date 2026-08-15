import { useCallback, useState } from 'react'
import FilmList from './components/FilmList'
import FilmForm from './components/FilmForm'
import Session from './components/Session'
import { loadFilms } from './storage'
import type { Film } from './types'

type Screen =
  | { name: 'films' }
  | { name: 'session'; filmId: string }
  | { name: 'edit'; filmId?: string }

export default function App() {
  const [films, setFilms] = useState<Film[]>(loadFilms)
  const [screen, setScreen] = useState<Screen>({ name: 'films' })

  const refresh = useCallback(() => setFilms(loadFilms()), [])

  const goToFilms = useCallback(() => {
    refresh()
    setScreen({ name: 'films' })
  }, [refresh])

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

  // Фильм мог исчезнуть (например, стёрли в соседней вкладке) — тогда просто
  // показываем список вместо того, чтобы падать.
  const openFilm = screen.name === 'session' ? films.find((f) => f.id === screen.filmId) : undefined

  if (openFilm) {
    return (
      <Shell wide>
        <Session
          film={openFilm}
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
        onOpen={(id) => setScreen({ name: 'session', filmId: id })}
        onAdd={() => setScreen({ name: 'edit' })}
        onEdit={(id) => setScreen({ name: 'edit', filmId: id })}
        onChanged={refresh}
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
