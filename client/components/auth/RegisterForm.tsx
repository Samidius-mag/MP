'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: 'client' | 'operator';
  phone?: string;
  companyName?: string;
}

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { register: registerUser } = useAuth();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>();

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    try {
      const { confirmPassword, ...registerData } = data;
      await registerUser(registerData);
      toast.success('Регистрация выполнена успешно');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="label">
              Имя *
            </label>
            <input
              {...register('firstName', {
                required: 'Имя обязательно'
              })}
              type="text"
              className={`input ${errors.firstName ? 'input-error' : ''}`}
              placeholder="Введите ваше имя"
              autoComplete="off"
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="label">
              Фамилия *
            </label>
            <input
              {...register('lastName', {
                required: 'Фамилия обязательна'
              })}
              type="text"
              className={`input ${errors.lastName ? 'input-error' : ''}`}
              placeholder="Введите вашу фамилию"
              autoComplete="off"
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">
            Email *
          </label>
          <input
            {...register('email', {
              required: 'Email обязателен',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Неверный формат email'
              }
            })}
            type="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="Введите ваш email"
            autoComplete="off"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="label">
            Телефон
          </label>
          <input
            {...register('phone', {
              pattern: {
                value: /^[\+]?[1-9][\d]{0,15}$/,
                message: 'Неверный формат телефона'
              }
            })}
            type="tel"
            className={`input ${errors.phone ? 'input-error' : ''}`}
            placeholder="+7 (999) 123-45-67"
            autoComplete="off"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="role" className="label">
            Роль *
          </label>
          <select
            {...register('role', {
              required: 'Выберите роль'
            })}
            className={`input ${errors.role ? 'input-error' : ''}`}
          >
            <option value="">Выберите роль</option>
            <option value="client">Клиент</option>
            <option value="operator">Оператор</option>
          </select>
          {errors.role && (
            <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="companyName" className="label">
            Название компании
          </label>
          <input
            {...register('companyName')}
            type="text"
            className="input"
            placeholder="Введите название компании"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Пароль *
          </label>
          <input
            {...register('password', {
              required: 'Пароль обязателен',
              minLength: {
                value: 6,
                message: 'Пароль должен содержать минимум 6 символов'
              }
            })}
            type="password"
            className={`input ${errors.password ? 'input-error' : ''}`}
            placeholder="Введите пароль"
            autoComplete="new-password"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">
            Подтверждение пароля *
          </label>
          <input
            {...register('confirmPassword', {
              required: 'Подтверждение пароля обязательно',
              validate: (value) => value === password || 'Пароли не совпадают'
            })}
            type="password"
            className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
            placeholder="Подтвердите пароль"
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
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
            href="/login"
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Уже есть аккаунт? Войти
          </Link>
        </div>
      </div>
    </div>
  );
}


