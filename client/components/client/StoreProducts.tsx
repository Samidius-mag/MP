'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Product {
  id: number;
  nm_id?: number;
  article: string;
  name: string;
  brand?: string;
  category?: string;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  weight_kg?: number;
  current_price?: number;
  commission_percent?: number;
  logistics_cost?: number;
  is_active: boolean;
  in_promotion: boolean;
  promotion_discount_percent?: number;
  last_updated: string;
  created_at: string;
  source?: string; // 'wildberries' | 'sima_land'
  purchase_price?: number;
  available_quantity?: number;
  markup_percent?: number;
  marketplace_targets?: string[]; // ['wb', 'ozon', 'yandex_market']
  image_url?: string;
}

type SortField = 'name' | 'brand' | 'price' | 'none';
type SortDirection = 'asc' | 'desc';

export default function StoreProducts() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [sortField, setSortField] = useState<SortField>('none');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingMarkup, setEditingMarkup] = useState<number | null>(null);
  const [markupValue, setMarkupValue] = useState<string>('');
  const [uploadingToYM, setUploadingToYM] = useState<number | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [allProducts, searchTerm, filterActive, sortField, sortDirection]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      const response = await api.get('/client/store-products');
      
      const products = response.data.products || [];
      setAllProducts(products);
      
    } catch (err: any) {
      console.error('Error fetching products:', err);
      toast.error(err.response?.data?.error || 'Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...allProducts];

    // Применяем фильтры
    if (searchTerm) {
      filtered = filtered.filter((p: Product) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.article.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (filterActive !== null) {
      filtered = filtered.filter((p: Product) => p.is_active === filterActive);
    }

    // Применяем сортировку
    if (sortField !== 'none') {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'name':
            aValue = a.name || '';
            bValue = b.name || '';
            break;
          case 'brand':
            aValue = a.brand || '';
            bValue = b.brand || '';
            break;
          case 'price':
            aValue = Number(a.current_price) || 0;
            bValue = Number(b.current_price) || 0;
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          // Проверяем на NaN для числовых значений
          if (isNaN(aValue)) aValue = 0;
          if (isNaN(bValue)) bValue = 0;
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
      });
    }

    setFilteredProducts(filtered);
    setCurrentPage(1); // Сбрасываем на первую страницу при изменении фильтров
  };

  const loadCards = async () => {
    try {
      setLoadingCards(true);
      
      const response = await api.post('/client/store-products/load');
      
      toast.success(response.data.message || `Загружено ${response.data.products?.length || 0} товаров`);
      
      // Обновляем список товаров
      await fetchProducts();
      
    } catch (err: any) {
      console.error('Error loading cards:', err);
      toast.error(err.response?.data?.error || 'Ошибка загрузки карточек');
    } finally {
      setLoadingCards(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const updateMarkup = async (productId: number, markup: number) => {
    try {
      await api.put(`/client/store-products/${productId}/markup`, {
        markup_percent: markup
      });
      toast.success('Наценка обновлена');
      await fetchProducts();
      setEditingMarkup(null);
      setMarkupValue('');
    } catch (err: any) {
      console.error('Error updating markup:', err);
      toast.error(err.response?.data?.error || 'Ошибка обновления наценки');
    }
  };

  const toggleMarketplace = async (productId: number, marketplace: string) => {
    try {
      const product = allProducts.find(p => p.id === productId);
      if (!product) return;

      const currentTargets = product.marketplace_targets || [];
      const newTargets = currentTargets.includes(marketplace)
        ? currentTargets.filter(m => m !== marketplace)
        : [...currentTargets, marketplace];

      await api.put(`/client/store-products/${productId}/marketplaces`, {
        marketplace_targets: newTargets
      });
      toast.success('Маркетплейсы обновлены');
      await fetchProducts();
    } catch (err: any) {
      console.error('Error updating marketplaces:', err);
      toast.error(err.response?.data?.error || 'Ошибка обновления маркетплейсов');
    }
  };

  const uploadToYandexMarket = async (productId: number) => {
    try {
      setUploadingToYM(productId);
      await api.post(`/client/store-products/${productId}/upload/yandex-market`);
      toast.success('Товар загружен на Яндекс Маркет');
      await fetchProducts();
    } catch (err: any) {
      console.error('Error uploading to Yandex Market:', err);
      toast.error(err.response?.data?.error || 'Ошибка загрузки на Яндекс Маркет');
    } finally {
      setUploadingToYM(null);
    }
  };

  const calculateSellingPrice = (purchasePrice?: number, markupPercent?: number) => {
    if (!purchasePrice) return null;
    const markup = markupPercent || 0;
    return purchasePrice * (1 + markup / 100);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Товары магазина</h1>
          <p className="mt-1 text-sm text-gray-600">
            Просмотр и управление товарами из разных источников (Wildberries, Сима Ленд)
          </p>
        </div>
        <button
          onClick={loadCards}
          disabled={loadingCards}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          {loadingCards ? 'Загрузка...' : 'Загрузить карточки'}
        </button>
      </div>

      {/* Фильтры и сортировка */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Поиск по названию, артикулу..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
          <select
            value={filterActive === null ? 'all' : filterActive ? 'active' : 'inactive'}
            onChange={(e) => {
              const value = e.target.value;
              setFilterActive(value === 'all' ? null : value === 'active');
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Сортировка:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">Без сортировки</option>
              <option value="name">По названию</option>
              <option value="brand">По бренду</option>
              <option value="price">По цене</option>
            </select>
            {sortField !== 'none' && (
              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                title={sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-700">Товаров на странице:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Список товаров */}
      {filteredProducts.length === 0 ? (
        <div className="card text-center">
          <div className="py-12">
            <p className="text-gray-500">
              Товары не найдены. Нажмите "Загрузить карточки" для импорта товаров из Wildberries.
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Товар
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Артикул / nmId
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Цена
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Комиссия
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Логистика
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Закупка / Наценка
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Остаток
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Маркетплейсы
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Обновлено
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((product) => {
                    const sellingPrice = calculateSellingPrice(product.purchase_price, product.markup_percent);
                    const marketplaceTargets = product.marketplace_targets || [];
                    return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        {product.brand && (
                          <div className="text-sm text-gray-500">{product.brand}</div>
                        )}
                        {product.category && (
                          <div className="text-xs text-gray-400">{product.category}</div>
                        )}
                        {product.source && (
                          <div className="text-xs text-blue-600 mt-1">
                            {product.source === 'sima_land' ? 'Сима Ленд' : 'Wildberries'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{product.article}</div>
                      {product.nm_id && (
                        <div className="text-xs text-gray-500">nmId: {product.nm_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPrice(product.current_price || sellingPrice || undefined)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.commission_percent ? `${product.commission_percent}%` : '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPrice(product.logistics_cost)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                      {product.in_promotion && (
                        <div className="text-xs text-purple-600 mt-1">
                          В акции: {product.promotion_discount_percent}%
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {product.purchase_price ? (
                          <>
                            <div className="text-gray-900">{formatPrice(product.purchase_price)}</div>
                            {editingMarkup === product.id ? (
                              <div className="flex items-center gap-1 mt-1">
                                <input
                                  type="number"
                                  value={markupValue}
                                  onChange={(e) => setMarkupValue(e.target.value)}
                                  placeholder={product.markup_percent?.toString() || '0'}
                                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                                  autoFocus
                                />
                                <span className="text-xs text-gray-500">%</span>
                                <button
                                  onClick={() => {
                                    const val = parseFloat(markupValue);
                                    if (!isNaN(val) && val >= 0) {
                                      updateMarkup(product.id, val);
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMarkup(null);
                                    setMarkupValue('');
                                  }}
                                  className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-600">
                                  Наценка: {product.markup_percent || 0}%
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingMarkup(product.id);
                                    setMarkupValue(product.markup_percent?.toString() || '');
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  Изменить
                                </button>
                              </div>
                            )}
                            {sellingPrice && (
                              <div className="text-xs text-green-600 mt-1">
                                Продажа: {formatPrice(sellingPrice)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.available_quantity !== undefined ? product.available_quantity : '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {['wb', 'ozon', 'yandex_market'].map(mp => {
                          const isSelected = marketplaceTargets.includes(mp);
                          const labels: Record<string, string> = {
                            'wb': 'WB',
                            'ozon': 'Ozon',
                            'yandex_market': 'ЯМ'
                          };
                          return (
                            <button
                              key={mp}
                              onClick={() => toggleMarketplace(product.id, mp)}
                              className={`px-2 py-1 text-xs rounded ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {labels[mp]}
                            </button>
                          );
                        })}
                        {product.source === 'sima_land' && marketplaceTargets.includes('yandex_market') && (
                          <button
                            onClick={() => uploadToYandexMarket(product.id)}
                            disabled={uploadingToYM === product.id}
                            className="mt-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {uploadingToYM === product.id ? 'Загрузка...' : 'Загрузить на ЯМ'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500">
                      {formatDate(product.last_updated)}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          {Math.ceil(filteredProducts.length / itemsPerPage) > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Показано {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} из {filteredProducts.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Назад
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(filteredProducts.length / itemsPerPage)) }, (_, i) => {
                    let pageNum;
                    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
                    
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-sm font-medium rounded-md ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(Math.ceil(filteredProducts.length / itemsPerPage), currentPage + 1))}
                  disabled={currentPage >= Math.ceil(filteredProducts.length / itemsPerPage)}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Вперед
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Статистика */}
      {filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Всего товаров</div>
            <div className="text-2xl font-bold text-blue-900">{filteredProducts.length}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Активных</div>
            <div className="text-2xl font-bold text-green-900">
              {filteredProducts.filter(p => p.is_active).length}
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">В акциях</div>
            <div className="text-2xl font-bold text-purple-900">
              {filteredProducts.filter(p => p.in_promotion).length}
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-sm text-orange-600 font-medium">Средняя цена</div>
            <div className="text-2xl font-bold text-orange-900">
              {formatPrice(
                filteredProducts.reduce((sum, p) => sum + (p.current_price || 0), 0) / filteredProducts.length
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

