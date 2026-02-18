'use client'

import Link from 'next/link'

const features = [
  {
    icon: '🎯',
    title: 'Мечта на 5 лет',
    description: 'Формулируй глобальную цель и декомпозируй её на годовые, квартальные и недельные задачи',
  },
  {
    icon: '📝',
    title: 'Ежедневное планирование',
    description: 'Создавай план дня, отмечай выполненное и получай честную оценку от ИИ',
  },
  {
    icon: '🤖',
    title: 'ИИ-анализ',
    description: 'Искусственный интеллект оценивает твой день, даёт рекомендации и прогнозирует достижение цели',
  },
  {
    icon: '📊',
    title: 'Отслеживание прогресса',
    description: 'Наглядная статистика: серии продуктивных дней, средняя скорость движения к мечте',
  },
  {
    icon: '🔄',
    title: 'Умные привычки',
    description: 'Система сама предложит превратить повторяющиеся задачи в привычки',
  },
  {
    icon: '📈',
    title: 'Периодические оценки',
    description: 'Получай развёрнутый анализ недели, месяца, квартала и года от ИИ',
  },
]

export default function Landing() {
  return (
    // Используем negative margins чтобы выйти за пределы container из layout
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="text-6xl font-bold text-blue-500">
                <span className="text-blue-400">I</span>ON
              </div>
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
              Персональный ИИ-ассистент
              <span className="block text-blue-400 mt-2">для достижения твоей мечты</span>
            </h1>
            
            {/* Subheadline */}
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-300">
              Планируй день, отслеживай прогресс и получай умные рекомендации от ИИ. 
              Достигни цели за 5 лет с ежедневной поддержкой.
            </p>
            
            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/25"
              >
                Начать бесплатно
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 text-lg font-semibold text-gray-300 bg-gray-700/50 rounded-xl hover:bg-gray-700 transition-all border border-gray-600"
              >
                Уже есть аккаунт? Войти
              </Link>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full opacity-30 pointer-events-none">
          <div className="absolute top-20 left-0 w-72 h-72 bg-blue-500 rounded-full blur-[128px]" />
          <div className="absolute top-40 right-0 w-72 h-72 bg-purple-500 rounded-full blur-[128px]" />
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Всё для достижения целей
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Комплексный подход к личной эффективности
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-gray-800/50 border border-gray-700/50 hover:border-blue-500/50 transition-all"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-gray-800">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Как это работает
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: '1', title: 'Опиши мечту', desc: 'Кем ты хочешь стать через 5 лет?' },
            { step: '2', title: 'Планируй день', desc: 'Каждое утро создавай план задач' },
            { step: '3', title: 'Отмечай выполнение', desc: 'Вечером зафиксируй что сделал' },
            { step: '4', title: 'Получи оценку', desc: 'ИИ проанализирует и даст рекомендации' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
          Готов начать путь к мечте?
        </h2>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Присоединяйся и начни трансформацию уже сегодня. Бесплатно.
        </p>
        <Link
          href="/register"
          className="inline-block px-10 py-4 text-xl font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/25"
        >
          Создать аккаунт
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          © 2026 ION Assistant. Персональный ИИ-ассистент для достижения целей.
        </div>
      </footer>
    </div>
  )
}
