import { useRef, useState } from 'react'
import Unlock from './Unlock'
import { buildBackup, deleteFilm, forgetPassword, importFilms } from '../api'
import type { SessionInfo } from '../api'
import type { Film } from '../types'

interface Props {
  films: Film[]
  session: SessionInfo
  onOpen: (id: string) => void
  onAdd: () => void
  onEdit: (id: string) => void
  onChanged: () => Promise<void>
  onSignedIn: () => void
}

export default function FilmList({
  films,
  session,
  onOpen,
  onAdd,
  onEdit,
  onChanged,
  onSignedIn,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  async function handleDelete(film: Film) {
    if (!confirm(`Удалить «${film.title}» вместе с вопросами?`)) return
    try {
      await deleteFilm(film.id)
      await onChanged()
    } catch (cause) {
      setNotice({ text: message(cause), error: true })
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(buildBackup(films), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `киноклуб-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    try {
      const { added, updated } = await importFilms(await file.text())
      setNotice({ text: `Готово: добавлено ${added}, обновлено ${updated}.` })
      await onChanged()
    } catch (cause) {
      setNotice({ text: message(cause), error: true })
    }
  }

  return (
    <>
      <header className="hero">
        <p className="hero__kicker">🎬 Киноклуб</p>
        <h1 className="hero__title">Карточки для разговора</h1>
        <p className="hero__lead">
          Выбираете фильм, на столе появляются закрытые карточки. Переворачиваете по очереди —
          и обсуждаете. Правильных ответов нет.
        </p>
      </header>

      <div className="stack">
        {films.map((film) => (
          <article key={film.id} className="film">
            <button className="film__main" onClick={() => onOpen(film.id)}>
              <span className="film__title">{film.title}</span>
              {film.note && <span className="film__note">{film.note}</span>}
              <span className="film__count">
                {film.questions.length} {plural(film.questions.length)}
              </span>
            </button>
            {session.admin && (
              <div className="film__tools">
                <button className="icon" title="Изменить" onClick={() => onEdit(film.id)}>
                  ✎
                </button>
                <button className="icon" title="Удалить" onClick={() => void handleDelete(film)}>
                  ✕
                </button>
              </div>
            )}
          </article>
        ))}

        {films.length === 0 && (
          <p className="empty">
            {session.admin
              ? 'Пока пусто. Добавьте фильм и вопросы, которые хотите обсудить.'
              : 'Здесь пока нет фильмов. Ведущий добавит их к встрече.'}
          </p>
        )}
      </div>

      {session.admin && (
        <button className="button button--primary button--block" onClick={onAdd}>
          + Добавить фильм
        </button>
      )}

      {session.admin ? (
        <footer className="footer">
          <button className="button button--quiet" onClick={handleExport}>
            Скачать копию
          </button>
          <button className="button button--quiet" onClick={() => fileInput.current?.click()}>
            Загрузить копию
          </button>
          <button
            className="button button--quiet"
            onClick={() => {
              forgetPassword()
              void onChanged()
            }}
          >
            Выйти
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
              event.target.value = ''
            }}
          />
        </footer>
      ) : (
        <Unlock
          writesEnabled={session.writesEnabled}
          onSignedIn={async () => {
            onSignedIn()
            await onChanged()
          }}
        />
      )}

      {notice && (
        <p className={notice.error ? 'notice notice--error' : 'notice'}>{notice.text}</p>
      )}

      <p className="fineprint">
        Фильмы хранятся на сервере — они на месте с любого устройства и после закрытого
        браузера. Забывается только то, какие карточки вы успели перевернуть.
      </p>
    </>
  )
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Что-то пошло не так.'
}

function plural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'вопрос'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'вопроса'
  return 'вопросов'
}
