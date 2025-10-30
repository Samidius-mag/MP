'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';
import { 
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  CloudArrowDownIcon,
  MagnifyingGlassCircleIcon,
  XMarkIcon
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
  order_type?: string; // FBS, DBW, DBS
  supplierStatus?: string; // Статус сборочного задания
  wbStatus?: string; // Статус системы Wildberries
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

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('new');
  const [marketplaceFilter, setMarketplaceFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [showHistorical, setShowHistorical] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkOrderId, setCheckOrderId] = useState('');
  const [checkingOrder, setCheckingOrder] = useState(false);
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);

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

      const path = showHistorical ? '/client/orders-history' : '/client/orders';
      const response = await api.get(`${path}?${params}`);
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
    // Функция удалена - импорт через исторические данные
  };

  const checkOrder = async () => {
    if (!checkOrderId.trim()) {
      toast.error('Введите номер заказа');
      return;
    }

    console.log('🔍 Начинаем проверку заказа:', checkOrderId.trim());
    setCheckingOrder(true);
    try {
      console.log('📡 Отправляем запрос на сервер...');
      const response = await api.get(`/client/orders/check/${checkOrderId.trim()}`);
      console.log('✅ Ответ сервера получен:', response.data);
      
      setOrderDetails(response.data);
      setShowCheckModal(false);
      toast.success('Информация о заказе получена');
    } catch (error: any) {
      console.error('❌ Ошибка при проверке заказа:', error);
      console.error('📄 Детали ошибки:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      toast.error(error.response?.data?.error || 'Заказ не найден');
      setOrderDetails(null);
    } finally {
      setCheckingOrder(false);
      console.log('🏁 Проверка заказа завершена');
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

  const getStatusDetails = (order: Order) => {
    if (!order.supplierStatus && !order.wbStatus) return null;
    
    const supplierStatusMap = {
      'new': 'Новое сборочное задание',
      'confirm': 'На сборке',
      'complete': 'В доставке',
      'cancel': 'Отменено продавцом'
    };
    
    const wbStatusMap = {
      'waiting': 'В работе',
      'sorted': 'Отсортировано',
      'sold': 'Получен покупателем',
      'canceled': 'Отменено',
      'canceled_by_client': 'Отменено покупателем при получении',
      'declined_by_client': 'Отменено покупателем',
      'defect': 'Отмена по причине брака',
      'ready_for_pickup': 'Прибыло на ПВЗ'
    };
    
    return (
      <div className="mt-2 text-xs text-gray-500">
        {order.supplierStatus && (
          <div>
            <span className="font-medium">Статус сборки:</span> {supplierStatusMap[order.supplierStatus as keyof typeof supplierStatusMap] || order.supplierStatus}
          </div>
        )}
        {order.wbStatus && (
          <div>
            <span className="font-medium">Статус WB:</span> {wbStatusMap[order.wbStatus as keyof typeof wbStatusMap] || order.wbStatus}
          </div>
        )}
      </div>
    );
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
              onClick={() => setShowCheckModal(true)}
              className="btn-secondary flex items-center"
            >
              <MagnifyingGlassCircleIcon className="h-4 w-4 mr-2" />
              Проверить заказ
            </button>
            <button
              onClick={() => { 
                setShowHistorical(prev => !prev); 
                setCurrentPage(1); 
                setStatusFilter(showHistorical ? 'new' : '');
                setLoading(true); 
              }}
              className="btn-primary"
            >
              {showHistorical ? 'Только новые' : 'Исторические данные'}
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
                        {order.order_type && getOrderTypeBadge(order.order_type)}
                        {getStatusBadge(order.status)}
                      </div>
                      {getStatusDetails(order)}
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('ru-RU')}
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
                      <div className="space-y-3">
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

                            {/* Технические идентификаторы WB */}
                            {(item.nmId || item.chrtId || item.orderUid || item.rid) && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs text-gray-500 space-y-1">
                                  {item.nmId && <div>nmId: {item.nmId}</div>}
                                  {item.chrtId && <div>chrtId: {item.chrtId}</div>}
                                  {item.orderUid && <div>orderUid: {item.orderUid}</div>}
                                  {item.rid && <div>rid: {item.rid}</div>}
                                  {item.skus && item.skus.length > 0 && (
                                    <div>SKU: {item.skus.join(', ')}</div>
                                  )}
                                </div>
                              </div>
                            )}

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
                <div className="mt-4" />
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

        {/* Модальное окно проверки заказа */}
        {showCheckModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Проверить заказ</h3>
                <button
                  onClick={() => setShowCheckModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Номер заказа</label>
                  <input
                    type="text"
                    value={checkOrderId}
                    onChange={(e) => setCheckOrderId(e.target.value)}
                    className="input w-full"
                    placeholder="Введите номер заказа"
                    onKeyPress={(e) => e.key === 'Enter' && checkOrder()}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={checkOrder}
                    disabled={checkingOrder}
                    className="btn-primary flex-1"
                  >
                    {checkingOrder ? 'Поиск...' : 'Найти заказ'}
                  </button>
                  <button
                    onClick={() => setShowCheckModal(false)}
                    className="btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Детали найденного заказа */}
        {orderDetails && (
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Детали заказа #{orderDetails.marketplace_order_id}</h3>
                <button
                  onClick={() => setOrderDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Маркетплейс:</span> {getMarketplaceLabel(orderDetails.marketplace)}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Статус:</span> {getStatusBadge(orderDetails.status)}
                    </p>
                    {orderDetails.order_type && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Тип заказа:</span> {getOrderTypeBadge(orderDetails.order_type)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Сумма:</span> {orderDetails.total_amount.toLocaleString('ru-RU')} ₽
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Дата создания:</span> {new Date(orderDetails.created_at).toLocaleDateString('ru-RU')}
                    </p>
                    {orderDetails.updated_at !== orderDetails.created_at && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Обновлен:</span> {new Date(orderDetails.updated_at).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Клиент:</span> {orderDetails.customer_name}
                  </p>
                  {orderDetails.customer_phone && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Телефон:</span> {orderDetails.customer_phone}
                    </p>
                  )}
                  {orderDetails.customer_email && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Email:</span> {orderDetails.customer_email}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Адрес доставки:</span>
                  </p>
                  <p className="text-sm text-gray-600">{orderDetails.delivery_address}</p>
                </div>

                {orderDetails.supplierStatus && orderDetails.wbStatus && (
                  <div>
                    {getStatusDetails(orderDetails)}
                  </div>
                )}

                {orderDetails.items && orderDetails.items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Товары:</h4>
                    <div className="space-y-2">
                      {orderDetails.items.map((item, index) => (
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}



