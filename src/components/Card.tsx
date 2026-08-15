interface Props {
  number: number
  question: string
  flipped: boolean
  onFlip: () => void
}

export default function Card({ number, question, flipped, onFlip }: Props) {
  return (
    <button
      className={flipped ? 'card card--open' : 'card'}
      onClick={onFlip}
      aria-pressed={flipped}
      aria-label={flipped ? question : `Карточка ${number}, закрыта`}
      style={{ '--tilt': `${tiltFor(number)}deg` } as React.CSSProperties}
    >
      <span className="card__inner">
        <span className="card__face card__face--back">
          <span className="card__number">{number}</span>
        </span>
        <span className="card__face card__face--front">
          <span className={`card__question card__question--${sizeFor(question)}`}>{question}</span>
          <span className="card__corner">{number}</span>
        </span>
      </span>
    </button>
  )
}

/** Лёгкий разнобой наклона, чтобы стол не выглядел как таблица в экселе. */
function tiltFor(number: number): number {
  const steps = [-1.6, 0.9, -0.5, 1.4, -1.1, 0.4]
  return steps[number % steps.length]
}

function sizeFor(question: string): 'short' | 'medium' | 'long' {
  if (question.length <= 60) return 'short'
  if (question.length <= 130) return 'medium'
  return 'long'
}
