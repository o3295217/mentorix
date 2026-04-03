'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-constants'

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setValidating(false);
        setError('Токен не указан');
        return;
      }

      try {
        const response = await fetch(`/api/auth/reset-password?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Недействительный токен');
          setTokenValid(false);
        } else {
          setTokenValid(true);
          setUserEmail(data.email);
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setError('Ошибка проверки токена');
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен быть не менее ${MIN_PASSWORD_LENGTH} символов`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ошибка сброса пароля');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-400">Проверка токена...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
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
              Ошибка
            </h2>
          </div>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <p className="text-red-300">
              {error || 'Ссылка недействительна или истекла'}
            </p>
          </div>

          <div className="text-center space-y-3">
            <Link 
              href="/forgot-password" 
              className="block text-sm text-blue-400 hover:text-blue-300"
            >
              Запросить новую ссылку
            </Link>
            <Link 
              href="/login" 
              className="block text-sm text-gray-400 hover:text-gray-300"
            >
              ← Вернуться к входу
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
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
              Пароль изменён
            </h2>
          </div>
          
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-300">
              Ваш пароль успешно изменён!
            </p>
            <p className="text-sm text-green-400 mt-2">
              Перенаправление на страницу входа...
            </p>
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
            Новый пароль
          </h2>
          {userEmail && (
            <p className="mt-2 text-center text-sm text-gray-400">
              для {userEmail}
            </p>
          )}
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Новый пароль
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
                placeholder="Минимум 6 символов"
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
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
