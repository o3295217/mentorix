'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailNotVerified(false);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Проверяем, не подтверждён ли email
        if (data.emailNotVerified) {
          setEmailNotVerified(true);
          return;
        }
        setError(data.error || 'Ошибка входа');
        return;
      }

      // Успешный вход - редирект
      router.push(redirect);
      router.refresh();
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  // Показываем сообщение о неподтверждённом email
  if (emailNotVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6 text-center">
            <svg className="w-16 h-16 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-semibold text-yellow-200 mb-2">
              Email не подтверждён
            </h2>
            <p className="text-yellow-400 mb-4">
              Проверьте почту <strong>{email}</strong> и перейдите по ссылке для активации.
            </p>
            <div className="space-y-2">
              <Link
                href="/verify-email"
                className="block text-sm text-blue-400 hover:underline"
              >
                Отправить письмо повторно
              </Link>
              <button
                onClick={() => setEmailNotVerified(false)}
                className="text-sm text-gray-400 hover:underline"
              >
                Назад к входу
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link href="/" className="block text-center text-3xl font-bold text-white hover:text-blue-400 transition-colors">
            ← ION Assistant
          </Link>
          <h2 className="mt-6 text-center text-2xl font-semibold text-white">
            Вход в систему
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-700 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-gray-100"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <Link 
              href="/forgot-password" 
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              Забыли пароль?
            </Link>
            <Link 
              href="/register" 
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Зарегистрироваться
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
