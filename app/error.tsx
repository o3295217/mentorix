'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-center shadow-2xl shadow-red-950/10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-300/80">Сбой интерфейса</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Не удалось открыть этот экран</h1>
        <p className="mt-3 text-sm leading-6 text-gray-300">
          Мы сохранили приложение в рабочем состоянии. Повторите загрузку экрана или вернитесь позже, если ошибка повторится.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-gray-500">Код события: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-gray-200"
          >
            Повторить
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/' }}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/20 hover:bg-white/5"
          >
            На главную
          </button>
        </div>
      </div>
    </div>
  )
}
