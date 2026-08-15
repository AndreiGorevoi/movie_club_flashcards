import Card from './Card'
import { useTable } from '../useTable'
import type { Film } from '../types'

interface Props {
  film: Film
  canEdit: boolean
  onBack: () => void
  onEdit: () => void
}

export default function Session({ film, canEdit, onBack, onEdit }: Props) {
  const { table, connected, error, flip, reshuffle } = useTable(film)

  const opened = table?.flipped.length ?? 0
  const total = table?.order.length ?? film.questions.length
  const allOpen = table !== null && opened === total

  function handleReshuffle() {
    if (opened > 0 && !confirm('Перетасовать колоду и закрыть все карточки у всех?')) return
    void reshuffle()
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
          {canEdit && (
            <button className="button button--quiet" onClick={handleReshuffle}>
              Перетасовать
            </button>
          )}
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
          {table && <Viewers count={table.viewers} connected={connected} />}
        </p>
      </div>

      {error && <p className="notice notice--error">{error}</p>}

      {table === null ? (
        <p className="state__text">Раскладываем карточки…</p>
      ) : (
        <div className="table">
          {table.order.map((questionIndex, position) => (
            <Card
              key={questionIndex}
              number={position + 1}
              question={film.questions[questionIndex]}
              flipped={table.flipped.includes(questionIndex)}
              onFlip={() => void flip(questionIndex)}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** Сколько устройств за столом — чтобы было видно, все ли подключились. */
function Viewers({ count, connected }: { count: number; connected: boolean }) {
  if (!connected) {
    return <span className="viewers viewers--offline"> · связь потеряна, ждём…</span>
  }
  if (count <= 1) return null

  return (
    <span className="viewers">
      {' · '}
      <span className="viewers__dot" /> за столом: {count}
    </span>
  )
}
