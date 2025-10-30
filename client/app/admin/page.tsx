'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';
import UsersManagement from '@/components/admin/UsersManagement';
import LogsViewer from '@/components/admin/LogsViewer';
import SystemSettings from '@/components/admin/SystemSettings';
import AdminProfileSettings from '@/components/admin/AdminProfileSettings';

type AdminTab = 'dashboard' | 'users' | 'logs' | 'settings' | 'profile';

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  const tabs = [
    { id: 'dashboard', name: 'Панель управления', icon: '📊' },
    { id: 'users', name: 'Пользователи', icon: '👥' },
    { id: 'logs', name: 'Логи', icon: '📋' },
    { id: 'settings', name: 'Настройки системы', icon: '⚙️' },
    { id: 'profile', name: 'Мой профиль', icon: '👤' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'users':
        return <UsersManagement />;
      case 'logs':
        return <LogsViewer />;
      case 'settings':
        return <SystemSettings />;
      case 'profile':
        return <AdminProfileSettings />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Панель администратора</h1>
              <p className="text-sm text-gray-500">Управление системой и пользователями</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Добро пожаловать, {user.firstName} {user.lastName}
              </span>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                На главную
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Выход
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-3 text-lg">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

