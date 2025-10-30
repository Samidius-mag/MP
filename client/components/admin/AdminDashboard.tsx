'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface SystemStats {
  overview: {
    totalUsers: number;
    totalClients: number;
    totalOrders: number;
    totalRevenue: number;
  };
  usersByRole: Record<string, number>;
  ordersByMarketplace: Record<string, number>;
  ordersByStatus: Record<string, number>;
  recentOrders: Array<{
    date: string;
    count: number;
  }>;
  topClients: Array<{
    company_name: string;
    order_count: number;
    total_amount: number;
  }>;
}

interface LogsStats {
  serverLogs: Array<{
    level: string;
    count: number;
  }>;
  clientLogs: Array<{
    level: string;
    count: number;
  }>;
  topErrors: Array<{
    message: string;
    count: number;
  }>;
  activeUsers: Array<{
    email: string;
    first_name: string;
    last_name: string;
    log_count: number;
  }>;
}

export default function AdminDashboard() {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [logsStats, setLogsStats] = useState<LogsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, logsResponse] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/logs/stats')
      ]);
      
      setSystemStats(statsResponse.data);
      setLogsStats(logsResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Ошибка загрузки</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Обзор системы</h2>
        <p className="text-gray-600">Статистика и ключевые показатели</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <span className="text-white text-sm font-medium">👥</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Всего пользователей</p>
              <p className="text-2xl font-bold text-blue-900">
                {systemStats?.overview.totalUsers || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <span className="text-white text-sm font-medium">🏢</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600">Клиентов</p>
              <p className="text-2xl font-bold text-green-900">
                {systemStats?.overview.totalClients || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                <span className="text-white text-sm font-medium">📦</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-purple-600">Заказов</p>
              <p className="text-2xl font-bold text-purple-900">
                {systemStats?.overview.totalOrders || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                <span className="text-white text-sm font-medium">💰</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-yellow-600">Комиссия (1.5%)</p>
              <p className="text-2xl font-bold text-yellow-900">
                {systemStats?.overview.totalRevenue ? 
                  new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB'
                  }).format(systemStats.overview.totalRevenue) : '₽0'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Users by Role */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Пользователи по ролям</h3>
          <div className="space-y-3">
            {systemStats?.usersByRole && Object.entries(systemStats.usersByRole).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600 capitalize">
                  {role === 'client' ? 'Клиенты' : role === 'operator' ? 'Операторы' : 'Администраторы'}
                </span>
                <span className="text-sm font-bold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orders by Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Заказы по статусам</h3>
          <div className="space-y-3">
            {systemStats?.ordersByStatus && Object.entries(systemStats.ordersByStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600 capitalize">
                  {status === 'new' ? 'Новые' : 
                   status === 'in_assembly' ? 'В сборке' :
                   status === 'ready_to_ship' ? 'Готов к отправке' :
                   status === 'shipped' ? 'Отправлен' :
                   status === 'delivered' ? 'Доставлен' :
                   status === 'cancelled' ? 'Отменен' : status}
                </span>
                <span className="text-sm font-bold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Statistics */}
      {logsStats && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Статистика логов (24 часа)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-md font-medium text-gray-700 mb-3">Логи сервера</h4>
              <div className="space-y-2">
                {logsStats.serverLogs.map((log) => (
                  <div key={log.level} className="flex justify-between items-center">
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      log.level === 'error' ? 'bg-red-100 text-red-800' :
                      log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                      log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{log.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-md font-medium text-gray-700 mb-3">Логи клиента</h4>
              <div className="space-y-2">
                {logsStats.clientLogs.map((log) => (
                  <div key={log.level} className="flex justify-between items-center">
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      log.level === 'error' ? 'bg-red-100 text-red-800' :
                      log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                      log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{log.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

