import React, { useState } from 'react';
import { signUp } from '../lib/auth';
import { UserPlus } from 'lucide-react';

interface RegisterProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

export function Register({ onSuccess, onSwitchToLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const translateError = (error: string): string => {
    if (error.includes('User already registered')) return 'Пользователь с таким email уже существует';
    if (error.includes('Password should be at least')) return 'Пароль должен быть минимум 6 символов';
    if (error.includes('Invalid email')) return 'Неверный формат email';
    if (error.includes('violates row-level security')) return 'Ошибка безопасности. Обратитесь к администратору';
    if (error.includes('duplicate key value')) return 'Пользователь с таким email уже существует';
    return 'Ошибка регистрации. Попробуйте позже';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUp(email, password, fullName);
      setSuccess(true);
    } catch (err: any) {
      setError(translateError(err.message || 'Failed to register'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 rounded-lg shadow-xl p-8 border border-gray-800">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center">
                <UserPlus className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white text-center mb-4">
              Регистрация успешна
            </h2>

            <p className="text-gray-400 text-center mb-6">
              Ваш аккаунт создан и ожидает подтверждения администратора.
              Вы получите доступ после активации учётной записи.
            </p>

            <button
              onClick={onSwitchToLogin}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
            >
              Вернуться ко входу
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 rounded-lg shadow-xl p-8 border border-gray-800">
          <div className="flex items-center justify-center mb-8">
            <UserPlus className="w-12 h-12 text-cyan-500" />
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-2">
            Регистрация
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Создайте свой аккаунт RentMaster
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Полное имя
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email или логин
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
                disabled={loading}
                minLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                Минимум 6 символов
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Создание аккаунта...' : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToLogin}
              className="text-cyan-400 hover:text-cyan-300 text-sm"
            >
              Уже есть аккаунт? Войти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
