export interface Film {
  id: string
  title: string
  /** Свободная подпись под названием: год, режиссёр, дата встречи — что угодно. */
  note: string
  /** Порядок здесь — порядок ввода. Так же карточки ложатся на стол, пока ведущий не перетасует. */
  questions: string[]
  createdAt: number
}

/** Формат файла экспорта/импорта. `version` даёт запас на будущие миграции. */
export interface Backup {
  version: 1
  exportedAt: string
  films: Film[]
}
