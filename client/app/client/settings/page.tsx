'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { 
  UserIcon,
  BuildingOfficeIcon,
  KeyIcon,
  CogIcon
} from '@heroicons/react/24/outline';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  inn: string;
  address: string;
}

interface ApiKeysFormData {
  wildberries: {
    api_key: string;
  };
  ozon: {
    api_key: string;
    client_id: string;
  };
  yandex_market: {
    api_key: string;
    business_id?: string | number;
    warehouse_id?: string | number;
  };
  sima_land: {
    token: string;
  };
}

export default function ClientSettingsPage() {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeysFormData>({
    wildberries: { api_key: '' },
    ozon: { api_key: '', client_id: '' },
    yandex_market: { api_key: '', business_id: undefined, warehouse_id: undefined },
    sima_land: { token: '' }
  });

  const { register: registerProfile, handleSubmit: handleProfileSubmit, setValue: setProfileValue } = useForm<ProfileFormData>();
  const { register: registerApiKeys, handleSubmit: handleApiKeysSubmit, setValue: setApiKeysValue } = useForm<ApiKeysFormData>();

  useEffect(() => {
    if (user) {
      setProfileValue('firstName', user.firstName || '');
      setProfileValue('lastName', user.lastName || '');
      setProfileValue('phone', user.phone || '');
      setProfileValue('companyName', user.companyName || '');
      setProfileValue('inn', user.inn || '');
      setProfileValue('address', user.address || '');
    }
  }, [user, setProfileValue]);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      console.log('Fetching API keys...');
      const response = await api.get('/client/api-keys');
      console.log('Raw response:', response.data);
      const keys = response.data.apiKeys || {};
      
      console.log('Fetched API keys:', keys); // Для отладки
      
      // Устанавливаем пустые значения по умолчанию
      const defaultKeys = {
        wildberries: { api_key: '' },
        ozon: { api_key: '', client_id: '' },
        yandex_market: { api_key: '', business_id: '', warehouse_id: '' },
        sima_land: { token: '' }
      };
      
      // Объединяем с полученными данными, но только если они не пустые
      const mergedKeys = {
        wildberries: (keys.wildberries?.api_key && keys.wildberries.api_key.trim() !== '') ? keys.wildberries : defaultKeys.wildberries,
        ozon: (keys.ozon?.api_key && keys.ozon.api_key.trim() !== '') ? keys.ozon : defaultKeys.ozon,
        yandex_market: (keys.yandex_market?.api_key && keys.yandex_market.api_key.trim() !== '') ? keys.yandex_market : defaultKeys.yandex_market,
        sima_land: (keys.sima_land?.token && keys.sima_land.token.trim() !== '') ? keys.sima_land : defaultKeys.sima_land
      };
      
      console.log('Merged API keys:', mergedKeys); // Для отладки
      
      setApiKeys(mergedKeys);
      setApiKeysValue('wildberries', mergedKeys.wildberries);
      setApiKeysValue('ozon', mergedKeys.ozon);
      setApiKeysValue('yandex_market', mergedKeys.yandex_market);
      setApiKeysValue('sima_land', mergedKeys.sima_land);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      // В случае ошибки устанавливаем пустые значения
      const emptyKeys = {
        wildberries: { api_key: '' },
        ozon: { api_key: '', client_id: '' },
        yandex_market: { api_key: '' },
        sima_land: { token: '' }
      };
      setApiKeys(emptyKeys);
      setApiKeysValue('wildberries', emptyKeys.wildberries);
      setApiKeysValue('ozon', emptyKeys.ozon);
      setApiKeysValue('yandex_market', emptyKeys.yandex_market);
      setApiKeysValue('sima_land', emptyKeys.sima_land);
    }
  };

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      await updateProfile(data);
      toast.success('Профиль обновлен успешно');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onApiKeysSubmit = async (data: ApiKeysFormData) => {
    setIsLoading(true);
    try {
      await api.put('/client/api-keys', data);
      toast.success('API ключи обновлены успешно');
      // Обновляем локальное состояние после успешного сохранения
      setApiKeys(data);
    } catch (error: any) {
      toast.error('Ошибка обновления API ключей');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySubmit = async (marketplace: string, data: any) => {
    setIsLoading(true);
    try {
      await api.put('/client/api-keys', { [marketplace]: data });
      toast.success(`API ключ ${marketplace} обновлен успешно`);
      // Обновляем локальное состояние
      setApiKeys(prev => ({
        ...prev,
        [marketplace]: data
      }));
    } catch (error: any) {
      toast.error(`Ошибка обновления API ключа ${marketplace}`);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Профиль', icon: UserIcon },
    { id: 'company', name: 'Компания', icon: BuildingOfficeIcon },
    { id: 'api', name: 'API ключи', icon: KeyIcon },
  ];

  return (
    <Layout requiredRole="client">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
          <p className="mt-1 text-sm text-gray-600">
            Управление профилем и настройками интеграций
          </p>
        </div>

        <div className="flex space-x-8">
          {/* Боковое меню */}
          <div className="w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === tab.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-5 h-5 mr-3" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Контент */}
          <div className="flex-1">
            {activeTab === 'profile' && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Личная информация</h3>
                </div>
                <div className="card-body">
                  <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label className="label">Имя *</label>
                        <input
                          {...registerProfile('firstName', { required: 'Имя обязательно' })}
                          type="text"
                          className="input"
                          placeholder="Введите ваше имя"
                        />
                      </div>
                      <div>
                        <label className="label">Фамилия *</label>
                        <input
                          {...registerProfile('lastName', { required: 'Фамилия обязательна' })}
                          type="text"
                          className="input"
                          placeholder="Введите вашу фамилию"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Телефон</label>
                      <input
                        {...registerProfile('phone')}
                        type="tel"
                        className="input"
                        placeholder="+7 (999) 123-45-67"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary"
                      >
                        {isLoading ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'company' && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Информация о компании</h3>
                </div>
                <div className="card-body">
                  <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-6">
                    <div>
                      <label className="label">Название компании</label>
                      <input
                        {...registerProfile('companyName')}
                        type="text"
                        className="input"
                        placeholder="Введите название компании"
                      />
                    </div>

                    <div>
                      <label className="label">ИНН</label>
                      <input
                        {...registerProfile('inn')}
                        type="text"
                        className="input"
                        placeholder="Введите ИНН"
                        maxLength={12}
                      />
                    </div>

                    <div>
                      <label className="label">Адрес</label>
                      <textarea
                        {...registerProfile('address')}
                        rows={3}
                        className="input"
                        placeholder="Введите адрес компании"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary"
                      >
                        {isLoading ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="space-y-6">
                {/* Wildberries */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">Wildberries</h3>
                    <p className="text-sm text-gray-500">Настройка интеграции с Wildberries</p>
                  </div>
                  <div className="card-body">
                    <div className="space-y-4">
                      <div>
                        <label className="label">API ключ</label>
                        <input
                          {...registerApiKeys('wildberries.api_key')}
                          type="password"
                          className="input"
                          placeholder="Введите API ключ Wildberries"
                          autoComplete="new-password"
                          value={apiKeys.wildberries?.api_key || ''}
                          onChange={(e) => {
                            setApiKeys(prev => ({
                              ...prev,
                              wildberries: { ...prev.wildberries, api_key: e.target.value }
                            }));
                          }}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Получите API ключ в личном кабинете Wildberries
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleApiKeySubmit('wildberries', apiKeys.wildberries)}
                          disabled={isLoading}
                          className="btn-primary"
                        >
                          {isLoading ? 'Сохранение...' : 'Сохранить Wildberries'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ozon */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">Ozon</h3>
                    <p className="text-sm text-gray-500">Настройка интеграции с Ozon</p>
                  </div>
                  <div className="card-body">
                    <div className="space-y-4">
                      <div>
                        <label className="label">API ключ</label>
                        <input
                          {...registerApiKeys('ozon.api_key')}
                          type="password"
                          className="input"
                          placeholder="Введите API ключ Ozon"
                          autoComplete="new-password"
                          value={apiKeys.ozon?.api_key || ''}
                          onChange={(e) => {
                            setApiKeys(prev => ({
                              ...prev,
                              ozon: { ...prev.ozon, api_key: e.target.value }
                            }));
                          }}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Получите API ключ в личном кабинете Ozon
                        </p>
                      </div>
                      <div>
                        <label className="label">Client ID</label>
                        <input
                          {...registerApiKeys('ozon.client_id')}
                          type="text"
                          className="input"
                          placeholder="Введите Client ID Ozon"
                          autoComplete="off"
                          value={apiKeys.ozon?.client_id || ''}
                          onChange={(e) => {
                            setApiKeys(prev => ({
                              ...prev,
                              ozon: { ...prev.ozon, client_id: e.target.value }
                            }));
                          }}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Получите Client ID в личном кабинете Ozon
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleApiKeySubmit('ozon', apiKeys.ozon)}
                          disabled={isLoading}
                          className="btn-primary"
                        >
                          {isLoading ? 'Сохранение...' : 'Сохранить Ozon'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Яндекс.Маркет */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">Яндекс.Маркет</h3>
                    <p className="text-sm text-gray-500">Настройка интеграции с Яндекс.Маркет</p>
                  </div>
                  <div className="card-body">
                    <div className="space-y-4">
                      <div>
                        <label className="label">API ключ</label>
                        <input
                          {...registerApiKeys('yandex_market.api_key')}
                          type="password"
                          className="input"
                          placeholder="Введите API ключ Яндекс.Маркет"
                          autoComplete="new-password"
                          value={apiKeys.yandex_market?.api_key || ''}
                          onChange={(e) => {
                            setApiKeys(prev => ({
                              ...prev,
                              yandex_market: { ...prev.yandex_market, api_key: e.target.value }
                            }));
                          }}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Получите API ключ в личном кабинете Яндекс.Маркет
                        </p>
                      </div>
                      <div>
                        <label className="label">Business ID</label>
                        <input
                          {...registerApiKeys('yandex_market.business_id')}
                          type="text"
                          className="input"
                          placeholder="Введите Business ID Яндекс.Маркет"
                          autoComplete="off"
                          value={(apiKeys.yandex_market?.business_id as any) || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setApiKeys(prev => ({
                              ...prev,
                              yandex_market: { ...prev.yandex_market, business_id: val }
                            }));
                          }}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Идентификатор бизнеса/кабинета в Яндекс.Маркет
                        </p>
                      </div>
                      <div>
                        <label className="label">Warehouse ID</label>
                        <input
                          {...registerApiKeys('yandex_market.warehouse_id')}
                          type="text"
                          className="input"
                          placeholder="Введите Warehouse ID Яндекс.Маркет"
                          autoComplete="off"
                          value={(apiKeys.yandex_market?.warehouse_id as any) || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setApiKeys(prev => ({
                              ...prev,
                              yandex_market: { ...prev.yandex_market, warehouse_id: val }
                            }));
                          }}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          ID склада для передачи остатков (обязательно)
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleApiKeySubmit('yandex_market', apiKeys.yandex_market)}
                          disabled={isLoading}
                          className="btn-primary"
                        >
                          {isLoading ? 'Сохранение...' : 'Сохранить Яндекс.Маркет'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sima-land: скрываем для конкретного пользователя */}
                {user?.email !== 'test+deposit@example.com' && (
                  <div className="card">
                    <div className="card-header">
                      <h3 className="text-lg font-medium text-gray-900">СИМА ЛЕНД</h3>
                      <p className="text-sm text-gray-500">Настройка интеграции с поставщиком СИМА ЛЕНД</p>
                    </div>
                    <div className="card-body">
                      <div className="space-y-4">
                        <div>
                          <label className="label">Токен API</label>
                          <input
                            {...registerApiKeys('sima_land.token')}
                            type="password"
                            className="input"
                            placeholder="Введите токен API СИМА ЛЕНД"
                            autoComplete="new-password"
                            value={apiKeys.sima_land?.token || ''}
                            onChange={(e) => {
                              setApiKeys(prev => ({
                                ...prev,
                                sima_land: { ...prev.sima_land, token: e.target.value }
                              }));
                            }}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Получите API токен в личном кабинете на сайте sima-land.ru
                          </p>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleApiKeySubmit('sima_land', apiKeys.sima_land)}
                            disabled={isLoading}
                            className="btn-primary"
                          >
                            {isLoading ? 'Сохранение...' : 'Сохранить СИМА ЛЕНД'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}


