'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

interface Client {
  id: number;
  company_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface YVProduct {
  id: number;
  client_id: number;
  article: string;
  name: string;
  description?: string;
  purchase_price?: number;
  seller_price?: number;
  marketplace_price?: number;
  fulfillment_price?: number;
  barcode?: string;
  sku?: string;
  stock_quantity: number;
  package_length_cm?: number;
  package_width_cm?: number;
  package_height_cm?: number;
  package_weight_kg?: number;
  brand?: string;
  category?: string;
  images?: string[];
  main_image_url?: string;
  is_active: boolean;
  created_at: string;
  company_name?: string;
}

export default function YVProductsPage() {
  const [products, setProducts] = useState<YVProduct[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<number | null>(null);

  // Форма для добавления товара
  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    description: '',
    purchase_price: '',
    seller_price: '',
    marketplace_price: '',
    fulfillment_price: '',
    stock_quantity: '0',
    package_length_cm: '',
    package_width_cm: '',
    package_height_cm: '',
    package_weight_kg: '',
    brand: '',
    category: '',
    auto_generate_description: true,
    article: ''
  });

  useEffect(() => {
    fetchData();
  }, [clientFilter, searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsResponse, clientsResponse] = await Promise.all([
        api.get(`/operator/yv-products?${clientFilter ? `client_id=${clientFilter}&` : ''}${searchTerm ? `search=${searchTerm}` : ''}`),
        api.get('/operator/yv-products/clients')
      ]);

      setProducts(productsResponse.data.products || []);
      setClients(clientsResponse.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleGenerateDescription = async () => {
    if (!formData.name) {
      toast.error('Введите название товара');
      return;
    }

    try {
      const response = await api.post('/operator/yv-products/generate-description', {
        name: formData.name
      });
      setFormData(prev => ({ ...prev, description: response.data.description }));
      toast.success('Описание сгенерировано');
    } catch (error: any) {
      console.error('Error generating description:', error);
      toast.error('Ошибка генерации описания');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id || !formData.name) {
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      const productData = {
        ...formData,
        client_id: parseInt(formData.client_id),
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        seller_price: formData.seller_price ? parseFloat(formData.seller_price) : null,
        marketplace_price: formData.marketplace_price ? parseFloat(formData.marketplace_price) : null,
        fulfillment_price: formData.fulfillment_price ? parseFloat(formData.fulfillment_price) : null,
        stock_quantity: parseInt(formData.stock_quantity),
        package_length_cm: formData.package_length_cm ? parseFloat(formData.package_length_cm) : null,
        package_width_cm: formData.package_width_cm ? parseFloat(formData.package_width_cm) : null,
        package_height_cm: formData.package_height_cm ? parseFloat(formData.package_height_cm) : null,
        package_weight_kg: formData.package_weight_kg ? parseFloat(formData.package_weight_kg) : null,
        article: formData.article || null
      };

      await api.post('/operator/yv-products', productData);
      toast.success('Товар успешно добавлен');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast.error(error.response?.data?.error || 'Ошибка создания товара');
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      name: '',
      description: '',
      purchase_price: '',
      seller_price: '',
      marketplace_price: '',
      fulfillment_price: '',
      stock_quantity: '0',
      package_length_cm: '',
      package_width_cm: '',
      package_height_cm: '',
      package_weight_kg: '',
      brand: '',
      category: '',
      auto_generate_description: true,
      article: ''
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) {
      return;
    }

    try {
      await api.delete(`/operator/yv-products/${id}`);
      toast.success('Товар удален');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error('Ошибка удаления товара');
    }
  };

  return (
    <Layout requiredRole="operator">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Добавление товара ЮВ</h1>
            <p className="mt-1 text-sm text-gray-600">
              Ручное добавление товаров Южных Ворот
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Добавить товар
          </button>
        </div>

        {/* Фильтры */}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию или артикулу..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <select
            value={clientFilter || ''}
            onChange={(e) => setClientFilter(e.target.value ? parseInt(e.target.value) : null)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Все клиенты</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.company_name}
              </option>
            ))}
          </select>
        </div>

        {/* Таблица товаров */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Товары не найдены
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Артикул
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Клиент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Цены
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Остаток
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.article}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        {product.main_image_url && (
                          <img
                            src={product.main_image_url}
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded mr-3"
                          />
                        )}
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.brand && (
                            <div className="text-xs text-gray-500">{product.brand}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.company_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="space-y-1">
                        {product.purchase_price && (
                          <div>Закупка: {product.purchase_price} ₽</div>
                        )}
                        {product.seller_price && (
                          <div>Селлер: {product.seller_price} ₽</div>
                        )}
                        {product.marketplace_price && (
                          <div>МП: {product.marketplace_price} ₽</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.stock_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Модальное окно добавления товара */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Добавить товар ЮВ</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Основная информация */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Клиент <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="client_id"
                      value={formData.client_id}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Выберите клиента</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.company_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Артикул (оставьте пустым для автогенерации)
                    </label>
                    <input
                      type="text"
                      name="article"
                      value={formData.article}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Название товара <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Описание
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
                      title="Сгенерировать описание по названию"
                    >
                      <SparklesIcon className="w-5 h-5" />
                      Авто
                    </button>
                  </div>
                  <label className="flex items-center mt-2">
                    <input
                      type="checkbox"
                      name="auto_generate_description"
                      checked={formData.auto_generate_description}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Автогенерировать описание</span>
                  </label>
                </div>

                {/* Цены */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Цена закупки
                    </label>
                    <input
                      type="number"
                      name="purchase_price"
                      value={formData.purchase_price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Цена селлеру
                    </label>
                    <input
                      type="number"
                      name="seller_price"
                      value={formData.seller_price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Цена на МП
                    </label>
                    <input
                      type="number"
                      name="marketplace_price"
                      value={formData.marketplace_price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Фулфилмент
                    </label>
                    <input
                      type="number"
                      name="fulfillment_price"
                      value={formData.fulfillment_price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Габариты */}
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Длина (см)
                    </label>
                    <input
                      type="number"
                      name="package_length_cm"
                      value={formData.package_length_cm}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ширина (см)
                    </label>
                    <input
                      type="number"
                      name="package_width_cm"
                      value={formData.package_width_cm}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Высота (см)
                    </label>
                    <input
                      type="number"
                      name="package_height_cm"
                      value={formData.package_height_cm}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Вес (кг)
                    </label>
                    <input
                      type="number"
                      name="package_weight_kg"
                      value={formData.package_weight_kg}
                      onChange={handleInputChange}
                      step="0.001"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Остаток
                    </label>
                    <input
                      type="number"
                      name="stock_quantity"
                      value={formData.stock_quantity}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Дополнительная информация */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Бренд
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Категория
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Кнопки */}
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  >
                    Добавить товар
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

