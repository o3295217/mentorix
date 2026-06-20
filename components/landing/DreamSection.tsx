export default function DreamSection() {
  return (
    <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div data-reveal className="landing-reveal">
            <span className="text-blue-400 font-semibold text-sm tracking-widest uppercase mb-3 block">
              Шаг первый
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
              Сначала — ваш
              <br />
              <span className="landing-gradient-text">контекст и цель</span>
            </h2>
            <p className="mt-6 text-lg text-gray-400 leading-relaxed">
              Сначала вы заполняете профиль, чтобы Наставник понял ваш ритм жизни,
              интересы и приоритеты. Это помогает строить не абстрактный,
              а реалистичный путь к цели.
            </p>
            <p className="mt-4 text-lg text-gray-400 leading-relaxed">
              Потом вы описываете мечту или цель и&nbsp;выбираете срок&nbsp;— Куратор
              раскладывает путь на&nbsp;годовые, квартальные, месячные и&nbsp;недельные
              шаги, чтобы каждый день опирался на&nbsp;ваш реальный контекст.
            </p>
          </div>

          {/* Visual: Куратор засасывает анкету → молния → Мечта загорается */}
          <div data-reveal className="landing-reveal landing-reveal-delay-1">
            <div className="relative">
              <div className="absolute -inset-5 rounded-[30px] bg-blue-500/8 blur-3xl" />
              <div className="relative rounded-2xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.42),rgba(15,23,42,0.18))] px-6 py-3 backdrop-blur-md sm:px-8 sm:py-4">

                <div className="relative">
                  {/* Orbit: теги вокруг сферы Куратора, засасываются к центру */}
                  <div className="relative w-full" style={{ height: '210px' }}>
                    {/* Теги на орбите */}
                    {[
                      { label: 'Профессия', cls: 'ion-tag-0' },
                      { label: 'Ценности', cls: 'ion-tag-1' },
                      { label: 'Интересы', cls: 'ion-tag-2' },
                      { label: 'Вызовы', cls: 'ion-tag-3' },
                      { label: 'Образ жизни', cls: 'ion-tag-4' },
                      { label: 'Образование', cls: 'ion-tag-5' },
                    ].map((tag) => (
                      <span
                        key={tag.label}
                        className={`absolute top-1/2 left-1/2 ion-tag ${tag.cls} rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap z-10`}
                      >
                        {tag.label}
                      </span>
                    ))}

                    {/* Сфера Куратора в центре орбиты */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                      <div className="ion-sphere-glow absolute -inset-8 rounded-full bg-blue-500/20 blur-2xl" />
                      <div className="ion-sphere relative flex h-14 w-14 items-center justify-center rounded-full border border-blue-400/40 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.5),rgba(59,130,246,0.15)_50%,rgba(15,23,42,0.9)_80%)] shadow-[0_0_32px_rgba(96,165,250,0.2)]">
                        <div className="absolute inset-1.5 rounded-full border border-white/10" />
                        <span className="text-[10px] font-bold tracking-[0.2em] text-blue-100">М</span>
                      </div>
                    </div>
                  </div>

                  {/* Молния — absolute от низа сферы до баров, не влияет на layout */}
                  <svg className="ion-lightning origin-top absolute z-10 pointer-events-none" style={{ top: '133px', left: '50%', marginLeft: '-16px' }} width="32" height="68" viewBox="0 0 32 68" fill="none">
                    <defs>
                      <filter id="lightning-glow" x="-100%" y="-20%" width="300%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur1" />
                        <feGaussianBlur stdDeviation="7" in="SourceGraphic" result="blur2" />
                        <feMerge>
                          <feMergeNode in="blur2" />
                          <feMergeNode in="blur1" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <path d="M16 0 L19 20 L9 25 L22 45 L16 68" stroke="rgba(96,165,250,0.25)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M16 0 L19 20 L9 25 L22 45 L16 68" stroke="rgba(147,197,253,0.45)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M16 0 L19 20 L9 25 L22 45 L16 68" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#lightning-glow)" />
                    <path d="M9 25 L3 32" stroke="rgba(200,220,255,0.5)" strokeWidth="1" strokeLinecap="round" fill="none" />
                    <path d="M22 45 L28 50" stroke="rgba(200,220,255,0.4)" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                  </svg>

                  {/* Иерархия целей */}
                  <div className="w-full mt-1 space-y-1.5">
                    {[
                      { level: 'Мечта', text: 'Запустить свой продукт', color: 'from-blue-500 to-blue-400', pct: 100, barCls: 'ion-bar-0', textCls: 'ion-goal-text-0' },
                      { level: 'Год', text: 'MVP + первые клиенты', color: 'from-blue-500/75 to-blue-400/75', pct: 85, barCls: 'ion-bar-1', textCls: 'ion-goal-text-1' },
                      { level: 'Квартал', text: 'Прототип и тесты', color: 'from-blue-500/55 to-blue-400/55', pct: 70, barCls: 'ion-bar-2', textCls: 'ion-goal-text-2' },
                      { level: 'Месяц', text: 'Исследование рынка', color: 'from-blue-500/35 to-blue-400/35', pct: 58, barCls: 'ion-bar-3', textCls: 'ion-goal-text-3' },
                      { level: 'Неделя', text: 'Описать идею и ЦА', color: 'from-blue-500/20 to-blue-400/20', pct: 48, barCls: 'ion-bar-4', textCls: 'ion-goal-text-4' },
                    ].map((item) => (
                      <div
                        key={item.level}
                        className={`h-9 rounded-lg bg-gradient-to-r ${item.color} flex items-center justify-between px-3 ${item.barCls}`}
                        style={{ width: `${item.pct}%` }}
                      >
                        <span className="text-white text-xs font-semibold whitespace-nowrap">{item.level}</span>
                        <span className={`${item.textCls} text-white/80 text-[11px] whitespace-nowrap ml-2`}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
