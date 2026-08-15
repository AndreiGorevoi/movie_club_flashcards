import { useState } from 'react'
import { saveFilm } from '../storage'
import type { Film } from '../types'

interface Props {
  film?: Film
  onDone: () => void
  onCancel: () => void
}

export default function FilmForm({ film, onDone, onCancel }: Props) {
  const [title, setTitle] = useState(film?.title ?? '')
  const [note, setNote] = useState(film?.note ?? '')
  const [text, setText] = useState(film?.questions.join('\n') ?? '')
  const [error, setError] = useState<string | null>(null)

  const questions = parseQuestions(text)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setError('У фильма должно быть название.')
    if (questions.length === 0) return setError('Нужен хотя бы один вопрос.')

    saveFilm({ id: film?.id, title: title.trim(), note: note.trim(), questions })
    onDone()
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <header className="hero hero--compact">
        <p className="hero__kicker">🎬 {film ? 'Правки' : 'Новый фильм'}</p>
        <h1 className="hero__title">{film ? film.title : 'Что смотрим?'}</h1>
      </header>

      <label className="field">
        <span className="field__label">Название</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Дюна: Часть вторая"
          autoFocus
        />
      </label>

      <label className="field">
        <span className="field__label">
          Подпись <span className="field__hint">необязательно</span>
        </span>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Вильнёв, 2024 · встреча 14 марта"
        />
      </label>

      <label className="field">
        <span className="field__label">
          Вопросы <span className="field__hint">по одному в строке</span>
        </span>
        <textarea
          className="input input--area"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={
            'Какая сцена осталась с вами дольше всего?\n' +
            'Кому вы сочувствовали, хотя не должны были?\n' +
            'О чём этот фильм, если убрать сюжет?'
          }
        />
        <span className="field__counter">
          Карточек на столе будет: <strong>{questions.length}</strong>
        </span>
      </label>

      {error && <p className="notice notice--error">{error}</p>}

      <div className="form__actions">
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="button button--primary">
          Сохранить
        </button>
      </div>
    </form>
  )
}

/** Пустые строки игнорируем — так удобно вставлять текст с отступами. */
function parseQuestions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}
