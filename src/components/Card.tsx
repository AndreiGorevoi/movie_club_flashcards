import { useLayoutEffect, useRef } from 'react'

interface Props {
  number: number
  question: string
  flipped: boolean
  onFlip: () => void
  onZoom: () => void
}

const MAX_SIZE = 20
const MIN_SIZE = 11

/**
 * Подгоняет шрифт под карточку: уменьшает, пока текст не перестанет вылезать.
 * Угадывать размер по длине строки нельзя — «Почему?» и вопрос на три
 * предложения требуют разного, а от ширины колонки зависит всё остальное.
 */
function useFitText(
  box: React.RefObject<HTMLElement | null>,
  text: React.RefObject<HTMLElement | null>,
  question: string,
) {
  useLayoutEffect(() => {
    const boxEl = box.current
    const textEl = text.current
    if (!boxEl || !textEl) return

    const fit = () => {
      let size = MAX_SIZE
      textEl.style.fontSize = `${size}px`

      while (
        size > MIN_SIZE &&
        (textEl.scrollHeight > boxEl.clientHeight || textEl.scrollWidth > boxEl.clientWidth)
      ) {
        size -= 1
        textEl.style.fontSize = `${size}px`
      }
    }

    fit()
    // Поворот планшета и смена числа колонок меняют ширину — пересчитываем.
    const observer = new ResizeObserver(fit)
    observer.observe(boxEl)
    return () => observer.disconnect()
  }, [box, text, question])
}

export default function Card({ number, question, flipped, onFlip, onZoom }: Props) {
  const box = useRef<HTMLSpanElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  useFitText(box, text, question)

  return (
    <button
      className={flipped ? 'card card--open' : 'card'}
      onClick={flipped ? onZoom : onFlip}
      aria-pressed={flipped}
      aria-label={flipped ? `${question} — открыть крупно` : `Карточка ${number}, закрыта`}
      style={{ '--tilt': `${tiltFor(number)}deg` } as React.CSSProperties}
    >
      <span className="card__inner">
        <span className="card__face card__face--back">
          <span className="card__number">{number}</span>
        </span>
        <span className="card__face card__face--front">
          <span className="card__question" ref={box}>
            <span className="card__text" ref={text}>
              {question}
            </span>
          </span>
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
