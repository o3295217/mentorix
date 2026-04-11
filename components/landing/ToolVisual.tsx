import { TOOL_CARDS } from './data'

export default function ToolVisual({ visual, accent }: { visual: (typeof TOOL_CARDS)[number]['visual']; accent: (typeof TOOL_CARDS)[number]['accent'] }) {
  const lineClass =
    accent === 'purple'
      ? 'from-purple-400 to-fuchsia-300'
      : accent === 'orange'
      ? 'from-orange-400 to-amber-300'
      : accent === 'cyan'
      ? 'from-cyan-400 to-sky-300'
      : 'from-blue-400 to-indigo-300'

  if (visual === 'forecast') {
    return (
      <div className="relative h-20 overflow-hidden">
        <div className="absolute inset-x-4 bottom-4 h-px bg-slate-800" />
        <div className="absolute inset-x-4 top-4 h-px bg-slate-900/60" />
        <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-900/60" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 220 80" fill="none">
          <path d="M18 58 C52 56, 70 50, 100 44 S150 28, 202 18" stroke="url(#forecastGlow)" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
          <path d="M18 58 C52 56, 70 50, 100 44 S150 28, 202 18" fill="url(#forecastArea)" opacity="0.28" />
          <path d="M18 58 C52 56, 70 50, 100 44 S150 28, 202 18" className="stroke-[3] drop-shadow-[0_0_8px_rgba(255,255,255,0.12)]" stroke="url(#forecastGradient)" strokeLinecap="round" />
          <circle cx="18" cy="58" r="3.5" fill="#cbd5e1" opacity="0.65" />
          <circle cx="202" cy="18" r="5" fill="white" />
          <defs>
            <linearGradient id="forecastGradient" x1="18" y1="58" x2="202" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor={accent === 'purple' ? '#a78bfa' : '#60a5fa'} />
              <stop offset="1" stopColor={accent === 'purple' ? '#f0abfc' : '#93c5fd'} />
            </linearGradient>
            <linearGradient id="forecastGlow" x1="18" y1="58" x2="202" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor={accent === 'purple' ? '#7c3aed' : '#2563eb'} />
              <stop offset="1" stopColor={accent === 'purple' ? '#e879f9' : '#7dd3fc'} />
            </linearGradient>
            <linearGradient id="forecastArea" x1="110" y1="18" x2="110" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={accent === 'purple' ? '#c084fc' : '#93c5fd'} stopOpacity="0.22" />
              <stop offset="1" stopColor={accent === 'purple' ? '#c084fc' : '#93c5fd'} stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute left-4 bottom-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">Сейчас</div>
        <div className="absolute right-4 top-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">Цель</div>
      </div>
    )
  }

  if (visual === 'speed') {
    return (
      <div className="relative h-20 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 260 110" fill="none">
          <path
            d="M54 82 A76 76 0 0 1 206 82"
            stroke="#243247"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M54 82 A76 76 0 0 1 206 82"
            stroke="url(#speedGradient)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M130 82 L172 44"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <circle cx="130" cy="82" r="4.5" fill="#f8fafc" />
          <circle cx="130" cy="82" r="8" fill="rgba(255,255,255,0.08)" />
          <defs>
            <linearGradient id="speedGradient" x1="54" y1="82" x2="206" y2="82" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fb7185" />
              <stop offset="0.52" stopColor="#fcd34d" />
              <stop offset="1" stopColor="#4ade80" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (visual === 'retro') {
    return (
      <div className="grid h-20 grid-cols-4 gap-2 py-1">
        {['Нед', 'Мес', 'Кв', 'Год'].map((label, index) => (
          <div
            key={label}
            className={`flex flex-col items-center justify-center rounded-xl border text-[10px] font-semibold uppercase tracking-[0.14em] ${
              index === 0
                ? 'border-orange-400/35 bg-orange-500/10 text-orange-200'
                : index === 1
                ? 'border-orange-300/20 bg-orange-500/5 text-orange-100/80'
                : 'border-slate-800 bg-slate-900/70 text-slate-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-20 items-end gap-2 px-1 pb-1">
      {[28, 46, 22, 60, 38, 72].map((height, index) => (
        <div key={height} className="flex h-full flex-1 items-end rounded-t-lg bg-slate-800 overflow-hidden">
          <div
            className={`w-full rounded-t-lg bg-gradient-to-t ${lineClass}`}
            style={{ height: `${height}%`, opacity: index >= 4 ? 1 : 0.75 }}
          />
        </div>
      ))}
    </div>
  )
}
