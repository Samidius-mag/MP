'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';

interface WarehouseItem {
  id: number;
  name: string;
  barcode: string | null;
  purchase_price: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function WarehousePage() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    barcode: '',
    purchase_price: 0,
    stock: 0
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/warehouse', {
        params: { search: searchTerm }
      });
      setItems(response.data.items || []);
    } catch (error) {
      console.error('Error fetching warehouse items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/warehouse', newItem);
      setItems([response.data.item, ...items]);
      setNewItem({ name: '', barcode: '', purchase_price: 0, stock: 0 });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Ошибка при добавлении товара');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Layout requiredRole="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Склад</h1>
            <p className="mt-1 text-sm text-gray-600">
              Управление товарами на складе
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Добавить товар
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Поиск по названию или штрих-коду..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Найти
          </button>
        </form>

        {/* Add Item Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Добавить товар</h3>
                <form onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Наименование *
                    </label>
                    <input
                      type="text"
                      required
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Штрих-код
                    </label>
                    <input
                      type="text"
                      value={newItem.barcode}
                      onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Цена закупа *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={newItem.purchase_price}
                      onChange={(e) => setNewItem({ ...newItem, purchase_price: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Остаток
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newItem.stock}
                      onChange={(e) => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Добавить
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Загрузка...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">
              <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Нет товаров</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'По вашему запросу ничего не найдено' : 'Начните с добавления товара на склад'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {items.map((item) => (
                <li key={item.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center space-x-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.stock > 0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            Остаток: {item.stock}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                        {item.barcode && (
                          <span>ШК: {item.barcode}</span>
                        )}
                        <span>Цена закупа: {formatPrice(item.purchase_price)}</span>
                        <span>Обновлено: {formatDate(item.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="Редактировать остаток (только оператор)"
                        disabled
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Информация о складе
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Товары с указанным штрих-кодом будут автоматически сопоставляться с заказами Wildberries</li>
                  <li>При поступлении заказа с совпадающим штрих-кодом с депозита будет списана цена закупа</li>
                  <li>Редактирование остатков доступно только операторам и администраторам</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
