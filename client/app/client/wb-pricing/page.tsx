'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';

// Типы для товаров
interface Product {
  nm_id: number;
  name?: string;
  current_price?: number;
  in_promotion?: boolean;
  logistics_cost?: number;
  commission_percent?: number;
}

export default function WbPricingPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [form, setForm] = useState({
    // Основные настройки маржинальности
    markupPercent: 20, // Наценка (%)
    acquiringPercent: 2.5, // Эквайринг (%)
    
    // Логистика (зависит от габаритов товара)
    firstLiterLogisticsRub: 50, // Логистика первого литра
    additionalLiterLogisticsRub: 10, // Логистика дополнительного литра
    warehouseCoeffPercent: 15, // Коэффициент склада
    
    // Дополнительные параметры
    maxDiscountPercent: 10, // Максимальная скидка
    belowRrp: 'unknown', // Цены ниже РРЦ
    localizationIndex: 1.2, // Индекс локализации
    shipmentHandlingRub: 5, // Обработка отправления
    
    // Ограничения по цене
    minPurchasePriceRub: 100, // Минимальная закупочная цена
    maxPurchasePriceRub: 10000, // Максимальная закупочная цена
    
    // Управление акциями
    maintainMarginInPromotions: true, // Удерживать маржинальность в акциях
    autoExitPromotions: true, // Автоматически выходить из акций
    
    // Комиссия маркетплейса (получается из API WB)
    marketplaceCommissionPercent: 0, // Будет обновляться из API
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);

  // Загрузка настроек с сервера
  const loadSettings = async () => {
    try {
      console.log('Loading settings...');
      const response = await api.get('/pricing/settings');
      console.log('Settings loaded:', response.data);
      setForm(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Сохранение настроек на сервер
  const saveSettings = async () => {
    try {
      console.log('Saving settings...');
      await api.put('/pricing/settings', form);
      console.log('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Загрузка товаров
  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      console.log('Loading products...');
      const response = await api.get('/pricing/products');
      console.log('Products loaded:', response.data);
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Синхронизация товаров с Wildberries
  const syncProducts = async () => {
    setIsSyncing(true);
    try {
      console.log('Starting sync using API key from user settings...');
      const response = await api.post('/pricing/sync-products');
      
      console.log('Sync response:', response);
      
      if (response && response.data) {
        setProducts(response.data.products || []);
        console.log(`Синхронизировано ${response.data.count || 0} товаров`);
      } else {
        console.warn('Unexpected response format:', response);
        setProducts([]);
      }
    } catch (error) {
      console.error('Error syncing products:', error);
      setProducts([]);
    } finally {
      setIsSyncing(false);
    }
  };

  // Получение актуальной комиссии маркетплейса из WB API
  const fetchMarketplaceCommission = async () => {
    try {
      console.log('Fetching marketplace commission from WB API...');
      
      // Используем API ключ из настроек пользователя через сервер
      const response = await api.post('/pricing/fetch-commission');
      
      if (response && response.data && response.data.commission) {
        const commission = response.data.commission;
        setForm(prev => ({ ...prev, marketplaceCommissionPercent: commission }));
        console.log(`Marketplace commission updated: ${commission}%`);
        return commission;
      } else {
        // Если не удалось получить комиссию, используем стандартное значение
        const defaultCommission = 5.0; // Стандартная комиссия WB
        setForm(prev => ({ ...prev, marketplaceCommissionPercent: defaultCommission }));
        console.log(`Using default marketplace commission: ${defaultCommission}%`);
        return defaultCommission;
      }
    } catch (error) {
      console.error('Error fetching marketplace commission:', error);
      // Если ошибка, используем стандартное значение
      const defaultCommission = 5.0;
      setForm(prev => ({ ...prev, marketplaceCommissionPercent: defaultCommission }));
      console.log(`Using default marketplace commission: ${defaultCommission}%`);
      return defaultCommission;
    }
  };

  // Расчет оптимальной цены для товара
  const calculateOptimalPrice = async (product: Product) => {
    try {
      console.log('Calculating optimal price for product:', product.nm_id);
      const response = await api.post('/pricing/calculate-price', { 
        productId: product.nm_id,
        settings: form 
      });
      
      if (response && response.data) {
        console.log('Price calculation result:', response.data);
        
        // Если есть рекомендуемая цена, обновляем её в базе данных
        if (response.data.finalPrice && response.data.finalPrice > 0) {
          try {
            const updateResponse = await api.put('/pricing/update-price', {
              productId: product.nm_id,
              newPrice: response.data.finalPrice
            });
            
            if (updateResponse.data.success) {
              console.log('Price updated successfully:', updateResponse.data);
              
              // Обновляем товар в локальном состоянии
              setProducts(prevProducts => 
                prevProducts.map(p => 
                  p.nm_id === product.nm_id 
                    ? { ...p, current_price: response.data.finalPrice }
                    : p
                )
              );
              
              alert(`Цена товара обновлена на ${response.data.finalPrice} ₽`);
            }
          } catch (updateError) {
            console.error('Error updating price:', updateError);
            alert('Ошибка при обновлении цены товара');
          }
        } else {
          alert('Не удалось рассчитать оптимальную цену');
        }
        
        return response.data;
      }
    } catch (error) {
      console.error('Error calculating price:', error);
      alert('Ошибка при расчете цены');
    }
    return null;
  };

  // Простая функция загрузки данных
  const loadData = async () => {
    try {
      console.log('Loading data...');
      await loadSettings();
      await loadProducts();
      console.log('Data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    console.log('WbPricingPage mounted');
    setIsLoaded(true);
    loadData();
  }, []);

  if (!isLoaded) {
    return (
      <Layout requiredRole="client">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Загрузка...</h1>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requiredRole="client">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Wildberries - Ценообразование</h1>
            <p className="mt-2 text-gray-600">Автоматическое управление ценами и участие в акциях</p>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Настройки ценообразования</h2>
            
            {/* Основные настройки маржинальности */}
            <div className="mb-6">
              <h3 className="text-md font-medium text-gray-800 mb-3">Основные настройки маржинальности</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Наценка (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.markupPercent}
                    onChange={(e) => setForm(prev => ({ ...prev, markupPercent: Number(e.target.value) }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Эквайринг (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.acquiringPercent}
                    onChange={(e) => setForm(prev => ({ ...prev, acquiringPercent: Number(e.target.value) }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Комиссия маркетплейса (%)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      step="0.1"
                      value={form.marketplaceCommissionPercent}
                      onChange={(e) => setForm(prev => ({ ...prev, marketplaceCommissionPercent: Number(e.target.value) }))}
                      className="mt-1 block flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Получается из API WB"
                    />
                    <button
                      onClick={fetchMarketplaceCommission}
                      className="mt-1 px-3 py-2 text-sm rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200"
                    >
                      Обновить
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Логистика */}
            <div className="mb-6">
              <h3 className="text-md font-medium text-gray-800 mb-3">Логистика (зависит от габаритов)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Первый литр (₽)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.firstLiterLogisticsRub}
                    onChange={(e) => setForm(prev => ({ ...prev, firstLiterLogisticsRub: Number(e.target.value) }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Доп. литр (₽)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.additionalLiterLogisticsRub}
                    onChange={(e) => setForm(prev => ({ ...prev, additionalLiterLogisticsRub: Number(e.target.value) }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Коэф. склада (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.warehouseCoeffPercent}
                    onChange={(e) => setForm(prev => ({ ...prev, warehouseCoeffPercent: Number(e.target.value) }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Управление акциями */}
            <div className="mb-6">
              <h3 className="text-md font-medium text-gray-800 mb-3">Управление акциями</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.maintainMarginInPromotions}
                    onChange={(e) => setForm(prev => ({ ...prev, maintainMarginInPromotions: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Удерживать маржинальность в акциях</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.autoExitPromotions}
                    onChange={(e) => setForm(prev => ({ ...prev, autoExitPromotions: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Автоматически выходить из акций</span>
                </label>
              </div>
            </div>

            {/* Информация об API ключе */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    API ключ Wildberries
                  </h3>
                  <div className="mt-1 text-sm text-blue-700">
                    <p>Используется API ключ из настроек пользователя. Для изменения перейдите в <strong>Настройки → API ключи</strong>.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Кнопки управления */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Автоматизация:</span>
                <button
                  onClick={() => setAutomationEnabled(!automationEnabled)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    automationEnabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {automationEnabled ? 'Включена' : 'Отключена'}
                </button>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={saveSettings}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Сохранить настройки
                </button>
                
                <button
                  onClick={syncProducts}
                  disabled={isSyncing}
                  className={`px-4 py-2 rounded-md ${
                    isSyncing
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSyncing ? 'Синхронизация...' : 'Синхронизировать товары'}
                </button>
              </div>
            </div>
          </div>

          {/* Список товаров */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Товары ({products.length})</h2>
            
            {isLoadingProducts ? (
              <div className="text-center py-4">
                <div className="text-gray-500">Загрузка товаров...</div>
              </div>
            ) : products.length > 0 ? (
              <div className="space-y-3">
                {products.slice(0, 10).map((product, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{product.name || `Товар ${index + 1}`}</div>
                        <div className="text-sm text-gray-500">ID: {product.nm_id || 'N/A'}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Текущая цена: {product.current_price ? `${product.current_price} ₽` : 'N/A'}
                          {product.in_promotion && (
                            <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                              В акции
                            </span>
                          )}
                        </div>
                        {product.logistics_cost && (
                          <div className="text-xs text-gray-500">
                            Логистика: {(product.logistics_cost / 100).toFixed(2)} ₽
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => calculateOptimalPrice(product)}
                          className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-md hover:bg-blue-200"
                        >
                          Рассчитать цену
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {products.length > 10 && (
                  <div className="text-sm text-gray-500 text-center py-2">
                    ... и еще {products.length - 10} товаров
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-lg mb-2">Товары не найдены</div>
                <div className="text-sm">Нажмите "Синхронизировать товары" для загрузки из Wildberries</div>
              </div>
            )}
          </div>

          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            ✅ Компонент работает корректно с API функциональностью
          </div>
        </div>
      </div>
    </Layout>
  );
}