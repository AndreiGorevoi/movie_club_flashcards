import { useState } from 'react'
import { signIn } from '../api'

interface Props {
  writesEnabled: boolean
  onSignedIn: () => Promise<void>
}

/**
 * Вход для ведущего. Гости ничего не вводят — они просто открывают карточки,
 * поэтому форма спрятана за неприметной ссылкой.
 */
export default function Unlock({ writesEnabled, onSignedIn }: Props) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!writesEnabled) {
    return (
      <p className="fineprint">
        Сервер запущен без пароля ведущего, поэтому список фильмов доступен только для чтения.
      </p>
    )
  }

  if (!open) {
    return (
      <footer className="footer">
        <button className="button button--quiet" onClick={() => setOpen(true)}>
          Я ведущий
        </button>
      </footer>
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(password)
      setPassword('')
      setOpen(false)
      await onSignedIn()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось войти.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="unlock" onSubmit={handleSubmit}>
      <input
        className="input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль ведущего"
        autoFocus
        autoComplete="current-password"
      />
      <button type="submit" className="button button--primary" disabled={busy || !password}>
        {busy ? '…' : 'Войти'}
      </button>
      <button type="button" className="button button--quiet" onClick={() => setOpen(false)}>
        Отмена
      </button>
      {error && <p className="notice notice--error unlock__error">{error}</p>}
    </form>
  )
}
