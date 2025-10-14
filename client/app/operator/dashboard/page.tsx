'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';
import { 
  ShoppingBagIcon, 
  UserGroupIcon,
  PrinterIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface OperatorStats {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  todayOrders: number;
  weekOrders: number;
  pendingOrders: number;
}

interface Order {
  id: number;
  marketplace_order_id: string;
  marketplace: string;
  status: string;
  total_amount: number;
  customer_name: string;
  company_name: string;
  created_at: string;
}

export default function OperatorDashboard() {
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, ordersResponse] = await Promise.all([
        api.get('/operator/stats'),
        api.get('/operator/orders?limit=10')
      ]);

      setStats(statsResponse.data);
      setRecentOrders(ordersResponse.data.orders);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'new': { label: 'Новый', className: 'badge-info' },
      'in_assembly': { label: 'В сборке', className: 'badge-warning' },
      'ready_to_ship': { label: 'Готов к отправке', className: 'badge-warning' },
      'shipped': { label: 'Отправлен', className: 'badge-success' },
      'delivered': { label: 'Доставлен', className: 'badge-success' },
      'cancelled': { label: 'Отменен', className: 'badge-danger' },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, className: 'badge-gray' };
    return <span className={`badge ${statusInfo.className}`}>{statusInfo.label}</span>;
  };

  const getMarketplaceLabel = (marketplace: string) => {
    const marketplaceMap = {
      'wildberries': 'Wildberries',
      'ozon': 'Ozon',
      'yandex_market': 'Яндекс.Маркет'
    };
    return marketplaceMap[marketplace as keyof typeof marketplaceMap] || marketplace;
  };

  if (loading) {
    return (
      <Layout requiredRole="operator">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requiredRole="operator">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд оператора</h1>
          <p className="mt-1 text-sm text-gray-600">
            Обзор заказов и статистики сборки
          </p>
        </div>

        {/* Статистические карточки */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ShoppingBagIcon className="h-8 w-8 text-primary-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Всего заказов
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.totalOrders || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-8 w-8 text-orange-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Требуют внимания
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.pendingOrders || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <PrinterIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      За сегодня
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.todayOrders || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserGroupIcon className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      За неделю
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.weekOrders || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика по статусам */}
        {stats?.ordersByStatus && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Заказы по статусам</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    <div className="text-sm text-gray-500">
                      {status === 'new' && 'Новые'}
                      {status === 'in_assembly' && 'В сборке'}
                      {status === 'ready_to_ship' && 'Готовы к отправке'}
                      {status === 'shipped' && 'Отправлены'}
                      {status === 'delivered' && 'Доставлены'}
                      {status === 'cancelled' && 'Отменены'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Последние заказы */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Последние заказы</h3>
          </div>
          <div className="card-body">
            {recentOrders.length > 0 ? (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Заказ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Клиент
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Маркетплейс
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Сумма
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{order.marketplace_order_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.company_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getMarketplaceLabel(order.marketplace)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.total_amount.toLocaleString('ru-RU')} ₽
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-primary-600 hover:text-primary-900">
                            Обработать
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6">
                <ShoppingBagIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Нет заказов</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Заказы появятся здесь после их создания клиентами.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}






