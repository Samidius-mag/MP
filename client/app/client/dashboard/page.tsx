'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';
import { 
  ShoppingBagIcon, 
  CreditCardIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CogIcon,
  TruckIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  ordersByMarketplace: Record<string, number>;
  totalAmount: number;
  recentOrders: number;
}

interface OrderItem {
  article: string;
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
  // Обогащённые поля WB
  subject?: string;
  brand?: string;
  nmId?: number;
  chrtId?: number;
  skus?: string[];
  orderUid?: string;
  rid?: string;
  assignmentId?: string;
  orderType?: string;
  supplierStatus?: string;
  wbStatus?: string;
  supplierStatusText?: string;
  wbStatusText?: string;
  priceFormatted?: string;
  totalPriceFormatted?: string;
}

interface Order {
  id: number;
  marketplace_order_id: string;
  marketplace: string;
  status: string;
  total_amount: number;
  customer_name: string;
  created_at: string;
  order_type?: string;
  supplierStatus?: string;
  wbStatus?: string;
  items: OrderItem[];
}

export default function ClientDashboard() {
  const router = useRouter();
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

  const getOrderTypeBadge = (orderType: string) => {
    const typeMap = {
      'FBS': { label: 'FBS', className: 'badge-primary', description: 'Fulfillment by Seller' },
      'DBW': { label: 'DBW', className: 'badge-success', description: 'Delivery by Wildberries' },
      'DBS': { label: 'DBS', className: 'badge-warning', description: 'Delivery by Seller' }
    };
    
    const typeInfo = typeMap[orderType as keyof typeof typeMap] || { label: orderType, className: 'badge-gray', description: '' };
    return (
      <span 
        className={`badge ${typeInfo.className}`}
        title={typeInfo.description}
      >
        {typeInfo.label}
      </span>
    );
  };

  const getOrdersByStatus = () => {
    if (!stats?.ordersByStatus) return { new: 0, in_assembly: 0, shipped: 0 };
    
    return {
      new: stats.ordersByStatus.new || 0,
      in_assembly: (stats.ordersByStatus.in_assembly || 0) + (stats.ordersByStatus.ready_to_ship || 0),
      shipped: (stats.ordersByStatus.shipped || 0) + (stats.ordersByStatus.delivered || 0)
    };
  };

  const goToOrdersWithStatus = (status: string) => {
    router.push(`/client/orders?status=${status}`);
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
                      За сегодня
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

        {/* Статусы заказов */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Статусы заказов</h3>
            <p className="mt-1 text-sm text-gray-600">
              Распределение заказов по текущему статусу
            </p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {/* Новые заказы */}
              <div 
                className="relative overflow-hidden rounded-lg bg-blue-50 px-4 py-5 shadow sm:px-6 sm:py-6 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => goToOrdersWithStatus('new')}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-blue-600 truncate">
                        Новые заказы
                      </dt>
                      <dd className="text-2xl font-bold text-blue-900">
                        {getOrdersByStatus().new}
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm text-blue-600">
                    Требуют обработки
                  </div>
                </div>
                <div className="absolute top-4 right-4">
                  <div className="text-xs text-blue-500 font-medium">
                    Нажмите для просмотра →
                  </div>
                </div>
              </div>

              {/* На сборке */}
              <div 
                className="relative overflow-hidden rounded-lg bg-yellow-50 px-4 py-5 shadow sm:px-6 sm:py-6 cursor-pointer hover:bg-yellow-100 transition-colors"
                onClick={() => goToOrdersWithStatus('in_assembly')}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CogIcon className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-yellow-600 truncate">
                        На сборке
                      </dt>
                      <dd className="text-2xl font-bold text-yellow-900">
                        {getOrdersByStatus().in_assembly}
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm text-yellow-600">
                    В процессе сборки
                  </div>
                </div>
                <div className="absolute top-4 right-4">
                  <div className="text-xs text-yellow-500 font-medium">
                    Нажмите для просмотра →
                  </div>
                </div>
              </div>

              {/* В доставке */}
              <div 
                className="relative overflow-hidden rounded-lg bg-green-50 px-4 py-5 shadow sm:px-6 sm:py-6 cursor-pointer hover:bg-green-100 transition-colors"
                onClick={() => goToOrdersWithStatus('shipped')}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TruckIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-green-600 truncate">
                        В доставке
                      </dt>
                      <dd className="text-2xl font-bold text-green-900">
                        {getOrdersByStatus().shipped}
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm text-green-600">
                    Отправлены или доставлены
                  </div>
                </div>
                <div className="absolute top-4 right-4">
                  <div className="text-xs text-green-500 font-medium">
                    Нажмите для просмотра →
                  </div>
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
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-lg font-medium text-gray-900">
                          #{order.marketplace_order_id}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {getMarketplaceLabel(order.marketplace)}
                        </span>
                        {order.order_type && getOrderTypeBadge(order.order_type)}
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>

                    {/* Товары заказа */}
                    {order.items && order.items.length > 0 && (
                      <div className="mt-3">
                        <div className="space-y-2">
                          {order.items.map((item, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 p-3 rounded-lg border"
                            >
                              {/* Основная информация о товаре */}
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-medium text-gray-900">{item.article}</span>
                                    {item.assignmentId && (
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        ID: {item.assignmentId}
                                      </span>
                                    )}
                                    {item.orderType && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        {item.orderType}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-700">
                                    <div className="font-medium">{item.name}</div>
                                    {item.subject && item.subject !== item.name && (
                                      <div className="text-gray-600">Категория: {item.subject}</div>
                                    )}
                                    {item.brand && (
                                      <div className="text-gray-600">Бренд: {item.brand}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm">
                                    <span className="text-gray-600">
                                      {item.quantity} шт. × {item.priceFormatted || item.price.toLocaleString('ru-RU')} ₽
                                    </span>
                                  </div>
                                  <div className="font-medium text-gray-900">
                                    = {item.totalPriceFormatted || item.totalPrice.toLocaleString('ru-RU')} ₽
                                  </div>
                                </div>
                              </div>

                              {/* Статусы сборочного задания */}
                              {(item.supplierStatus || item.wbStatus) && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <div className="text-xs space-y-1">
                                    {item.supplierStatus && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-gray-500">Статус сборки:</span>
                                        <span className={`px-2 py-1 rounded text-xs ${
                                          item.supplierStatus === 'new' ? 'bg-blue-100 text-blue-800' :
                                          item.supplierStatus === 'confirm' ? 'bg-yellow-100 text-yellow-800' :
                                          item.supplierStatus === 'complete' ? 'bg-green-100 text-green-800' :
                                          item.supplierStatus === 'cancel' ? 'bg-red-100 text-red-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {item.supplierStatusText || item.supplierStatus}
                                        </span>
                                      </div>
                                    )}
                                    {item.wbStatus && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-gray-500">Статус WB:</span>
                                        <span className={`px-2 py-1 rounded text-xs ${
                                          item.wbStatus === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                                          item.wbStatus === 'sorted' ? 'bg-blue-100 text-blue-800' :
                                          item.wbStatus === 'sold' ? 'bg-green-100 text-green-800' :
                                          item.wbStatus === 'ready_for_pickup' ? 'bg-green-100 text-green-800' :
                                          item.wbStatus.includes('cancel') ? 'bg-red-100 text-red-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {item.wbStatusText || item.wbStatus}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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

