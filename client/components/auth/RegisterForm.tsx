'use client';

import React, { useState } from 'react';
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
  phone: string;
  inn: string;
  termsAccepted: boolean;
}

// Верификация email отключена — весь шаг убран

// Компонент подсказки
function HelpTooltip({ content }: { content: string }) {
  return (
    <div className="group relative inline-block">
      <span className="text-gray-400 hover:text-gray-600 cursor-help">?</span>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  );
}

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingCompany, setIsCheckingCompany] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const { register: registerUser, checkCompany } = useAuth();
  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm<RegisterFormData>();

  const password = watch('password');
  const inn = watch('inn');

  // Проверка компании по ИНН
  const handleCheckCompany = async (innValue: string) => {
    if (!innValue || innValue.length < 10) return;
    
    setIsCheckingCompany(true);
    try {
      const result = await checkCompany(innValue);
      setCompanyData(result.data);
      toast.success('Компания найдена и проверена');
    } catch (error: any) {
      // При ошибке создаем базовые данные
      setCompanyData({
        inn: innValue,
        name: `Компания с ИНН ${innValue}`,
        form: innValue.length === 10 ? 'IP' : 'OOO',
        ogrn: '',
        status: 'Не проверено в ФНС',
        reliability: {
          status: 'unknown',
          message: error.message || 'Ошибка проверки через ФНС'
        }
      });
      toast('Ошибка проверки ФНС, но регистрация возможна', {
        icon: '⚠️',
        style: {
          background: '#fef3c7',
          color: '#92400e',
          border: '1px solid #f59e0b'
        }
      });
    } finally {
      setIsCheckingCompany(false);
    }
  };

  // Проверяем компанию при изменении ИНН
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inn && inn.length >= 10) {
        handleCheckCompany(inn);
      }
    }, 1000); // Задержка 1 секунда после ввода

    return () => clearTimeout(timeoutId);
  }, [inn]);

  const onSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    // Если нет данных компании, создаем базовые
    if (!companyData) {
      setCompanyData({
        inn: data.inn,
        name: `Компания с ИНН ${data.inn}`,
        form: data.inn.length === 10 ? 'IP' : 'OOO',
        ogrn: '',
        status: 'Не проверено в ФНС',
        reliability: {
          status: 'unknown',
          message: 'Компания не проверена через ФНС'
        }
      });
    }

    setIsLoading(true);
    try {
      const result = await registerUser({
        ...data,
        companyData: companyData,
        termsAccepted: data.termsAccepted
      });
      // Регистрация теперь сразу авторизует пользователя
      toast.success('Регистрация выполнена успешно');
      window.location.href = '/client/dashboard';
    } catch (error: any) {
      toast.error(error.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  // Шаг подтверждения email удалён

  return (
    <div>
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="label flex items-center gap-2">
              Имя *
              <HelpTooltip content="Введите ваше имя" />
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
            <label htmlFor="lastName" className="label flex items-center gap-2">
              Фамилия *
              <HelpTooltip content="Введите вашу фамилию" />
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
          <label htmlFor="email" className="label flex items-center gap-2">
            Email *
            <HelpTooltip content="Ваш email для входа" />
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
          <label htmlFor="phone" className="label flex items-center gap-2">
            Телефон *
            <HelpTooltip content="Ваш контактный номер телефона" />
          </label>
          <input
            {...register('phone', {
              required: 'Телефон обязателен',
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
          <label htmlFor="inn" className="label flex items-center gap-2">
            ИНН компании *
            <HelpTooltip content="Введите ИНН вашей компании. Данные будут автоматически получены из базы ФНС" />
          </label>
          <div className="relative">
            <input
              {...register('inn', {
                required: 'ИНН обязателен',
                pattern: {
                  value: /^\d{10,12}$/,
                  message: 'ИНН должен содержать 10-12 цифр'
                }
              })}
              type="text"
              className={`input pr-10 ${errors.inn ? 'input-error' : ''}`}
              placeholder="1234567890"
              autoComplete="off"
            />
            {isCheckingCompany && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
          {errors.inn && (
            <p className="mt-1 text-sm text-red-600">{errors.inn.message}</p>
          )}
        </div>

        {/* Отображение данных компании */}
        {companyData && (
          <div className={`p-4 rounded-lg border ${
            companyData.status && !companyData.status.includes('Не проверено')
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={companyData.status && !companyData.status.includes('Не проверено') ? 'text-green-600' : 'text-yellow-600'}>
                {companyData.status && !companyData.status.includes('Не проверено') ? '✓' : '⚠'}
              </span>
              <h3 className={`font-medium ${
                companyData.status && !companyData.status.includes('Не проверено')
                  ? 'text-green-800'
                  : 'text-yellow-800'
              }`}>
                {companyData.status && !companyData.status.includes('Не проверено')
                  ? 'Компания найдена и проверена'
                  : 'Компания не проверена в ФНС'
                }
              </h3>
            </div>
            <div className={`text-sm space-y-1 ${
              companyData.status && !companyData.status.includes('Не проверено')
                ? 'text-green-700'
                : 'text-yellow-700'
            }`}>
              <p><strong>Название:</strong> {companyData.name}</p>
              <p><strong>Форма:</strong> {companyData.form === 'OOO' ? 'ООО' : 'ИП'}</p>
              <p><strong>ИНН:</strong> {companyData.inn}</p>
              <p><strong>ОГРН:</strong> {companyData.ogrn || 'Не указан'}</p>
              <p><strong>Статус:</strong> {companyData.status}</p>
              {companyData.reliability && (
                <p><strong>Надежность:</strong> {companyData.reliability.message}</p>
              )}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="password" className="label flex items-center gap-2">
            Пароль *
            <HelpTooltip content="Минимум 8 символов, 1 заглавная буква, 1 спецсимвол. Пример: HgyE#8" />
          </label>
          <input
            {...register('password', {
              required: 'Пароль обязателен',
              minLength: {
                value: 8,
                message: 'Пароль должен содержать минимум 8 символов'
              },
              pattern: {
                value: /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/,
                message: 'Пароль должен содержать минимум 8 символов, 1 заглавную букву и 1 спецсимвол'
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
          <label htmlFor="confirmPassword" className="label flex items-center gap-2">
            Подтверждение пароля *
            <HelpTooltip content="Повторите пароль для подтверждения" />
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

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              {...register('termsAccepted', {
                required: 'Необходимо согласие с офертой'
              })}
              type="checkbox"
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="termsAccepted" className="font-medium text-gray-700">
              Я согласен с{' '}
              <a href="/terms" className="text-blue-600 hover:text-blue-500 underline">
                условиями оферты
              </a>{' '}
              и{' '}
              <a href="/privacy" className="text-blue-600 hover:text-blue-500 underline">
                политикой конфиденциальности
              </a>
              *
            </label>
            {errors.termsAccepted && (
              <p className="mt-1 text-sm text-red-600">{errors.termsAccepted.message}</p>
            )}
          </div>
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


