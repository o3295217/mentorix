'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, inviteCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.error?.includes('приглашения')) {
          setShowInviteCode(true);
        }
        setError(data.error || 'Ошибка регистрации');
        return;
      }

      // Требуется верификация email
      if (data.requiresVerification) {
        setRequiresVerification(true);
        return;
      }

      // Успешная регистрация - редирект на главную
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Register error:', err);
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  // Показываем сообщение о необходимости верификации
  if (requiresVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 text-center">
            <svg className="w-16 h-16 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-blue-200 mb-2">
              Проверьте почту
            </h2>
            <p className="text-blue-400 mb-4">
              Мы отправили письмо на <strong>{email}</strong>. Перейдите по ссылке для активации аккаунта.
            </p>
            <Link
              href="/verify-email"
              className="text-sm text-blue-400 hover:underline"
            >
              Не получили письмо? Отправить повторно
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link href="/" className="flex justify-center hover:opacity-80 transition-opacity">
            <span className="inline-flex flex-col items-stretch">
              <span className="text-4xl sm:text-5xl font-black tracking-tight inline-flex">
                <span className="aion-letter-a">A</span>
                <span className="aion-letter-i">I</span>
                <span className="aion-letters-on">ON</span>
              </span>
              <span className="aion-subtitle text-xs uppercase font-medium mt-1 landing-gradient-text-subtle">
                {'ассистент'.split('').map((c, i) => <span key={i}>{c}</span>)}
              </span>
            </span>
          </Link>
          <h2 className="mt-6 text-center text-2xl font-semibold text-white">
            Регистрация
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                Имя (опционально)
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-700 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-gray-100"
                placeholder="Ваше имя"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-700 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-gray-100"
                placeholder="your@email.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-700 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-gray-100"
                placeholder="Минимум 8 символов"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                Подтвердите пароль
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-700 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-gray-100"
                placeholder="Повторите пароль"
              />
            </div>

            {showInviteCode && (
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-300">
                  Код приглашения
                </label>
                <input
                  id="inviteCode"
                  name="inviteCode"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-700 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-gray-100"
                  placeholder="Введите код приглашения"
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </div>

          <div className="text-center">
            <Link 
              href="/login" 
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Уже есть аккаунт? Войти
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
