import { useRef, useState } from 'react'
import { deleteFilm, exportBackup, importBackup } from '../storage'
import type { Film } from '../types'

interface Props {
  films: Film[]
  onOpen: (id: string) => void
  onAdd: () => void
  onEdit: (id: string) => void
  onChanged: () => void
}

export default function FilmList({ films, onOpen, onAdd, onEdit, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function handleDelete(film: Film) {
    if (!confirm(`Удалить «${film.title}» вместе с вопросами?`)) return
    deleteFilm(film.id)
    onChanged()
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], {
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
      const { added, updated } = importBackup(await file.text())
      setNotice(`Готово: добавлено ${added}, обновлено ${updated}.`)
      onChanged()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось прочитать файл.')
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
            <div className="film__tools">
              <button className="icon" title="Изменить" onClick={() => onEdit(film.id)}>
                ✎
              </button>
              <button className="icon" title="Удалить" onClick={() => handleDelete(film)}>
                ✕
              </button>
            </div>
          </article>
        ))}

        {films.length === 0 && (
          <p className="empty">
            Пока пусто. Добавьте фильм и вопросы, которые хотите обсудить.
          </p>
        )}
      </div>

      <button className="button button--primary button--block" onClick={onAdd}>
        + Добавить фильм
      </button>

      <footer className="footer">
        <button className="button button--quiet" onClick={handleExport}>
          Скачать копию
        </button>
        <button className="button button--quiet" onClick={() => fileInput.current?.click()}>
          Загрузить копию
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

      {notice && <p className="notice">{notice}</p>}

      <p className="fineprint">
        Фильмы хранятся в этом браузере. «Скачать копию» — чтобы перенести их на другое
        устройство или не потерять.
      </p>
    </>
  )
}

function plural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'вопрос'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'вопроса'
  return 'вопросов'
}
