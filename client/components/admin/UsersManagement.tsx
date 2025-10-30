'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  created_at: string;
  company_name?: string;
  inn?: string;
  address?: string;
}

interface UserStats {
  totalOrders: number;
  totalAmount: number;
  currentBalance: number;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Состояние для создания оператора
  const [showCreateOperatorModal, setShowCreateOperatorModal] = useState(false);
  const [createOperatorLoading, setCreateOperatorLoading] = useState(false);
  const [operatorForm, setOperatorForm] = useState({
    firstName: '',
    lastName: ''
  });
  const [createdCredentials, setCreatedCredentials] = useState<{login: string, password: string} | null>(null);

  // Состояние для удаления пользователя
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [page, searchTerm, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('role', roleFilter);

      const response = await api.get(`/admin/users?${params}`);
      setUsers(response.data.users);
      setTotalPages(response.data.pagination.totalPages);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: number) => {
    try {
      const response = await api.get(`/admin/users/${userId}`);
      setSelectedUser(response.data.user);
      setUserStats(response.data.stats);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка загрузки данных пользователя');
    }
  };

  const toggleUserStatus = async (userId: number, isActive: boolean) => {
    try {
      setActionLoading(true);
      await api.put(`/admin/users/${userId}/status`, { isActive });
      toast.success(`Пользователь ${isActive ? 'активирован' : 'заблокирован'}`);
      fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_active: isActive } : null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка изменения статуса');
    } finally {
      setActionLoading(false);
    }
  };

  const createOperator = async () => {
    if (!operatorForm.firstName || !operatorForm.lastName) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    setCreateOperatorLoading(true);
    try {
      const response = await api.post('/admin/users/operator', operatorForm);
      setCreatedCredentials(response.data.credentials);
      toast.success('Оператор успешно создан');
      setOperatorForm({ firstName: '', lastName: '' });
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка создания оператора');
    } finally {
      setCreateOperatorLoading(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const deleteUser = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);
    try {
      await api.delete(`/admin/users/${userToDelete.id}`);
      toast.success(`Пользователь ${userToDelete.first_name} ${userToDelete.last_name} успешно удален`);
      setShowDeleteModal(false);
      setUserToDelete(null);
      
      // Если удаляемый пользователь был выбран, сбрасываем выбор
      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null);
        setUserStats(null);
      }
      
      await fetchUsers(); // Обновляем список пользователей
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка удаления пользователя');
    } finally {
      setDeleteLoading(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Пароль должен содержать минимум 8 символов');
      return;
    }

    try {
      setActionLoading(true);
      await api.put(`/admin/users/${selectedUser?.id}/password`, {
        newPassword,
        confirmPassword
      });
      toast.success('Пароль успешно изменен');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка смены пароля');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'client': return 'Клиент';
      case 'operator': return 'Оператор';
      case 'admin': return 'Администратор';
      default: return role;
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {isActive ? 'Активен' : 'Заблокирован'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
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
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Управление пользователями</h2>
            <p className="text-gray-600">Просмотр и управление пользователями системы</p>
          </div>
          <button
            onClick={() => setShowCreateOperatorModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + Создать оператора
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Поиск по email, имени или компании..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все роли</option>
          <option value="client">Клиенты</option>
          <option value="operator">Операторы</option>
          <option value="admin">Администраторы</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Список пользователей</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    selectedUser?.id === user.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => fetchUserDetails(user.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                          {user.company_name && (
                            <p className="text-xs text-gray-400">{user.company_name}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">{getRoleLabel(user.role)}</span>
                      {getStatusBadge(user.is_active)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Назад
                </button>
                <span className="text-sm text-gray-700">
                  Страница {page} из {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="lg:col-span-1">
          {selectedUser ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Детали пользователя</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Имя</label>
                  <p className="text-sm text-gray-900">{selectedUser.first_name} {selectedUser.last_name}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm text-gray-900">{selectedUser.email}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Телефон</label>
                  <p className="text-sm text-gray-900">{selectedUser.phone}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Роль</label>
                  <p className="text-sm text-gray-900">{getRoleLabel(selectedUser.role)}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Статус</label>
                  <div className="mt-1">{getStatusBadge(selectedUser.is_active)}</div>
                </div>

                {selectedUser.company_name && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Компания</label>
                    <p className="text-sm text-gray-900">{selectedUser.company_name}</p>
                  </div>
                )}

                {selectedUser.inn && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">ИНН</label>
                    <p className="text-sm text-gray-900">{selectedUser.inn}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500">Дата регистрации</label>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedUser.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>

                {/* Statistics for clients */}
                {selectedUser.role === 'client' && userStats && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Статистика</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Заказов:</span>
                        <span className="text-xs font-medium text-gray-900">{userStats.totalOrders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Сумма заказов:</span>
                        <span className="text-xs font-medium text-gray-900">
                          {new Intl.NumberFormat('ru-RU', {
                            style: 'currency',
                            currency: 'RUB'
                          }).format(userStats.totalAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Баланс:</span>
                        <span className="text-xs font-medium text-gray-900">
                          {new Intl.NumberFormat('ru-RU', {
                            style: 'currency',
                            currency: 'RUB'
                          }).format(userStats.currentBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <button
                    onClick={() => toggleUserStatus(selectedUser.id, !selectedUser.is_active)}
                    disabled={actionLoading}
                    className={`w-full px-3 py-2 text-sm font-medium rounded-md ${
                      selectedUser.is_active
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    } disabled:opacity-50`}
                  >
                    {selectedUser.is_active ? 'Заблокировать' : 'Активировать'}
                  </button>
                  
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
                  >
                    Сменить пароль
                  </button>

                  {selectedUser.role !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(selectedUser)}
                      className="w-full px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                    >
                      Удалить пользователя
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <p className="text-gray-500">Выберите пользователя для просмотра деталей</p>
            </div>
          )}
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Смена пароля</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Новый пароль</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Минимум 8 символов"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Подтверждение пароля</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Повторите пароль"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  onClick={changePassword}
                  disabled={actionLoading || !newPassword || !confirmPassword}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания оператора */}
      {showCreateOperatorModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Создание оператора</h3>
              {createdCredentials ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-green-800 mb-2">Оператор создан успешно!</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Логин:</span>
                        <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-sm">
                          {createdCredentials.login}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Пароль:</span>
                        <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-sm">
                          {createdCredentials.password}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Сохраните эти данные! Они больше не будут показаны.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Имя *
                      </label>
                      <input
                        type="text"
                        value={operatorForm.firstName}
                        onChange={(e) => setOperatorForm(prev => ({ ...prev, firstName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Иван"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Фамилия *
                      </label>
                      <input
                        type="text"
                        value={operatorForm.lastName}
                        onChange={(e) => setOperatorForm(prev => ({ ...prev, lastName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Иванов"
                      />
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      Система автоматически сгенерирует логин и пароль для оператора.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                {createdCredentials ? (
                  <button
                    onClick={() => {
                      setShowCreateOperatorModal(false);
                      setCreatedCredentials(null);
                      setOperatorForm({ firstName: '', lastName: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Закрыть
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setShowCreateOperatorModal(false);
                        setOperatorForm({ firstName: '', lastName: '' });
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={createOperator}
                      disabled={createOperatorLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {createOperatorLoading ? 'Создание...' : 'Создать оператора'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Подтверждение удаления
              </h3>
              
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 mb-2">
                  Вы уверены, что хотите удалить пользователя?
                </p>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="font-medium text-gray-900">
                    {userToDelete.first_name} {userToDelete.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{userToDelete.email}</p>
                  <p className="text-xs text-gray-400">{getRoleLabel(userToDelete.role)}</p>
                </div>
                <p className="text-xs text-red-600 mt-2">
                  ⚠️ Это действие нельзя отменить
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                  }}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={deleteUser}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

