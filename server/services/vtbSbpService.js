const axios = require('axios');
const crypto = require('crypto');

class VtbSbpService {
  constructor() {
    this.baseUrl = process.env.VTB_SBP_BASE_URL || 'https://sandbox.vtb.ru/integration/api/rest';
    this.merchantId = process.env.VTB_MERCHANT_ID;
    this.userName = process.env.VTB_USER_NAME;
    this.password = process.env.VTB_PASSWORD;
    this.token = process.env.VTB_TOKEN;
    this.privateKey = process.env.VTB_PRIVATE_KEY;
    this.publicKey = process.env.VTB_PUBLIC_KEY;
    this.secretKey = process.env.VTB_SECRET_KEY;
  }

  /**
   * Создание заказа для СБП платежа
   * @param {Object} orderData - Данные заказа
   * @param {string} orderData.orderNumber - Номер заказа
   * @param {number} orderData.amount - Сумма в копейках
   * @param {string} orderData.description - Описание заказа
   * @param {string} orderData.returnUrl - URL для возврата
   * @param {string} orderData.failUrl - URL при ошибке
   * @param {string} orderData.notificationUrl - URL для уведомлений
   * @returns {Object} Результат создания заказа
   */
  async createOrder(orderData) {
    try {
      const {
        orderNumber,
        amount,
        description,
        returnUrl,
        failUrl,
        notificationUrl
      } = orderData;

      const requestData = {
        userName: this.userName,
        password: this.password,
        orderNumber,
        amount,
        description,
        returnUrl,
        failUrl,
        notificationUrl,
        language: 'ru',
        currency: '643', // RUB
        sessionTimeoutSecs: 1200, // 20 минут
        bindingId: null,
        features: 'AUTO_PAYMENT'
      };

      // Удаляем пустые поля
      Object.keys(requestData).forEach(key => {
        if (requestData[key] === null || requestData[key] === undefined) {
          delete requestData[key];
        }
      });

      const response = await axios.post(`${this.baseUrl}/register.do`, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return this.parseResponse(response.data);
    } catch (error) {
      console.error('VTB SBP createOrder error:', error.response?.data || error.message);
      throw new Error(`Ошибка создания СБП заказа: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  /**
   * Получение QR-кода для оплаты по СБП
   * @param {string} orderId - ID заказа
   * @returns {Object} Данные QR-кода
   */
  async getQrCode(orderId) {
    try {
      const requestData = {
        userName: this.userName,
        password: this.password,
        orderId
      };

      const response = await axios.post(`${this.baseUrl}/getSbpQrCode.do`, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return this.parseResponse(response.data);
    } catch (error) {
      console.error('VTB SBP getQrCode error:', error.response?.data || error.message);
      throw new Error(`Ошибка получения QR-кода: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  /**
   * Получение статуса СБП платежа
   * @param {string} orderId - ID заказа
   * @returns {Object} Статус платежа
   */
  async getPaymentStatus(orderId) {
    try {
      const requestData = {
        userName: this.userName,
        password: this.password,
        orderId
      };

      const response = await axios.post(`${this.baseUrl}/getSbpStatus.do`, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return this.parseResponse(response.data);
    } catch (error) {
      console.error('VTB SBP getPaymentStatus error:', error.response?.data || error.message);
      throw new Error(`Ошибка получения статуса: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  /**
   * Отклонение СБП платежа
   * @param {string} orderId - ID заказа
   * @returns {Object} Результат отклонения
   */
  async declinePayment(orderId) {
    try {
      const requestData = {
        userName: this.userName,
        password: this.password,
        orderId
      };

      const response = await axios.post(`${this.baseUrl}/declineSbpPayment.do`, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return this.parseResponse(response.data);
    } catch (error) {
      console.error('VTB SBP declinePayment error:', error.response?.data || error.message);
      throw new Error(`Ошибка отклонения платежа: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  /**
   * Создание статического QR-кода для оплаты СБП
   * @param {Object} qrData - Данные для QR-кода
   * @param {string} qrData.merchantId - ID мерчанта
   * @param {string} qrData.merchantName - Название мерчанта
   * @param {string} qrData.merchantCity - Город мерчанта
   * @param {string} qrData.merchantCategoryCode - Код категории
   * @param {string} qrData.merchantTerminalId - ID терминала
     * @param {string} qrData.merchantTerminalId - ID терминала
   * @returns {Object} Данные статического QR-кода
   */
  async createStaticQrCode(qrData) {
    try {
      const {
        merchantId,
        merchantName,
        merchantCity,
        merchantCategoryCode,
        merchantTerminalId
      } = qrData;

      const requestData = {
        userName: this.userName,
        password: this.password,
        merchantId,
        merchantName,
        merchantCity,
        merchantCategoryCode,
        merchantTerminalId
      };

      const response = await axios.post(`${this.baseUrl}/createStaticQrCode.do`, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return this.parseResponse(response.data);
    } catch (error) {
      console.error('VTB SBP createStaticQrCode error:', error.response?.data || error.message);
      throw new Error(`Ошибка создания статического QR-кода: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  /**
   * Проверка подписи уведомления
   * @param {Object} notificationData - Данные уведомления
   * @param {string} signature - Подпись
   * @returns {boolean} Результат проверки
   */
  verifyNotificationSignature(notificationData, signature) {
    try {
      if (this.secretKey) {
        // Симметричная криптография
        return this.verifyHmacSignature(notificationData, signature);
      } else if (this.publicKey) {
        // Асимметричная криптография
        return this.verifyRsaSignature(notificationData, signature);
      }
      return false;
    } catch (error) {
      console.error('VTB SBP signature verification error:', error);
      return false;
    }
  }

  /**
   * Проверка HMAC подписи
   * @param {Object} data - Данные для проверки
   * @param {string} signature - Подпись
   * @returns {boolean} Результат проверки
   */
  verifyHmacSignature(data, signature) {
    try {
      // Формируем строку для подписи
      const dataString = this.buildDataString(data);
      
      // Вычисляем HMAC
      const hmac = crypto.createHmac('sha256', this.secretKey);
      hmac.update(dataString);
      const computedSignature = hmac.digest('hex');
      
      return computedSignature.toLowerCase() === signature.toLowerCase();
    } catch (error) {
      console.error('HMAC signature verification error:', error);
      return false;
    }
  }

  /**
   * Проверка RSA подписи
   * @param {Object} data - Данные для проверки
   * @param {string} signature - Подпись
   * @returns {boolean} Результат проверки
   */
  verifyRsaSignature(data, signature) {
    try {
      // Формируем строку для подписи
      const dataString = this.buildDataString(data);
      
      // Декодируем подпись из hex
      const signatureBuffer = Buffer.from(signature, 'hex');
      
      // Создаем объект для проверки подписи
      const verify = crypto.createVerify('sha512');
      verify.update(dataString);
      
      // Проверяем подпись
      return verify.verify(this.publicKey, signatureBuffer);
    } catch (error) {
      console.error('RSA signature verification error:', error);
      return false;
    }
  }

  /**
   * Формирование строки данных для подписи
   * @param {Object} data - Данные
   * @returns {string} Строка для подписи
   */
  buildDataString(data) {
    const fields = [
      'amount', 'mdOrder', 'operation', 'orderNumber', 'status'
    ];
    
    const parts = [];
    fields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        parts.push(`${field};${data[field]};`);
      }
    });
    
    return parts.join('');
  }

  /**
   * Парсинг ответа от API
   * @param {string} responseData - Ответ от API
   * @returns {Object} Распарсенные данные
   */
  parseResponse(responseData) {
    try {
      // VTB API возвращает данные в формате key=value&key2=value2
      const params = new URLSearchParams(responseData);
      const result = {};
      
      for (const [key, value] of params) {
        result[key] = value;
      }
      
      return result;
    } catch (error) {
      console.error('VTB SBP parseResponse error:', error);
      return { error: 'Ошибка парсинга ответа' };
    }
  }

  /**
   * Создание платежной ссылки для СБП
   * @param {Object} paymentData - Данные платежа
   * @returns {Object} Результат создания платежа
   */
  async createSbpPayment(paymentData) {
    try {
      // Сначала создаем заказ
      const orderResult = await this.createOrder({
        orderNumber: paymentData.orderNumber,
        amount: paymentData.amount,
        description: paymentData.description,
        returnUrl: paymentData.returnUrl,
        failUrl: paymentData.failUrl,
        notificationUrl: paymentData.notificationUrl
      });

      if (orderResult.errorCode !== '0') {
        throw new Error(orderResult.errorMessage || 'Ошибка создания заказа');
      }

      // Получаем QR-код
      const qrResult = await this.getQrCode(orderResult.orderId);

      if (qrResult.errorCode !== '0') {
        throw new Error(qrResult.errorMessage || 'Ошибка получения QR-кода');
      }

      return {
        success: true,
        orderId: orderResult.orderId,
        orderNumber: orderResult.orderNumber,
        qrCode: qrResult.qrCode,
        qrCodeUrl: qrResult.qrCodeUrl,
        paymentUrl: orderResult.formUrl,
        amount: paymentData.amount,
        status: 'pending'
      };
    } catch (error) {
      console.error('VTB SBP createSbpPayment error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Проверка статуса платежа
   * @param {string} orderId - ID заказа
   * @returns {Object} Статус платежа
   */
  async checkPaymentStatus(orderId) {
    try {
      const statusResult = await this.getPaymentStatus(orderId);
      
      if (statusResult.errorCode !== '0') {
        return {
          success: false,
          error: statusResult.errorMessage || 'Ошибка получения статуса'
        };
      }

      return {
        success: true,
        orderId: statusResult.orderId,
        status: statusResult.status,
        amount: statusResult.amount,
        operation: statusResult.operation
      };
    } catch (error) {
      console.error('VTB SBP checkPaymentStatus error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new VtbSbpService();


