'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';
import { 
  ShoppingBagIcon, 
  CreditCardIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon 
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  ordersByMarketplace: Record<string, number>;
  totalAmount: number;
  recentOrders: number;
}

interface Order {
  id: number;
  marketplace_order_id: string;
  marketplace: string;
  status: string;
  total_amount: number;
  customer_name: string;
  created_at: string;
}

export default function ClientDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, ordersResponse, balanceResponse] = await Promise.all([
        api.get('/client/stats'),
        api.get('/client/orders?limit=5'),
        api.get('/client/balance')
      ]);

      setStats(statsResponse.data);
      setRecentOrders(ordersResponse.data.orders);
      setBalance(balanceResponse.data.balance);
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
      <Layout requiredRole="client">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requiredRole="client">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
          <p className="mt-1 text-sm text-gray-600">
            Обзор ваших заказов и статистики
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
                  <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Общая сумма
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.totalAmount?.toLocaleString('ru-RU') || 0} ₽
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
                  <CreditCardIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Баланс депозита
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {balance.toLocaleString('ru-RU')} ₽
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
                  <ArrowTrendingUpIcon className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      За последние 30 дней
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.recentOrders || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{order.marketplace_order_id}
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
                          {new Date(order.created_at + 'Z').toLocaleDateString('ru-RU')}
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
                  У вас пока нет заказов. Настройте интеграцию с маркетплейсами.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

