'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ошибка отправки');
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <Link href="/" className="flex justify-center hover:opacity-80 transition-opacity">
              <span className="inline-flex flex-col items-stretch">
                <span className="text-4xl sm:text-5xl font-black tracking-tight landing-gradient-text">
                  mentorix
                </span>
                <span className="aion-subtitle text-xs uppercase font-medium mt-1 landing-gradient-text-subtle">
                  {'ассистент'.split('').map((c, i) => <span key={i}>{c}</span>)}
                </span>
              </span>
            </Link>
            <h2 className="mt-6 text-center text-2xl font-semibold text-white">
              Проверьте почту
            </h2>
          </div>
          
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-green-300">
              Если аккаунт с адресом <strong>{email}</strong> существует, на него отправлена ссылка для сброса пароля.
            </p>
            <p className="text-sm text-green-400 mt-2">
              Ссылка действительна 1 час.
            </p>
          </div>

          <div className="text-center">
            <Link 
              href="/login" 
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              ← Вернуться к входу
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
              <span className="text-4xl sm:text-5xl font-black tracking-tight landing-gradient-text">
                mentorix
              </span>
              <span className="aion-subtitle text-xs uppercase font-medium mt-1 landing-gradient-text-subtle">
                {'ассистент'.split('').map((c, i) => <span key={i}>{c}</span>)}
              </span>
            </span>
          </Link>
          <h2 className="mt-6 text-center text-2xl font-semibold text-white">
            Восстановление пароля
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Введите email, указанный при регистрации
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          
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
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Отправка...' : 'Отправить ссылку'}
            </button>
          </div>

          <div className="text-center">
            <Link 
              href="/login" 
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              ← Вернуться к входу
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
