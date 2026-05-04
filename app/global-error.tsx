'use client'

import { useEffect } from 'react'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global application error:', error)
  }, [error])

  return (
    <html lang="ru" className="dark">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-12 text-gray-100">
          <div className="w-full max-w-xl rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-center shadow-2xl shadow-red-950/10">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-300/80">Критический сбой</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">AION временно не загрузился</h1>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Перезапустите приложение. Если ошибка повторится, код события поможет найти причину в логах.
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
                onClick={() => { window.location.reload() }}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/20 hover:bg-white/5"
              >
                Перезагрузить
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
