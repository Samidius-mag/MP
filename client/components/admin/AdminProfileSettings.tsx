'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function AdminProfileSettings() {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!profileData.firstName.trim()) {
      toast.error('Имя обязательно для заполнения');
      return false;
    }
    if (!profileData.lastName.trim()) {
      toast.error('Фамилия обязательна для заполнения');
      return false;
    }
    if (!profileData.email.trim()) {
      toast.error('Email обязателен для заполнения');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      toast.error('Неверный формат email');
      return false;
    }
    if (profileData.phone.trim() && !/^[\+]?[1-9][\d]{0,15}$/.test(profileData.phone.trim())) {
      toast.error('Неверный формат телефона');
      return false;
    }
    return true;
  };

  const saveProfile = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Подготавливаем данные для отправки, убирая пустые строки
      const dataToSave = {
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        email: profileData.email.trim(),
        ...(profileData.phone.trim() && { phone: profileData.phone.trim() })
      };
      
      await updateProfile(dataToSave);
      toast.success('Профиль успешно обновлен');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка обновления профиля');
    } finally {
      setSaving(false);
    }
  };

  const resetProfile = () => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  };

  const hasChanges = () => {
    if (!user) return false;
    return (
      profileData.firstName.trim() !== (user.firstName || '') ||
      profileData.lastName.trim() !== (user.lastName || '') ||
      profileData.email.trim() !== (user.email || '') ||
      profileData.phone.trim() !== (user.phone || '')
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Настройки профиля</h2>
        <p className="text-gray-600">Управление личными данными администратора</p>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-3">
          <button
            onClick={saveProfile}
            disabled={saving || !hasChanges()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          
          <button
            onClick={resetProfile}
            disabled={!hasChanges()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Сбросить
          </button>
        </div>

        {hasChanges() && (
          <div className="text-sm text-orange-600 font-medium">
            Есть несохраненные изменения
          </div>
        )}
      </div>

      {/* Profile Form */}
      <div className="max-w-2xl space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Личная информация</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Имя *
              </label>
              <input
                type="text"
                value={profileData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите имя"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Фамилия *
              </label>
              <input
                type="text"
                value={profileData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите фамилию"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Контактная информация</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите email"
              />
              <p className="mt-1 text-sm text-gray-500">
                Email используется для входа в систему
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Телефон
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+7 (999) 123-45-67"
              />
              <p className="mt-1 text-sm text-gray-500">
                Необязательное поле
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Важная информация
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Изменение email потребует повторной авторизации</li>
                  <li>Все поля, отмеченные *, обязательны для заполнения</li>
                  <li>Телефон используется для уведомлений и восстановления доступа</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
