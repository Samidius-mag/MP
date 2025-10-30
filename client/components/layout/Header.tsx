
'use client';

import { useAuth } from '@/lib/auth-context';
import { BellIcon, UserIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export default function Header() {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Array<any>>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const prevCountRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Используем относительный путь для совместимости с HTTPS
    const audioUrl = typeof window !== 'undefined' 
      ? '/alarm.mp3'  // В браузере используем относительный путь
      : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/alarm.mp3`; // На сервере абсолютный
    audioRef.current = new Audio(audioUrl);
    audioRef.current.preload = 'auto';
  }, []);

  const fetchUnread = async () => {
    try {
      const [countRes, listRes] = await Promise.all([
        api.get('/notification/unread-count'),
        api.get('/notification?unread_only=true&limit=10')
      ]);
      const newCount = countRes.data?.count ?? 0;
      setUnreadCount(newCount);
      setNotifications(listRes.data?.notifications || []);
      if (newCount > prevCountRef.current && prevCountRef.current !== 0) {
        // Новые уведомления — проигрываем звук
        try { await audioRef.current?.play(); } catch {}
      }
      prevCountRef.current = newCount;
    } catch (e) {
      // игнорируем тихо, чтобы не мешать основному UI
    }
  };

  useEffect(() => {
    if (isFetching) return;
    setIsFetching(true);
    fetchUnread().finally(() => setIsFetching(false));
    const id = setInterval(fetchUnread, 15000); // каждые 15 секунд
    return () => clearInterval(id);
  }, []);

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
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 px-1 min-w-[1.25rem] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                    Уведомления
                  </div>
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div key={n.id} className="px-4 py-2 text-sm text-gray-600 border-b last:border-b-0">
                        <div className="font-medium text-gray-800">{n.title}</div>
                        <div className="text-gray-600">{n.message}</div>
                        <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at || n.sent_at).toLocaleString('ru-RU')}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500">Нет новых уведомлений</div>
                  )}
                  <div className="px-4 py-2">
                    <button
                      onClick={async () => {
                        try {
                          await api.put('/notification/mark-all-read');
                          prevCountRef.current = 0;
                          fetchUnread();
                        } catch {}
                      }}
                      className="w-full text-sm text-primary-600 hover:text-primary-700"
                    >
                      Отметить все как прочитанные
                    </button>
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






