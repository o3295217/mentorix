'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const slides = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в ION Assistant',
    subtitle: 'Ваш персональный помощник в достижении целей',
    content: (
      <div className="text-center space-y-6">
        <div className="text-8xl">🎯</div>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          ION поможет вам превратить большие цели в конкретные ежедневные действия
        </p>
      </div>
    ),
  },
  {
    id: 'pyramid',
    title: 'От цели к действию',
    subtitle: 'Принцип декомпозиции целей',
    content: (
      <div className="flex flex-col items-center space-y-2">
        {/* Пирамида целей */}
        <div className="relative w-full max-w-lg">
          {/* Уровень 1 - Цель */}
          <div className="flex justify-center mb-2">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-8 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
              <span className="text-xl">🎯</span>
              <span className="ml-2 font-semibold">Цель</span>
              <span className="ml-2 text-sm opacity-80">(долгосрочная)</span>
            </div>
          </div>
          
          {/* Стрелка */}
          <div className="flex justify-center text-gray-400 dark:text-gray-500 text-2xl">↓</div>
          
          {/* Уровень 2 - Год */}
          <div className="flex justify-center mb-2">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-10 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
              <span className="text-xl">📅</span>
              <span className="ml-2 font-semibold">Год</span>
            </div>
          </div>
          
          {/* Стрелка */}
          <div className="flex justify-center text-gray-400 dark:text-gray-500 text-2xl">↓</div>
          
          {/* Уровень 3 - Полугодие/Квартал */}
          <div className="flex justify-center gap-4 mb-2">
            <div className="bg-gradient-to-r from-teal-500 to-green-500 text-white px-6 py-2 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
              <span>📆</span>
              <span className="ml-2 font-medium">Полугодие</span>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-2 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
              <span>📆</span>
              <span className="ml-2 font-medium">Квартал</span>
            </div>
          </div>
          
          {/* Стрелка */}
          <div className="flex justify-center text-gray-400 dark:text-gray-500 text-2xl">↓</div>
          
          {/* Уровень 4 - Месяц */}
          <div className="flex justify-center mb-2">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-12 py-2 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
              <span>🗓️</span>
              <span className="ml-2 font-medium">Месяц</span>
            </div>
          </div>
          
          {/* Стрелка */}
          <div className="flex justify-center text-gray-400 dark:text-gray-500 text-2xl">↓</div>
          
          {/* Уровень 5 - Неделя */}
          <div className="flex justify-center mb-2">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-14 py-2 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
              <span>📋</span>
              <span className="ml-2 font-medium">Неделя</span>
            </div>
          </div>
          
          {/* Стрелка */}
          <div className="flex justify-center text-gray-400 dark:text-gray-500 text-2xl">↓</div>
          
          {/* Уровень 6 - День */}
          <div className="flex justify-center">
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-16 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
              <span className="text-xl">✅</span>
              <span className="ml-2 font-semibold">День</span>
              <span className="ml-2 text-sm opacity-80">— задачи</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'howItWorks',
    title: 'Как это работает',
    subtitle: 'Каждая мелкая задача связана с большой целью',
    content: (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-3xl">1️⃣</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Определите цель</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Запишите долгосрочную цель, которую хотите достичь
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-3xl">2️⃣</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Декомпозируйте</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Разбейте цель на периоды: год → полугодие → квартал → месяц → неделя
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-3xl">3️⃣</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Планируйте день</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Каждый день добавляйте задачи, приближающие к целям периода
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-3xl">4️⃣</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Отслеживайте прогресс</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Видьте связь каждого действия с большой целью
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'assistant',
    title: 'ION — ваш AI помощник',
    subtitle: 'Обсуждайте планы и получайте советы',
    content: (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="text-center text-6xl mb-4">🤖</div>
        
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-2xl rounded-tl-none max-w-xs">
              Какие задачи запланировать на сегодня?
            </div>
          </div>
          
          <div className="flex gap-3 justify-end">
            <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-2xl rounded-tr-none max-w-xs">
              Исходя из ваших целей на неделю, рекомендую сфокусироваться на...
            </div>
          </div>
        </div>
        
        <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
          ION анализирует ваши цели и помогает <br/>планировать эффективнее
        </p>
      </div>
    ),
  },
  {
    id: 'start',
    title: 'Готовы начать?',
    subtitle: 'Определите свою первую цель',
    content: (
      <div className="text-center space-y-6">
        <div className="text-8xl">🚀</div>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Начните с определения одной важной цели. <br/>
          Затем разбейте её на шаги к достижению.
        </p>
      </div>
    ),
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [completing, setCompleting] = useState(false);

  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  const handleNext = () => {
    if (isLastSlide) {
      completeOnboarding();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    setCompleting(true);
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        // Используем window.location для полной перезагрузки и обновления данных пользователя
        window.location.href = '/goals';
      } else {
        console.error('Failed to complete onboarding:', await res.text());
        router.push('/goals');
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      router.push('/goals');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Пропустить
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {slide.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{slide.subtitle}</p>
          </div>

          <div className="min-h-[400px] flex items-center justify-center">
            {slide.content}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Назад
          </button>

          {/* Dots */}
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  index === currentSlide
                    ? 'bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={completing}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {completing ? 'Загрузка...' : isLastSlide ? 'Начать →' : 'Далее →'}
          </button>
        </div>
      </div>
    </div>
  );
}
