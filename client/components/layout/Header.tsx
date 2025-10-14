'use client';

import { useAuth } from '@/lib/auth-context';
import { BellIcon, UserIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function Header() {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Добро пожаловать, {user?.firstName} {user?.lastName}
          </h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Уведомления */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
            >
              <BellIcon className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                3
              </span>
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                    Уведомления
                  </div>
                  <div className="px-4 py-2 text-sm text-gray-600">
                    Новый заказ #12345
                  </div>
                  <div className="px-4 py-2 text-sm text-gray-600">
                    Баланс пополнен на 10,000 ₽
                  </div>
                  <div className="px-4 py-2 text-sm text-gray-600">
                    Заказ #12344 готов к отправке
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Профиль пользователя */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div className="text-sm">
              <div className="font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-gray-500 capitalize">
                {user?.role === 'client' && 'Клиент'}
                {user?.role === 'operator' && 'Оператор'}
                {user?.role === 'admin' && 'Администратор'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}




