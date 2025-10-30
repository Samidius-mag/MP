'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface TwoFactorStepProps {
  userId: number;
  onComplete: (token: string) => void;
}

// Компонент для 2FA
function TwoFactorStep({ userId, onComplete }: TwoFactorStepProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { verifyTwoFactor } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }

    setIsLoading(true);
    try {
      const token = await verifyTwoFactor(userId, code);
      onComplete(token);
      toast.success('2FA подтвержден успешно');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка подтверждения 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Двухфакторная аутентификация</h2>
        <p className="mt-2 text-gray-600">
          Введите код из приложения аутентификатора
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="label">
            Код аутентификации
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="input text-center text-lg tracking-widest"
            maxLength={6}
            autoComplete="off"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || code.length !== 6}
          className="btn-primary w-full"
        >
          {isLoading ? 'Проверка...' : 'Подтвердить'}
        </button>
      </form>
    </div>
  );
}

// Компонент для смены пароля
interface PasswordChangeStepProps {
  userId: number;
  onComplete: () => void;
}

function PasswordChangeStep({ userId, onComplete }: PasswordChangeStepProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { forceChangePassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Пароль должен содержать минимум 8 символов');
      return;
    }

    setIsLoading(true);
    try {
      await forceChangePassword(userId, currentPassword, newPassword);
      toast.success('Пароль успешно изменен');
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка смены пароля');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Смена пароля</h2>
        <p className="mt-2 text-gray-600">
          Необходимо сменить пароль при первом входе
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="currentPassword" className="label">
            Текущий пароль
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
            placeholder="Введите текущий пароль"
            required
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="label">
            Новый пароль
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
            placeholder="Введите новый пароль"
            required
            minLength={8}
          />
          <p className="mt-1 text-xs text-gray-500">
            Минимум 8 символов, 1 заглавная буква, 1 спецсимвол
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">
            Подтверждение пароля
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="Подтвердите новый пароль"
            required
            minLength={8}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
          className="btn-primary w-full"
        >
          {isLoading ? 'Смена пароля...' : 'Сменить пароль'}
        </button>
      </form>
    </div>
  );
}

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'login' | '2fa' | 'password-change'>('login');
  const [twoFactorData, setTwoFactorData] = useState<{userId: number} | null>(null);
  const [passwordChangeData, setPasswordChangeData] = useState<{userId: number} | null>(null);
  const { login, verifyTwoFactor, forceChangePassword } = useAuth();
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await login(data.email, data.password);
      
      if (result.requiresTwoFactor) {
        setTwoFactorData({ userId: result.userId! });
        setStep('2fa');
      } else if (result.requiresPasswordChange) {
        setPasswordChangeData({ userId: result.userId! });
        setStep('password-change');
      } else {
        toast.success('Вход выполнен успешно');
      }
    } catch (error: any) {
      toast.error(error.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorComplete = async (token: string) => {
    // Токен уже сохранен в контексте аутентификации
    toast.success('Вход выполнен успешно');
    window.location.href = '/client/dashboard';
  };

  const handlePasswordChangeComplete = () => {
    toast.success('Пароль успешно изменен. Войдите в систему с новым паролем.');
    setStep('login');
    setPasswordChangeData(null);
  };

  if (step === '2fa' && twoFactorData) {
    return (
      <TwoFactorStep
        userId={twoFactorData.userId}
        onComplete={handleTwoFactorComplete}
      />
    );
  }

  if (step === 'password-change' && passwordChangeData) {
    return (
      <PasswordChangeStep
        userId={passwordChangeData.userId}
        onComplete={handlePasswordChangeComplete}
      />
    );
  }

  return (
    <div>
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="email" className="label">
            Email или телефон
          </label>
          <input
            {...register('email', {
              required: 'Email или телефон обязателен',
              pattern: {
                value: /^([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|[\+]?[1-9][\d]{0,15})$/i,
                message: 'Неверный формат email или телефона'
              }
            })}
            type="text"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="Введите email или телефон"
            autoComplete="off"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="label">
            Пароль
          </label>
          <input
            {...register('password', {
              required: 'Пароль обязателен'
            })}
            type="password"
            className={`input ${errors.password ? 'input-error' : ''}`}
            placeholder="Введите ваш пароль"
            autoComplete="current-password"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              {...register('rememberMe')}
              type="checkbox"
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
              Запомнить меня
            </label>
          </div>
          <div className="text-sm">
            <a href="/forgot-password" className="text-blue-600 hover:text-blue-500">
              Забыли пароль?
            </a>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Или</span>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/register"
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Создать аккаунт
          </Link>
        </div>
      </div>
    </div>
  );
}


