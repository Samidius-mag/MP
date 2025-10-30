'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface LogEntry {
  id: number;
  level: string;
  message: string;
  service?: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  metadata?: any;
  created_at: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  component?: string;
  action?: string;
  url?: string;
}

interface LogsResponse {
  logs: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<'server' | 'client'>('server');
  const [filters, setFilters] = useState({
    level: '',
    service: '',
    userId: '',
    component: '',
    action: '',
    startDate: '',
    endDate: ''
  });
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [logType, pagination.page, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(`/admin/logs/${logType}?${params}`);
      const data: LogsResponse = response.data;
      
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      error: 'bg-red-100 text-red-800',
      warn: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
      debug: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[level as keyof typeof colors] || colors.debug}`}>
        {level.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const truncateMessage = (message: string, maxLength: number = 100) => {
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      level: '',
      service: '',
      userId: '',
      component: '',
      action: '',
      startDate: '',
      endDate: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Просмотр логов</h2>
        <p className="text-gray-600">Мониторинг активности системы и пользователей</p>
      </div>

      {/* Log Type Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setLogType('server')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                logType === 'server'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Логи сервера
            </button>
            <button
              onClick={() => setLogType('client')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                logType === 'client'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Логи клиента
            </button>
          </nav>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Уровень</label>
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Все уровни</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          {logType === 'server' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Сервис</label>
              <input
                type="text"
                value={filters.service}
                onChange={(e) => handleFilterChange('service', e.target.value)}
                placeholder="auth, orders, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {logType === 'client' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Компонент</label>
                <input
                  type="text"
                  value={filters.component}
                  onChange={(e) => handleFilterChange('component', e.target.value)}
                  placeholder="Component name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Действие</label>
                <input
                  type="text"
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  placeholder="User action"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID пользователя</label>
            <input
              type="number"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              placeholder="User ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата с</label>
            <input
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата по</label>
            <input
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Очистить
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logs List */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Логи {logType === 'server' ? 'сервера' : 'клиента'} 
                ({pagination.total} записей)
              </h3>
            </div>
            
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    selectedLog?.id === log.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {getLevelBadge(log.level)}
                        {log.service && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {log.service}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mb-1">
                        {truncateMessage(log.message)}
                      </p>
                      {log.email && (
                        <p className="text-xs text-gray-500">
                          Пользователь: {log.email} ({log.first_name} {log.last_name})
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={!pagination.hasPrev}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Назад
                </button>
                <span className="text-sm text-gray-700">
                  Страница {pagination.page} из {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!pagination.hasNext}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Log Details */}
        <div className="lg:col-span-1">
          {selectedLog ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Детали лога</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Уровень</label>
                  <div className="mt-1">{getLevelBadge(selectedLog.level)}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Сообщение</label>
                  <p className="text-sm text-gray-900 mt-1 break-words">{selectedLog.message}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Время</label>
                  <p className="text-sm text-gray-900 mt-1">{formatDate(selectedLog.created_at)}</p>
                </div>

                {selectedLog.service && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Сервис</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedLog.service}</p>
                  </div>
                )}

                {selectedLog.component && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Компонент</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedLog.component}</p>
                  </div>
                )}

                {selectedLog.action && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Действие</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedLog.action}</p>
                  </div>
                )}

                {selectedLog.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Пользователь</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedLog.email} ({selectedLog.first_name} {selectedLog.last_name})
                    </p>
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">IP адрес</label>
                    <p className="text-sm text-gray-900 mt-1 font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}

                {selectedLog.request_id && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID запроса</label>
                    <p className="text-sm text-gray-900 mt-1 font-mono">{selectedLog.request_id}</p>
                  </div>
                )}

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Метаданные</label>
                    <pre className="text-xs text-gray-900 mt-1 bg-gray-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <p className="text-gray-500">Выберите лог для просмотра деталей</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}





