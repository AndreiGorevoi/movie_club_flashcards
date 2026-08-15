import { useEffect, useState } from 'react'
import Card from './Card'
import { clearTable, loadTable, saveTable } from '../storage'
import type { Table } from '../storage'
import type { Film } from '../types'

interface Props {
  film: Film
  canEdit: boolean
  onBack: () => void
  onEdit: () => void
}

export default function Session({ film, canEdit, onBack, onEdit }: Props) {
  const [table, setTable] = useState<Table>(() => startTable(film))

  // Переключились на другой фильм — берём его стол (или раскладываем новый).
  useEffect(() => setTable(startTable(film)), [film])

  useEffect(() => saveTable(film.id, table), [film.id, table])

  const opened = table.flipped.length
  const total = table.order.length
  const allOpen = opened === total

  function flip(questionIndex: number) {
    if (table.flipped.includes(questionIndex)) return
    setTable((prev) => ({ ...prev, flipped: [...prev.flipped, questionIndex] }))
  }

  function reshuffle() {
    if (opened > 0 && !confirm('Перетасовать колоду и закрыть все карточки?')) return
    clearTable(film.id)
    setTable({ order: shuffle(film.questions.length), flipped: [] })
  }

  return (
    <>
      <header className="session__head">
        <button className="button button--quiet" onClick={onBack}>
          ← Все фильмы
        </button>
        <div className="session__title">
          <h1>{film.title}</h1>
          {film.note && <p>{film.note}</p>}
        </div>
        <div className="session__tools">
          {canEdit && (
            <button className="button button--quiet" onClick={onEdit}>
              Вопросы
            </button>
          )}
          <button className="button button--quiet" onClick={reshuffle}>
            Перетасовать
          </button>
        </div>
      </header>

      <div className="progress">
        <div className="progress__track">
          <div
            className="progress__fill"
            style={{ width: total ? `${(opened / total) * 100}%` : '0%' }}
          />
        </div>
        <p className="progress__label">
          {allOpen ? 'Все карточки открыты 🎉' : `Открыто ${opened} из ${total}`}
        </p>
      </div>

      <div className="table">
        {table.order.map((questionIndex, position) => (
          <Card
            key={questionIndex}
            number={position + 1}
            question={film.questions[questionIndex]}
            flipped={table.flipped.includes(questionIndex)}
            onFlip={() => flip(questionIndex)}
          />
        ))}
      </div>
    </>
  )
}

function startTable(film: Film): Table {
  return loadTable(film.id, film.questions.length) ?? { order: shuffle(film.questions.length), flipped: [] }
}

/** Фишер — Йетс: колода тасуется заново на каждую встречу. */
function shuffle(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}
