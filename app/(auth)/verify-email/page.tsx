'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setVerifying(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Ошибка верификации');
        } else {
          setSuccess(true);
          setTimeout(() => {
            router.push('/onboarding');
          }, 2000);
        }
      } catch (err) {
        console.error('Verify email error:', err);
        setError('Ошибка соединения');
      } finally {
        setVerifying(false);
      }
    }

    verifyToken();
  }, [token, router]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResendSuccess(false);

    if (!email) {
      setError('Введите email');
      return;
    }

    setResending(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ошибка отправки');
      } else {
        setResendSuccess(true);
      }
    } catch (err) {
      console.error('Resend verification error:', err);
      setError('Ошибка соединения');
    } finally {
      setResending(false);
    }
  };

  // Показываем загрузку при верификации
  if (token && verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-400">Подтверждение email...</p>
        </div>
      </div>
    );
  }

  // Успешная верификация
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
            <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-xl font-semibold text-green-200 mb-2">
              Email подтверждён!
            </h2>
            <p className="text-green-400">
              Перенаправление...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Форма для повторной отправки (без токена или ошибка)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Подтверждение email
          </h2>
          {!token && (
            <p className="mt-2 text-center text-sm text-gray-400">
              Проверьте почту для активации аккаунта
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl relative">
            {error}
          </div>
        )}

        {resendSuccess && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded">
            Письмо отправлено! Проверьте почту.
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleResend}>
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
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-gray-100 bg-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
              placeholder="Введите email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={resending}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? 'Отправка...' : 'Отправить письмо повторно'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-blue-400 hover:text-blue-500"
          >
            Вернуться к входу
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
