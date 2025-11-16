'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SimaLandProduct {
  id: number;
  article: string;
  name: string;
  brand?: string;
  category?: string;
  category_id?: number;
  purchase_price?: number;
  available_quantity?: number;
  image_url?: string;
  image_urls?: string[];
  description?: string;
  characteristics?: any;
}

interface Category {
  id: number;
  name: string;
  parent_id?: number;
  level?: number;
}

type SortField = 'name' | 'brand' | 'price' | 'available' | 'none';
type SortDirection = 'asc' | 'desc';

// Компонент для отображения изображения товара с поддержкой альтернативных URL
function ProductImage({ product }: { product: SimaLandProduct }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [allImageUrls, setAllImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Собираем все доступные URL изображений
    const urls: string[] = [];
    if (product.image_url) {
      urls.push(product.image_url);
      console.log(`[CLIENT] 📸 Product ${product.id}: main image_url = ${product.image_url.substring(0, 80)}...`);
    }
    if (product.image_urls && Array.isArray(product.image_urls)) {
      // Добавляем альтернативные URL, избегая дубликатов
      product.image_urls.forEach(url => {
        if (url && !urls.includes(url)) {
          urls.push(url);
        }
      });
      console.log(`[CLIENT] 📸 Product ${product.id}: ${product.image_urls.length} alternative image_urls`);
    }
    console.log(`[CLIENT] 📸 Product ${product.id}: Total ${urls.length} image URLs available`);
    setAllImageUrls(urls);
    setCurrentImageIndex(0);
    setImageError(false);
    setIsLoading(true);
    
    // Используем прямые URL, поэтому просто включаем загрузку
    setIsLoading(false);
  }, [product.image_url, product.image_urls]);

  const handleImageError = () => {
    setCurrentImageIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      if (nextIndex < allImageUrls.length) {
        // Пробуем следующее изображение
        console.log(`[CLIENT] ❌ Image ${prevIndex} failed, trying next: ${allImageUrls[nextIndex]}`);
        return nextIndex;
      } else {
        // Все изображения не загрузились
        console.log(`[CLIENT] ❌ All ${allImageUrls.length} images failed for product ${product.id}`);
        setImageError(true);
        setIsLoading(false);
        return prevIndex;
      }
    });
  };

  // Проверяем, является ли URL прокси (тогда ошибки будут JSON, а не изображения)
  const isProxiedUrl = (url: string) => {
    return url.includes('/api/sima-land/image-proxy');
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setIsLoading(false);
    
    console.log(`[CLIENT] ✅ Image loaded: ${currentImageUrl?.substring(0, 80)}... (${img.naturalWidth}x${img.naturalHeight})`);
    
    // Если изображение слишком маленькое (менее 10x10), это может быть placeholder от сервера
    // (например, при 404 ошибке мы возвращаем SVG 1x1)
    if (img.naturalWidth < 10 && img.naturalHeight < 10) {
      console.log(`[CLIENT] ⚠️ Image is too small (${img.naturalWidth}x${img.naturalHeight}), likely a placeholder - trying next image`);
      // Сразу пробуем следующее изображение вместо показа этого placeholder
      handleImageError();
      return;
    }
    
    setImageError(false);
  };

  const currentImageUrl = allImageUrls[currentImageIndex];

  if (isLoading) {
    return (
      <div className="w-full h-48 bg-gray-100 flex flex-col items-center justify-center border-0">
        <div className="animate-pulse">
          <PhotoIcon className="h-12 w-12 text-gray-300" />
        </div>
      </div>
    );
  }

  if (imageError || !currentImageUrl) {
    return (
      <div className="w-full h-48 bg-gray-100 flex flex-col items-center justify-center border-0">
        <PhotoIcon className="h-12 w-12 text-gray-400" />
        <span className="mt-2 text-xs text-gray-500">Изображение недоступно</span>
      </div>
    );
  }

  // Добавляем параметр для обхода кеша браузера
  const imageUrlWithCacheBust = currentImageUrl && currentImageUrl.includes('/api/sima-land/image-proxy')
    ? `${currentImageUrl}${currentImageUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
    : currentImageUrl;

  return (
    <img 
      src={imageUrlWithCacheBust} 
      alt={product.name} 
      className="w-full h-48 object-cover bg-gray-100"
      loading="lazy"
      onError={handleImageError}
      onLoad={handleImageLoad}
      crossOrigin="anonymous"
    />
  );
}

export default function SimaLandProducts() {
  const [allProducts, setAllProducts] = useState<SimaLandProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<SimaLandProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  // Импорт из БД: загрузка выполняется на сервере планово, на странице только фильтрация
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('none');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasToken, setHasToken] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SimaLandProduct | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loadingProductDetails, setLoadingProductDetails] = useState(false);

  useEffect(() => {
    checkToken();
    fetchCategories();
    // Не загружаем товары по умолчанию — ждём ввода в поиск
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [allProducts, searchTerm, sortField, sortDirection]);

  const checkToken = async () => {
    try {
      const response = await api.get('/client/api-keys');
      const token = response.data.apiKeys?.sima_land?.token;
      setHasToken(token && token.trim() !== '');
    } catch (error) {
      console.error('Error checking token:', error);
      setHasToken(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/client/sima-land/categories');
      setCategories(response.data.categories || []);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      // Не показываем ошибку, просто пустой список категорий
    }
  };

  const fetchProducts = async (term: string, categoryIds?: number[]) => {
    try {
      setLoading(true);
      const params: any = {};
      if (term && term.trim()) {
        params.search = term.trim();
      }
      if (categoryIds && categoryIds.length > 0) {
        params.categories = categoryIds;
      }
      
      const response = await api.get('/client/sima-land/products', { params });
      
      const products = response.data.products || [];
      
      // Логируем для отладки (первые несколько товаров)
      if (products.length > 0) {
        console.log('[CLIENT] ✅ Received products:', products.length);
        products.slice(0, 3).forEach((p: any) => {
          console.log(`[CLIENT] Product ${p.id} (${p.article}):`);
          console.log(`[CLIENT]   image_url = ${p.image_url || 'NULL'} (type: ${typeof p.image_url})`);
          console.log(`[CLIENT]   name = ${p.name?.substring(0, 50)}...`);
          if (p.image_url) {
            console.log(`[CLIENT]   🔍 Will try to load image: ${p.image_url}`);
          }
        });
      } else {
        console.log('[CLIENT] ⚠️  No products received');
      }
      
      setAllProducts(products);
      
    } catch (err: any) {
      console.error('Error fetching products:', err);
      if (err.response?.status === 400) {
        toast.error(err.response?.data?.error || 'Необходимо настроить токен API');
      } else {
        toast.error(err.response?.data?.error || 'Ошибка загрузки товаров');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategories(prev => {
      const newSelected = prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId];
      return newSelected;
    });
  };

  const handleCategoryFilterApply = () => {
    const term = searchTerm.trim();
    if (!term && selectedCategories.length === 0) {
      toast('Введите поисковый запрос или выберите категории', { icon: 'ℹ️' });
      setAllProducts([]);
      setFilteredProducts([]);
      return;
    }
    fetchProducts(term || '', selectedCategories);
  };

  const clearCategoryFilter = () => {
    setSelectedCategories([]);
    if (searchTerm.trim()) {
      fetchProducts(searchTerm.trim(), []);
    } else {
      setAllProducts([]);
      setFilteredProducts([]);
    }
  };

  // Поиск выполняется только по нажатию на кнопку "Применить"

  const applyFiltersAndSort = () => {
    let filtered = [...allProducts];

    // Фильтрация по поиску выполняется на сервере
    // Здесь только сортировка

    // Применяем сортировку
    if (sortField !== 'none') {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'available': {
            const aAvail = (Number(a.available_quantity) || 0) > 0 ? 1 : 0;
            const bAvail = (Number(b.available_quantity) || 0) > 0 ? 1 : 0;
            // доступные первыми; при равенстве — по количеству убыв.
            if (aAvail !== bAvail) return bAvail - aAvail;
            const aq = Number(a.available_quantity) || 0;
            const bq = Number(b.available_quantity) || 0;
            return bq - aq;
          }
          case 'name':
            aValue = a.name || '';
            bValue = b.name || '';
            break;
          case 'brand':
            aValue = a.brand || '';
            bValue = b.brand || '';
            break;
          case 'price':
            aValue = Number(a.purchase_price) || 0;
            bValue = Number(b.purchase_price) || 0;
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          if (isNaN(aValue)) aValue = 0;
          if (isNaN(bValue)) bValue = 0;
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
      });
    }

    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  const formatPrice = (price?: number) => {
    if (!price) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  };

  const loadProductDetails = async (productId: number) => {
    try {
      setLoadingProductDetails(true);
      const response = await api.get(`/client/sima-land/products/${productId}/details`);
      
      if (response.data.success && response.data.product) {
        const updatedProduct = response.data.product;
        // Обновляем изображения и описание товара
        setSelectedProduct(prev => prev ? {
          ...prev,
          image_url: updatedProduct.image_url || prev.image_url,
          image_urls: updatedProduct.image_urls || prev.image_urls,
          description: updatedProduct.description || prev.description,
          characteristics: updatedProduct.characteristics || prev.characteristics
        } : null);
      }
    } catch (err: any) {
      console.error('Error loading product details:', err);
      // Не показываем ошибку пользователю, просто используем данные из БД
    } finally {
      setLoadingProductDetails(false);
    }
  };

  const addToStore = async (product: SimaLandProduct) => {
    try {
      const response = await api.post('/client/sima-land/products/add', {
        article: product.article,
        name: product.name,
        brand: product.brand,
        category: product.category,
        purchase_price: product.purchase_price,
        available_quantity: product.available_quantity || 0,
        image_url: product.image_url,
        description: product.description
      });
      
      toast.success('Товар добавлен в магазин');
      
      // Обновляем список товаров, если есть активный поиск
      if (searchTerm && searchTerm.trim().length >= 2) {
        await fetchProducts(searchTerm.trim());
      }
      
    } catch (err: any) {
      console.error('Error adding product:', err);
      toast.error(err.response?.data?.error || 'Ошибка добавления товара');
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Товары СИМА ЛЕНД</h1>
          <p className="mt-1 text-sm text-gray-600">Найдите товары поставщика по названию или артикулу</p>
        </div>
        <div className="flex gap-2 items-center w-full max-w-xl ml-auto">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Поиск по названию или артикулу (или выберите категории)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
          <button
            onClick={handleCategoryFilterApply}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Применить
          </button>
          <button
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
              showCategoryFilter || selectedCategories.length > 0
                ? 'bg-primary-100 text-primary-700 border border-primary-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            Категории {selectedCategories.length > 0 && `(${selectedCategories.length})`}
          </button>
        </div>
      </div>


      {/* Фильтр категорий */}
      {showCategoryFilter && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-900">Фильтр по категориям</h3>
            {selectedCategories.length > 0 && (
              <button
                onClick={clearCategoryFilter}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Очистить
              </button>
            )}
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">Категории загружаются...</p>
          ) : (
            <div className="max-h-64 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id)}
                    onChange={() => handleCategoryToggle(category.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{category.name}</span>
                </label>
              ))}
            </div>
          )}
          {selectedCategories.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Выбрано категорий: {selectedCategories.length}</p>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map(catId => {
                  const cat = categories.find(c => c.id === catId);
                  return cat ? (
                    <span
                      key={catId}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                    >
                      {cat.name}
                      <button
                        onClick={() => handleCategoryToggle(catId)}
                        className="ml-1 text-primary-600 hover:text-primary-800"
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Фильтры и сортировка */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Сортировка:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">Без сортировки</option>
              <option value="available">Доступные первыми</option>
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
            <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
            {!searchTerm && selectedCategories.length === 0 ? (
              <p className="mt-4 text-gray-500">Введите поисковый запрос или выберите категории для фильтрации товаров.</p>
            ) : (
              <p className="mt-4 text-gray-500">Товары не найдены для выбранных фильтров.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .map((product) => (
            <div 
              key={product.id} 
              className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={async () => {
                setSelectedProduct(product);
                setSelectedImageIndex(0);
                // Загружаем актуальные данные товара через API
                await loadProductDetails(product.id);
              }}
            >
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 overflow-hidden">
                <ProductImage product={product} />
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                </div>
                {product.brand && (
                  <p className="text-xs text-gray-500 mb-2">{product.brand}</p>
                )}
                {product.category && (
                  <p className="text-xs text-blue-600 mb-2">{product.category}</p>
                )}
                <div className="flex justify-between items-center mt-3">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatPrice(product.purchase_price)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Остаток: {product.available_quantity || 0}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToStore(product);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Добавить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* Статистика */}
      {filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Всего товаров</div>
            <div className="text-2xl font-bold text-blue-900">{filteredProducts.length}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Доступно</div>
            <div className="text-2xl font-bold text-green-900">
              {filteredProducts.filter(p => (p.available_quantity || 0) > 0).length}
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-sm text-orange-600 font-medium">Средняя цена</div>
            <div className="text-2xl font-bold text-orange-900">
              {formatPrice(
                filteredProducts.reduce((sum, p) => sum + (p.purchase_price || 0), 0) / filteredProducts.length
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно детального просмотра товара */}
      {selectedProduct && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedProduct(null);
            setSelectedImageIndex(0);
          }}
        >
          <div 
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок модального окна */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start z-10">
              <div className="flex-1 pr-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h2>
                {selectedProduct.brand && (
                  <p className="text-sm text-gray-500 mt-1">Бренд: {selectedProduct.brand}</p>
                )}
                {selectedProduct.article && (
                  <p className="text-sm text-gray-500">Артикул: {selectedProduct.article}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setSelectedImageIndex(0);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Галерея фотографий */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Фотографии
                    {loadingProductDetails && (
                      <span className="ml-2 text-sm text-gray-500">(загрузка...)</span>
                    )}
                  </h3>
                  {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? (
                    <div className="space-y-4">
                      {/* Основное изображение */}
                      <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={selectedProduct.image_urls[selectedImageIndex] || selectedProduct.image_url || ''}
                          alt={selectedProduct.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      {/* Миниатюры */}
                      {selectedProduct.image_urls.length > 1 && (
                        <div className="grid grid-cols-4 gap-2">
                          {selectedProduct.image_urls.map((url, index) => (
                            <button
                              key={index}
                              onClick={() => setSelectedImageIndex(index)}
                              className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-all ${
                                selectedImageIndex === index
                                  ? 'border-primary-600 ring-2 ring-primary-200'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <img
                                src={url}
                                alt={`${selectedProduct.name} - фото ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : selectedProduct.image_url ? (
                    <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                      <PhotoIcon className="h-24 w-24 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Информация о товаре */}
                <div>
                  <div className="space-y-6">
                    {/* Цена и остаток */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Цена и наличие</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Цена закупки:</span>
                          <span className="text-xl font-bold text-gray-900">
                            {formatPrice(selectedProduct.purchase_price)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Остаток на складе:</span>
                          <span className={`text-lg font-semibold ${
                            (selectedProduct.available_quantity || 0) > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {selectedProduct.available_quantity || 0} шт.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Описание */}
                    {selectedProduct.description && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Описание</h3>
                        <div 
                          className="text-gray-700 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: selectedProduct.description }}
                        />
                      </div>
                    )}

                    {/* Характеристики */}
                    {selectedProduct.characteristics && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Характеристики</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          {typeof selectedProduct.characteristics === 'object' ? (
                            <div className="space-y-2">
                              {Object.entries(selectedProduct.characteristics).map(([key, value]) => {
                                if (value === null || value === undefined || value === '') return null;
                                
                                // Словарь переводов названий характеристик на русский
                                const characteristicNames: { [key: string]: string } = {
                                  'size': 'Размер',
                                  'depth': 'Глубина',
                                  'width': 'Ширина',
                                  'height': 'Высота',
                                  'weight': 'Вес',
                                  'in_box': 'В упаковке',
                                  'in_set': 'В наборе',
                                  'country': 'Страна',
                                  'country_id': 'ID страны',
                                  'material': 'Материал',
                                  'box_depth': 'Глубина упаковки',
                                  'box_width': 'Ширина упаковки',
                                  'box_height': 'Высота упаковки',
                                  'package_volume': 'Объем упаковки',
                                  'minimum_order_quantity': 'Минимальный заказ',
                                  'parameters': 'Параметры',
                                  'barcodes': 'Штрихкоды',
                                  'color': 'Цвет',
                                  'gender': 'Пол',
                                  'isbn': 'ISBN',
                                  'page_count': 'Количество страниц',
                                  'brand': 'Бренд',
                                  'category': 'Категория',
                                };
                                
                                // Получаем русское название характеристики
                                const getCharacteristicName = (key: string): string => {
                                  // Сначала проверяем словарь
                                  if (characteristicNames[key.toLowerCase()]) {
                                    return characteristicNames[key.toLowerCase()];
                                  }
                                  // Если не найдено, форматируем название
                                  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
                                };
                                
                                if (key === 'parameters' && Array.isArray(value)) {
                                  return (
                                    <div key={key} className="border-b border-gray-200 pb-2 mb-2">
                                      <div className="font-medium text-gray-900 mb-2">
                                        {getCharacteristicName(key)}:
                                      </div>
                                      <div className="space-y-1">
                                        {value.map((param: any, idx: number) => {
                                          if (!param || (!param.name && !param.value)) return null;
                                          return (
                                            <div key={idx} className="text-sm text-gray-700 ml-4">
                                              {param.name && param.name.trim() && (
                                                <span className="font-medium">{param.name}: </span>
                                              )}
                                              {param.value && <span>{String(param.value)}</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }
                                if (Array.isArray(value)) {
                                  return (
                                    <div key={key} className="flex justify-between items-start border-b border-gray-200 pb-2 mb-2">
                                      <span className="font-medium text-gray-900">
                                        {getCharacteristicName(key)}:
                                      </span>
                                      <span className="text-gray-700 text-right">{value.join(', ')}</span>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={key} className="flex justify-between items-start border-b border-gray-200 pb-2 mb-2">
                                    <span className="font-medium text-gray-900">
                                      {getCharacteristicName(key)}:
                                    </span>
                                    <span className="text-gray-700 text-right">{String(value)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-gray-700">{String(selectedProduct.characteristics)}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Кнопка добавления */}
                    <div className="pt-4">
                      <button
                        onClick={() => {
                          addToStore(selectedProduct);
                          setSelectedProduct(null);
                        }}
                        className="w-full px-4 py-3 bg-primary-600 text-white text-lg font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                      >
                        Добавить в магазин
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

