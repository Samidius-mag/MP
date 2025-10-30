'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  CreditCardIcon, 
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';

interface Deposit {
  id: number;
  amount: number;
  balance_before: number;
  balance_after: number;
  transaction_type: string;
  description: string;
  payment_method: string;
  status: string;
  created_at: string;
}

export default function DepositPage() {
  const [balance, setBalance] = useState<number>(0);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('sbp');
  const [isDepositing, setIsDepositing] = useState(false);
  const [showSbpModal, setShowSbpModal] = useState(false);
  const [sbpData, setSbpData] = useState<any>(null);
  const [sbpStatus, setSbpStatus] = useState<string>('pending');

  useEffect(() => {
    fetchDepositData();
  }, []);

  const fetchDepositData = async () => {
    try {
      const [balanceResponse, depositsResponse] = await Promise.all([
        api.get('/client/balance'),
        api.get('/client/deposits?limit=20')
      ]);

      setBalance(balanceResponse.data.balance);
      setDeposits(depositsResponse.data.deposits);
    } catch (error) {
      console.error('Error fetching deposit data:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    setIsDepositing(true);
    try {
      const response = await api.post('/payment/deposit', {
        amount: parseFloat(depositAmount),
        payment_method: paymentMethod
      });

      const { paymentUrl, invoiceFile } = response.data;
      
      if (paymentUrl) {
        if (paymentUrl.type === 'bank_transfer') {
          // Показываем реквизиты для банковского перевода
          toast.success('Реквизиты для перевода отправлены на email');
          console.log('Bank transfer details:', paymentUrl.details);
        } else if (paymentUrl.type === 'sbp') {
          // Обрабатываем СБП платеж
          if (paymentUrl.qrCode) {
            // Показываем QR-код для оплаты
            setShowSbpModal(true);
            setSbpData({
              qrCode: paymentUrl.qrCode,
              qrCodeUrl: paymentUrl.qrCodeUrl,
              paymentUrl: paymentUrl.paymentUrl,
              orderId: paymentUrl.orderId,
              amount: paymentUrl.amount
            });
          } else if (paymentUrl.paymentUrl) {
            // Открываем страницу оплаты
            window.open(paymentUrl.paymentUrl, '_blank');
          } else if (paymentUrl.error) {
            toast.error(paymentUrl.error);
          }
        } else {
          // Открываем страницу оплаты
          window.open(paymentUrl.url, '_blank');
        }
      }

      // Если есть PDF счет, предлагаем скачать
      if (invoiceFile) {
        toast.success('PDF счет сгенерирован. Вы можете скачать его ниже.');
      }

      setShowDepositForm(false);
      setDepositAmount('');
      toast.success('Платеж создан успешно');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка создания платежа');
    } finally {
      setIsDepositing(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownTrayIcon className="h-5 w-5 text-green-600" />;
      case 'withdrawal':
        return <ArrowUpTrayIcon className="h-5 w-5 text-red-600" />;
      case 'order_payment':
        return <CreditCardIcon className="h-5 w-5 text-blue-600" />;
      default:
        return <CreditCardIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'Пополнение';
      case 'withdrawal':
        return 'Списание';
      case 'order_payment':
        return 'Оплата заказа';
      default:
        return type;
    }
  };

  // Проверка статуса СБП платежа
  const checkSbpStatus = async (orderId: string) => {
    try {
      const response = await api.get(`/payment/sbp-status/${orderId}`);
      const { status, localStatus } = response.data;
      
      setSbpStatus(status);
      
      if (status === '1' && localStatus === 'completed') {
        toast.success('Платеж успешно завершен!');
        setShowSbpModal(false);
        fetchDepositData(); // Обновляем данные
      } else if (status === '2' || status === '3') {
        toast.error('Платеж отклонен или отменен');
        setShowSbpModal(false);
      }
    } catch (error) {
      console.error('Error checking SBP status:', error);
    }
  };

  // Автоматическая проверка статуса СБП
  useEffect(() => {
    if (showSbpModal && sbpData?.orderId) {
      const interval = setInterval(() => {
        checkSbpStatus(sbpData.orderId);
      }, 5000); // Проверяем каждые 5 секунд

      return () => clearInterval(interval);
    }
  }, [showSbpModal, sbpData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="badge-success">Завершено</span>;
      case 'pending':
        return <span className="badge-warning">Ожидает</span>;
      case 'failed':
        return <span className="badge-danger">Ошибка</span>;
      default:
        return <span className="badge-gray">{status}</span>;
    }
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Депозит</h1>
            <p className="mt-1 text-sm text-gray-600">
              Управление балансом и история операций
            </p>
          </div>
          <button
            onClick={() => setShowDepositForm(true)}
            className="btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Пополнить
          </button>
        </div>

        {/* Текущий баланс */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Текущий баланс</h3>
                <p className="text-3xl font-bold text-primary-600">
                  {balance.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Доступно для заказов</p>
                <p className="text-lg font-semibold text-gray-900">
                  {balance.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Форма пополнения */}
        {showDepositForm && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Пополнить депозит</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                  <label className="label">Сумма пополнения</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="input"
                    placeholder="Введите сумму"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="label">Способ оплаты</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="input"
                  >
                    <option value="sbp">СБП</option>
                    <option value="yukassa">ЮKassa</option>
                    <option value="tinkoff">Тинькофф</option>
                    <option value="bank_transfer">Банковский перевод</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDepositForm(false)}
                    className="btn-secondary"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isDepositing}
                    className="btn-primary"
                  >
                    {isDepositing ? 'Создание...' : 'Создать платеж'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* История операций */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">История операций</h3>
          </div>
          <div className="card-body">
            {deposits.length > 0 ? (
              <div className="space-y-4">
                {deposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {getTransactionIcon(deposit.transaction_type)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {getTransactionLabel(deposit.transaction_type)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {deposit.description}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(deposit.created_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        deposit.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {deposit.amount > 0 ? '+' : ''}{deposit.amount.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-xs text-gray-500">
                        Баланс: {deposit.balance_after.toLocaleString('ru-RU')} ₽
                      </p>
                      <div className="mt-1">
                        {getStatusBadge(deposit.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Нет операций</h3>
                <p className="mt-1 text-sm text-gray-500">
                  История операций с депозитом появится здесь.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно СБП */}
      {showSbpModal && sbpData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Оплата через СБП</h3>
              <button
                onClick={() => setShowSbpModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Отсканируйте QR-код в приложении вашего банка для оплаты
              </p>
              
              <div className="mb-4">
                <p className="text-2xl font-bold text-gray-900 mb-2">
                  {sbpData.amount} ₽
                </p>
                <p className="text-sm text-gray-500">
                  ID заказа: {sbpData.orderId}
                </p>
              </div>

              {sbpData.qrCode && (
                <div className="mb-4">
                  <img 
                    src={sbpData.qrCodeUrl || `data:image/png;base64,${sbpData.qrCode}`}
                    alt="QR код для оплаты"
                    className="mx-auto border border-gray-200 rounded"
                    style={{ width: '200px', height: '200px' }}
                  />
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Статус:</p>
                <div className="flex items-center justify-center">
                  {sbpStatus === 'pending' && (
                    <div className="flex items-center text-yellow-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                      Ожидание оплаты...
                    </div>
                  )}
                  {sbpStatus === '1' && (
                    <div className="flex items-center text-green-600">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Оплачено
                    </div>
                  )}
                  {(sbpStatus === '2' || sbpStatus === '3') && (
                    <div className="flex items-center text-red-600">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Отклонено
                    </div>
                  )}
                </div>
              </div>

              {sbpData.paymentUrl && (
                <div className="mb-4">
                  <a
                    href={sbpData.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Открыть в браузере
                  </a>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => checkSbpStatus(sbpData.orderId)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Проверить статус
                </button>
                <button
                  onClick={() => setShowSbpModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}






