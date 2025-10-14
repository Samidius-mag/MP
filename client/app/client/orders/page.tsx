'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';
import { 
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Order {
  id: number;
  marketplace_order_id: string;
  marketplace: string;
  status: string;
  total_amount: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

interface OrderItem {
  article: string;
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    fetchOrders();
  }, [currentPage, statusFilter, marketplaceFilter, searchTerm]);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(statusFilter && { status: statusFilter }),
        ...(marketplaceFilter && { marketplace: marketplaceFilter }),
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await api.get(`/client/orders-history?${params}`);
      setOrders(response.data.orders);
      setTotalPages(response.data.pagination.totalPages);
      setTotalOrders(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const importOrders = async () => {
    setImporting(true);
    try {
      const response = await api.post('/client/import-orders');
      toast.success(response.data.message);
      // Обновляем список заказов после импорта
      await fetchOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка импорта заказов');
    } finally {
      setImporting(false);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchOrders();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setMarketplaceFilter('');
    setCurrentPage(1);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Заказы</h1>
            <p className="mt-1 text-sm text-gray-600">
              Управление заказами с маркетплейсов
              {totalOrders > 0 && (
                <span className="ml-2 text-primary-600 font-medium">
                  ({totalOrders} заказов)
                </span>
              )}
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={importOrders}
              disabled={importing}
              className="btn-primary flex items-center"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Импорт...
                </>
              ) : (
                <>
                  <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                  Импорт заказов
                </>
              )}
            </button>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="btn-secondary flex items-center"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Обновить
            </button>
          </div>
        </div>

        {/* Фильтры и поиск */}
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="label">Поиск</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input pl-10"
                      placeholder="Поиск по заказу или клиенту"
                    />
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="label">Статус</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input"
                  >
                    <option value="">Все статусы</option>
                    <option value="new">Новый</option>
                    <option value="in_assembly">В сборке</option>
                    <option value="ready_to_ship">Готов к отправке</option>
                    <option value="shipped">Отправлен</option>
                    <option value="delivered">Доставлен</option>
                    <option value="cancelled">Отменен</option>
                  </select>
                </div>

                <div>
                  <label className="label">Маркетплейс</label>
                  <select
                    value={marketplaceFilter}
                    onChange={(e) => setMarketplaceFilter(e.target.value)}
                    className="input"
                  >
                    <option value="">Все маркетплейсы</option>
                    <option value="wildberries">Wildberries</option>
                    <option value="ozon">Ozon</option>
                    <option value="yandex_market">Яндекс.Маркет</option>
                  </select>
                </div>

                <div className="flex items-end space-x-2">
                  <button type="submit" className="btn-primary">
                    <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                    Найти
                  </button>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="btn-secondary"
                  >
                    <FunnelIcon className="h-4 w-4 mr-2" />
                    Сбросить
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Список заказов */}
        <div className="card">
          <div className="card-body">
            {orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">
                          #{order.marketplace_order_id}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {getMarketplaceLabel(order.marketplace)}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {order.total_amount.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at + 'Z').toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Клиент:</span> {order.customer_name}
                        </p>
                        {order.customer_phone && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Телефон:</span> {order.customer_phone}
                          </p>
                        )}
                        {order.customer_email && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Email:</span> {order.customer_email}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Адрес доставки:</span>
                        </p>
                        <p className="text-sm text-gray-600">{order.delivery_address}</p>
                      </div>
                    </div>

                    {/* Товары заказа */}
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Товары:</h4>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded"
                          >
                            <div>
                              <span className="font-medium">{item.article}</span>
                              <span className="text-gray-500 ml-2">- {item.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-gray-600">
                                {item.quantity} шт. × {item.price.toLocaleString('ru-RU')} ₽
                              </span>
                              <span className="font-medium ml-2">
                                = {item.totalPrice.toLocaleString('ru-RU')} ₽
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <ShoppingBagIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Нет заказов</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Заказы появятся здесь после настройки API ключей и импорта с маркетплейсов.
                </p>
                <div className="mt-4">
                  <button
                    onClick={importOrders}
                    disabled={importing}
                    className="btn-primary"
                  >
                    {importing ? 'Импорт...' : 'Импортировать заказы'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Страница {currentPage} из {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Предыдущая
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Следующая
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}


